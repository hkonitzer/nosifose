const express = require('express');
const router = express.Router();
const config = require('../lib/config');

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: config.get('name'), version: config.get('version') });
});

module.exports = router;
