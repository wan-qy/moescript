//:module: compiler runtime -- compilerrt
//	:author:		infinte (aka. be5invis)
//	:info:			The essential environment for Moe Compiler

var moe = require('../runtime');
var Nai = moe.Nai;
var Hash = moe.Hash;

var derive = moe.derive;

var $ = function(template, items_){
	var a = arguments;
	return template.replace(/%(\d+)/g, function(m, $1){
		return a[parseInt($1, 10)] || '';
	});
};

var PW_flatLine = function(line){
	return line.replace(/^\n+|\n+$/g, '').replace(/\t/g, '    ')
}

var PWMeta = exports.PWMeta = function(source, positionGetter){
	positionGetter = positionGetter || function(p){ return p == undefined ? source.length : p };
	var lines = source.split('\n');
	return function(message, p){
		var pos = 2 + positionGetter(p);
		var posSofar = 0;
		for(var i = 0; i < lines.length; i++){
			posSofar += 1 + lines[i].length;
			if(posSofar >= pos) break;
		};
		var linePrev = lines[i - 1] || ''
		var line = lines[i] || '';
		var lineNext = lines[i + 1] || ''
		var lineFront = line.slice(0, line.length - posSofar + pos);
		message = $('%1 \n %2\n %3\n   %4^^^\n %5',
				message,
				(i > 0 ? (i) + ': ' + linePrev : ''),
				((i + 1) + ': ' + line),
				((i + 1) + lineFront).replace(/\S/g, ' ').slice(0, -1),
				((i + 2) + ': ' + lineNext));
		return message;
	};
};
var PEMeta = exports.PEMeta = function(PW){
	return function(){
		return new Error(PW.apply(this, arguments))
	}
};

var NodeType = exports.NodeType = function () {
	var types = [
		// Unknown type
		'UNKNOWN',
		// Primary
		'VARIABLE', 'TEMPVAR', 'THIS', 'LITERAL', 'ARRAY', 'OBJECT', 'FUNCTION', 'BLOCK',
		'ARGUMENTS', 'ARGN', 'ARG0', 'GROUP', 'PESUDO_FUNCTION', 'UNIT',
		// Wrappers
		'BINDPOINT', 'CTOR',
		// Membering
		'MEMBER', 
		// Invocation
		'CALL', 'CALLBLOCK',
		// Singular Operators
		'NEGATIVE', 'NOT',
		// Binary Operators
		// NOTE: direct-converted operators must be ordered from higher priority to lower priority
		'*', '/', '%',
		'+', '-',
		'<', '>', '<=', '>=', 'is', 'in',
		'==', '!=', '=~', '!~', '===', '!==',
		'and', '&&',
		'or', '||',
		'..', '...',
		'as',
		// Sequence 
		'then',
		// Conditional
		'CONDITIONAL',
		// Assignment
		'ASSIGN', 'RETURN',

		// Statements
		'IF', 'WHILE', 'REPEAT', 'VAR', 'BREAK', 'LABEL', 
		// Large-scale
		'TRY', 'PARAMETERS', 'SCRIPT', 'PROGRAM'];

	var T = {};
	for (var i = 0; i < types.length; i++)
		T[types[i]] = function(j){return {
			ts: types[j],
			ti: j,
			valueOf: function(){return j},
			toString: function(){return types[j]}
		}}(i);

	T.MIN_BINARY_OPERATOR = T['*']
	T.MAX_BINARY_OPERATOR = T['as']
	T.MAX_EXPRESSIONAL = T['ASSIGN']
	T.MAX_INTERNAL_EXPRESSIONAL = T['RETURN']
	return T;
} ();
var nt = NodeType;
var ScopedScript = exports.ScopedScript = function (id, env) {
	this.id = id;
	this.variables = new Hash;
	this.labels = {};
	this.upper = null;
	this.type = NodeType.SCOPE;
	this.nest = [];
	this.locals = [];
	this.fid = "F" + id.toString(36);
	this.usedVariables = new Hash;
	this.usedVariablesOcc = new Hash;
	this.usedVariablesAssignOcc = new Hash;
	this.usedTemps = new Hash;
	this.grDepth = 0;
	this.sharpNo = 0;
	this.finNo = 0;
	this.coroid = false;
	this.initHooks = {};
	this.pendNewVars = [];
	if(env){
		env.hasNested = true;
		env.nest.push(this.id);
		this.parent = env;
		this.variables = derive(env.variables);
	}
};
ScopedScript.prototype.pendNewVar = function (name, parQ, constQ, pos) {
	this.pendNewVars.push({
		name: name,
		parQ: parQ,
		constQ: constQ,
		pos: pos
	})
}
ScopedScript.prototype.newVar = function (name, parQ, constQ, explicitQ) {
	if(!this.variables.get(name)){
		// New variable
		this.variables.put(name, {
			id: this.id,
			parQ: parQ,
			constQ: constQ
		})
	} else if (this.variables.get(name).id === this.id) {
		// Same scope redeclare
		if(this.variables.get(name).constQ || constQ){
			throw ("Attempt to redefine constant " + name)
		}
		return;
	} else {
		// Shadowing
		var rv;
		if(this.variables.get(name).constQ && !parQ) {
			if(explicitQ){
				throw ("Attempt to shadow constant " + name)
			} else {
				rv = "Shadowing constant " + name;
			}
		};
		this.variables.put(name, {
			id: this.id,
			parQ: parQ,
			constQ: constQ
		});
		return rv;
	};
};
ScopedScript.prototype.useVar = function (name, position) {
	this.usedVariables.put(name, true);
	if(this.usedVariablesOcc.get(name) === undefined) {
		this.usedVariablesOcc.put(name, position);
	}
};
ScopedScript.prototype.useTemp = function(name, processing){
	// Processing:
	// 0: As variable
	// 1: As Parameter
	// 2: Special
	if(!this.usedTemps.get(name)) {
		this.usedTemps.put(name, (processing || 0) + 1);
	}
};
ScopedScript.VARIABLETEMP = 0;
ScopedScript.PARAMETERTEMP = 1;
ScopedScript.SPECIALTEMP = 2;

