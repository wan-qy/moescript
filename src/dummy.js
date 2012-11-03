var path = require('path');
var fs = require('fs');

var moert    = require('./runtime');
var moecrt   = require('./compiler/compiler.rt');
var compiler = require('./compiler/compiler');
var path = require('path');
var C_STRING = moecrt.C_STRING;

exports.runtime = moert.runtime;

var initGvm = function(){
	ts = new (require('./compiler/compiler')).TopScope();
	ts.bind('require', 'require');
	ts.bind('module', 'module');
	ts.bind('exports', 'exports');
	ts.bind('console', 'console');
	ts.bind('process', 'process');
	ts.bind('Buffer', 'Buffer');
	ts.bind('setTimeout', 'setTimeout');
	ts.bind('clearTimeout', 'clearTimeout');
	ts.bind('setInterval', 'setInterval');
	ts.bind('clearInterval', 'clearInterval');

	ts.libRequireBind(require('./prelude'), 'require(' + C_STRING(path.resolve(path.dirname(module.filename), './prelude')) + ')');
	ts.runtimeBind = 'require(' + C_STRING(path.resolve(path.dirname(module.filename), './runtime')) + ').runtime';
};

var ts;

exports.useRequireManager = function(newrm){ return ts = newrm };
exports.bind = function(){ ts.bind.apply(ts, arguments) };

var compile = function(source){
	if(!ts) initGvm();

	var script = compiler.compile(source, ts, {
		optiomMaps : {},
		warn: function(s){ process.stderr.write(s + '\n') }
	});
	return compiler.stdComposite(script, ts);
};

require.extensions['.moe'] = function(module, fileName){
	module._compile(compile(fs.readFileSync(fileName, 'utf-8')), fileName);
};