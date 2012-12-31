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

var SCOPE_LOCKED_ERR = new Error("Top scope locked. Cannot add more binds.")
var TopScope = function(){
	this.maps = {};

	this.fInits = function(f){
		var maps = this.maps;
		for(var item in maps) if(typeof maps[item] == 'string'){
			f(maps[item], item);
		}
	};

	this.runtimeName = C_TEMP('RUNTIME');
	this.initsName = C_TEMP('INITS');
};
TopScope.prototype.bind = function(n, s){
	if(this.locked) throw SCOPE_LOCKED_ERR;
	return (this.maps[n] = s);
};
TopScope.prototype.partBind = function(n, obj, prop){
	if(this.locked) throw SCOPE_LOCKED_ERR;
	return this.bind(n, PART(obj, prop));
};
TopScope.prototype.libRequireBind = function(lib, bind){
	if(this.locked) throw SCOPE_LOCKED_ERR;
	for(var item in lib) if(/^[a-zA-Z_]\w*$/.test(item) && OWNS(lib, item)) {
		this.bind(item, PART(bind, item));
	}
};
TopScope.prototype.createInitializationCode = function(){
	var s = "var undefined;\n";
	for(var item in moe.runtime) if(OWNS(moe.runtime, item)) {
		s += 'var ' + C_TEMP(item) + ' = ' + PART(this.runtimeName, item) + ';\n';
	};
	this.fInits(function(v, n){
		s += 'var ' + C_NAME(n) + ' = ' + v + ';\n';
	});
	return s;
}

TopScope.fromSimpleMap = function(map){
	if(map instanceof TopScope) return map;
	var ts = new TopScope();
	for(var term in map) if(OWNS(map, term)) ts.bind(term, map[term]);
	return ts;
};

//============
var lex = exports.lex = moec_lexer.lex;
var parse = exports.parse = moec_parser.parse;
//============
var Generator = moec_codegen.Generator;

var inputNormalize = exports.inputNormalize = function(s){
	s = s.replace(/^\ufeff/, '').replace(/^\ufffe/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
	return '\n' + s + '\n';
};

var compile = function (source, ts, config) {
	source = inputNormalize(source);
	ts = TopScope.fromSimpleMap(ts);
	
	config = derive(config || {});
	config.makeT = moecrt.TMaker();
	config.warn = config.warn || function(){ };
	config.PW = moecrt.PWMeta(source);
	config.PE = moecrt.PEMeta(config.PW);

	// Parse
	var ast = parse(lex(source, config), source, config);
	config.options = ast.options;
	
	// Scopes formation + variable resolve
	var trees = moec_resolver.resolve(ast, ts, config);
	var enter = trees[0];

	// Generate code
	var generator = Generator(trees, config);
	var generatedInfo = generator(enter, true);

	generatedInfo.source = source;
	generatedInfo.ts = ts;
	generatedInfo.trees = trees;
	generatedInfo.aux = config;
	generatedInfo.astOptions = ast.options;

	return generatedInfo;
};


exports.compile = compile;
exports.TopScope = TopScope;
exports.createSmap = function(){
	// TODO
};

exports.stdComposite = function(info, ts){
	ts = ts || info.ts;
	return '(function(){var ' + ts.runtimeName + ' = ' + (ts.runtimeBind || 'require' + '("moe").runtime' ) + '\n' +
		ts.createInitializationCode() + '\n' + info.generatedCode + '}());';
};