﻿//:module: lib/async
//	:author:		infinte (aka. be5invis)
//	:info:			perform essential asynchronous support with YIELD
var derive = exports.derive;
var OBSTRUCTIVE_SCHEMATA_M = moert.runtime.OBSTRUCTIVE_SCHEMATA_M;
var OWNS = moert.runtime.OWNS;

"Definition Start"

var asyncSchemata = derive(OBSTRUCTIVE_SCHEMATA_M);

var async = exports.async = function(M){
	if(M.build){
		var g = M.build(asyncSchemata);
		return function(){
			return g.apply(this, arguments)()
		}
	} else
		return function(){ return M.apply(this, arguments) }
};
exports.asyncTask = function(M){
	if(M.build){
		return function(){
			var s = derive(asyncSchemata);
			if(typeof arguments[arguments.length - 1] === 'function')
				s['return'] = arguments[arguments.length - 1]
			return M.build(s).apply(this, arguments)()
		}
	} else
		return function(){ return M.apply(this, arguments) }
};
exports.sleep = function(time, f){ return setTimeout(f, time) }

exports.join = function(o, callback){
	var nActivities = 0;
	var nDone = 0;
	var res = {}
	var checkContinue = function(term){
		return function(val){
			res[term] = val;
			nDone += 1;
			if(nDone >= nActivities) {
				callback(res);
			}
		}
	}
	for(var term in o) if(OWNS(o, term)) {
		nActivities += 1;
		res[term] = undefined;
	};
	if(nActivities === 0) callback(res)
	for(var term in o) if(OWNS(o, term)) {
		o[term].call(null, checkContinue(term))
	};
	return nActivities;
};