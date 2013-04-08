// << runtime.js >>
// << Nai >>
var Nai = function() {};
Nai.prototype = {
	constructor: undefined,
	toString: undefined, // comment this line to debug.
	valueOf: undefined,
	hasOwnProperty: undefined,
	propertyIsEnumerable: undefined
};

// << derive >>
var derive = Object.craate ? Object.create : function() {
	var F = function() {};
	return function(obj) {
		F.prototype = obj;
		return new F;
	}
}();

// << OWNS >>
var OWNS = function() {
	var hop = {}.hasOwnProperty;
	return function(o,p) {
		return hop.call(o,p)
	}
}();

// << SLICE >>
var SLICE = function() {
	var s = Array.prototype.slice;
	return function(x, m, n) {
		return s.call(x, m, n);
	};
} ();

// << UNIQ >>
var UNIQ = function(arr) {
	if (!arr.length) return arr;

	var b = arr.slice(0).sort();
	var t = [b[0]], tn = 1;
	for (var i = 1; i < b.length; i++)
		if (b[i] && b[i] != b[i - 1])
			t[tn++] = b[i];
	return t;
};

// << NamedArguments >>
var NamedArguments = function() { };
NamedArguments.prototype = new Nai();
NamedArguments.fetch = function(o, p) {
	if (OWNS(o, p)) return o[p]
}

var CREATE_NARGS = function(a){
	var na = new NamedArguments, kl = a.length;
	for (var i = 0; i < kl; i += 2)
		na[a[i]] = a[i + 1];
	return na;
}
// optimizations
var CREATE_NARGS0 = function(){
	return new NamedArguments;
};
var CREATE_NARGS1 = function(c1,v1){
	var na = new NamedArguments;
	na[c1] = v1;
	return na;
};
var CREATE_NARGS2 = function(c1,v1,c2,v2){
	var na = new NamedArguments;
	na[c1] = v1;
	na[c2] = v2;
	return na;
};
var CREATE_NARGS3 = function(c1,v1,c2,v2,c3,v3){
	var na = new NamedArguments;
	na[c1] = v1;
	na[c2] = v2;
	na[c3] = v3;
	return na;
};
var CREATE_NARGS4 = function(c1,v1,c2,v2,c3,v3,c4,v4){
	var na = new NamedArguments;
	na[c1] = v1;
	na[c2] = v2;
	na[c3] = v3;
	na[c4] = v4;
	return na;
};

// << CNARG >>
var CNARG = function(a) {
	if (a instanceof NamedArguments)
		return a
	else
		return new NamedArguments
};


// << OPERATORS >>
var IS = function(x, y){ return y.be(x) };
var AS = function(x, y){ return y.convertFrom(x) };

// << Keyword Functions >>
var IN = function(range){
	return {'be': function(x){return range.contains(x)}}
};
var THROW = function(x) {
	throw x || "[?] Unexpected error"
};
var NEGATE = function(x){return -x};
var NOT = function(x){return !x};

// << MONAD_SCHEMATA_M >>
var MONAD_SCHEMATA_M = {
	'return': function(x) { return x },
	'bindYield': function() { return arguments[0].apply(arguments[1], SLICE(arguments, 2)) },
	'bind': function(v, cb){ return cb(v) },
	'try': function(){
		throw "Try/Catch is not supported in this monadic schemata"
	},
	'resend': function(b, callback){
		var s = derive(this);
		s['return'] = callback;
		return b(s)();
	}
};

// << GETENUM >>
var GETENUM = function(obj){
	if(obj.getEnumerator) {
		return obj.getEnumerator()
	} else if(obj instanceof Array) {
		var t = obj.slice(0);
		var low = 0;
		var high = t.length;
		var i = low;
		var f = {active: true};
		f.emit = function(){
			if(i >= high) {
				f.active = false;
				return;
			} else {
				return t[i++]
			}
		};
		f.each = function(g){
			for(var i = low; i < high; i++)
				g(t[i])
		};
		return f;
	} else {
		throw new Error("Unable to get enumerator of " + obj)
	}
};


// << Ranges >>
var ExclusiveRange = function(left, right){
	return new ExclusiveAscRange(left, right)
};
var InclusiveRange = function(left, right){
	return new InclusiveAscRange(left, right)
};

var ExclusiveAscRange = function(left, right){
	this.left = left;
	this.right = right;
};
ExclusiveAscRange.prototype.getEnumerator = function(){
	var low = this.left;
	var high = this.right;
	var i = low;
	var f = {active: true}
	f.emit = function(){
		if(i >= high) {
			f.active = false
			return i;
		} else {
			return i++;
		}
	}
	f.each = function(g){
		for(var i = low, k = high; i < k; i++) g(i)
	}
	return f
};

var InclusiveAscRange = function(left, right){
	this.left = left;
	this.right = right;
};
InclusiveAscRange.prototype.getEnumerator = function(){
	var low = this.left;
	var high = this.right;
	var i = low;
	var f = {active: true}
	f.emit = function(){
		if(i > high) {
			f.active = false
			return i;
		} else {
			return i++;
		}
	}
	f.each = function(g){
		for(var i = low, k = high; i <= k; i++) g(i)
	}
	return f
};

// << export-interface >>
// All functions used for the runtime
exports.runtime = {
	CNARG: CNARG,
	SLICE: SLICE,
	THROW: THROW,
	NEGATE: NEGATE,
	NOT: NOT,
	IN: IN,
	IS: IS,
	AS: AS,
	ExclusiveRange: ExclusiveRange,
	InclusiveRange: InclusiveRange,
	NamedArguments: NamedArguments,
	NARGS: CREATE_NARGS,
	NARGS0: CREATE_NARGS0,
	NARGS1: CREATE_NARGS1,
	NARGS2: CREATE_NARGS2,
	NARGS3: CREATE_NARGS3,
	NARGS4: CREATE_NARGS4,
	GETENUM: GETENUM
};

// util functions used for the compiler or the prelude
exports.derive = derive;
exports.Nai = Nai;
exports.MONAD_SCHEMATA_M = MONAD_SCHEMATA_M;
exports.OWNS = OWNS;
exports.UNIQ = UNIQ;