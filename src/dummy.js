var path = require('path');
var fs = require('fs');

var moert   = require('./runtime');
var compiler = require('./compiler/compiler');

var rm = new (require('./compiler/requirements')).RequirementsManager(require)
var target = require('./compiler/targets/node');
var config = {}
target.addInits(rm);

exports.config = config;
exports.addDirectMap = rm.addDirectMap.bind(rm);
exports.addLibName = rm.addLibName.bind(rm);

exports.setTarget = function(v){
	rm = new (require('./compiler/requirements').RequirementsManager);
	target = require('./compiler/targets/' + v);
	target.addInits(rm);
};

var getCompiled = exports.getCompiled = function(fileName){
	var source = fs.readFileSync(fileName, 'utf-8');

	var script = compiler.compile(source, {
		optiomMaps : {},
		initVariables: rm.fInits,
		warn: function(s){ process.stderr.write(s + '\n') }
	});
	return target.composite(
				script,
				rm.wrappedLibRequirements(),
				rm.fInits,
				config)
}

var compile = exports.compile = function(module, fileName){
	module._compile(getCompiled(fileName), fileName);
}

require.extensions['.moe'] = compile;
