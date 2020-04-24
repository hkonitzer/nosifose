const express = require('express');
const router = express.Router();
const log = require('../lib/logging');
const config = require('../lib/config');
// Init CSRF
const Csrf = require('csurf');
const csrfProtection = Csrf({ cookie: false });
// Validator
const { check, validationResult, matchedData } = require('express-validator');
const { checkSchema } = require('express-validator');
// Templating
const Handlebars = require('handlebars');
// Init reCAPTCHA
const Recaptcha = require('express-recaptcha').RecaptchaV3;

// read all schemas
const fs = require('fs');
const path = require('path');
const SCHEMA_FOLDER_PATH = './schemas';
const schemaFiles = fs.readdirSync(SCHEMA_FOLDER_PATH).filter(fileName => {
  return fs.lstatSync(path.join(SCHEMA_FOLDER_PATH, fileName)).isFile() && fileName.endsWith('js');
});

if (schemaFiles.length) {
  log.debug(`${schemaFiles.length} schema file(s) found`);
} else {
  log.error(`No schema files found in directory "${SCHEMA_FOLDER_PATH}"!`);
  process.exit(1);
}

const buildAndSendResponse = function(req, res, htmlTemplate, handleBarsInput = {}, responseCode = 200) {
  res.set('Content-Type', 'text/html');
  const data = handleBarsInput;
  data.csrfToken = req.csrfToken();
  data.recaptcha = res.recaptcha || '';
  // formData
  data.formData = req.body || {};
  delete data.formData._csrf;
  return res.status(responseCode).send(htmlTemplate(data));
};

for (let s in schemaFiles) {
  const schemaLocation = path.join(path.resolve('.'), SCHEMA_FOLDER_PATH, schemaFiles[s]);
  log.debug(`Loading schema "${schemaLocation}`)
  const schema = require(schemaLocation);
  const endpoint = '/' + schemaFiles[s].substring(0, schemaFiles[s].lastIndexOf('.'));
  log.debug(`Installing endpoint "${endpoint}"`);
  // Prepare reCAPTACHA
  const recaptcha = new Recaptcha(
      config.get('recaptcha').site_key, // SITE KEY
      config.get('recaptcha').secret_key, // SECRET KEY
      {
        callback: 'rccb'
        ,action: endpoint.substring(1)
        //,onload: 'rcol'
      });
  // Prepare HTML
  const markup = schema.markup;
  const formHtmlTemplate = Handlebars.compile(markup.formHtml);
  const responseHtmlTemplate = Handlebars.compile(markup.responseHtml);
  const handleBarsInput = markup.variables;
  // require the given callback
  log.debug(`Requiring callback "${schema.callback}"`)
  const callback = require(path.join(path.resolve('.'), schema.callback));

  // GET
  router.get(endpoint, csrfProtection, recaptcha.middleware.render, (req, res) => {
    return buildAndSendResponse(req, res, formHtmlTemplate, handleBarsInput)
  });

  // POST
  router.post(endpoint, checkSchema(schema.definition), csrfProtection, recaptcha.middleware.render, (req, res) => {
    const errors = validationResult(req);
    const data = handleBarsInput;
    data.formData = req.body;
    if (!errors.isEmpty()) {
      data.errors = errors.array();
      return buildAndSendResponse(req, res, formHtmlTemplate, data,400);
    }
    // get reCAPTCHA response (error or data with score)
    const rcData = { error: null, data: null };
    recaptcha.verify(req, function(error, data){
      rcData.error = error; // we dont not react on reCAPTCHA errors, transfer them to the callback and handle any errors there
      rcData.data = data; // will be something like: { hostname: 'localhost', score: 0.9, action: 'contact' }
    });
    // @TODO: check callback return value for errors
    callback(matchedData(req), rcData);
    return buildAndSendResponse(req, res, responseHtmlTemplate, data,201);
  });
}

module.exports = router;

