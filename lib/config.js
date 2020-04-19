'use strict';
const fs = require('fs'),
    nconf = require('nconf');
const config = nconf.argv().env();
nconf.use('settings', { type: 'file', file: __dirname + '/../settings.json' });
nconf.use('package', { type: 'file', file: __dirname + '/../package.json' });

module.exports = config;