const mysql = require('mysql')

module.exports = function(databaseName) {
	const pool = mysql.createPool({
	  	host: process.env.DB_HOST || 'mysql',
	  	user: process.env.DB_USER || 'root',
	  	password: process.env.DB_PASS || 'root',
	  	database: databaseName
	})

	// replace query method with promisified version
	pool.query = function(query, params) {
		return new Promise((resolve, reject) => {
			pool.getConnection((err, conn) => {
				if (err) {
					reject(err)
					return
				}

				conn.query(query, params,
					(err, results) => {
						conn.release()
						if (err) {
							reject(err)
						} else {
							resolve(results)
						}
					}
				)
			})
		})		
	}

	return pool
}