var path = require('path')
var opts = require('./options').opts
var argv = require('./options').argv
var moe = require('../runtime')
var compiler = require('../compiler')
var util = require('util')
var fs = require('fs')

var target;

var gvm = new (require('../compiler/gvm').GlobalVariableManager);

var libBind = function(line){
	var m, name, libName
	if(m = line.match(/^\s*(\w+)\s*=\s*/)){
		name = m[1], libName = line.slice(m[0].length)
	} else {
		name = libName = line
	};
	gvm.libBind(name, libName)
};
var optmaps = {'with': libBind};

var runtimeBind = '';
var noPreludeQ  = false;
var bareQ = false;
var fWrite = console.log;

gvm.bind('require', 'require');
gvm.bind('module', 'module');
gvm.bind('exports', 'exports');

var codeSegments = [];

var doFile = function(value){
	if(fs.existsSync(value)){
		if(!noPreludeQ) gvm.libRequireBind('./../prelude', '(require("moe/prelude"))');

		gvm.runtimeBind = runtimeBind;

		var script = compiler.compile(fs.readFileSync(value, 'utf-8'), gvm, {
			optionMaps: optmaps,
			warn: function(s){ process.stderr.write(s + '\n') }
		});
		codeSegments.push(compiler.stdComposite(script, gvm));
	} else {
		util.debug('File ' + value + ' does not exist.');
	}
}

opts()
	.on('-o', '--output',
		function(path){ fWrite = function(s){fs.writeFileSync(path, s, 'utf-8')} })
	.on('-b', '--bind',
		function(s, x){ gvm.bind(s, x) })
	.on('-g', '--global',
		function(varName){ gvm.bind(varName, varName) })
	.on('--clear-binds', 
		function(){ gvm = new (require('../compiler/gvm').GlobalVariableManager) })
	.on('--no-prelude', 
		function(){ noPreludeQ = true }) .on('--use-prelude', function(){ noPreludeQ = false })
	.on('--bare', 
		function(){ this.config['--clear-binds'].call(this), this.config['--no-prelude'].call(this)})
	.on('--runtime-bind', 
		function(expr){ runtimeBind = expr })
	.on('--include-js', 
		function(file){ codeSegments.push(compiler.inputNormalize(fs.readFileSync(file, 'utf-8'))) })
	.on('--file', '-f', doFile)
	.file(doFile)
	.parse(argv());

fWrite(codeSegments.join('\n\n'));