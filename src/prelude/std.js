//:^
// Moe standard library
//	:author:		infinte (aka. be5invis)
//	:info:			The standard library for Lofn.

//-! with moert/runtime

var derive = moert.derive;
var Nai = moert.Nai;

var CNARG = moert.runtime.CNARG;
var CREATERULE = moert.runtime.CREATERULE;
var IINVOKE = moert.runtime.IINVOKE;
var M_TOP = moert.runtime.M_TOP;
var NamedArguments = moert.runtime.NamedArguments;
var OBSTRUCTIVE = moert.runtime.OBSTRUCTIVE;
var OBSTRUCTIVE_SCHEMATA_M = moert.runtime.OBSTRUCTIVE_SCHEMATA_M;
var OWNS = moert.runtime.OWNS;
var RETURNVALUE = moert.runtime.RETURNVALUE;
var RMETHOD = moert.runtime.RMETHOD;
var SLICE = moert.runtime.SLICE;
var THROW = moert.runtime.THROW;
var TRY = moert.runtime.TRY;
var UNIQ = moert.runtime.UNIQ;
var YIELDVALUE = moert.runtime.YIELDVALUE;
var MOE_GET_ENUM = moert.runtime.GET_ENUM;


var reg = function(name, value){
	exports[name] = value
};

//: moert
reg('derive', derive);
reg('NamedArguments', NamedArguments);

reg('endl', '\n');

//: PrimitiveTypes
reg('Math', derive(Math));
reg('RegExp', function(){
	var R = function(){
		return RegExp.apply(this, arguments)
	};
	R.be = function(o){
		return o instanceof RegExp
	};
	R.convertFrom = function(s){
		return RegExp(s)
	};
	
	var rType = function(options){
		R[options] = function(s){
			return RegExp(s, options)
		};
		R[options].convertFrom = function(s){
			return RegExp(s, options)
		}
	};

	rType('g');
	rType('i');
	rType('m');
	rType('gi');
	rType('gm');
	rType('im');
	rType('gim');

	R.walk = function(r, s, fMatch, fGap){
		var l = r.lastIndex;
		fMatch = fMatch || function(){};
		fGap = fGap || function(){};
		var match, last = 0;
		while(match = r.exec(s)){
			if(last < match.index) fGap(s.slice(last, match.index));
			if(fMatch.apply(this, match)) fGap.apply(this, match);
			last = r.lastIndex;
		};
		if(last < s.length) fGap(s.slice(last));
		r.lastIndex = l;
		return s;
	};

	return R;
}());

reg('Date', function(){
	var f = function(){
		var a = arguments;
		switch(a.length){
			case 0: return new Date();
			case 1: return new Date(a[0]);
			case 2: return new Date(a[0], a[1]);
			case 3: return new Date(a[0], a[1], a[2]);
			case 4: return new Date(a[0], a[1], a[2], a[3]);
			case 5: return new Date(a[0], a[1], a[2], a[3], a[4]);
			case 6: return new Date(a[0], a[1], a[2], a[3], a[4], a[5]);
			default: return new Date(a[0], a[1], a[2], a[3], a[4], a[5], a[6]);
		};
	};
	f['new'] = f.convertFrom = f;
	f.now = function(){return new Date()};
	return f;
}());

//: operator
reg('operator', {
	add:	function (a, b) { return a + b },
	addf:	function (a, b) { return (a - 0) + (b - 0)},
	concat:	function (a, b) { return '' + a + b },
	minus:	function (a, b) { return a - b },
	times:	function (a, b) { return a * b },
	divide:	function (a, b) { return a / b },
	mod:	function (a, b) { return a % b },
	shl:	function (a, n) { return a << n },
	shr:	function (a, n) { return a >> n },
	shrf:	function (a, n) { return a >>> n },
	band:	function (a, b) { return a & b },
	bor:	function (a, b) { return a | b },
	bnot:	function (a, b) { return ~a },
	bxor:	function (a, b) { return a ^ b},
	and:	function (a, b) { return a && b},
	or: 	function (a, b) { return a || b}
});

