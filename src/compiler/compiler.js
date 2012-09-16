//:module: compiler
//	:author:		infinte (aka. be5invis)
//	:info:			The code generator for Moe Runtime

var moe = require('../runtime');
var UNIQ = moe.runtime.UNIQ;
var OWNS = moe.runtime.OWNS;
var derive = moe.derive;

var moecrt = require('./compiler.rt');
var nt = moecrt.NodeType;
var ScopedScript = moecrt.ScopedScript;

var lfc_lexer = require('./lexer');
var lfc_parser = require('./parser');

var lfc_resolver = require('./resolve');

var lfc_codegen = require('./codegen');
var C_NAME = lfc_codegen.C_NAME;
var C_TEMP = lfc_codegen.C_TEMP;
var PART = lfc_codegen.PART;
var STRIZE = lfc_codegen.STRIZE;

var GlobalVariableManager = require('./gvm').GlobalVariableManager;


//============
var lex = exports.lex = lfc_lexer.lex;
var parse = exports.parse = lfc_parser.parse;
//============
var Generator = lfc_codegen.Generator;

var inputNormalize = exports.inputNormalize = function(s){
	s = s.replace(/^\ufeff/, '')
		 .replace(/^\ufffe/, '')
		 .replace(/\r\n/g, '\n')
		 .replace(/\r/g, '\n');
	return '\n' + s + '\n';
};

var createInitVariables = function(gvm){
	if(!gvm){ return (function(){}) }
	else if(gvm instanceof GlobalVariableManager){ return gvm.fInits }
	else {
		return function(map){
			return function(f){
				for(var term in map) if(OWNS(map, term))
					f(map[term], term)
			};
		}(gvm)
	}
};

var compile = exports.compile = function (source, config) {
	source = inputNormalize(source)
	config = derive(config || {});

	config.runtimeName = config.runtimeName || C_TEMP('RUNTIME');
	config.initsName = config.initsName || C_TEMP('INITS');
	config.initVariables = config.initVariables || createInitVariables(config.globalVariables);
	config.makeT = moecrt.TMaker();

	config.warn = config.warn || function(){ };
	config.PW = moecrt.PWMeta(source);
	config.PE = moecrt.PEMeta(config.PW);

	//Parse
	var ast = parse(lex(source, config), source, config);

	config.options = ast.options;

	var trees = lfc_resolver.resolve(ast, config);
	var enter = trees[0];

	var generator = Generator(trees, config);
	var generatedInfo = generator(enter, true);

	generatedInfo.source = source;
	generatedInfo.trees = trees;
	generatedInfo.initializationCode = "var undefined;\n" + function(){
		var s = '';
		for(var item in moe.runtime) if(OWNS(moe.runtime, item)) {
			s += 'var ' + C_TEMP(item) + ' = ' + PART(config.runtimeName, item) + ';\n';
		};
		config.initVariables(function(v, n){
			s += 'var ' + C_NAME(n) + ' = ' + (v || PART(config.initsName, n)) + ';\n';
		});
		return s;
	}();
	generatedInfo.aux = config;
	generatedInfo.astOptions = ast.options;

	return generatedInfo;
};

exports.createSmap = function(ci){
};

exports.stdComposite = function(script, aux){
	return 'var ' + script.aux.runtimeName + ' = ' + (aux.runtimeBind || 'require' + '("moe").runtime' ) + '\n' +
		script.initializationCode + '\n' + script.generatedCode 
};