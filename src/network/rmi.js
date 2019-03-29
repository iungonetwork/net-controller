// Remote management interface

const keypair = require('keypair'),
	  apdb = require('./apdb'),
	  forge = require('node-forge'),
	  SshClient = require('ssh2').Client,
	  log = require('../log')('rmi')

function issueKeyPair(accessPointId) {
	const keys = keypair(),
    	  publicKey = forge.pki.publicKeyFromPem(keys.public)

 	keys.public_ssh = forge.ssh.publicKeyToOpenSSH(publicKey, accessPointId)
 	
 	return keys;
}

async function runRemoteCommand(accessPointId, command) {

	const ap = await apdb.find(accessPointId)
	const ssh = new SshClient()

    log.debug('connecting to ' + ap.ipAddress)
	//log.debug('private key for %s:\n %s', accessPointId, privateKey)

    return new Promise((resolve, reject) => {
		ssh.on('ready', function() {
			log.info('running remote command "%s" on %s', command, accessPointId)
			ssh.exec(command, function(err, stream) {
				if (err) {
					reject(err)
				}

				let stdout = ''
				let stderr = ''

				stream.on('close', function(code, signal) {
					resolve({code: code, signal: signal, stdout: stdout, stderr: stderr})
					ssh.end()
				}).on('data', function(data) {
					stdout += data
					log.info('stdout: %s', data)
				}).stderr.on('data', function(data) {
					stderr += data
					log.info('stderr: %s', data)
				});
			});
		}).on('error', err => {
			log.error(err)
			const _err = new Error('Access point is offline')
			_err.code = 'OFFLINE'
			reject(_err)
		}).connect({
			host: ap.ipAddress,
			port: 22,
			username: 'root',
			privateKey: ap.rmiKeys.private
		});
    })
}

module.exports = { issueKeyPair, runRemoteCommand }