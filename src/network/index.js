module.exports = { accessPoint, user, status, start }

const rmi = require('./rmi'),
	  pool = require('./pool'),
	  pkim = require('./pkim'),
	  raddb = require('./raddb'),
	  apdb = require('./apdb'),
	  openvpn = require('./openvpn'),
	  captive = require('./captive'),
	  log = require('../log')('service'),
	  Netmask = require('netmask').Netmask,
	  security = require('./security')

function start() {
	monitorConnectionStatus()
	security.startSecurityThreatProcessor()
}

// access point related functions
function accessPoint(accessPointId) {
	return {
		
		// create access point
		create: async function(macAddress) {

			const accessPoint = {
				accessPointId: accessPointId,
				macAddress: macAddress
			}

			// issue IP address
			const ipAddress = await pool.pop(accessPointId)
			accessPoint.ipAddress = ipAddress.split('/')[0]
			accessPoint.netMask = (new Netmask(ipAddress)).mask

			await openvpn.bindAddress(accessPointId, accessPoint.ipAddress, accessPoint.netMask)

			// issue management key pair
			accessPoint.rmiKeys = await rmi.issueKeyPair(accessPointId)

			// issue signaling network access credentials
			accessPoint.signalingKeys = await pkim.issueCert(accessPointId)

			// register with radius, issue secret
			accessPoint.radiusSecret = await raddb.addNas(accessPointId, accessPoint.ipAddress)

			accessPoint.captiveSecret = await captive.generateSecret()

			accessPoint.signalingGateway = process.env.SIGTUN_PUBLIC_IP || '192.168.1.105'
			accessPoint.radius = process.env.RADIUS_INTERNAL_IP || '172.28.1.16'

			await apdb.add(accessPoint)

			log.info('Created access point:\n %O', accessPoint)
			return accessPoint
		},

		run: async function(command) {
			log.info('Exec on access point %s', accessPointId)
			const accessPoint = await apdb.find(accessPointId)
			return rmi.runRemoteCommand(accessPointId, command)			
		},

		// reboot access point
		reboot: async function() {
			log.info('Rebooting access point %s', accessPointId)
			const accessPoint = await apdb.find(accessPointId)
			return rmi.runRemoteCommand(accessPointId, 'reboot')
		},

		// set ssid
		setSsid: async function(ssid) {
			log.info('Setting access point %s SSID to "%s"', accessPointId, ssid)
			const accessPoint = await apdb.find(accessPointId)
			return rmi.runRemoteCommand(accessPointId, 'uci set wireless.default_radio0.ssid="'+ ssid +'"; uci set wireless.default_radio1.ssid="'+ ssid +'-OPEN"; uci commit; /etc/init.d/iungo stop; sleep 1; /etc/init.d/iungo start').then(result => result.code == 0)
		},

		kill: async function() {
			await pkim.revokeCert(accessPointId)
			await openvpn.kill(accessPointId)
			return true
		},

		updateFirmware: async function(image) {
			image = image || 'latest.bin'
			log.info('Updating %s firmware to "%s"', accessPointId, image)
			const accessPoint = await apdb.find(accessPointId)
			return rmi.runRemoteCommand(accessPointId, 'wget -O /tmp/sysupgrade.bin http://172.28.0.102/' + image + ' && sysupgrade -v -F /tmp/sysupgrade.bin')
		},

		isolateClient: async function(ipAddress, duration) {
			const accessPoint = await apdb.find(accessPointId)
			return rmi.runRemoteCommand(accessPointId, 'MAC_ADDRESS=$(cat /proc/net/arp | grep ' + ipAddress + ' | awk \'{print $4}\'); iptables -I INPUT 1 -m mac --mac-source $MAC_ADDRESS -j DROP; iptables -I FORWARD 1 -m mac --mac-source $MAC_ADDRESS -j DROP; echo "iptables -D INPUT -m mac --mac-source $MAC_ADDRESS -j DROP; iptables -D FORWARD -m mac --mac-source $MAC_ADDRESS -j DROP" | at now + ' + duration)
		},

		enableSecurity: function(options) {
			return security.enableSecurity(accessPointId, options)
		},

		disableSecurity: function() {
			return security.disableSecurity(accessPointId)
		},

		fetchSecuritySettings: function() {
			return security.fetchSecuritySettings(accessPointId)
		},

		getSecurityReport: function() {
			return security.getReport(accessPointId)
		},

		unblock: function(ipAddress) {
			return security.unblockClientIp(accessPointId, ipAddress)
		},

		block: function(ipAddress) {
			return security.blockClientIp(accessPointId, ipAddress)
		},

		setConnected: function(connected) {
			return connected ? apdb.markOnline(accessPointId) : apdb.markOffline(accessPointId)
		}	
	}
}

function user(userId) {
	return {

		create: async function() {
			return {
				userId: userId,
				password: await raddb.addUser(userId)
			}
		},

		disable: function() {
			return raddb.disableUser(userId)
		},

		getCaptiveResponse: async function(accessPointId, challenge) {
			const password = await raddb.getUserPassword(userId)
			const accessPoint = await apdb.find(accessPointId)
			return captive.manglePassword(challenge, accessPoint.secret, password)
		},

		getPassword: async function() {
			return raddb.getUserPassword(userId)
		}
	}
}

async function status() {
	const status = {}
	status.accessPointsOnline = await apdb.getOnline()
	status.activeSessions = await raddb.getActiveSessions()
	return status
}

// update ap db online status every 5 min from actual openvpn client list to avoid "ghost" APs
const UUID = /^[0-9A-F]{8}-[0-9A-F]{4}-[4][0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i
async function monitorConnectionStatus() {
	try	{
		log.debug('updating apdb:online from openvpn status')
		const status = await openvpn.getStatus()
		apdb.resetOnline().then(_ => {
			const clientsOnline = Object.keys(status.parsed.clients)
			const accessPointsOnline = clientsOnline.filter(clientId => UUID.test(clientId))
			if (accessPointsOnline.length > 0) {
				apdb.markOnline(accessPointsOnline)
			}
		}).catch(err => {
			log.error('failed to update ap db: %s', err.message)
		})
	} catch(err) {
		log.error('failed to get openvpn status: %s', err.message)
	}
	
	setTimeout(monitorConnectionStatus, 300000)
}