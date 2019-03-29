const 
	boom = require('boom'),
	{asyncMiddleware, log} = require('./util'),
	network = require('../network')

module.exports.create = asyncMiddleware(async(req, res) => {

	const userId = req.body.userId
	if (!userId) {
		throw boom.badRequest('"userId" is not specified in request body')
	}

	const user = await network.user(userId).create();

	res.json(user)
})


module.exports.getCredentials = asyncMiddleware(async(req, res) => {
	const userId = req.params.userId
	const user = {
		username: userId,
		password: await network.user(userId).getPassword()
	}
	res.send(user)
})


module.exports.disable = asyncMiddleware(async(req, res) => {
	const userId = req.params.userId
	if (!userId) {
		throw boom.badRequest('Required parameter "userId" is not specified')
	}

	const status = await network.user(userId).disable()

	res.json({success: status})
})


module.exports.getCaptiveCredentials = asyncMiddleware(async(req, res) => {

	const userId = req.params.userId
	const accessPointId = req.params.accessPointId
	const challenge = req.params.challenge

	const response = await network.user(userId).getCaptiveResponse(accessPointId, challenge)

	res.json({
		userId: userId,
		accessPointId: accessPointId,
		challenge: challenge,
		response: response
	})
})