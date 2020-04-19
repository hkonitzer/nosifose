'use strict';
const config =  require('./config');
let loggingFunction = require('debug');
let info = loggingFunction(config.get('name') + ':app');
let error = loggingFunction(config.get('name') + ':error');
let debug = loggingFunction(config.get('name') + ':debug');
error.log = console.error.bind(console);
debug.log = console.info.bind(console);
info.log = console.log.bind(console);
let logging = {
    error: error,
    debug: debug,
    info: info
};

module.exports = logging;