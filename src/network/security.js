/*
	Security management API
	TODO/DEPRECATED: This should be moved to a separate service.
*/
module.exports = {startSecurityThreatProcessor, enableSecurity, disableSecurity, fetchSecuritySettings, getReport, unblockClientIp, blockClientIp}

const {accessPoint} = require('../network')
const log = require('../log')('security')
const amqp = require('amqp-connection-manager')
const raddb = require('./raddb')

const db = require('../mysql')('security')

const securityThreatQueue = 'security-threat'
const collector = process.env.SECURITY_COLLECTOR
const defaultOptions = {}
const events = {
	on: 'security-on',
	off: 'security-off',
	threat: 'threat',
	blocked: 'blocked',
	unblocked: 'unblocked'
}

/*
	Get security settings for access point
*/
function fetchSecuritySettings(accessPointId, settings) {
	return db.query('SELECT * FROM access_point_settings WHERE access_point_id = ?', [accessPointId]).then(result => {
		if (!result.length) {
			return {
				enabled: 0,
				options: defaultOptions
			}
		} else {
			return {
				enabled: result[0].enabled,
				options: JSON.parse(result[0].options)
			}
		}
	})
}

/*
	Get security event report
*/
function getReport(accessPointId, since, till) {

	const params = [
		accessPointId,
		since || '1970-01-01',
		till || new Date()
	]

	return db.query('SELECT * FROM event WHERE access_point_id = ? AND occurred_at BETWEEN ? AND ? ORDER BY occurred_at DESC', params).then(rows => {
		return rows.map(row => {
			row.details = JSON.parse(row.details)
			return row
		})
	})
}

/*
	Log security event
*/
function addLogEntry(accessPointId, type, details, occurredAt) {

	const params = [
		null,
		accessPointId,
		type,
		(occurredAt ? occurredAt : new Date()).toISOString().slice(0, 19).replace('T', ' '),
		details ? JSON.stringify(details) : '{}'
	]

	return db.query('INSERT INTO event (id, access_point_id, type, occurred_at, details) VALUES(?, ?, ?, ?, ?)', params)
}

/*
	Store security settings for access point
*/
function storeSecuritySettings(accessPointId, settings) {
	const options = JSON.stringify(settings.options || defaultOptions)
	const enabled = settings.enabled ? 1 : 0

	const params = [accessPointId, enabled, options, enabled, options]
	return db.query('INSERT INTO access_point_settings (access_point_id, enabled, options) VALUES(?, ?, ?) ON DUPLICATE KEY UPDATE enabled = ?, options = ?', params)
}

/*
	Enable access point security
*/
async function enableSecurity(accessPointId, options) {

	log.debug(`enabling security for ${accessPointId}`)
	const ap = accessPoint(accessPointId)

	let collectorSet, softflowdEnabled
	
	try	{
		collectorSet = await ap.run(`uci set softflowd.@softflowd[0].host_port="${collector}" && uci set softflowd.@softflowd[0].interface="tun1" && uci set softflowd.@softflowd[0].sampling_rate="1" && uci commit`).then(result => result.code === 0)
		softflowdEnabled = await ap.run(`/etc/init.d/softflowd enable && /etc/init.d/softflowd restart`).then(result => result.code === 0)

		if (!options.allowTorrents) {
			const rules = [
				'iptables -I FORWARD 1 -i tun1 -m comment --comment "!iungo:block_torrents" -p tcp -m multiport --dports 6880:7000 -j DROP',
				'iptables -I FORWARD 1 -i tun1 -m comment --comment "!iungo:block_torrents" -p udp -m multiport --dports 6880:7000 -j DROP',
				'iptables -I FORWARD 1 -i tun1 -m comment --comment "!iungo:block_torrents" -p tcp -m multiport --sports 51413,19222 -j DROP',
				'iptables -I FORWARD 1 -i tun1 -m comment --comment "!iungo:block_torrents" -p udp -m multiport --sports 51413,19222 -j DROP',
			]
			ap.run(rules.join(' && '))
		} else {
			// remove torrent rules
			ap.run('iptables-save | grep -v !iungo:block_torrents | iptables-restore')
		}
		
		await storeSecuritySettings(accessPointId, {enabled: 1, options: options})
		await addLogEntry(accessPointId, events.on, {options: options})
	} catch(err) {
		log.error('failed to enable security for %s, error: %s', accessPointId, err.message)
		return false
	}

	return collectorSet && softflowdEnabled
}

/*
	Disable access point security
*/
async function disableSecurity(accessPointId, options) {

	log.debug(`disabling security for ${accessPointId}`)
	const ap = accessPoint(accessPointId)

	let softflowdDisabled
	try	{
		const settings = await fetchSecuritySettings(accessPointId)
		softflowdDisabled = await ap.run(`/etc/init.d/softflowd disable && /etc/init.d/softflowd stop`).then(result => result.code === 0)
		settings.enabled = 0
		ap.run('iptables-save | grep -v !iungo:block_torrents | iptables-restore')
		await storeSecuritySettings(accessPointId, settings)
		await addLogEntry(accessPointId, events.off)
	} catch(err) {
		log.error('failed to disable security for %s, error: %s', accessPointId, err.message)
		return false
	}
	
	return softflowdDisabled
}

