var path = require('path');
var opts = require('./options').opts;
var argv = require('./options').argv;
var moe = require('../runtime');
var compiler = require('../compiler');
var util = require('util');
var fs = require('fs');

var ts = new compiler.TopScope;

var optmaps = {};
var options = {};

var runtimeBind = '';
var preludeBind = '';
var fWrite = console.log;
var keepSourceMap = false;
var codeSegments = [];

var doFile = function(value){
	if(fs.existsSync(value)){
//		if(!noPreludeQ) ts.libRequireBind(require('../prelude'), '(require("moe/prelude"))');
		ts.runtimeBind = runtimeBind;
		ts.locked = true;
		var script = compiler.compile(fs.readFileSync(value, 'utf-8'), ts, {
			optionMaps: optmaps,
			warn: function(s){ process.stderr.write(s + '\n') },
			options: options,
			keepSourceMap: keepSourceMap
		});
		codeSegments.push(compiler.stdComposite(script, ts));
	} else {
		process.stderr.write('File ' + value + ' does not exist.' + "\n");
	}
};

var METADATA = require('../package.json');
var VER_MSG = "\
Moescript Optimized Compiler, ver. #version\n\
(c) 2012 #author\n".replace(/#\w+/g, function(m){return METADATA[m.slice(1)]})
var HELP_MSG = "\
USAGE\n\
	moec [options] <input_file>\n\
\n\
OPTIONS\n\
 * -v, --version : Display version information\n\
 * -h, --help : Display help information\n\
 * --explicit : Enable explicit mode\n\
 * -o <path>, --output <path> : Specify the output path of generated .js file. When absent, it will be written into STDOUT\n\
 * -b <name> <expr>, --bind <name> <expr> : Enable a global variable named <name>, and bind it into JavaScript expression <expr>\n\
 * -g <name>, --global <name> : Create a global variable <name>, bind it to <name>\n\
 * --bare : Clear all global variable binds\n\
 * --runtime-bind <expr> : Bind the Moescript Runtime into <expr>. When absent, \"require('moe').runtime\" will be used\
";

var argvParser = opts()
	.on('-v', '--version', function(){ return console.log(VER_MSG) })
	.on('-h', '--help', function(){ return console.log(VER_MSG + HELP_MSG) })
	.on('-o', '--output', function(path){ fWrite = function(s){fs.writeFileSync(path, s, 'utf-8')} })
	.on('-b', '--bind', function(s, x){ ts.bind(s, x) })
	.on('-g', '--global', function(varName){ ts.bind(varName, varName) })
	.on('--bare', function(){ ts.maps = {} })
	.on('--runtime-bind', function(expr){ runtimeBind = expr })
	.on('--prelude-bind', function(expr){ preludeBind = expr })
	.on('--prelude', function(){ ts.libRequireBind(require('../prelude'), preludeBind || '(require("moe/prelude"))') })
//	.on('--source-map', function(){ keepSourceMap = true })
	.on('-w', '--web', function() {
		this.config['--runtime-bind']('moescript.runtime');
		this.config['--prelude-bind']('moescript.prelude');
		this.config['--bare']();
		this.config['--prelude']();
	})
	.on('--include-js', function(file){
		var jsCode = compiler.inputNormalize(fs.readFileSync(file, 'utf-8'))
		codeSegments.push(jsCode);
	})
	.on('--file', '-f', doFile)
	.on('--explicit', function(){ options.explicit = true })
	.file(doFile);

// Add prelude. Note that it is absent when building prelude...
try {
	ts.libRequireBind(require('../prelude'), preludeBind || '(require("moe/prelude"))')
} catch(e) {
	process.stderr.write("Warning: prelude not found.\n")
}
// Add initial binds
ts.bind('require', 'require');
ts.bind('module', 'module');
ts.bind('exports', 'exports');

argvParser.parse(argv());

// Write compilation result
fWrite(codeSegments.join('\n;\n'));