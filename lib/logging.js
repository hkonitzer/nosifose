const loggingFunction = require('debug');
const info = loggingFunction('nosifose:app');
const error = loggingFunction('nosifose:error');
const debug = loggingFunction('nosifose:debug');
error.log = console.error.bind(console);
debug.log = console.info.bind(console);
info.log = console.log.bind(console);
const logging = {
    error: error,
    debug: debug,
    info: info
};

module.exports = logging;