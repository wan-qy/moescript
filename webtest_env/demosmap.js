module.provide(['moe/runtime', 'moe/compiler/compiler', 'moe/prelude', 'moe/compiler/gvm'], function(require){
	var moert = require('moe/runtime');
	var EISA_OWNS = moert.runtime.OWNS;
	var GlobalVariableManager = require('moe/compiler/gvm').GlobalVariableManager;
	var clrscr = function(){$('smapdemoOut').innerHTML = ''};
	var rtrace = function(s){$('smapdemoOut').innerHTML += s};
	var SMAPEncode = function(s){
		return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace('>', '&gt')
	};

	var moert_using = function(libs, f) {
		var importings = [], immediates = [];
		for (var i = 0; i < libs.length; i++) {
			if (typeof libs[i] === 'string')
				importings.push(libs[i]);
			else
				immediates.push(libs[i]);
		};
		var gvm = new GlobalVariableManager;
		module.provide(importings, function(require) {
			var vals = {};
			for (var i = 0; i < importings.length; i++)
				require.enumerate(libs[i], function(n, v) {
					vals[n] = v;
					gvm.bind(n);
				});
			for (var i = 0; i < immediates.length; i++) {
				var immlib = immediates[i];
				for (var each in immlib)
					if (EISA_OWNS(immlib, each)) {
						vals[each] = immlib[each];
						gvm.bind(each);
					};
			};

			return f.call(vals, vals, gvm);
		});
	};
	var unique = function(x){
		var u = {}, a = [];
		for(var i = 0, l = x.length; i < l; ++i){
			if(u.hasOwnProperty(x[i])) {
				continue;
			}
			a.push(x[i]);
			u[x[i]] = 1;
		}
		return a;
	};
	var smapToSpansT = function(src, code, smapPoints){
		smapPoints = [{p: 0, q: 0, type: '['}].concat(smapPoints).concat([{p: code.length, q: src.length, type: ']'}]);
		var sofar = 0;
		var buf = '';
		var qs = [];
		for(var j = 0; j < smapPoints.length; j++){
			var point = smapPoints[j];
			qs.push(point.q);
			buf += '<span>' + SMAPEncode(code.slice(sofar, point.p)) + '</span><a href="#q' + point.q + '" class="smap-' + (point.type === '[' ? 'open' : 'close') + '">'
			    + ' ' + '</a>';
			sofar = point.p;
		};
		buf = 'Generated:<div>' + buf + '</div>\n\nOriginal:<div>'
		qs = unique(qs).sort(function(x, y){return x - y});
		sofar = 0;
		for(var j = 0; j < qs.length; j++){
			buf += '<span>' + SMAPEncode(src.slice(sofar, qs[j])) + '</span><span class="q" id="q' + qs[j] + '"></span>';
			sofar = qs[j];
		};
		buf += '</div>';
		return buf;
	};
	document.getElementById('go').onclick = function () {
		clrscr();
		moert_using(['moe/prelude', { log: function(){console.log.apply(console, arguments)} }],
			function(initvs, gvm){
				var lfc = require('moe/compiler/compiler');
				var script = lfc.compile(document.getElementById('input').value, {
					globalVariables: gvm
				});
				rtrace(smapToSpansT(script.source, script.generatedCode, script.smapPoints));
		});
	};
});