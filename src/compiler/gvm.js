var moe = require('../runtime');
var moecrt = require('./compiler.rt');
var OWNS = moe.runtime.OWNS;
var moec_codegen = require('./codegen');
var C_NAME = moec_codegen.C_NAME;
var C_TEMP = moec_codegen.C_TEMP;
var PART = moec_codegen.PART;
var C_STRING = moecrt.C_STRING;

var GlobalVariableManager = exports.GlobalVariableManager = function(_require){
	var YES = {};
	var globalVars = {};
	var variableMaps = {};

	_require = _require || require;


	var addDirectMap = function(name, map){
		globalVars[name] = YES;
		variableMaps[name] = map;
	};
	var addLibImport = function(libName, bind){
		var lib = _require(libName);
		for(var item in lib) if(/^[a-zA-Z_]\w*$/.test(item) && OWNS(lib, item)) {
			globalVars[item] = YES;
			variableMaps[item] = (bind || 'require' + '(' + C_STRING(libName) + ')') + '[' + C_STRING(item) + ']';
		}
	};
	var addLibName = function(name, id){
		globalVars[name] = YES;
		variableMaps[name] = 'require' + '(' + C_STRING(id) + ')'
	};
	var fInits = function(f){
		for(var item in globalVars) {
			if(globalVars[item] === YES){
				f(variableMaps[item], item);
			}
		}
	};


	// Exports
	this.bind = this.addDirectMap = addDirectMap;
	this.addLibImport = addLibImport;
	this.addLibName = addLibName;
	this.fInits = fInits;
	this.runtimeName = C_TEMP('RUNTIME');
	this.initsName = C_TEMP('INITS');
	this.createInitializationCode = function(){
		var s = "var undefined;\n";
		for(var item in moe.runtime) if(OWNS(moe.runtime, item)) {
			s += 'var ' + C_TEMP(item) + ' = ' + PART(this.runtimeName, item) + ';\n';
		};
		this.fInits(function(v, n){
			s += 'var ' + C_NAME(n) + ' = ' + v + ';\n';
		});
		return s;
	}
};

GlobalVariableManager.fromSimpleMap = function(map){
	if(map instanceof GlobalVariableManager) return map;
	var gvm = new GlobalVariableManager();
	for(var term in map) if(OWNS(map, term)) gvm.bind(term, map[term]);
	return gvm;
}