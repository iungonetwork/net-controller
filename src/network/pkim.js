/*
	PKI service API
*/

const request = require('superagent'),
	  host = process.env.PKIM_HOST || 'pkim'
	
let caCert

/*
	Pre-load CA certificate
*/
getCaCert().then((_caCert) => caCert = _caCert)


/*
	Get CA certificate
*/
function getCaCert() {
	return request
		.get(host + '/ca.crt')
		.then(res => res.text)
}

/*
	Issue certificate
*/
function issueCert(commonName) {
	return request
		.get(host + '/issue/' + commonName)
		.then(res => {
			const keys = JSON.parse(res.text)
			keys.caCert = caCert
			return keys
		})
}

/*
	Revoke certificate
*/
function revokeCert(commonName) {
	return request
		.get(host + '/revoke/' + commonName)
		.then(res => true)
}

module.exports = { caCert, issueCert, revokeCert }	