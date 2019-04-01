
/*
	Simple access point data storage
*/

const redis = require('../redis'),
	  log = require('../log')('apdb'),
	  SET_ACCESS_POINTS_ONLINE = 'access-points:online',
	  ACCESS_POINT_KEY = accessPointId => `access-point:${accessPointId}`

// Find access point data
function find(accessPointId) {
	return redis.pget(ACCESS_POINT_KEY(accessPointId)).then((accessPoint) => accessPoint ? JSON.parse(accessPoint) : null)
}

// Add new access point data
function add(accessPoint) {
	log.debug('adding ap data to db: %O', accessPoint)
	return redis.pset(ACCESS_POINT_KEY(accessPoint.accessPointId), JSON.stringify(accessPoint))
}

// Mark access point online
function markOnline(accessPointId) {
	return redis.psadd(SET_ACCESS_POINTS_ONLINE, accessPointId)
}

// Mark access point offline
function markOffline(accessPointId) {
	return redis.psrem(SET_ACCESS_POINTS_ONLINE, accessPointId)
}

// Reset access point online data
function resetOnline() {
	return redis.pdel(SET_ACCESS_POINTS_ONLINE)
}

// Get access point ids that are currently online
function getOnline() {
	return redis.psmembers(SET_ACCESS_POINTS_ONLINE)
}

module.exports = { find, add, markOffline, markOnline, getOnline, resetOnline }