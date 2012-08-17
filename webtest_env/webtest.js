var run = function(){};
var terr = G_TRACE('err').tracel;

var source2html = function(s){
	return '<ol>'
		+ ('' + s.trim())
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/^\/\/MoeMap\/\/.*$/gm, function(s){ return '<em>' + s + '</em>'})
			.replace(/^/gm, '<li>')
			.replace(/$/gm, '</li>')
			.replace(/\n/g, '')
		+ '</ol>'
}

module.provide(['moe/runtime', 'moe/compiler/compiler', 'moe/prelude', 'moe/compiler/gvm'], function(require){
	var moert = require('moe/runtime');
	var EISA_OWNS = moert.runtime.OWNS;
	var GlobalVariableManager = require('moe/compiler/gvm').GlobalVariableManager;
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
	run = document.getElementById('go').onclick = function () {
		clrscr();
		var infoout = G_TRACE('info');
		var tracel = infoout.tracel;
		var tracer = infoout.traceraw;
		moert_using(['moe/prelude', output, { log: function(){console.log.apply(console, arguments)} }],
			function(initvs, gvm){
				try {
					var lfc = require('moe/compiler/compiler');
					var script = lfc.compile(document.getElementById('input').value, {
						globalVariables: gvm,
						warn: tracel
					});
					tracer('Generated Code:' + source2html(script.generatedCode));
					tracer('Smap points:' + source2html(script.smapPoints.map(function(p){
						return '(Type: ' + p.type + ') ' + p.p + ' -> ' + p.q;
					}).join('\n')));
					tracer('Initialization Code:' + source2html(script.initializationCode));
					var func = Function(script.aux.runtimeName, script.aux.initsName, 
						script.initializationCode + '\n;' + script.generatedCode);
					tracel('Started Master Execution.');
					func(moert.runtime, initvs);
					tracel('Master Execution finished.');
				} catch(e){
					terr('Error occurs:\n' + e + '\nF12 to read more');
				}
		});
	};
});
var resizeInput = function(){
	$('input').style.height = ($('input').scrollHeight - 8) + 'px';
}
var last_blanks = '';
var exec = false;
try {
	$('input').addEventListener('keydown', function(e){
		if((e.shiftKey || e.ctrlKey) && (e.key === 'Enter' || e.keyCode === 13)){
			e.preventDefault();exec = true;
			return setTimeout(function(){run();},0);
		} else if(e.key === 'Enter' || e.keyCode === 13){
			last_blanks = getCurrentLineBlanks($('input'));
		} else if(e.key === 'Tab' || e.keyCode === 9){
			e.preventDefault();
			insertAtCursor($('input'), '    ');
		}
	}, false);
	$('input').addEventListener('keyup',function(){
		var len = 0;
		return function(e){
			var l = $('input').value.length;
			if(l <= len)
				$('input').style.height = 0;
			len = l;
			if(e.key === 'Enter' || e.keyCode === 13){
				if(!exec) insertAtCursor($('input'), last_blanks);
				exec = false;
			}
			resizeInput();
		}
	}(), false);
} catch(e) {};
window.onload = function(){
	resizeInput()
};