exports.walkNode = function(node, f, aux){
	if(!node) return;
	if(!node.type) return;
	var res = false;
	for(var each in node) if(node[each]){
		var prop = node[each];
		if(prop.length && prop.slice){
			for(var i = 0; i < prop.length; i++)
				if(prop[i] && prop[i].type)
					res = f(prop[i], aux) || res
		} else if (prop.type) {
			res = f(prop, aux) || res
		}
	};
	return res;
};
exports.walkNodeTF = function(node, f, aux){
	if(!node) return;
	if(!node.type) return;
	var res;
	for(var each in node) if(node[each]){
		var prop = node[each];
		if(prop.length && prop.slice){
			for(var i = 0; i < prop.length; i++)
				if(prop[i] && prop[i].type) {
					res = f(prop[i], aux);
					if(res) prop[i] = res;
				}
		} else if (prop.type) {
			res = f(prop, aux)
			if(res) node[each] = res;
		}
	};
	return node;
};

exports.TMaker = function(){
	var ns = {};
	return function(e, namespace){
		namespace = namespace || '';
		if(!ns[namespace]) ns[namespace] = 0
		var id = namespace + '_' + ns[namespace].toString(36);
		ns[namespace] += 1
		if(e) e.useTemp(id);
		return id;
	};
};

exports.MakeNode = function (type, props, position) {
	var p = props || {};
	p.type = type , p.bp = p.bp || 0;
	p.position = position;
	return p
};

exports.walkRex = function(r, s, fMatch, fGap){
	var l = r.lastIndex;
	r.lastIndex = 0;
	fMatch = fMatch || function(){};
	fGap = fGap || function(){};
	var match, last = 0;
	while(match = r.exec(s)){
		if(last < match.index) fGap(s.slice(last, match.index), last);
		if(fMatch.apply(this, (match.push(match.index), match))) fGap.apply(this, match);
		last = r.lastIndex;
	};
	if(last < s.length) fGap(s.slice(last), last);
	r.lastIndex = l;
	return s;
};
exports.composeRex = function(r, o){
	var source = r.source;
	var g = r.global;
	var i = r.ignoreCase;
	var m = r.multiline;
	source = source.replace(/#\w+/g, function(word){
		word = word.slice(1);
		if(o[word] instanceof RegExp) return o[word].source
		else return word
	});
	return new RegExp(source, (g ? 'g' : '') + (i ? 'i' : '') + (m ? 'm' : ''));
};
exports.C_STRING = function(){
	var CTRLCHR = function (c) {
		var x = c.charCodeAt(0).toString(16), q = x.length;
		return '\\u' + (q < 4 ? '0' + (q < 3 ? '0' + (q < 2 ? '0' + x : x) : x) : x);
	};
	return function (s) {
		return '"' + (s || '')
			.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\t/g, '\\t')
			.replace(/[\x00-\x1f\x7f-\uffff]/g, CTRLCHR)
			.replace(/<\/(script)>/ig, '<\x2f$1\x3e') + '"';
	};
}();
exports.nodeSideEffectiveQ = function(node){
	if(!node) return false;
	while(node.type === nt.GROUP) node = node.operand;
	return (node.type !== nt.VARIABLE 
		&& node.type !== nt.TEMPVAR 
		&& node.type !== nt.LITERAL 
		&& node.type !== nt.THIS 
		&& node.type !== nt.ARGUMENTS)
};