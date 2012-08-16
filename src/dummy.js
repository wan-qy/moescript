var path = require('path');
var fs = require('fs');

var moert   = require('./runtime');
var compiler = require('./compiler/compiler');

exports.runtime = moert.runtime

var gvm = new (require('./compiler/gvm')).GlobalVariableManager(require)
gvm.bind('require', 'require');
gvm.bind('module', 'module');
gvm.bind('exports', 'exports');
gvm.addLibImport('moe/prelude');
gvm.bind('console', 'console');
gvm.bind('process', 'process');

var config = {}
exports.config = config;

exports.useRequireManager = function(newrm){return gvm = newrm};
exports.bind = function(){gvm.bind.apply(gvm, arguments)};
exports.addLibName = function(){gvm.addLibName.apply(gvm, arguments)};

var compile = exports.compile = function(source){
	var script = compiler.compile(source, {
		optiomMaps : {},
		globalVariables: gvm,
		warn: function(s){ process.stderr.write(s + '\n') }
	});
	return {
		script: compiler.stdComposite(script, config),
		trees: script.trees
	}
}

var getCompiled = function(fileName){
	return compile(fs.readFileSync(fileName, 'utf-8')).script;
};

require.extensions['.moe'] = function(module, fileName){
	module._compile(getCompiled(fileName), fileName);
};