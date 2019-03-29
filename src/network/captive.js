const crypto = require('crypto'),
	  xor = require('buffer-xor'),
	  log = require('../log')('captive')

module.exports.generateSecret = function() {
	return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

module.exports.manglePassword = function(challenge, secret, password) {
	const md = crypto.createHash('md5'),
		  challengeBuffer = Buffer.alloc(32),
	  	  secretBuffer = Buffer.from(secret),
	  	  passwordBuffer = Buffer.from(password)

  	Buffer.from(challenge, 'hex').copy(challengeBuffer)
  	md.update(challengeBuffer.slice(0, 16))
  	md.update(secretBuffer)
  	const digest = md.digest()

  	return xor(passwordBuffer, digest).slice(0, passwordBuffer.length).toString('hex')
}