const axios = require('axios');
const launches = require('./launches.mongo');
const planets = require('./planets.mongo');

const DEFAULT_FLIGHT_NUMBER = 100;
const SPACEX_API_URL = 'https://api.spacexdata.com/v4/launches/query';

async function populateLaunches() {
	console.log('Downloading launch data...');
	const response = await axios.post(SPACEX_API_URL, {
		query: {},
		options: {
			pagination: false,
			populate: [
				{
					path: 'rocket',
					select: {
						name: 1,
					},
				},
				{
					path: 'payloads',
					select: {
						customers: 1,
					},
				},
			],
		},
	});

	if (response.status) {
		console.log('Problem downloading launch data');
		throw new Error('Launch data downlaod failed');
	}

	const launchData = response.data.docs;
	for (const launchDoc of launchData) {
		const payloads = launchDoc['payloads'];
		const customers = payloads.flatMap((payload) => payload['customers']);

		const launch = {
			flightNumber: launchDoc['flight_number'],
			mission: launchDoc['name'],
			rocket: launchDoc['rocket']['name'],
			launchDate: launchDoc['date_local'],
			upcoming: launchDoc['upcoming'],
			success: launchDoc['success'],
			customers,
		};

		console.log(`${launch.flightNumber} ${launch.mission}`);
		await saveLaunch(launch);
	}
}

async function loadLaunchesData() {
	const firstLaunch = await findLaunch({
		flightNumber: 1,
		rocket: 'Falcon 1',
		mission: 'FalconSat',
	});

	if (firstLaunch) {
		console.log('Launch data already loaded');
		return;
	}

	populateLaunches();
}

async function findLaunch(filter) {
	return await launches.findOne(filter);
}

async function existsLaunchWithId(launchId) {
	return await findLaunch({ flightNumber: launchId });
}

async function getLatestFlightNumber() {
	const latestLaunch = await launches.findOne().sort('-flightNumber');

	if (!latestLaunch) {
		return DEFAULT_FLIGHT_NUMBER;
	}

	return latestLaunch.flightNumber;
}

async function abortLaunchWithId(launchId) {
	const aborted = await launches.updateOne(
		{
			flightNumber: launchId,
		},
		{
			upcoming: false,
			success: false,
		}
	);

	return aborted.modifiedCount === 1;
}

async function getAllLaunches(skip, limit) {
	return await launches
		.find(
			{},
			{
				_id: 0,
				__v: 0,
			}
		)
		.sort({ flightNumber: 1 })
		.skip(skip)
		.limit(limit);
}

async function saveLaunch(launch) {
	// update dengan flightNumber sebagai filter
	// kalau ga ada insert launch baru
	// perlu tambahan upsert
	await launches.findOneAndUpdate(
		{
			flightNumber: launch.flightNumber,
		},
		launch,
		{
			upsert: true,
		}
	);
}

async function scheduleNewLaunch(launch) {
	const planet = await planets.findOne({
		keplerName: launch.target,
	});

	if (!planet) {
		throw new Error('No matching planet was found');
	}

	const newFlightNumber = (await getLatestFlightNumber()) + 1;
	const newLaunch = Object.assign(launch, {
		success: true,
		upcoming: true,
		customers: ['ZTM', 'NASA'],
		flightNumber: newFlightNumber,
	});

	await saveLaunch(newLaunch);
}

module.exports = {
	loadLaunchesData,
	existsLaunchWithId,
	abortLaunchWithId,
	getAllLaunches,
	scheduleNewLaunch,
};
