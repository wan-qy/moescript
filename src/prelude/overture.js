// Moe Standard Prelude
//    ...'s overture
// Copyright(c) 2012 Belleve Invis

var derive = moert.derive;
var Nai = moert.Nai;

var reg = function(name, value){
	exports[name] = value
};

//: moert
reg('derive', derive);
reg('NamedArguments', moert.runtime.NamedArguments);

reg('endl', '\n');
reg('global_', (function(){return this})())

//: PrimitiveTypes
reg('math', derive(Math));
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

var _Type = function(p, f){
	var Aut = function(){};
	Aut.prototype = p;
	var T = function(){
		var o = new Aut();
		f.apply(o, arguments);
		return o;
	};
	T.new = T;
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

reg('debugger', function(){debugger});

reg('object', function(p, f){
	var o;
	if(!f){
		o = {};
		f = p
	} else if(p instanceof Function){
		o = function(){return p.apply(this, arguments)}
	} else {
		o = derive(p);
	};
	f.call(o);
	return o;
});

reg('seq', function(){return arguments[arguments.length - 1]})

var internalClassWrapper = function(C, f){
	var T = function(){return C.apply(this, arguments)}
	T.prototype = C.prototype
	T.be = function(x){return x instanceof C}
	T.formMatch = function(got, miss){return function(x){
		if(T.be(x))
			return got(x)
		else
			return miss(x)
	}};
	if(f) f.call(T, C, T);
	T.__ = C;
	T.toString = function(){ return 'function () { [Moe Wrapped Native Type] }'};
	return T
}

reg('_Object', Object);
reg('Object', internalClassWrapper(Object, function(){
	this.be = function(x){return x !== undefined}
}));
reg('Number', internalClassWrapper(Number, function(){
	this.be = function(x){return typeof x === 'number' || x instanceof Number}
}));
reg('Boolean', internalClassWrapper(Boolean, function(){
	this.be = function(x){return x === true || x === false}
}));
reg('Array', internalClassWrapper(Array, function(){
	this.formMatch = function(got, miss){return function(x){
		if(x instanceof Array && x.length >= got.length - 1){
			return got.apply(null, x.slice(0, got.length - 1).concat([x.slice(got.length - 1)]))
		} else {
			return miss(x)
		}
	}};
	this.isArray = this.be;
}));
reg('Function', internalClassWrapper(Function));
reg('String', internalClassWrapper(String, function(){
	this.be = function(x){return typeof x === 'string' || x instanceof String}
}));

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

reg('keysof', Object.keys || (function () {
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

reg('defaultMonadSchemata', moert.runtime.MONAD_SCHEMATA_M)