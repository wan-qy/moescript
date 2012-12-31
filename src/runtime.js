//: Nai
var Nai = function() {};
Nai.prototype = {
	constructor: undefined,
//	toString: undefined, // comment this line for debug.
	valueOf: undefined,
	hasOwnProperty: undefined,
	propertyIsEnumerable: undefined
};

//: derive
var derive = Object.craate ? Object.create : function() {
	var F = function() {};
	return function(obj) {
		F.prototype = obj;
		return new F;
	}
}();
var derive = derive;

//: OWNS
var OWNS = function() {
	var hop = {}.hasOwnProperty;
	return function(o,p) {
		return hop.call(o,p)
	}
}();

//: SLICE
var SLICE = function() {
	var s = Array.prototype.slice;
	return function(x, m, n) {
		return s.call(x, m, n);
	};
} ();

//: UNIQ
var UNIQ = function(arr) {
	if (!arr.length) return arr;

	var b = arr.slice(0).sort();
	var t = [b[0]], tn = 1;
	for (var i = 1; i < b.length; i++)
		if (b[i] && b[i] != b[i - 1])
			t[tn++] = b[i];
	return t;
};

//: NamedArguments
var NamedArguments = function() { };
var NamedArguments = NamedArguments;
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

//: CNARG
var CNARG = function(a) {
	if (a instanceof NamedArguments)
		return a
	else
		return new NamedArguments
}

//: AUX-METHODS
var M_TOP = function() {return this}();
var RMETHOD = function(l, r, m) {
	return r[m](l)
}
var YIELDVALUE = function(a, restart) {
	this.values = a;
	this.restart = restart;
}
var RETURNVALUE = function(x) {
	this.value = x
}
//: MONAD_SCHEMATA_M
var MONAD_SCHEMATA_M = {
	'return': function(x) { return x },
	'bindYield': function() { return arguments[0].apply(arguments[1], SLICE(arguments, 2)) },
	'bind': function(v, cb){ return cb(v) }
}

//: Exceptions
var THROW = function(x) {
	throw x || "[?] Unexpected error"
};
var NEGATE = function(x){return -x}
var NOT = function(x){return !x}

var IS = function(x, y){ return y.be(x) }
var AS = function(x, y){ return y.convertFrom(x) }

var SCHEMATA_BLOCK = function(G, schemata, coming){
	if(G.build){
		var m = derive(schemata);
		m['return'] = coming;
		return G.build(m)()();
	} else {
		return coming(G())
	}
};

