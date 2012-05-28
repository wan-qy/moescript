var path = require('path');
var fs = require('fs');

var moert   = require('./runtime');
var compiler = require('./compiler/compiler');

var rm = new (require('./compiler/requirements')).RequirementsManager(require)
var target = require('./compiler/targets/node');
var config = {}
target.addInits(rm);

exports.config = config;
exports.addDirectMap = function(){rm.addDirectMap.apply(rm, arguments)}
exports.addLibName = function(){rm.addLibName.apply(rm, arguments)};

exports.setTarget = function(v){
	rm = new (require('./compiler/requirements').RequirementsManager);
	target = require('./compiler/targets/' + v);
	target.addInits(rm);
};

var compile = exports.compile = function(source){
	var script = compiler.compile(source, {
		optiomMaps : {},
		initVariables: rm.fInits,
		warn: function(s){ process.stderr.write(s + '\n') }
	});
	return {
		script: target.composite(
				script,
				rm.wrappedLibRequirements(),
				rm.fInits,
				config),
		trees: script.trees
	}
}

var getCompiled = function(fileName){
	return compile(fs.readFileSync(fileName, 'utf-8')).script;
};

require.extensions['.moe'] = function(module, fileName){
	module._compile(getCompiled(fileName), fileName);
};