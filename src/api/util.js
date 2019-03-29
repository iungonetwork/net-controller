const boom = require('boom')
const log = require('../log')('api')

const asyncMiddleware = fn => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((err) => {
    if (!err.isBoom) {
      return next(boom.badImplementation(err));
    }
    next(err);
  });
};

// json request/response body logger
function logReqRes(req, res, next) {

  var oldWrite = res.write,
      oldEnd = res.end;

  var chunks = [];

  res.write = function (chunk) {
    chunks.push(Buffer.from(chunk));

    oldWrite.apply(res, arguments);
  };

  res.end = function (chunk) {
    if (chunk)
      chunks.push(Buffer.from(chunk));

    var body = Buffer.concat(chunks).toString('utf8');
    var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

	if (req.method == 'GET') {
		log.debug('request from %s\n -> %s %s\n <- %d\n <- %o', ip, req.method, req.url, res.statusCode, JSON.parse(body))
	} else {
		log.debug('request from %s\n -> %s %s\n -> %o \n <- %d\n <- %o', ip, req.method, req.url, req.body, res.statusCode, JSON.parse(body))
	}

    oldEnd.apply(res, arguments);
  };

  next();
}


module.exports = {log, logReqRes, asyncMiddleware}