var GET_ENUM = function(obj){
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

var IN = function(range){
	return {'be': function(x){return range.contains(x)}}
};

//: ES5
// Essential ES5 prototype methods
if (!Array.prototype.map) {
	Array.prototype.map = function(fun /*, thisp */) {
		"use strict";

		if (this === void 0 || this === null)
			throw new TypeError();

		var t = Object(this);
		var len = t.length >>> 0;
		if (typeof fun !== "function")
			throw new TypeError();

		var res = new Array(len);
		var thisp = arguments[1];
		for (var i = 0; i < len; i++) {
			if (i in t)
				res[i] = fun.call(thisp, t[i], i, t);
		}

		return res;
	};
};
if (!Array.prototype.some) {
	Array.prototype.some = function(fun /*, thisp */) {
		"use strict";

		if (this === void 0 || this === null)
			throw new TypeError();

		var t = Object(this);
		var len = t.length >>> 0;
		if (typeof fun !== "function")
			throw new TypeError();

		var thisp = arguments[1];
		for (var i = 0; i < len; i++) {
			if (i in t && fun.call(thisp, t[i], i, t))
				return true;
		}

		return false;
	};
}
if (!Array.prototype.reduce) {
	Array.prototype.reduce = function(fun /*, initialValue */)
	{
		"use strict";

		if (this === void 0 || this === null)
			throw new TypeError();

		var t = Object(this);
		var len = t.length >>> 0;
		if (typeof fun !== "function")
			throw new TypeError();

		// no value to return if no initial value and an empty array
		if (len == 0 && arguments.length == 1)
			throw new TypeError();

		var k = 0;
		var accumulator;
		if (arguments.length >= 2) {
			accumulator = arguments[1];
		} else {
			do {
				if (k in t) {
					accumulator = t[k++];
					break;
				}

				// if array contains no values, no initial value to return
				if (++k >= len) throw new TypeError();
			} while (true);
		}

		while (k < len) {
			if (k in t)
				accumulator = fun.call(undefined, accumulator, t[k], k, t);
			k++;
		}

		return accumulator;
	};
};
if (!Array.prototype.reduceRight) {
	Array.prototype.reduceRight = function(callbackfn /*, initialValue */) {
		"use strict";

		if (this === void 0 || this === null)
			throw new TypeError();

		var t = Object(this);
		var len = t.length >>> 0;
		if (typeof callbackfn !== "function")
			throw new TypeError();

		// no value to return if no initial value, empty array
		if (len === 0 && arguments.length === 1)
			throw new TypeError();

		var k = len - 1;
		var accumulator;
		if (arguments.length >= 2) {
			accumulator = arguments[1];
		} else {
			do {
				if (k in this) {
					accumulator = this[k--];
					break;
				}

				// if array contains no values, no initial value to return
				if (--k < 0)
					throw new TypeError();
			} while (true);
		}

		while (k >= 0) {
			if (k in t)
				accumulator = callbackfn.call(undefined, accumulator, t[k], k, t);
			k--;
		}

		return accumulator;
	};
}
if (!Array.prototype.every) {
	Array.prototype.every = function(fun /*, thisp */) {
		"use strict";

		if (this === void 0 || this === null)
			throw new TypeError();

		var t = Object(this);
		var len = t.length >>> 0;
		if (typeof fun !== "function")
			throw new TypeError();

		var thisp = arguments[1];
		for (var i = 0; i < len; i++) {
			if (i in t && !fun.call(thisp, t[i], i, t))
				return false;
		}

		return true;
	};
}
if (!Array.prototype.filter) {
	Array.prototype.filter = function(fun /*, thisp */) {
		"use strict";

		if (this === void 0 || this === null)
			throw new TypeError();

		var t = Object(this);
		var len = t.length >>> 0;
		if (typeof fun !== "function")
			throw new TypeError();

		var res = [];
		var thisp = arguments[1];
		for (var i = 0; i < len; i++) {
			if (i in t) {
				var val = t[i]; // in case fun mutates this
				if (fun.call(thisp, val, i, t))
					res.push(val);
			}
		}

		return res;
	};
}
if (!Array.prototype.forEach) {
	Array.prototype.forEach = function(fun /*, thisp */) {
		"use strict";

		if (this === void 0 || this === null)
			throw new TypeError();

		var t = Object(this);
		var len = t.length >>> 0;
		if (typeof fun !== "function")
			throw new TypeError();

		var thisp = arguments[1];
		for (var i = 0; i < len; i++) {
			if (i in t)
				fun.call(thisp, t[i], i, t);
		}
	};
}

var RANGE_EX = function(left, right){
	return new ExclusiveAscRange(left, right)
};
var RANGE_INCL = function(left, right){
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

//: moe-master
var moe = exports;

moe.runtime = moe.rt = {
	CNARG: CNARG,
	M_TOP: M_TOP,
	MONAD_SCHEMATA_M: MONAD_SCHEMATA_M,
	OWNS: OWNS,
	RETURNVALUE: RETURNVALUE,
	RMETHOD: RMETHOD,
	SLICE: SLICE,
	THROW: THROW,
	NEGATE: NEGATE,
	NOT: NOT,
	IN: IN,
	IS: IS,
	AS: AS,
	SCHEMATA_BLOCK: SCHEMATA_BLOCK,
	UNIQ: UNIQ,
	YIELDVALUE: YIELDVALUE,
	RANGE_EX: RANGE_EX,
	RANGE_INCL: RANGE_INCL,
	NamedArguments: NamedArguments,
	NARGS: CREATE_NARGS,
	NARGS0: CREATE_NARGS0,
	NARGS1: CREATE_NARGS1,
	NARGS2: CREATE_NARGS2,
	NARGS3: CREATE_NARGS3,
	NARGS4: CREATE_NARGS4,
	GET_ENUM: GET_ENUM
};

moe.derive = derive;
moe.Nai = Nai;