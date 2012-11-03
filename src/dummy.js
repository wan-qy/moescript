var path = require('path');
var fs = require('fs');

var moert    = require('./runtime');
var moecrt   = require('./compiler/compiler.rt');
var compiler = require('./compiler/compiler');
var path = require('path');
var C_STRING = moecrt.C_STRING;

exports.runtime = moert.runtime;

var initGvm = function(){
	gvm = new (require('./compiler/gvm')).GlobalVariableManager(require);
	gvm.bind('require', 'require');
	gvm.bind('module', 'module');
	gvm.bind('exports', 'exports');
	gvm.bind('console', 'console');
	gvm.bind('process', 'process');
	gvm.bind('Buffer', 'Buffer');
	gvm.bind('setTimeout', 'setTimeout');
	gvm.bind('clearTimeout', 'clearTimeout');
	gvm.bind('setInterval', 'setInterval');
	gvm.bind('clearInterval', 'clearInterval');

	gvm.libRequireBind('./prelude', 'require(' + C_STRING(path.resolve(path.dirname(module.filename), './prelude')) + ')');
	gvm.runtimeBind = 'require(' + C_STRING(path.resolve(path.dirname(module.filename), './runtime')) + ').runtime';
};

var gvm;

exports.useRequireManager = function(newrm){ return gvm = newrm };
exports.bind = function(){ gvm.bind.apply(gvm, arguments) };
exports.libBind = function(){ gvm.libBind.apply(gvm, arguments) };

var compile = function(source){
	if(!gvm) initGvm();

	var script = compiler.compile(source, gvm, {
		optiomMaps : {},
		warn: function(s){ process.stderr.write(s + '\n') }
	});
	return compiler.stdComposite(script, gvm);
};

require.extensions['.moe'] = function(module, fileName){
	module._compile(compile(fs.readFileSync(fileName, 'utf-8')), fileName);
};