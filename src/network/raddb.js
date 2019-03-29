
const db = require('../mysql')('radius')

function getNasIdByIp(ipAddress) {
	return db.query('SELECT shortname FROM nas WHERE nasname = ?', [ipAddress]).then(results => {
		if (results.length == 1) {
			return results[0].shortname
		}
		throw new Error('Access point ID not found')
	})
}

function getUserPassword(username) {
	return db.query('SELECT value FROM radcheck WHERE username = ? AND attribute = "Cleartext-Password"', [username]).then(results => {
		if (results.length == 1) {
			return results[0].value
		}
		throw new Error('User password not found')
	})
}

function disableUser(username) {
	return db.query('INSERT INTO radcheck VALUES(null, ?, "Auth-Type", ":=", "Reject")', [username])
}

function getSession(sessionId) {
	return db.query('SELECT * FROM radacct WHERE acctuniqueid = ?', [sessionId]).then(results => {
		if (results.length == 1) {
			return results[0]
		}
		throw new Error('Session not found')
	})
}

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

async function addNas(name, ipAddress) {
	const secret = generateSecret()
	await db.query('INSERT INTO nas VALUES(null, ?, ?, "Access Point", 2, ?, "default", "", "")', [ipAddress, name, secret])
	return secret
}

function addUser(username) {
	const password = generateSecret()
	return db.query('INSERT INTO radcheck VALUES(null, ?, "Cleartext-Password", ":=", ?)', [username, password]).then(results => {
		return password
	})
}

function generateSecret() {
	return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

module.exports = { getUserPassword, addUser, addNas, getSession, disableUser, getActiveSessions, getNasIdByIp }