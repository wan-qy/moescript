// Moe Standard Prelude
//    ...'s overture
// Copyright(c) 2012 Belleve Invis

var moert = require('./runtime');

var derive = moert.derive;
var Nai = moert.Nai;

var reg = function(name, value){
	exports[name] = value
};

//: moert
reg('derive', derive);
reg('NamedArguments', moert.runtime.NamedArguments);
reg('JSON', (function(){return this})().JSON);

reg('endl', '\n');
reg('global_', (function(){return this})())


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

// Math functions
reg('math', function(){
	var m = derive(Math);
	m.randInt = function(p, q){
		if(arguments.length < 2){
			q = p; p = 0;
		};
		return Math.floor(p + Math.random() * (q - p))
	};
	return m;
}());

var _Type = function(p, f){
	var Aut = function(){};
	Aut.prototype = p;
	var T = function(){
		if(this instanceof Aut){
			var o = this;
		} else {
			var o = new Aut();
		}
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
Type.inherits = function(T){
	return function(f){
		return Type.outof(T)(function(){
			if(typeof T === 'function') T.apply(this, arguments);
			return f.apply(this, arguments);
		})
	}
}

reg('type', Type);
reg('outof', Type.outof);
reg('inherits', Type.inherits);

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
	this.be = function(x){return x !== undefined};
	this.getPrototypeOf = Object.getPrototypeOf  
	this.getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor  
	this.getOwnPropertyNames = Object.getOwnPropertyNames  
	this.create = Object.create  
	this.defineProperty = Object.defineProperty  
	this.defineProperties = Object.defineProperties 
	this.seal = Object.seal  
	this.freeze = Object.freeze  
	this.preventExtensions = Object.preventExtensions  
	this.isSealed = Object.isSealed  
	this.isFrozen = Object.isFrozen  
	this.isExtensible = Object.isExtensible  
	this.keys = Object.keys  
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
reg('Number', internalClassWrapper(Number, function(){
	this.be = function(x){return typeof x === 'number' || x instanceof Number}
	this.convertFrom = function(x){return x - 0}
	this.MAX_VALUE = Number.MAX_VALUE;
	this.POSITIVE_INFINITY = Number.POSITIVE_INFINITY;
	this.MIN_VALUE = Number.MIN_VALUE;
	this.NEGATIVE_INFINITY = Number.NEGATIVE_INFINITY;
	this.NaN = Number.NaN;
}));
reg('Boolean', internalClassWrapper(Boolean, function(){
	this.be = function(x){return x === true || x === false}
	this.convertFrom = function(x){return !!x}
}));
reg('String', internalClassWrapper(String, function(){
	this.be = function(x){return typeof x === 'string' || x instanceof String}
	this.convertFrom = function(x){return x + ""}
}));
reg('Error', internalClassWrapper(Error));
reg('Date', Date);
reg('RegExp', internalClassWrapper(RegExp, function(){
	var R = this;
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
		r.lastIndex = 0;
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
}));
reg('Primitive', function(){
	var P = function(){};
	var C_STRING = function(){
		var CTRLCHR = function (c) {
			var n = c.charCodeAt(0);
			return '\\x' + (n > 15 ? n.toString(16) : '0' + n.toString(16));
		};
		return function (s) {
			return '"' + (s || '')
				.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
				.replace(/[\x00-\x1f\x7f]/g, CTRLCHR)
				.replace(/<\/(script)>/ig, '<\x2f$1\x3e') + '"';
		};
	}();
	P.be = function(x){return !x || typeof x === 'number' || typeof x === 'string' || typeof x === 'boolean'};
	P.stringify = function(x){
		if(typeof x === 'string') return C_STRING(x)
		else return '' + x
	};
	return P;
}());

// trace and tracel
if(typeof console === 'undefined'){
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
if(typeof process !== 'undefined' && process.stderr){
	// Use STDERR in node
	trace = function(xs){
		var s = '';
		for (var i = 0; i < arguments.length; i++)
			s += arguments[i];
		process.stderr.write(s + '\n');
		return arguments[arguments.length - 1];		
	}
}
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

reg('defaultMonadSchemata', moert.MONAD_SCHEMATA_M);
;
(function(){var RUNTIME$_ = moert.runtime
var undefined;
var CNARG$_ = RUNTIME$_.CNARG;
var SLICE$_ = RUNTIME$_.SLICE;
var THROW$_ = RUNTIME$_.THROW;
var NEGATE$_ = RUNTIME$_.NEGATE;
var NOT$_ = RUNTIME$_.NOT;
var IN$_ = RUNTIME$_.IN;
var IS$_ = RUNTIME$_.IS;
var AS$_ = RUNTIME$_.AS;
var ExclusiveRange$_ = RUNTIME$_.ExclusiveRange;
var InclusiveRange$_ = RUNTIME$_.InclusiveRange;
var NamedArguments$_ = RUNTIME$_.NamedArguments;
var NARGS$_ = RUNTIME$_.NARGS;
var NARGS0$_ = RUNTIME$_.NARGS0;
var NARGS1$_ = RUNTIME$_.NARGS1;
var NARGS2$_ = RUNTIME$_.NARGS2;
var NARGS3$_ = RUNTIME$_.NARGS3;
var NARGS4$_ = RUNTIME$_.NARGS4;
var GETENUM$_ = RUNTIME$_.GETENUM;
var UA_LIST$_ = RUNTIME$_.UA_LIST;
var exports$ = exports;
var moert$ = moert;


var _$_ARGS = [];
var _$_ARGND = {};
var Array$, Date$, Enumerable$, Function$, MONAD_SCHEMATA_M$, OWNS$, Object$, Primitive$, Reaction$, RegExp$, async$, compose$, cons$, createAsyncSchemata$, derive$, doon$, enumeration$, export$, getEnumeratorOf$, global_$, hash$, inspect$, instanceof$, its$, itself$, join$, keysof$, list$, match$, math$, nothing$, object$, pairsof$, pcl$, pcr$, qjoin$, rangeForEach$, returns$, select$, sleep$, start$, table$, takeWhile$, tee$, time$, type$;
derive$ = exports$.derive;
Object$ = exports$.Object;
Function$ = exports$.Function;
object$ = exports$.object;
global_$ = exports$.global_;
Primitive$ = exports$.Primitive;
Array$ = exports$.Array;
Date$ = exports$.Date;
keysof$ = exports$.keysof;
RegExp$ = exports$.RegExp;
type$ = exports$.type;
instanceof$ = exports$["instanceof"];
math$ = exports$.math;
MONAD_SCHEMATA_M$ = moert$.MONAD_SCHEMATA_M;
OWNS$ = moert$.OWNS;
export$ = (function (n$){
    return (function (x$){
        return (exports$[n$] = x$);
    });
});
nothing$ = export$("nothing")(undefined);
its$ = export$("its")((function (prop$){
    return (function (o$){
        return o$[prop$];
    });
}));
returns$ = export$("returns")((function (x$){
    return (function (){
        return x$;
    });
}));
itself$ = export$("itself")((function (x$){
    return x$;
}));
compose$ = export$("compose")((function (f$,g$){
    return (function (){
        var _$_THIS = this;
        var _$_ARGS = SLICE$_(arguments, 0);
        return f$(g$.apply(_$_THIS, _$_ARGS));
    });
}));
doon$ = export$("doon")((function (o$,f$){
    return f$.call(o$);
}));
tee$ = export$("tee")((function (o$,f$){
    f$.call(o$, o$);
    return o$;
}));
list$ = export$("list")(object$((function (){
    var _$_THIS = this;
    var cat$;
    _$_THIS.car = (function (a$){
        return a$[0];
    });
    _$_THIS.cdr = (function (a$){
        return a$.slice(1);
    });
    _$_THIS.initial = (function (a$){
        return a$.slice(0, (-(1)));
    });
    _$_THIS.last = (function (a$){
        return a$[a$.length - 1];
    });
    cat$ = (function (a$,b$){
        return a$.concat(b$);
    });
    _$_THIS.flat = (function (a$){
        return a$.reduce(cat$, []);
    });
    _$_THIS.fill = (function (range$,x$){
        return table$(({build: function(SCHEMATA$_){return function (){
            var es_0$_, es_1$_, es_2$_, es_3$_, es_4$_, es_5$_;
            var i$;
            es_0$_ = (function(){
                es_3$_ = range$;
                return SCHEMATA$_.bind(es_3$_, es_4$_);
            });
            es_4$_ = (function(es_5$_){
                i$ = es_5$_;
                return es_1$_(x$);
            });
            es_1$_ = (function(es_2$_){
                return SCHEMATA$_["return"](es_2$_);
            });
            return es_0$_;
        }}}));
    });
    _$_THIS.tolist = (function (range$){
        return table$(({build: function(SCHEMATA$_){return function (){
            var es_6$_, es_7$_, es_8$_, es_9$_, es_a$_, es_b$_;
            var x$;
            es_6$_ = (function(){
                es_9$_ = range$;
                return SCHEMATA$_.bind(es_9$_, es_a$_);
            });
            es_a$_ = (function(es_b$_){
                x$ = es_b$_;
                return es_7$_(x$);
            });
            es_7$_ = (function(es_8$_){
                return SCHEMATA$_["return"](es_8$_);
            });
            return es_6$_;
        }}}));
    });
    return (_$_THIS.shuffle = (function (a$){
        var _0$_;
        var b$, i$, j$, t$;
        b$ = a$.slice(0);
        i$ = 0;
        _0$_ = b$.length;
        while (i$ < _0$_) {
            j$ = math$.randInt(i$, b$.length);
            t$ = b$[i$];
            b$[i$] = b$[j$];
            b$[j$] = t$;
            i$ = i$ + 1;
        };
        return b$;
    }));
})));
pcl$ = export$("pcl")((function (f$){
    var _$_ARGS = SLICE$_(arguments, 0);
    var args$;
    args$ = _$_ARGS.slice(1);
    return (function (){
        var _$_THIS = this;
        var _$_ARGS = SLICE$_(arguments, 0);
        return f$.apply(_$_THIS, args$.concat(_$_ARGS));
    });
}));
pcr$ = export$("pcr")((function (f$){
    var _$_ARGS = SLICE$_(arguments, 0);
    var args$;
    args$ = _$_ARGS.slice(1);
    return (function (){
        var _$_THIS = this;
        var _$_ARGS = SLICE$_(arguments, 0);
        return f$.apply(_$_THIS, _$_ARGS.concat(args$));
    });
}));
time$ = export$("time")((function (args$,f$){
    var finishTime$, startTime$;
    startTime$ = new (Date$)();
    f$.apply(null, args$);
    finishTime$ = new (Date$)();
    return finishTime$ - startTime$;
}));
(function (){
    var inspectObject$, inspectProperties$, rIdentifier$, tPropName$;
    rIdentifier$ = (/^[a-zA-Z_$][\w$]*$/);
    tPropName$ = (function (s$){
        return (rIdentifier$.test(s$) ? s$ : Primitive$.stringify(s$));
    });
    inspectProperties$ = (function (x$,stack$,depth$,targetDepth$){
        var _2$_, _1$_;
        var a$, foundCircle$, j$, p$, prop$;
        a$ = [];
        p$ = (_2$_ = GETENUM$_(keysof$(x$))).emit();
        while (_2$_.active) {
            prop$ = x$[p$];
            foundCircle$ = false;
            s$L:{
                j$ = (_1$_ = GETENUM$_(stack$)).emit();
                while (_1$_.active) {
                    if (j$ === prop$) {
                        foundCircle$ = true;
                        break s$L;
                    } ;
                    j$ = _1$_.emit();
                };
            };
            if (foundCircle$) {
                a$.push(tPropName$(p$) + ": " + "[Circular]");
            } else {
                a$.push(tPropName$(p$) + ": " + inspectObject$(prop$, stack$, depth$ + 1, targetDepth$));
            };
            p$ = _2$_.emit();
        };
        return (depth$ === 0 ? " " + a$.join(",\n  ") + " " : a$.join(", "));
    });
    inspectObject$ = (function (x$,stack$,depth$,targetDepth$){
        if (depth$ >= targetDepth$) {
            return "[...]";
        } else {
            if (IS$_(x$, Primitive$)) {
                return Primitive$.stringify(x$);
            } else {
                if (IS$_(x$, Function$)) {
                    return "{ [Function]\n " + inspectProperties$(x$, stack$.concat([x$]), depth$, targetDepth$) + "}";
                } else {
                    return "[" + inspectProperties$(x$, stack$.concat([x$]), depth$, targetDepth$) + "]";
                };
            };
        };
    });
    return (inspect$ = export$("inspect")((function (x$,targetDepth$){
        var _$_ARGS = SLICE$_(arguments, 0);
        if (_$_ARGS.length < 2) {
            targetDepth$ = 3;
        };
        return inspectObject$(x$, [], 0, targetDepth$);
    })));
})();
enumeration$ = export$("enumeration")((function (G$){
    return (function (){
        var _$_THIS = this;
        var _$_ARGS = SLICE$_(arguments, 0);
        var e$, fCont$, g$;
        e$ = ({"emit": (function (){
            var _$_THIS = this;
            var _$_ARGS = SLICE$_(arguments, 0);
            return fCont$.apply(_$_THIS, _$_ARGS);
        }), "active": true});
        (function (){
            var fBind$, fBindYield$, fRet$;
            fRet$ = (function (x$){
                e$.active = false;
                return x$;
            });
            fBind$ = (function (x$,cont$){
                fCont$ = cont$;
                return x$;
            });
            fBindYield$ = (function (f$,t$,x$,cont$){
                var _$_ARGS = SLICE$_(arguments, 0);
                return fBind$(f$.call(t$, x$), _$_ARGS[_$_ARGS.length - 1]);
            });
            return (g$ = G$.build(({"return": fRet$, "bind": fBind$, "bindYield": fBindYield$})));
        })();
        fCont$ = g$.apply(_$_THIS, _$_ARGS);
        return e$;
    });
}));
enumeration$.yield = (function (x$){
    return x$;
});
Enumerable$ = export$("Enumerable")((function (G$){
    return (function (){
        var _$_THIS = this;
        var _$_ARGS = SLICE$_(arguments, 0);
        return ((function (){
            var argsp$, fGetEnumerator$, thisp$;
            thisp$ = _$_THIS;
            argsp$ = _$_ARGS;
            fGetEnumerator$ = (function (){
                var e$, fCont$, g$;
                e$ = ({"emit": (function (){
                    var _$_THIS = this;
                    var _$_ARGS = SLICE$_(arguments, 0);
                    return fCont$.apply(_$_THIS, _$_ARGS);
                }), "active": true});
                (function (){
                    var fBind$, fBindYield$, fRet$;
                    fRet$ = (function (x$){
                        e$.active = false;
                        return x$;
                    });
                    fBind$ = (function (x$,cont$){
                        fCont$ = cont$;
                        return x$;
                    });
                    fBindYield$ = (function (f$,t$,x$,cont$){
                        var _$_ARGS = SLICE$_(arguments, 0);
                        return fBind$(f$.call(t$, x$), _$_ARGS[_$_ARGS.length - 1]);
                    });
                    return (g$ = G$.build(({"return": fRet$, "bind": fBind$, "bindYield": fBindYield$})));
                })();
                fCont$ = g$.apply(thisp$, argsp$);
                return e$;
            });
            return ({"getEnumerator": fGetEnumerator$});
        })());
    });
}));
getEnumeratorOf$ = export$("getEnumeratorOf")(moert$.runtime.GETENUM);
rangeForEach$ = export$("rangeForEach")((function (range$,f$){
    var e$, t$;
    e$ = getEnumeratorOf$(range$);
    if (e$.each) {
        return e$.each(f$);
    } else {
        t$ = e$.emit();
        while (!(e$.stop)) {
            f$(t$);
            t$ = e$.emit();
        };
        return undefined;
    };
}));
takeWhile$ = export$("takeWhile")(Enumerable$(({build: function(SCHEMATA$_){return function (I$,condition$){
    var _3$_, es_c$_, es_d$_, es_e$_, es_f$_, es_g$_, es_h$_, es_i$_, es_j$_, es_k$_;
    var a$;
    es_c$_ = (function(){
        a$ = (_3$_ = GETENUM$_(I$)).emit();
        return es_f$_();
    });
    es_f$_ = (function(){
        if (!(_3$_.active)) {
            return es_g$_();
        };
        if (!(!(condition$(a$)))) {
            return es_h$_();
        };
        return es_d$_(undefined);
    });
    es_h$_ = (function(){
        es_i$_ = a$;
        return SCHEMATA$_.bind(es_i$_, es_j$_);
    });
    es_j$_ = (function(es_k$_){
        a$ = _3$_.emit();
        return es_f$_();
    });
    es_g$_ = (function(){
        return es_d$_(undefined);
    });
    es_d$_ = (function(es_e$_){
        return SCHEMATA$_["return"](es_e$_);
    });
    return es_c$_;
}}})));
select$ = export$("select")(Enumerable$(({build: function(SCHEMATA$_){return function (I$,condition$){
    var _4$_, es_l$_, es_m$_, es_n$_, es_o$_, es_p$_, es_q$_, es_r$_, es_s$_, es_t$_;
    var a$;
    es_l$_ = (function(){
        a$ = (_4$_ = GETENUM$_(I$)).emit();
        return es_o$_();
    });
    es_o$_ = (function(){
        if (!(_4$_.active)) {
            return es_p$_();
        };
        if (!(condition$(a$))) {
            return es_q$_();
        };
        es_r$_ = a$;
        return SCHEMATA$_.bind(es_r$_, es_s$_);
    });
    es_s$_ = (function(es_t$_){
        return es_q$_();
    });
    es_q$_ = (function(){
        a$ = _4$_.emit();
        return es_o$_();
    });
    es_p$_ = (function(){
        return es_m$_(undefined);
    });
    es_m$_ = (function(es_n$_){
        return SCHEMATA$_["return"](es_n$_);
    });
    return es_l$_;
}}})));
pairsof$ = export$("pairsof")(Enumerable$(({build: function(SCHEMATA$_){return function (o$){
    var _5$_, es_u$_, es_v$_, es_w$_, es_x$_, es_y$_, es_z$_, es_10$_, es_11$_;
    var j$;
    es_u$_ = (function(){
        j$ = (_5$_ = GETENUM$_(keysof$(o$))).emit();
        return es_x$_();
    });
    es_x$_ = (function(){
        if (!(_5$_.active)) {
            return es_y$_();
        };
        es_z$_ = [o$[j$], j$];
        return SCHEMATA$_.bind(es_z$_, es_10$_);
    });
    es_10$_ = (function(es_11$_){
        j$ = _5$_.emit();
        return es_x$_();
    });
    es_y$_ = (function(){
        return es_v$_([]);
    });
    es_v$_ = (function(es_w$_){
        return SCHEMATA$_["return"](es_w$_);
    });
    return es_u$_;
}}})));
table$ = export$("table")((function (G$){
    var _$_THIS = this;
    var _$_ARGS = SLICE$_(arguments, 0);
    var ans$, schemata$;
    ans$ = [];
    schemata$ = object$(MONAD_SCHEMATA_M$, (function (){
        var _$_THIS = this;
        _$_THIS["return"] = (function (x$){
            if (x$ !== undefined) {
                return ans$.push(x$);
            } ;
        });
        return (_$_THIS.bind = (function (enumerationList$,callback$){
            return rangeForEach$(enumerationList$, callback$);
        }));
    }));
    G$.build(schemata$).apply(_$_THIS, _$_ARGS)();
    return ans$;
}));
hash$ = export$("hash")((function (t$){
    var _6$_;
    var o$, term$;
    o$ = ({});
    term$ = (_6$_ = GETENUM$_(t$)).emit();
    while (_6$_.active) {
        o$[term$[0]] = o$[term$[1]];
        term$ = _6$_.emit();
    };
    return o$;
}));
Reaction$ = (function (s$,f$){
    return (function (err$,x$){
        if (err$) {
            return f$(err$, undefined);
        } else {
            return s$(null, x$);
        };
    });
});
createAsyncSchemata$ = (function (rLocal$,rLongJump$){
    var _$_ARGS = SLICE$_(arguments, 0);
    var schemata$;
    if (_$_ARGS.length < 2) {
        rLongJump$ = rLocal$;
    };
    schemata$ = derive$(MONAD_SCHEMATA_M$);
    schemata$.bind = (function (action$,g$){
        return action$((function (err$,x$){
            var e$;
            if (err$) {
                return rLocal$(err$, undefined);
            } else {
                try {
                    return g$(x$);
                } catch (e$) {
                    rLocal$(e$, undefined);
                };
                return undefined;
            };
        }));
    });
    schemata$.bindYield = (function (f$,t$){
        var _$_ARGS = SLICE$_(arguments, 0);
        var g$, reaction$;
        reaction$ = (function (err$,x$){
            var e$;
            if (err$) {
                return rLocal$(err$, undefined);
            } else {
                try {
                    return g$(x$);
                } catch (e$) {
                    rLocal$(e$, undefined);
                };
                return undefined;
            };
        });
        g$ = _$_ARGS[_$_ARGS.length - 1];
        return f$.apply(t$, _$_ARGS.slice(2, (-(1))).concat([reaction$]));
    });
    schemata$["try"] = (function (MAttempt$,MCatch$,g$){
        var catchSchemata$, ex$, r$, rCatch$, trySchemata$;
        r$ = (function (err$,x$){
            var ex$;
            if (err$) {
                try {
                    return MCatch$(catchSchemata$)(err$);
                } catch (ex$) {
                    rCatch$(ex$, undefined);
                };
                return undefined;
            } else {
                return g$(x$);
            };
        });
        trySchemata$ = createAsyncSchemata$(r$, rLongJump$);
        rCatch$ = (function (err$,x$){
            return (function (){
                if (err$) {
                    return rLocal$(err$, undefined);
                } else {
                    return g$(x$);
                };
            });
        });
        catchSchemata$ = createAsyncSchemata$(rCatch$, rLongJump$);
        try {
            return MAttempt$(trySchemata$)();
        } catch (ex$) {
            r$(ex$, undefined);
        };
        return undefined;
    });
    schemata$["return"] = (function (x$){
        return rLocal$(null, x$);
    });
    return schemata$;
});
async$ = export$("async")((function (M$){
    if (M$.build) {
        return (function (){
            var _$_THIS = this;
            var _$_ARGS = SLICE$_(arguments, 0);
            var a$, reaction$, t$;
            a$ = _$_ARGS.slice(0, (-(1)));
            t$ = _$_THIS;
            reaction$ = _$_ARGS[_$_ARGS.length - 1];
            return M$.build(createAsyncSchemata$(reaction$)).apply(t$, a$)();
        });
    } else {
        return (function (){
            var _$_THIS = this;
            var _$_ARGS = SLICE$_(arguments, 0);
            var a$, e$, r$, reaction$, t$;
            t$ = _$_THIS;
            a$ = _$_ARGS.slice(0, (-(1)));
            reaction$ = _$_ARGS[_$_ARGS.length - 1];
            ;
            try {
                r$ = M$.apply(t$, a$);
            } catch (e$) {
                return reaction$(e$, undefined);
            };
            return reaction$(null, r$);
        });
    };
}));
async$.defaultReaction = (function (err$,x$){
    if (err$) {
        return THROW$_(err$);
    } else {
        return x$;
    };
});
start$ = export$("start")((function (g$){
    var _$_THIS = this;
    var _$_ARGS = SLICE$_(arguments, 0);
    return g$.apply(_$_THIS, _$_ARGS.slice(1).concat([async$.defaultReaction]));
}));
join$ = export$("join")((function (o$,reaction$){
    var checkContinue$, failed$, keys$, nActivities$, nDone$, res$;
    nActivities$ = 0;
    nDone$ = 0;
    failed$ = false;
    res$ = (IS$_(o$, Array$) ? [] : ({}));
    checkContinue$ = (function (term$){
        var f$, s$;
        s$ = (function (val$){
            res$[term$] = val$;
            nDone$ = nDone$ + 1;
            if ((!(failed$)) && nDone$ >= nActivities$) {
                return reaction$(null, res$);
            } ;
        });
        f$ = (function (err$){
            failed$ = true;
            return reaction$(err$, undefined);
        });
        return Reaction$(s$, f$);
    });
    keys$ = Object$.keys(o$);
    if (!(keys$.length)) {
        reaction$(null, res$);
    } ;
    nActivities$ = keys$.length;
    return rangeForEach$(keys$, (function (term$){
        res$[term$] = undefined;
        return o$[term$](checkContinue$(term$));
    }));
}));
qjoin$ = export$("qjoin")(async$(({build: function(SCHEMATA$_){return function (nQueues$,tasks$){
    var _7$_, _8$_, _a$_, es_1b$_, es_1c$_, es_1d$_, es_1e$_, es_1f$_, es_1g$_, es_1h$_;
    var i$, q$;
    es_1b$_ = (function(){
        q$ = [];
        i$ = 0;
        _7$_ = nQueues$;
        while (i$ < _7$_) {
            q$[i$] = [];
            i$ = i$ + 1;
        };
        i$ = 0;
        _8$_ = tasks$.length;
        while (i$ < _8$_) {
            q$[i$ % nQueues$].push(tasks$[i$]);
            i$ = i$ + 1;
        };
        i$ = 0;
        _a$_ = nQueues$;
        while (i$ < _a$_) {
            (function (){
                var queue$;
                queue$ = q$[i$];
                return (q$[i$] = async$(({build: function(SCHEMATA$_){return function (){
                    var _9$_, es_12$_, es_13$_, es_14$_, es_15$_, es_16$_, es_17$_, es_18$_, es_19$_, es_1a$_;
                    var j$;
                    es_12$_ = (function(){
                        j$ = 0;
                        _9$_ = queue$.length;
                        return es_15$_();
                    });
                    es_15$_ = (function(){
                        if (!(j$ < _9$_)) {
                            return es_16$_();
                        };
                        es_17$_ = queue$;
                        es_18$_ = j$;
                        return SCHEMATA$_.bindYield(es_17$_[es_18$_], es_17$_, es_19$_);
                    });
                    es_19$_ = (function(es_1a$_){
                        j$ = j$ + 1;
                        return es_15$_();
                    });
                    es_16$_ = (function(){
                        return es_13$_(undefined);
                    });
                    es_13$_ = (function(es_14$_){
                        return SCHEMATA$_["return"](es_14$_);
                    });
                    return es_12$_;
                }}})));
            })();
            i$ = i$ + 1;
        };
        es_1e$_ = join$;
        es_1f$_ = q$;
        return SCHEMATA$_.bindYield(es_1e$_, null, es_1f$_, es_1g$_);
    });
    es_1g$_ = (function(es_1h$_){
        return es_1c$_(es_1h$_);
    });
    es_1c$_ = (function(es_1d$_){
        return SCHEMATA$_["return"](es_1d$_);
    });
    return es_1b$_;
}}})));
sleep$ = export$("sleep")((function (dt$,reaction$){
    return global_$.setTimeout((function (){
        return reaction$();
    }), dt$);
}));
match$ = export$("match")((function (x$){
    return (function (f$){
        return f$(x$);
    });
}));
cons$ = export$("cons")((function (_args_$){
    var _$_ARGS = SLICE$_(arguments, 0);
    return _$_ARGS.slice(0, (-(1))).concat(_$_ARGS[_$_ARGS.length - 1]);
}));
cons$.unapply = (function (list$,arity$){
    if (IS$_(list$, Array$) && list$.length >= arity$ - 1) {
        return list$.slice(0, arity$ - 1).concat([list$.slice(arity$ - 1)]);
    } ;
});
}());