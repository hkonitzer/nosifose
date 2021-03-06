const express = require('express');
const router = express.Router();
const log = require('../lib/logging');

// Init CSRF
const Csrf = require('csurf');
const csrfProtection = Csrf({cookie: false});
// Validator
const {check, validationResult, matchedData} = require('express-validator');
const {checkSchema} = require('express-validator');
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

const redirect = (req, res, url, urlParams = null, responseCode = 303) => {
    if (urlParams !== null) {
        let  queryParamArray = [];
        for (let responseURLParamsObjectKey in urlParams) {
            queryParamArray.push(`${responseURLParamsObjectKey}=${urlParams[responseURLParamsObjectKey]}`);
        }
        const queryParamString = '?' + queryParamArray.join('&');
        url+=queryParamString;
    }
    return res.redirect(responseCode, url);
}

const buildAndSendResponse = (req, res, htmlTemplate, handleBarsInput = {}, responseCode = 200) => {
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
    // Init
    let getMiddlewares = new Array(), postMiddlewares = new Array();
    const schemaLocation = path.join(path.resolve('.'), SCHEMA_FOLDER_PATH, schemaFiles[s]);
    log.debug(`Loading schema "${schemaLocation}`)
    const schema = require(schemaLocation);
    const endpoint = '/' + schemaFiles[s].substring(0, schemaFiles[s].lastIndexOf('.'));
    log.debug(`Installing endpoint "${endpoint}"`);
    // Prepare reCAPTACHA
    let recaptcha;
    if (schema.recaptcha) {
        recaptcha = new Recaptcha(
            schema.recaptcha.site_key, // SITE KEY
            schema.recaptcha.secret_key, // SECRET KEY
            {
                callback: 'rccb'
                , action: endpoint.substring(1)
                //,onload: 'rcol'
            });
        getMiddlewares.push(recaptcha.middleware.render);
        postMiddlewares.push(recaptcha.middleware.render);
    }
    // Load options from schema
    const schemaOptions = schema.options || { "csrf": false };
    const useCSRF = (schemaOptions.csrf === true);
    // Prepare HTML
    const markup = schema.markup;
    const formHtmlTemplate = Handlebars.compile(markup.formHtml);
    // Either html response or an url
    let responseHtmlTemplate = null;
    let responseURL = null;
    // Has the schema an query params object defined? Use this, but beware: If the callback function provides this
    // object (responseURLParamsObject), it will be used in favor of the schema definition
    const responseURLParamsObjectFromSchema = typeof markup.responseURLParamsObject === 'object' ? markup.responseURLParamsObject : null;
    if (typeof markup.responseHtml === 'string') {
        log.debug(`Using HTML for the response`);
        responseHtmlTemplate = Handlebars.compile(markup.responseHtml);
    } else {
        log.debug(`Using URL "${markup.responseURL}" for the response`);
        responseURL = markup.responseURL;
    }
    const handleBarsInput = markup.variables;
    // require the given callback
    log.debug(`Requiring callback "${schema.callback}"`)
    const callback = require(path.join(path.resolve('.'), schema.callback));

    // GET
    if (useCSRF) {
        getMiddlewares.push(csrfProtection);
    }
    router.get(endpoint, getMiddlewares, (req, res) => {
        return buildAndSendResponse(req, res, formHtmlTemplate, handleBarsInput)
    });

    // POST
    if (useCSRF) {
        postMiddlewares.push(csrfProtection);
    }
    postMiddlewares.push(checkSchema(schema.definition));
    router.post(endpoint, postMiddlewares, (req, res) => {
        const errors = validationResult(req);
        const data = handleBarsInput;
        data.formData = req.body;
        if (!errors.isEmpty()) {
            if (responseHtmlTemplate) {
                data.errors = errors.array();
                return buildAndSendResponse(req, res, formHtmlTemplate, data, 400);
            } else {
                return redirect(req,
                    res,
                    responseURL,
                    typeof callbackData.responseURLParamsObject === 'object' ? callbackData.responseURLParamsObject : responseURLParamsObjectFromSchema,
                    400);
            }
        }
        // get reCAPTCHA response (error or data with score)
        // build a function for with promises for this
        let recaptchaPromiseFunction = (req) => {
            return new Promise((resolve, reject) => {
                if (recaptcha) {
                    recaptcha.verify(req, (error, data) => {
                        let rcData = {};
                        rcData.error = error; // we dont not react on reCAPTCHA errors, transfer them to the callback and handle any errors there -> so no reject() here
                        rcData.data = data; // will be something like: { hostname: 'localhost', score: 0.9, action: 'contact' }
                        resolve(rcData);
                    });
                } else {
                    resolve({error: null, data: null}) // resolve empty recaptcha answer, because its not configured
                }
            }) ;
        };
        recaptchaPromiseFunction(req).then((rcData) => {
            return callback(matchedData(req), rcData);
        }).then((callbackData) => {
            if (responseHtmlTemplate) {
                // Add the given object from the callback function to the template data
                data.callbackData = callbackData;
                return buildAndSendResponse(req, res, responseHtmlTemplate, data, 201);
            } else {
                return redirect(req,
                    res,
                    responseURL,
                    typeof callbackData.responseURLParamsObject === 'object' ? callbackData.responseURLParamsObject : responseURLParamsObjectFromSchema);
            }
        });
    });
}

module.exports = router;

