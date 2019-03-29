const Redis = require('redis'),
 	  redis = Redis.createClient({host: process.env.REDIS_HOST || 'redis'}),
 	  {promisify} = require('util'),
 	  toPromify = ['spop', 'scard', 'smembers', 'sadd', 'srem', 'get', 'set', 'del']

toPromify.forEach(e => {
	redis['p' + e] = promisify(redis[e]).bind(redis)
})

module.exports = redis