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
var C_STRING = moecrt.C_STRING;

var moec_lexer = require('./lexer');
var moec_parser = require('./parser');

var moec_resolver = require('./resolve');

var moec_codegen = require('./codegen');
var C_NAME = moec_codegen.C_NAME;
var C_TEMP = moec_codegen.C_TEMP;
var PART = moec_codegen.PART;

var GlobalVariableManager = require('./gvm').GlobalVariableManager;


//============
var lex = exports.lex = moec_lexer.lex;
var parse = exports.parse = moec_parser.parse;
//============
var Generator = moec_codegen.Generator;

var inputNormalize = exports.inputNormalize = function(s){
	s = s.replace(/^\ufeff/, '')
		 .replace(/^\ufffe/, '')
		 .replace(/\r\n/g, '\n')
		 .replace(/\r/g, '\n');
	return '\n' + s + '\n';
};

var compile = exports.compile = function (source, gvm, config) {
	source = inputNormalize(source);
	gvm = GlobalVariableManager.fromSimpleMap(gvm);
	
	config = derive(config || {});
	config.makeT = moecrt.TMaker();
	config.warn = config.warn || function(){ };
	config.PW = moecrt.PWMeta(source);
	config.PE = moecrt.PEMeta(config.PW);

	//Parse
	var ast = parse(lex(source, config), source, config);
	config.options = ast.options;

	var trees = moec_resolver.resolve(ast, gvm, config);
	var enter = trees[0];

	var generator = Generator(trees, config);
	var generatedInfo = generator(enter, true);

	generatedInfo.source = source;
	generatedInfo.gvm = gvm;
	generatedInfo.trees = trees;
	generatedInfo.aux = config;
	generatedInfo.astOptions = ast.options;

	return generatedInfo;
};

exports.createSmap = function(ci){};

exports.stdComposite = function(info, gvm){
	gvm = gvm || info.gvm;
	return 'var ' + gvm.runtimeName + ' = ' + (gvm.runtimeBind || 'require' + '("moe").runtime' ) + '\n' +
		gvm.createInitializationCode() + '\n' + info.generatedCode;
};