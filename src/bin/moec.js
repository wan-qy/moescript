var path = require('path')
var opts = require('./opts')
var moe = require('../runtime')
var compiler = require('../compiler')
var util = require('util')
var fs = require('fs')

var target;

var rm = new (require('../compiler/requirements').RequirementsManager);

var addLibName = function(line){
	var m, name, libName
	if(m = line.match(/^\s*(\w+)\s*=\s*/)){
		name = m[1], libName = line.slice(m[0].length)
	} else {
		name = libName = line
	};
	rm.addLibName(name, libName)
};

var optmaps = {'with': addLibName};
var setTarget = function(v){
	rm = new (require('../compiler/requirements').RequirementsManager);
	target = require('../compiler/targets/' + v);
	target.addInits(rm);
};
setTarget('node');
var runtimeBind = '';

var fWrite = console.log;

opts.parse([
	{short: 't', long: 'target', value: true, description: "Set compilation target (node, least)",
		callback: function(v){ setTarget(v) }},
	{short: 'm', long: 'module', value: true, description: "Include module as global variable. Usage: -m name=path/to/module",
		callback: function(v){ addLibName(v) }},
	{short: 'i', long: 'include', value: true, description: "Include all exports of a module as global variable",
		callback: function(mod){ rm.addLibImport(mod) }},
	{short: 'o', long: 'output', value: true, description: "Set output .js path",
		callback: function(path){ fWrite = function(s){fs.writeFileSync(path, s, 'utf-8')} }},
	{short: 'g', long: 'global', value: true, description: "Declare a global variable",
		callback: function(varName){ rm.addDirectMap(varName, varName) }},
	{long: 'rtbind', value: true, 
		callback: function(expr){ runtimeBind = expr }}
], [{name: 'source_path', required: true, callback: function(value){
	(fs.exists||path.exists)(value, function(existQ){
		if(existQ){
			var script = compiler.compile(fs.readFileSync(value, 'utf-8'), {
				optionMaps: optmaps,
				initVariables: rm.fInits,
				warn: function(s){ process.stderr.write(s + '\n') }
			})
			fWrite(target.composite(
				script,
				rm.wrappedLibRequirements(),
				rm.fInits,
				{runtimeBind: runtimeBind}))
		} else {
			util.debug('File ' + value + ' does not exist.')
		}
	})
}}])
