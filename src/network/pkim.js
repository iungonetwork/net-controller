const request = require('superagent'),
	  host = process.env.PKIM_HOST || 'pkim'
	
let caCert

getCaCert().then((_caCert) => caCert = _caCert)

function getCaCert() {
	return request
		.get(host + '/ca.crt')
		.then(res => res.text)
}

function issueCert(commonName) {
	return request
		.get(host + '/issue/' + commonName)
		.then(res => {
			const keys = JSON.parse(res.text)
			keys.caCert = caCert
			return keys
		})
}

function revokeCert(commonName) {
	return request
		.get(host + '/revoke/' + commonName)
		.then(res => true)
}

module.exports = { caCert, issueCert, revokeCert }