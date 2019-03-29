const redis = require('../redis'),
	  log = require('../log')('apdb'),
	  SET_ACCESS_POINTS_ONLINE = 'access-points:online',
	  ACCESS_POINT_KEY = accessPointId => `access-point:${accessPointId}`

function find(accessPointId) {
	return redis.pget(ACCESS_POINT_KEY(accessPointId)).then((accessPoint) => accessPoint ? JSON.parse(accessPoint) : null)
}

function add(accessPoint) {
	log.debug('adding ap data to db: %O', accessPoint)
	return redis.pset(ACCESS_POINT_KEY(accessPoint.accessPointId), JSON.stringify(accessPoint))
}

function markOnline(accessPointId) {
	return redis.psadd(SET_ACCESS_POINTS_ONLINE, accessPointId)
}

function markOffline(accessPointId) {
	return redis.psrem(SET_ACCESS_POINTS_ONLINE, accessPointId)
}

function resetOnline() {
	return redis.pdel(SET_ACCESS_POINTS_ONLINE)
}

function getOnline() {
	return redis.psmembers(SET_ACCESS_POINTS_ONLINE)
}

module.exports = { find, add, markOffline, markOnline, getOnline, resetOnline }