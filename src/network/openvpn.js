const Telnet = require('telnet-client'),
	  fs = require('fs'),
	  Netmask = require('netmask').Netmask,
	  http = require('http'),
	  _url = require('url'),
	  EventEmitter = require('events')

const EXEC_TIMEOUT = 2000,
	  CONNECT_TIMEOUT = 5000,
	  host = process.env.OPENVPN_HOST || 'openvpn',
	  port = process.env.OPENVPN_MANAGEMENT_PORT || 7505,
	  ccd = process.env.OPENVPN_CCD_DIR || '/ccd'

function bindAddress(commonName, ipAddress, netMask) {
	return new Promise((resolve, reject) => {
		const filename = ccd + '/' + commonName,
			  data = 'ifconfig-push ' + ipAddress + ' ' + netMask
	    fs.writeFile(filename, data, function(err) {
	        if (err) reject(err)
	        else resolve(data)
	    })
	})
}

function getStatus() {
	return send('status').then(response => {

		const lines = response.split('\r\n')
		const status = {
			clients: {}
		};

		let cursor = 0
		if (lines[cursor] == 'OpenVPN CLIENT LIST') {
			cursor = 3 // skip updated at and client table headers
			
			while(lines[cursor] != 'ROUTING TABLE') {
				const fields = lines[cursor].split(',')
				
				if (!(fields[0] in status.clients)) {
					status.clients[fields[0]] = {}
				}
				status.clients[fields[0]].real = fields[1].split(':')[0]

				cursor++
			}

			cursor += 2 // skip routing table headers
			while(lines[cursor] != 'GLOBAL STATS') {
				const fields = lines[cursor].split(',')
				status.clients[fields[1]].virtual = fields[0]

				cursor++
			}

		} else {
			throw Error('could not parse status response')
		}
		
		// TODO parse response
		return {raw: response, parsed: status}
	})
}

function send(command) {
	// it seems that Promises API of telnet lib is broken
	// wraping to promise manually
	return new Promise((resolve, reject) => {
		const connection = new Telnet()
		connection
			.on('ready', prompt => {
				connection.send(command, {execTimeout: EXEC_TIMEOUT}, (err, response) => {
					if (err) {
						reject(err)
					} else {
						resolve(response)
					}
					connection.end()
				})
			})
			.on('timeout', reject)
			.on('error', reject)
			.connect({
				host: host,
				port: port,
				shellPrompt: '',
				timeout: CONNECT_TIMEOUT
			})			
	})
}

function kill(commonName) {
	return send('kill ' + commonName).then(response => {
		return true
	})
}

module.exports = { bindAddress, getStatus, kill }