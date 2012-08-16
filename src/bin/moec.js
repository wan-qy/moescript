var path = require('path')
var opts = require('./opts')
var moe = require('../runtime')
var compiler = require('../compiler')
var util = require('util')
var fs = require('fs')

var target;

var gvm = new (require('../compiler/gvm').GlobalVariableManager);

var addLibName = function(line){
	var m, name, libName
	if(m = line.match(/^\s*(\w+)\s*=\s*/)){
		name = m[1], libName = line.slice(m[0].length)
	} else {
		name = libName = line
	};
	gvm.addLibName(name, libName)
};
var optmaps = {'with': addLibName};

var runtimeBind = '';
var noPreludeQ  = false;
var fWrite = console.log;

gvm.bind('require', 'require');
gvm.bind('module', 'module');
gvm.bind('exports', 'exports');

opts.parse([
	{short: 'o', long: 'output', value: true, description: "Set output .js path",
		callback: function(path){ fWrite = function(s){fs.writeFileSync(path, s, 'utf-8')} }},
	{short: 'g', long: 'global', value: true, description: "Declare a global variable",
		callback: function(varName){ gvm.bind(varName, varName) }},
	{short: 'b', long: 'bind', value: true, description: "Create a global variable with specific bind",
		callback: function(s){
			var m = s.match(/(\w+)\s*=\s*([\s\S]*)$/);
			if(m){gvm.bind(m[1], m[2])}
		}},
	{long: 'runtime-bind', value: true, 
		callback: function(expr){ runtimeBind = expr }},
	{long: 'no-prelude', value: false,
		callback: function(){noPreludeQ = true}}
], [{name: 'source_path', required: true, callback: function(value){
	(fs.exists||path.exists)(value, function(existQ){
		if(existQ){
			if(!noPreludeQ) 
				gvm.addLibImport('./../prelude', '(require("moe/prelude"))');

			var script = compiler.compile(fs.readFileSync(value, 'utf-8'), {
				optionMaps: optmaps,
				globalVariables: gvm,
				warn: function(s){ process.stderr.write(s + '\n') }
			})
			fWrite(compiler.stdComposite(script, {runtimeBind: runtimeBind}))
		} else {
			util.debug('File ' + value + ' does not exist.')
		}
	})
}}])
