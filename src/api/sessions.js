/*
	Session related controllers.
*/

const 
	boom = require('boom'),
	{asyncMiddleware, log} = require('./util'),
	raddb = require('../network/raddb')

const amqp = require('amqp-connection-manager')
const amqpUri = process.env.AMQP_URI || 'amqp://user:pass@rabbitmq:5672'
const amqpQueueName = process.env.AMQP_BILLING_QUEUE || 'billing-service'
const amqpConnection = amqp.connect([amqpUri])	
const amqpChannel = amqpConnection.createChannel({
 	json: true,
  	setup: channel => channel.assertQueue(amqpQueueName, {durable: true})
})

/*
	This is used by FreeRADIUS to report session state change.
	Session information is fetched from DB and if session is closed it is reported to accounting.
*/
module.exports.check = asyncMiddleware(async(req, res) => {
	log.debug('incoming session notification: %s', req.body)
	const sessionId = req.params.sessionId;

	log.debug('session %s update notification from radius', sessionId)

	// primitive means to overcome race condition when db row is updated after rest call
	log.debug('waiting 10s before fetching session %s data', sessionId)
	setTimeout(function() {
		log.debug('fetching session %s data', sessionId)
		raddb.getSession(sessionId).then(async(session) => {
			log.debug('fetched session %s data: %o', sessionId, session)
			if (session.acctstoptime) {
				log.debug('session %s stop time is defined, prepare message', sessionId)
				const msg = {
					userId: session.username,
					accessPointId: session.nasid,
					bytesIn: session.acctoutputoctets,
					bytesOut: session.acctinputoctets,
					bytesTotal: session.acctinputoctets + session.acctoutputoctets,
					startedAt: session.acctstarttime,
					stoppedAt: session.acctstoptime,
					duration: session.acctsessiontime,
					sessionId: sessionId
				}

				log.debug('sending msg %o to queue %s', msg, process.env.AMQP_QUEUE)
				amqpChannel.sendToQueue(amqpQueueName, msg, {contentType: 'application/json'}).then(_ => {
					log.debug('msg for session %s sent', sessionId)
				}).catch(err => {
					log.debug('could not send msg for session %s: %s', sessionId, err)
				})
			} else {
				console.log('session %s is still active, not taking action', sessionId);
			}

		}).catch(err => {
			log.debug('session %s data not available', sessionId)
		})
	}, 10000)

	res.send({"Acct-Session-Id": sessionId})
})