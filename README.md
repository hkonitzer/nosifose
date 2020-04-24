# nosifose
NodeJS Simple Forms Server

Configure your web form and via text-file and nosifose provide an iframe 
with your form. The according get/post routes are created and the form 
can be processed (submitted) in the browser.
 
Intended for use with ghost-cms and a mail-service to implement 
contact-formular with double-opt-in logic.

Based on ExpressJS

Features:
+ Standalone or as module usable (for extended functionality you have to boot your own server and import nosifose as express app)
+ Forms can be configured as HTML using Handlebars as template engine.
+ Form validation included (via express-validator)
+ Rate limiting included (via rate-limiter-flexible)
+ CORS available (via cors)
+ reCAPTCHA service V3 can be integrated, results are provided for your callback function 
+ Unlimited forms available via routes

Not included:
+ Backend for your forms or any other logic. Functionality has to be implemented with own Javascript-Functions (callbacks)

Perquisites:
+ NodeJS V10+
+ Redis (for session handling and rate limiter service)

## Deploy options

## Configuration

### Logging

## Forms

### Callbacks 

# Copyright & License

MIT

Copyright (c) 2020 Hendrik Schellenberger

