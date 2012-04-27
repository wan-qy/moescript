var res = 'var moert = require("./runtime");';
var fs = require('fs')
for(var i = 3; i < process.argv.length; i++) {
	res += '(function(){' + fs.readFileSync(process.argv[i], "utf-8").replace(/^\ufeff/, '').replace(/\r\n/g, '\n') + '})();'
}
fs.writeFileSync(process.argv[2], res)