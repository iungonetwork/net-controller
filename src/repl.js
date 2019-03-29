const net = require('net')
const repl = require('repl')
const network = require('./network')

module.exports = function() {
	return net.createServer((socket) => {
		const replServer = repl.start({
			prompt: '> ',
			input: socket,
			output: socket
		})
		.on('exit', () => {
			socket.end()
		})

		replServer.context.iungo = network
	})
}