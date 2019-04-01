/*
	Access point address pool manager
*/

const Netmask = require('netmask').Netmask
	  redis = require('../redis'),
	  iprange = require('iprange'),
	  NAMESPACE = process.env.IUNGO_NET_POOL_NAMESPACE || 'pool',
	  _set = (name) => NAMESPACE + ':' + name,
	  log = require('../log')('pool')

/*
	Get IP addess from the pool
*/
async function pop() {
	const address = await redis.pspop(_set('available'))
	await redis.psadd(_set('used'), address)
	return address
}

/*
	Check if pool is initialized
*/
function isInit(val) {
	const key = NAMESPACE + ":net"
	if (val) {
		return redis.pset(key, val)
	} else {
		return redis.pget(key)
	}
}

/*
	Get available addressed in the pool
*/
function available() {
	return redis.psmembers(_set('available'))
}

/*
	Initialize pool
	Initialize the pool to given sub-net, excluding those matching exclude regexp.
	DEPRECATED: should be moved out of this module, should be a manual, "one-time" setup operation
*/
async function init(subnet, exclude) {

	log.debug('initializing IP pool in subnet %s excluding %s', subnet, exclude)
	await redis.pdel(_set('available'))
	await redis.pdel(_set('used'))
	await redis.pdel(NAMESPACE + ':net')

	const range = iprange(subnet)
	const bitmask = new Netmask(subnet).bitmask
	const pool = range.map(x => x + '/' + bitmask).filter(x => !exclude.test(x))

	await redis.psadd(_set('available'), pool)
	await isInit(subnet + ' excluding ' + exclude)

	return pool
}

/*
	Check status and init on startup
	DEPRECATED
*/
isInit().then(net => {
	if (net) {
		log.debug('Pool initialized to %s', net)
	} else {
		// TODO move to env
		return init(process.env.SIGNET, new RegExp(process.env.SIGNET_IP_POOL_EXCEPTION))
	}
}).then(async() => {
	const avail = await available()
	log.debug('Pool has %d address(-es) available', avail.length)
})

module.exports = { pop, init, isInit, available }