// mac cache
// TODO move to redis
const macAddresses = {}
const macCacheTimeout = 60000 // cache for 1 min

/*
	Find client MAC address
*/
async function getClientMacAddress(accessPointId, ipAddress) {
	const key = `${accessPointId}-${ipAddress}`
	if (macAddresses[key] && macAddresses[key].timestamp > Date.now() - macCacheTimeout && macAddresses[key].value) {
		return macAddresses[key].value
	}

	const ap = accessPoint(accessPointId)
	const macAddress = 
			await ap.run('cat /proc/net/arp | grep ' + ipAddress + ' | awk \'{printf $4}\'').then(result => result.stdout) ||
			await ap.run('chilli_query list | grep ' + ipAddress + ' | awk \'{printf $1}\' | sed s/-/:/g').then(result => result.stdout)

	macAddresses[key] = {
		value: macAddress,
		timestamp: Date.now()
	}

	return macAddress
}

/*
	Unblock IP address for access point
*/
async function unblockClientIp(accessPointId, ipAddress) {
	const ap = accessPoint(accessPointId)
	const macAddress = await getClientMacAddress(accessPointId, ipAddress)
	const success = await ap.run(`iptables -D INPUT -s ${ipAddress} -j DROP; iptables -D FORWARD -s ${ipAddress} -j DROP`).then(result => result.code === 0)
	if (success) {
		addLogEntry(accessPointId, events.unblocked, {ipAddress: ipAddress, macAddress: macAddress})
	}
	return success
}

const blocked = {}
/*
	Block client by IP on access point
*/
async function blockClientIp(accessPointId, ipAddress, period) {
	// TODO move this to redis
	const blockKey = `${accessPointId}-${ipAddress}`
	log.debug('block request for %s on %s, last block %d', accessPointId, ipAddress, blocked[blockKey] || 0)
	if (blocked[blockKey] > Date.now() - 60000) {
		log.debug('skipping block %s because it was already blocked in past 60sec', blockKey)
		return
	} else {
		log.debug('proceed to block %s', blockKey)
		blocked[blockKey] = Date.now()
	}

	period = period || '1 hour' // block for an hour by default
	const ap = accessPoint(accessPointId)
	
	const isBlocked = await ap.run('iptables -L FORWARD -n -v | grep ' + ipAddress + ' | grep DROP').then(result => result.stdout)

	let success = false
	if (!isBlocked) {
		const macAddress = await getClientMacAddress(accessPointId, ipAddress)
		success = await ap.run(`iptables -I INPUT 1 -s ${ipAddress} -j DROP; iptables -I FORWARD 1 -s ${ipAddress} -j DROP; echo "iptables -D INPUT -s ${ipAddress} -j DROP; iptables -D FORWARD -s ${ipAddress} -j DROP" | at now + ${period}`).then(result => result.code === 0)
		if (success) {
			addLogEntry(accessPointId, events.blocked, {ipAddress: ipAddress, macAddress: macAddress})
		}
	}

	return success
}

/*
	React to detected threat.
	Blocks logs the threat and bans offender IP on reporting AP for 1h.
*/
async function processThreatMsg(msg)
{
    if (msg !== null) {
    	
    	const msgContent = JSON.parse(msg.content)
    	log.debug('message received: %O', msgContent)

    	if (!msgContent.observer) {
    		log.error('observer not defined')
    		return
    	}

    	let observerId
    	try {
    		observerId = await raddb.getNasIdByIp(msgContent.observer)
    		log.debug('resolved observer IP %s to ID %s', msgContent.observer, observerId)
    	} catch(err) {
	    	log.error('observer could not be found for IP %s', msgContent.observer)
	    	return
	    }

	    const offenderIp = msgContent.offender
	    const offenderMac = await getClientMacAddress(observerId, offenderIp)

	    addLogEntry(observerId, events.threat, {type: msgContent.type, offender: {ipAddress: offenderIp, macAddress: offenderMac},  details: msgContent.details})

	    try {
	    	blockClientIp(observerId, offenderIp, '1 hour')
	    } catch(err) {
	    	log.error(err.message)	
	    }
	}
}

/*
	Start security threat message processor
*/
function startSecurityThreatProcessor() {
	const amqpConnection = amqp.connect([process.env.AMQP_URI])	
	const amqpChannel = amqpConnection.createChannel({
	 	json: true,
	  	setup: function(amqpChannel) {
	        const q = amqpChannel.assertQueue(securityThreatQueue, {durable: true})
	  		amqpChannel.consume(securityThreatQueue, processThreatMsg, {noAck: true})
	        return q
	    }
	});
}