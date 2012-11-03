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

module.provide(['moe/runtime', 'moe/compiler/compiler', 'moe/prelude'], function(require){
	var moert = require('moe/runtime');
	var OWNS = moert.runtime.OWNS;
	var moec = require('moe/compiler/compiler');
	var TopScope = moec.TopScope;
	var C_STRING = require('moe/compiler/compiler.rt').C_STRING;

	var moert_using = function(libs, f) {
		var importings = [], immediates = [];
		for (var i = 0; i < libs.length; i++) {
			if (typeof libs[i] === 'string')
				importings.push(libs[i]);
			else
				immediates.push(libs[i]);
		};
		var ts = new TopScope;
		module.provide(importings, function(require) {
			var vals = {};
			for (var i = 0; i < importings.length; i++)
				require.enumerate(libs[i], function(n, v) {
					vals[n] = v;
					ts.partBind(n, 'this', n);
				});
			for (var i = 0; i < immediates.length; i++) {
				var immlib = immediates[i];
				for (var n in immlib)
					if (OWNS(immlib, n)) {
						vals[n] = immlib[n];
						ts.partBind(n, 'this', n);
					};
			};

			return f.call(vals, ts);
		});
	};

	run = function () {
		clrscr();
		var infoout = G_TRACE('info');
		var tracel = infoout.tracel;
		var tracer = infoout.traceraw;

		moert_using(['moe/prelude', output, { log: function(){console.log.apply(console, arguments)} }],
			function(ts){
				try {
					var script = moec.compile(document.getElementById('input').value, {
						globalVariables: ts,
						warn: tracel
					});
					var initCode = ts.createInitializationCode();
					
					tracer('Generated Code:' + source2html(script.generatedCode));
					tracer('Smap points:' + source2html(script.smapPoints.map(function(p){
						return '(Type: ' + p.type + ') ' + p.p + ' -> ' + p.q;
					}).join('\n')));
					tracer('Initialization Code:' + source2html(initCode));

					var func = Function(ts.runtimeName, initCode + '\n;' + script.generatedCode);
					func.call(this, moert.runtime);
				} catch(e){
					terr('Error occurs:\n' + e + '\nF12 to read more');
				}
		});
	};
});

(function(){
	var IE = !!document.selection;

	function getCaretPos(txtarea){
		var strPos = 0;
		if (IE) { 
			txtarea.focus();
			var range = document.selection.createRange();
			range.moveStart('character', -txtarea.value.length);
			strPos = range.text.length;
		} else { 
			strPos = txtarea.selectionStart 
		};
		return strPos;
	}

	function insertAtCaret(txtarea, text) {
		var scrollPos = txtarea.scrollTop;
		var strPos = getCaretPos(txtarea);

		var front = txtarea.value.slice(0, strPos);  
		var back = txtarea.value.slice(strPos); 
		txtarea.value = front + text + back;
		strPos = strPos + text.length;
		if (IE) { 
			txtarea.focus();
			var range = document.selection.createRange();
			range.moveStart ('character', -txtarea.value.length);
			range.moveStart ('character', strPos);
			range.moveEnd ('character', 0);
			range.select();
		} else {
			txtarea.selectionStart = strPos;
			txtarea.selectionEnd = strPos;
			txtarea.focus();
		}
		txtarea.scrollTop = scrollPos;
	}

	function getCurrentLineBlanks(obj) {
		var pos = getCaretPos(obj);
		var str = obj.value;
		var i = pos-1;
		while (i>=0) {
			if (str.charAt(i) == '\n')
				break;
			i--;
		}
		i++;
		var blanks = "";
		while (i < str.length) {
			var c = str.charAt(i);
			if (c == ' ' || c == '\t')
				blanks += c;
			else
				break;
			i++;
		}
		return blanks;
	}

	var resizeInput = function(){
		$('input').style.height = ($('input').scrollHeight - 16) + 'px';
	}
	var last_blanks = '';
	var exec = false;

	$('input').addEventListener('keydown', function(e){
		if((e.shiftKey || e.ctrlKey) && (e.key === 'Enter' || e.keyCode === 13)){
			e.preventDefault();exec = true;
			return setTimeout(run, 0);
		} else if(e.key === 'Enter' || e.keyCode === 13){
			last_blanks = getCurrentLineBlanks($('input'));
		} else if(e.key === 'Tab' || e.keyCode === 9){
			e.preventDefault();
			insertAtCaret($('input'), '\t');
		}
	}, false);
	$('input').addEventListener('keyup', function(){
		var lRecord = 0
		return function(e){
			var ln = $('input').value.length;
			if(ln < lRecord){
				$('input').style.height = '0';
			};
			lRecord = ln;
			if(e.key === 'Enter' || e.keyCode === 13){
				if(!exec) insertAtCaret($('input'), last_blanks);
				exec = false;
			}
			resizeInput();
		}
	}(), false);

	$('go').addEventListener('click', function(){
		setTimeout(run, 0)
	})
	
	window.onload = function(){
		resizeInput();
	};
})();