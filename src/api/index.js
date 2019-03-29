const 
	express = require('express'),
	bodyParser = require('body-parser'),
	boom = require('boom'),
	{log, logReqRes, asyncMiddleware} = require('./util'),
	accessPoints = require('./access-points'),
	users = require('./users'),
	security = require('./security'),
	sessions = require('./sessions'),
	network = require('../network')

const app = module.exports = express()
app.use(bodyParser.json())
app.use(logReqRes)

// Get network status
app.get('/', asyncMiddleware(async(req, res) => {
	res.send({
		running: true,
		status: await network.status()
	})
}))

// Access points
app.post('/access-points', accessPoints.create)
app.post('/access-points/:accessPointId/tasks/reboot', accessPoints.reboot)
app.post('/access-points/:accessPointId/tasks/setSsid', accessPoints.setSsid)
app.post('/access-points/:accessPointId/kill', accessPoints.kill)
app.post('/access-points/:accessPointId/tasks/isolate', accessPoints.isolateClient)
app.post('/access-points/:accessPointId/connection-status/:status', accessPoints.setConnectionStatus)

// Security routes
app.get('/access-points/:accessPointId/security', security.getParams)
app.patch('/access-points/:accessPointId/security', security.setParams)
app.post('/access-points/:accessPointId/security', security.executeAction)
app.get('/access-points/:accessPointId/security/report', security.reportEvents)

// Users
app.post('/users', users.create)
app.post('/users/:userId/disable', users.disable)
app.get('/users/:userId', users.getCredentials)
app.get('/users/:userId/captiveCredentials/:accessPointId/:challenge', users.getCaptiveCredentials)

// Sessions
app.post('/sessions/:sessionId', sessions.check)

// 404 handler
app.use(function(req, res, next){
	throw boom.notFound('Resource not found')
});

// Error handler
app.use((err, req, res, next) => {
	if (err.isServer) {
		log.error(err)
  	}
  	return res.status(err.output.statusCode).json(err.output.payload);
})
