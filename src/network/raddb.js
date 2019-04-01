/*
	Freeradius database management API
*/

const db = require('../mysql')('radius')

/*
	Find access point id by IP address
*/
function getNasIdByIp(ipAddress) {
	return db.query('SELECT shortname FROM nas WHERE nasname = ?', [ipAddress]).then(results => {
		if (results.length == 1) {
			return results[0].shortname
		}
		throw new Error('Access point ID not found')
	})
}

/*
	Get user password
*/
function getUserPassword(username) {
	return db.query('SELECT value FROM radcheck WHERE username = ? AND attribute = "Cleartext-Password"', [username]).then(results => {
		if (results.length == 1) {
			return results[0].value
		}
		throw new Error('User password not found')
	})
}

/*
	Add Auth-Type := Reject for user to prevent further network access
*/
function disableUser(username) {
	return db.query('INSERT INTO radcheck VALUES(null, ?, "Auth-Type", ":=", "Reject")', [username])
}

/*
	Get session data
*/
function getSession(sessionId) {
	return db.query('SELECT * FROM radacct WHERE acctuniqueid = ?', [sessionId]).then(results => {
		if (results.length == 1) {
			return results[0]
		}
		throw new Error('Session not found')
	})
}

/*
	Get active sessions
*/
function getActiveSessions() {
	return db.query('SELECT * FROM radacct WHERE acctstoptime IS NULL').then(results => {
		return results.map((row) => {
			return {
				sessionId: row.acctuniqueid,
				userId: row.username,
				accessPointId: row.nasid
			}
		})
	})
}

/*
	Register access point
	Note: issues acces point secret
*/
async function addNas(name, ipAddress) {
	const secret = generateSecret()
	await db.query('INSERT INTO nas VALUES(null, ?, ?, "Access Point", 2, ?, "default", "", "")', [ipAddress, name, secret])
	return secret
}

/*
	Register user
	Note: issues random password
*/
function addUser(username) {
	const password = generateSecret()
	return db.query('INSERT INTO radcheck VALUES(null, ?, "Cleartext-Password", ":=", ?)', [username, password]).then(results => {
		return password
	})
}

/*
	Generates random password
*/
function generateSecret() {
	return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

module.exports = { getUserPassword, addUser, addNas, getSession, disableUser, getActiveSessions, getNasIdByIp }