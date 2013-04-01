var dummy = require('../dummy');
var path  = require('path');

if(process.argv[1]) {
	return require(path.resolve(process.argv[1]));
} else {
	process.stderr.write("REPL is still TO-DO. It will be here soon. I hope :)" + "\n")
	process.exit();
}