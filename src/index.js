const api = require('./api')
const network = require('./network')
const createRepl = require('./repl')

// Start network controller
network.start()

// Start API app
api.listen(process.env.PORT || 80)

// Launch REPL interface for manual interaction with network
if (process.env.REPL_ENABLED) {
	createRepl.listen(process.env.REPL_PORT || 5000);
}