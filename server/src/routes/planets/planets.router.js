const express = require('express');

const { httpGetAllPlanets } = require('./planets.handler');

const planetsRouter = express.Router();

planetsRouter.get(httpGetAllPlanets);

module.exports = planetsRouter;