reg('YieldValue', {be: function(x){return x instanceof YIELDVALUE}});
reg('ReturnValue', {be: function(x){return x instanceof RETURNVALUE}});

var _Type = function(p, f){
	var Aut = function(){};
	Aut.prototype = p;
	var T = function(){return f.apply(this, arguments)}
	T['new'] = function(){
		var o = new Aut();
		f.apply(o, arguments);
		return o;
	};
	T.prototype = p;
	return T
}
var Type = function(f){
	return _Type({}, f)
};
Type.of = function(x){return typeof x};
Type.outof = function(T){
	return function(f){
		return _Type((typeof T === 'function' ? new T() : derive(T)), f)
	}
};

reg('type', Type);
reg('outof', Type.outof);

var enumeratorSchemata = {
	'return': function(v){
		return new RETURNVALUE(v)
	},
	'bind': function(g, restart){
		return new YIELDVALUE(g, restart);
	},
	'yield': function(j){ return j }
};
var generateEmitter = function(d){
	var emitRestart = d;
	var emit = function(){
		var v = emitRestart();
		if(v.restart && v.values){
			emitRestart = v.restart;
			return v.values;
		}
	};
	return emit
};
//: enumerator
var enumeration;
reg('enumeration', enumeration = function(){
	var f = function(M, t){
		var G = M.build(enumeratorSchemata);
		return function(){
			return generateEmitter(G.apply(t || this, arguments));
		}
	};
	f.bypass = function(g, restart){
		return new YIELDVALUE(g, restart)
	};
	f['yield'] = function(restart){
		return new YIELDVALUE(SLICE(arguments, 0, -1), arguments[arguments.length - 1]);
	};
	return f;
}());
reg('Enumerable', function(M){
	var G = M.build(enumeratorSchemata);
	return function(){
		var t = this, a = arguments;
		return {getEnumerator: function(){
			return generateEmitter(G.apply(t, a));
		}}
	}
});
reg('getEnumeratorOf', MOE_GET_ENUM);
reg('rangeFor', function(range, f){
	var e = MOE_GET_ENUM(range);
	if(e.enumerate) return e.enumerate(f)
	else {
		var t = null
		while((t = e())) f.apply(null, t)
	}
})

reg('debugger', function(){debugger});

reg('object', function(p, f){
	var o;
	if(!f){
		o = {};
		f = p
	} else {
		o = derive(p);
	};
	f.call(o);
	return o;
});

reg('seq', function(){return arguments[arguments.length - 1]})

reg('Object', Object);
reg('Number', Number);
reg('Boolean', Boolean);
reg('Array', Array);
reg('Function', Function);
reg('String', String);

// trace and tracel
if(typeof console === undefined){
	console = {
		log: function(){}
	}
};
var trace = function(xs){
	var s = '';
	for (var i = 0; i < arguments.length; i++)
		s += arguments[i];
	console.log(s);
	return arguments[arguments.length - 1];
};
reg('trace', trace);

reg('instanceof', function(f){
	return {be: function(x){return x instanceof f}}
});

reg('keys', Object.keys || (function () {
    var hasOwnProperty = Object.prototype.hasOwnProperty,
        hasDontEnumBug = !{toString:null}.propertyIsEnumerable("toString"),
        DontEnums = [
            'toString',
            'toLocaleString',
            'valueOf',
            'hasOwnProperty',
            'isPrototypeOf',
            'propertyIsEnumerable',
            'constructor'
        ],
        DontEnumsLength = DontEnums.length;
 
    return function (o) {
        if (typeof o != "object" && typeof o != "function" || o === null)
            throw new TypeError("Object.keys called on a non-object");
 
        var result = [];
        for (var name in o) {
            if (hasOwnProperty.call(o, name))
                result.push(name);
        }
 
        if (hasDontEnumBug) {
            for (var i = 0; i < DontEnumsLength; i++) {
                if (hasOwnProperty.call(o, DontEnums[i]))
                    result.push(DontEnums[i]);
            }
        }
 
        return result;
    };
})());