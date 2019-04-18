/*
	User related controllers.
*/

const 
	boom = require('boom'),
	{asyncMiddleware, log} = require('./util'),
	network = require('../network'),
	superagent = require('superagent'),
	DEFAULT_HOSTAPD_SESSION_TIMEOUT = 3600

/*
	Create network user
*/
module.exports.create = asyncMiddleware(async(req, res) => {

	const userId = req.body.userId
	if (!userId) {
		throw boom.badRequest('"userId" is not specified in request body')
	}

	const user = await network.user(userId).create();

	res.json(user)
})

/*
	Get user network access credentials.
*/
module.exports.getCredentials = asyncMiddleware(async(req, res) => {
	const userId = req.params.userId
	const user = {
		username: userId,
		password: await network.user(userId).getPassword()
	}
	res.send(user)
})

/*
	Disable user.
*/
module.exports.disable = asyncMiddleware(async(req, res) => {
	const userId = req.params.userId
	if (!userId) {
		throw boom.badRequest('Required parameter "userId" is not specified')
	}

	const status = await network.user(userId).disable()

	res.json({success: status})
})

/*
	Authorize user.
*/
module.exports.authorize = asyncMiddleware(async(req, res) => {

	const userId = req.body['User-Name']
	const accessPointId = req.body['NAS-Identifier']

	if (!(userId && accessPointId)) {
		res.json({})
		return
	}

	const chilliRequest = req.body['ChilliSpot-Version'] != ''

	superagent.post('http://core-api/v1/account/check')
  		.send({userId, accessPointId})
  		.end((err, result) => {

  			if (err) {
  				throw boom.badRequest('Failed to check user balance')
  			}

  			const bytesAvailable = result.body

  			if (bytesAvailable <= 0) {
  				// User account is empty, deny access
  				res.status(401).json({})
  			} else {
  				if (chilliRequest) {
  					res.json({'ChilliSpot-Max-Input-Octets': bytesAvailable})
  				} else {
  					res.json({'Session-Timeout': DEFAULT_HOSTAPD_SESSION_TIMEOUT})
  				}
  			}
  		})
})

/*
	Get captive credentials for user (it is also access point specific).
	This is related to Coova Chilli auth mechanism.
*/
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