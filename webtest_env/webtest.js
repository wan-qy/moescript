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

module.provide(['moe/runtime', 'moe/compiler/compiler', 'moe/prelude', 'moe/compiler/smapinfo'], function(require){
	var moert = require('moe/runtime');
	var OWNS = moert.OWNS;
	var moec = require('moe/compiler/compiler');
	var TopScope = moec.TopScope;
	var C_STRING = require('moe/compiler/compiler.rt').C_STRING;
	var smapinfo = require('moe/compiler/smapinfo');

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

		var fAfterUsing = function(ts){
			var script = moec.compile(document.getElementById('input').value, ts, {
				warn: tracel,
				keepSourceMap: true
			});
			var initCode = ts.createInitializationCode();
			
			var si = smapinfo.calculateSmapPoints(script.generatedCode);
			tracer('Generated Code:' + source2html(si.codeWithoutSmap));
			tracer('Smap points:' + source2html(si.smapPoints.map(function(p){
				return '(Type: ' + p.type + ') ' + p.p + ' -> ' + p.q;
			}).join('\n')));
			tracer('Initialization Code:' + source2html(initCode));

			var func = Function(ts.runtimeName, initCode + '\n;' + si.codeWithoutSmap);
			func.call(this, moert.runtime);
		}

		moert_using(['moe/prelude', output, { log: function(){console.log.apply(console, arguments)} }], fAfterUsing);
	};

	window.onerror = function(message){
		terr(message);
	};
});

(function(){

	function getCaretPos(txtarea){
		var strPos = 0;
		if (txtarea.selectionStart >= 0) { 
			strPos = txtarea.selectionStart 
		} else { 
			txtarea.focus();
			var range = document.selection.createRange();
			range.moveStart('character', -txtarea.value.length);
			strPos = range.text.length;
		};
		return strPos;
	}

	function insertAtCaret(txtarea, text) {
		var strPos = getCaretPos(txtarea);

		var front = txtarea.value.slice(0, strPos);  
		var back = txtarea.value.slice(strPos); 
		txtarea.value = front + text + back;
		strPos = strPos + text.length;
		if (txtarea.selectionStart >= 0) { 
			txtarea.selectionStart = strPos;
			txtarea.selectionEnd = strPos;
			txtarea.focus();
		} else {
			txtarea.focus();
			var range = document.selection.createRange();
			range.moveStart ('character', -txtarea.value.length);
			range.moveStart ('character', strPos);
			range.moveEnd ('character', 0);
			range.select();
		}
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

	var enterDown = false;
	var justExec  = false;

	var heightResizer = function(){
		var handler = null;
		var lRecord = 0;
		var doResize = function(){
			var scrollPos = $('master').scrollTop;
			var ln = $('input').value.length;
			if(ln < lRecord){
				$('input').style.height = '0';
			};
			lRecord = ln;
			resizeInput();
			$('master').scrollTop = scrollPos;
			handler = null
		}
		var tick = function(){
			if(handler){ clearTimeout(handler) }
			handler = setTimeout(doResize);
		}
		return {tick: tick}
	}();

	$('input').addEventListener('keydown', function(e){
		// Input box resizing mechanism
		if(e.key === 'Enter' || e.keyCode === 13){
			e.preventDefault();
			if(!(e.shiftKey || e.ctrlKey) && !justExec){ // entering an ENTER
				insertAtCaret($('input'), "\n" + getCurrentLineBlanks($('input')));
			}
			enterDown = true;
		} else if(e.key === 'Tab' || e.keyCode === 9){
			e.preventDefault();
			insertAtCaret($('input'), '\t');
		};
		heightResizer.tick();
	}, false);

	$('input').addEventListener('keyup', function(e){
		// Execution handler mechanism
		justExec  = false;
		if(e.key === 'Enter' || e.keyIdentifier === 'Enter' || e.keyCode === 13){
			enterDown = false;
			if(e.shiftKey || e.ctrlKey) {
				e.preventDefault();
				setTimeout(run, 0);
				justExec = true
			}
		} else if(e.key === 'Shift' || e.keyIdentifier === 'Shift' || e.keyCode === 16 ||
		          e.key === 'Control' || e.keyIdentifier === 'Control' || e.keyCode === 17){
			if(enterDown) {
				e.preventDefault();
				setTimeout(run, 0);	
				justExec = true		
			}
		}
	}, false);

	$('go').addEventListener('click', function(){
		setTimeout(run, 0);
	})
	
	window.onload = function(){
		resizeInput();
	};
})();