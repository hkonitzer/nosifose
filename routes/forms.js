const express = require('express');
const router = express.Router();
const log = require('../lib/logging');
// Init CSRF
const csrf = require('csurf');
const csrfProtection = csrf({ cookie: false });

const { check, validationResult, matchedData } = require('express-validator');
const { checkSchema } = require('express-validator');

// read all schemas
const fs = require('fs');
const path = require('path');
const FOLDER_PATH = './schemas';
const schemaFiles = fs.readdirSync(FOLDER_PATH).filter(fileName => {
  return fs.lstatSync(path.join(FOLDER_PATH, fileName)).isFile() && fileName.endsWith('js');
});

if (schemaFiles.length) {
  log.debug(`${schemaFiles.length} schema file(s) found`);
} else {
  log.error(`No schema files found in directory "${FOLDER_PATH}"!`);
  process.exit(1);
}

const buildAndSendResponse = function(req, res, html) {
  let _html = `<html><head></head><body><form method="post" action="${req.originalUrl}">${html}<input type="hidden" name="_csrf" value="${req.csrfToken()}"></form></body></html>`;
  res.set('Content-Type', 'text/html');
  return res.status(200).send(_html);
};

for (let s in schemaFiles) {
  const schema = require(path.join(__dirname, '..', FOLDER_PATH, schemaFiles[s]));
  const endpoint = '/' + schemaFiles[s].substring(0, schemaFiles[s].lastIndexOf('.'));
  log.debug(`Installing endpoint "${endpoint}"`);

  // built form
  let html = `<!--start ${endpoint} -->`;
  for (let name in schema.markup) {
    //console.log(name, schema.markup[name])
    html+=`<label for="${name}">${schema.markup[name].label}</label>`
    html+=`<input type="${schema.markup[name].type}" id="${name}" name="${name}">`;
  }
  html += `<button type="submit">Submit</button>`;
  html += `<!--end ${endpoint} -->`;

  // GET
  router.get(endpoint, csrfProtection, (req, res) => buildAndSendResponse(req, res, html));
  // POST
  router.post(endpoint, checkSchema(schema.definition), csrfProtection, (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // @TODO: SEND HTML!
      return res.status(400).send({
        data: req.body,
        errors: errors.array(),
        errorMap: errors.mapped()
      });
    }

    const data = matchedData(req);
    console.log('Sanitized: ', data)
    // @TODO: send sanitized data in an email or persist in a db

    return res.status(201).send({
      data: data,
      errors: null,
      errorMap: null
    });
  });

}

module.exports = router;
