const createError = require('http-errors');
const util = require('util');
const express = require('express');
const helmet = require('helmet')
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const session = require('express-session');
const redis = require('redis');
const RedisStore = require('connect-redis')(session);
const log = require('./lib/logging');

const formsRouter = require('./routes/forms');

const route = (config, app) => {
    if (!config) {
        log.error('You have to provide a config (as nconf object)');
        process.exit(2);
    }
    // Express standards
    app.use(express.json());
    app.use(express.urlencoded({extended: false}));
    app.use(cookieParser());

    // Helmet (security)
    app.use(helmet({
        frameguard: false // we use iframes here!
    }));

    // CORS config
    if (config.get('server')['cors'] && config.get('server')['cors'] === true) {
        log.debug(`Configure cors with origin ${config.get('server')['cors-origin']} `);
        const cors = require('cors');
        app.options('*', cors())
        app.use(cors({
            origin: config.get('server')['cors-origin'],
            allowedHeaders: ['Origin, X-Requested-With, Content-Type, Accept'],
            exposedHeaders: ['Content-Range', 'X-Content-Range']
        }));
    }
    // Init Sessionstore
    let redisClient = redis.createClient({
        port: config.get('redis').port,
        host: config.get('redis').host,
        family: config.get('redis').family,
        password: config.get('redis').password,
        db: config.get('redis').db,
        showFriendlyErrorStack: (app.get('env') === 'development')
    });
    redisClient.on('ready', function () {
        log.debug('Redis session store ready');
    });
    if (app.get('env') === 'production') {
        app.set('trust proxy', 1); // trust first proxy
    }
    app.use(session({
        cookie: config.get('session').cookie,
        store: new RedisStore({
            client: redisClient,
            prefix: 'session',
            db: config.get('redis').db,
            logErrors: (app.get('env') === 'development')
        }),
        secret: config.get('session').secret,
        saveUninitialized: true,
        resave: true
    }));

    if (app.get('env') === 'development') {
        let redisdebug = require('debug')(config.get('name') + ':redis');
        redisClient.monitor((err, res) => {
            if (err !== null) {
                log.error("Cannot enter redis monitor mode:", err);
            } else {
                log.debug("Enter redis monitoring mode: ", res);
            }
        });
        redisClient.on('monitor', (time, args, rawReply) => {
            redisdebug(time + ': ' + util.inspect(args));
        });
    }

    //RateLimiter
    if (app.get('env') !== 'development') {
        app.use(require('./routes/middleware/rateLimiterRedis')(config));
    }
    let path = config.get('server')['path'] || '/forms';
    log.debug(`Installing route under path ${path} `);
    app.use(path, formsRouter);

    return app;
}

const server = (config) => {
    if (!config) {
        log.error('You have to provide a config (as nconf object)');
        process.exit(2);
    }
    const app = express();
    // view engine setup
    app.set('views', path.join(__dirname, 'views'));
    app.set('view engine', 'ejs');

    if (app.get('env') === 'development') {
        app.use(logger('dev'));
    }

    // install the actual express route for the nosifose api
    route(config, app);

    // catch 404 and forward to error handler
    app.use(function (req, res, next) {
        next(createError(404));
    });

    // error handler
    app.use(function (err, req, res, next) {
        // set locals, only providing error in development
        res.locals.message = err.message;
        res.locals.error = req.app.get('env') === 'development' ? err : {};

        // render the error page
        res.status(err.status || 500);
        res.render('error');
    });
    return app;
}

module.exports = {
    server: server,
    route: route
};