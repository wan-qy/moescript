var wrapCode = function(code){
	return '(function(){var exports = {};\n' + code + ';\n return exports})()'
}
var fs = require('fs');
var FILE_RUNTIME = process.argv[2];
var FILE_PRELUDE = process.argv[3];
var FILE_OUTPUT  = process.argv[4];

var s = '';
s = 'var moescript = ' + wrapCode(fs.readFileSync(FILE_RUNTIME, 'utf-8')) + ';\n';
s += 'moescript.prelude = ' + wrapCode(fs.readFileSync(FILE_PRELUDE, 'utf-8').replace(/require\('\.\/runtime'\)/g, 'moescript')) + ';\n';
fs.writeFileSync(FILE_OUTPUT, s, 'utf-8');