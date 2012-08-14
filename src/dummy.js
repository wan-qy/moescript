var path = require('path');
var fs = require('fs');

var moert   = require('./runtime');
var compiler = require('./compiler/compiler');

exports.runtime = moert.runtime

var rm = new (require('./compiler/requirements')).RequirementsManager(require)
rm.bind('require', 'require');
rm.bind('module', 'module');
rm.bind('exports', 'exports');
rm.addLibImport('moe/prelude');
rm.bind('console', 'console');
rm.bind('process', 'process');

var config = {}
exports.config = config;

exports.useRequireManager = function(newrm){return rm = newrm};
exports.bind = function(){rm.bind.apply(rm, arguments)};
exports.addLibName = function(){rm.addLibName.apply(rm, arguments)};

var compile = exports.compile = function(source){
	var script = compiler.compile(source, {
		optiomMaps : {},
		initVariables: rm.fInits,
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