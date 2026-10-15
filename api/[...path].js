'use strict';

const applicationHandler = require('../server');

module.exports = (request, response) => applicationHandler(request, response);
