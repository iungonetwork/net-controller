const 
	boom = require('boom'),
	{asyncMiddleware, log} = require('./util'),
	network = require('../network')

module.exports.getParams = asyncMiddleware(async(req, res) => {
	const accessPointId = req.params.accessPointId
	if (!accessPointId) {
		throw boom.badRequest('Required parameter "accessPointId" is not specified')
	}
	res.send(await network.accessPoint(accessPointId).fetchSecuritySettings())
})

module.exports.setParams = asyncMiddleware(async(req, res) => {
	const accessPointId = req.params.accessPointId
	if (!accessPointId) {
		throw boom.badRequest('Required parameter "accessPointId" is not specified')
	}

	const settings = await network.accessPoint(accessPointId).fetchSecuritySettings()

	if (req.body.enabled == 0) {
		await network.accessPoint(accessPointId).disableSecurity()
	} else if(settings.enabled && req.body.options) {
		await network.accessPoint(accessPointId).enableSecurity(req.body.options)
	} else if(req.body.enabled == 1) {
		await network.accessPoint(accessPointId).enableSecurity(req.body.options || settings.options)
	}

	res.send(await network.accessPoint(accessPointId).fetchSecuritySettings())
})

module.exports.executeAction = asyncMiddleware(async(req, res) => {
	const accessPointId = req.params.accessPointId
	if (!accessPointId) {
		throw boom.badRequest('Required parameter "accessPointId" is not specified')
	}

	const action = req.body.action
	let result
	if (action == 'unblock') {
		result = {success: await network.accessPoint(accessPointId).unblock(req.body.ipAddress)}
	}

	res.send(result)
})

module.exports.reportEvents = asyncMiddleware(async(req, res) => {
	const accessPointId = req.params.accessPointId
	if (!accessPointId) {
		throw boom.badRequest('Required parameter "accessPointId" is not specified')
	}
	res.send(await network.accessPoint(accessPointId).getSecurityReport())
})