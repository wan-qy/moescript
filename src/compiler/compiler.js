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
			.replace(/\r\n/g,   '\n')
			.replace(/\r/g,     '\n');
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

var sourceSlice = function(source, p, q){
	var slice = source.slice(p, q);
	if(slice.trim()){
		return slice.replace(/\s+$/, '').replace(/^/gm, '/// SEMB // ! // ') + '\n';
	} else {
		return ''
	}
};
var rSmapBegin = /^[ \t]*\/\/\/ SMAP \/\/ \[ \/\/ (\d+);.*\n/gm
var generateSourceMap = function(source, generated){
	var a = [], s = [];
	generated.replace(rSmapBegin, function(m, pos){
		a.push(pos - 0);
		return m;
	});
	a.push(source.length);

	var remap = [0];
	for(var j = 0; j < source.length; j++)
		if(source.charAt(j) === '\n')
			remap.push(j + 1);
	remap.push(source.length);
	//console.log(remap);

	//console.log(a.slice(0));
	// position "rounding"
	var lastLine = 0;
	for(var i = 0; i < a.length; i++){
		while(a[i] >= remap[lastLine + 1]){
			lastLine ++;
		}
		a[i] = remap[lastLine]
	};
	for(var i = a.length - 1; i > 1; i--){
		if(a[i - 1] === a[i - 2])
			a[i - 1] = a[i];
	}

	for(var i = 0; i < a.length - 1; i++) 
		s[i] = sourceSlice(source, a[i], a[i + 1]);

	i = 0;
	return generated.replace(rSmapBegin, function(){
		return s[i++];
	});
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
	var trees = lfc_resolver.resolve(ast, config);
	var enter = trees[0];

	var initializationCode = "var undefined;\n" + function(){
		var s = '';
		for(var item in moe.runtime) if(OWNS(moe.runtime, item)) {
			s += 'var ' + C_TEMP(item) + ' = ' + PART(config.runtimeName, item) + ';\n';
		};
		config.initVariables(function(v, n){
			s += 'var ' + C_NAME(n) + ' = ' + (v || PART(config.initsName, n)) + ';\n';
		});
		return s;
	}();

	var generator = Generator(trees, config);
	var generatedCode = generator(enter, true);

	if(ast.options.smap){

	} else {
		if(ast.options.debug){
			generatedCode = generateSourceMap(source, generatedCode)
		}
		generatedCode = generatedCode.replace(/^\s*\/\/\/(?! SEMB).*\n/gm, '');
	}

	return {
		trees: trees,
		generatedCode: generatedCode,
		initializationCode: initializationCode,
		aux: config
	}
};

exports.stdComposite = function(script, aux){
	return 'var ' + script.aux.runtimeName + ' = ' + (aux.runtimeBind || 'require' + '("moe").runtime' ) + '\n' +
		script.initializationCode + '\n' + script.generatedCode 
};