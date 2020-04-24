const redis = require('redis');
const log = require('../../lib/logging');
const {RateLimiterRedis} = require('rate-limiter-flexible');

const REQUEST_LIMIT_EXCEEDED_ERROR_CODE = 'REQUEST_LIMIT_EXCEEDED';

module.exports = (config) => {

    config.defaults({
        'redis': {
            host: 'localhost',
            port: 6379
        },
        'ratelimiter': {
            points: 10, // number of requests
            duration: 10, // per 10 seconds from a ip-address
            blockDuration: 0
        }
    });

    const redisClient = redis.createClient({
        host: config.get('redis:host'),
        port: config.get('redis:port'),
        enable_offline_queue: false,
    });

    redisClient.on('error', (err) => {
        log.error(err);
        process.exit(1);
    });
    redisClient.on('ready', (connD) => {
        log.debug(`Redis RateLimiter connected on host ${config.get('redis:host')}:${config.get('redis:port')}`);
    });

    const rateLimiterPoints = config.get('ratelimiter:points');

    const rateLimiterRedis = new RateLimiterRedis({
        storeClient: redisClient,
        redis: redisClient,
        keyPrefix: 'nosifose',
        points: rateLimiterPoints, // Anzahl requests
        duration: config.get('ratelimiter:duration'), // pro X Sekunden per IP-Adresse
        blockDuration: config.get('ratelimiter:blockDuration')
    });
    log.debug(`Ratelimiter initalized with ${rateLimiterPoints} points per ${config.get('ratelimiter:duration')} second(s)`);

    const setRateLimiterHeaders = (res, rateLimiterResponse) => {
        res.setHeader('X-RateLimit-Limit' ,rateLimiterPoints);
        res.setHeader('X-RateLimit-Remaining', rateLimiterResponse.remainingPoints);
        res.setHeader('X-RateLimit-Reset', new Date(Date.now() + rateLimiterResponse.msBeforeNext));
    };

    const rateLimiterMiddleware = (req, res, next) => {
        rateLimiterRedis.consume(req.ip)
            .then((rateLimiterResponse) => {
                setRateLimiterHeaders(res, rateLimiterResponse);
                next();
            })
            .catch((rateLimiterResponse) => {
                setRateLimiterHeaders(res, rateLimiterResponse);
                res.setHeader('Retry-After', rateLimiterResponse.msBeforeNext / 1000);
                res.status(429).send(`Error: ${REQUEST_LIMIT_EXCEEDED_ERROR_CODE} - Too much requests from your ip`);
                log.debug(`${req.ip} exceeded api rate limit`);
            });
    };

    return rateLimiterMiddleware;
}