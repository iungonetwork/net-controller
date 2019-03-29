const 
	boom = require('boom'),
	{asyncMiddleware, log} = require('./util'),
	network = require('../network')

module.exports.create = asyncMiddleware(async(req, res) => {
	// TODO validate accessPointId
	// TODO check for duplicate id
	const accessPointId = req.body.accessPointId

	// TODO validate macAddress
	const macAddress = req.body.macAddress
	
	if (!accessPointId) {
		throw boom.badRequest('"accessPointId" is not specified in request body')
	}

	if (!macAddress) {
		throw boom.badRequest('"macAddress" is not specified in request body')
	}

	const accessPoint = await network.accessPoint(accessPointId).create(macAddress);

	res.json(accessPoint)
})

module.exports.reboot = asyncMiddleware(async(req, res, next) => {
	const accessPointId = req.params.accessPointId
	if (!accessPointId) {
		throw boom.badRequest('Required parameter "accessPointId" is not specified')
	}

	// convert connectivity error to 410 error
	let status = null;
	try	{
		status = await network.accessPoint(accessPointId).reboot();
	} catch(err) {
		if (err.code == 'OFFLINE') {
			next(boom.boomify(err, {statusCode: 410}))
		}
		throw err
	}

	res.json({success: status})
})

module.exports.setSsid = asyncMiddleware(async(req, res, next) => {

	const accessPointId = req.params.accessPointId
	if (!accessPointId) {
		throw boom.badRequest('Required parameter "accessPointId" is not specified')
	}

	const ssid = req.body.ssid
	// TODO validate SSID
	if (!ssid) {
		throw boom.badRequest('"ssid" is not specified in request body')
	}

	// convert connectivity error to 410 error
	let status = null;
	try	{
		status = await network.accessPoint(accessPointId).setSsid(ssid);
	} catch(err) {
		if (err.code == 'OFFLINE') {
			next(boom.boomify(err, {statusCode: 410}))
		}
		throw err
	}

	res.json({success: status})
})

module.exports.kill = asyncMiddleware(async(req, res) => {
	const accessPointId = req.params.accessPointId
	if (!accessPointId) {
		throw boom.badRequest('Required parameter "accessPointId" is not specified')
	}

	const status = await network.accessPoint(accessPointId).kill();

	res.send({success: status})
})

module.exports.isolateClient = asyncMiddleware(async(req, res) => {
	const accessPointId = req.params.accessPointId
	if (!accessPointId) {
		throw boom.badRequest('Required parameter "accessPointId" is not specified')
	}

	const ipAddress = req.body.ipAddress
	if (!ipAddress) {
		throw boom.badRequest('"ipAddress" is not specified in request body')
	}

	const status = await network.accessPoint(accessPointId).isolateClient(ipAddress, '12 hours');

	res.send({success: status})
})

module.exports.setConnectionStatus = asyncMiddleware(async(req, res) => {
	const accessPointId = req.params.accessPointId
	if (!accessPointId) {
		throw boom.badRequest('Required parameter "accessPointId" is not specified')
	}

	network.accessPoint(accessPointId).setConnected(req.params.status == 'connect');

	res.send({success: 1})
})