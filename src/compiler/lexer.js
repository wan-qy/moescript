var tokenTypeStrs = exports.tokenTypeStrs = [];
var TokenType = function(){
	var k = 0;
	return function(desc){
		k = k + 1;
		tokenTypeStrs[k] = desc;
		return k;
	}
}();
// Token Type
var COMMENT = exports.COMMENT = TokenType('Comment')
var ID = exports.ID = TokenType('Identifier')
var OPERATOR = exports.OPERATOR = TokenType('Operator')
var COLON = exports.COLON = TokenType('Colon')
var COMMA = exports.COMMA = TokenType('Comma')
var NUMBER = exports.NUMBER = TokenType('Number')
var STRING = exports.STRING = TokenType('String')
var REGEX = exports.REGEX = TokenType('Regex')
var SEMICOLON = exports.SEMICOLON = TokenType('Semicolon')
var OPEN = exports.OPEN = TokenType('Open')
var CLOSE = exports.CLOSE = TokenType('Close')
var DOT = exports.DOT = TokenType('Dot')
var IF = exports.IF = TokenType('if')
var FOR = exports.FOR = TokenType('for')
var WHILE = exports.WHILE = TokenType('while')
var REPEAT = exports.REPEAT = TokenType('repeat')
var UNTIL = exports.UNTIL = TokenType('until')
var ARGUMENTS = exports.ARGUMENTS = TokenType('arguments')
var CASE = exports.CASE = TokenType('case')
var PIECEWISE = exports.PIECEWISE = TokenType('piecewise')
var WHEN = exports.WHEN = TokenType('when')
var FUNCTION = exports.FUNCTION = TokenType('Function')
var RETURN = exports.RETURN = TokenType('Return')
var BREAK = exports.BREAK = TokenType('Break')
var LABEL = exports.LABEL = TokenType('Label')
var END = exports.END = TokenType('End')
var ELSE = exports.ELSE = TokenType('Else')
var OTHERWISE = exports.OTHERWISE = TokenType('Otherwise')
var PIPE = exports.PIPE = TokenType('Pipeline sign')
var PIPELEFT = exports.PIPELEFT = TokenType('Pipe Left')
var PIPEDOT = exports.PIPEDOT = TokenType('Pipe-Dot')
var VAR = exports.VAR = TokenType('Var')
var SHARP = exports.SHARP = TokenType('Sharp sign')
var DO = exports.DO = TokenType('Do')
var TASK = exports.TASK = TokenType('Task')
var LAMBDA = exports.LAMBDA = TokenType('Lambda')
var PASS = exports.PASS = TokenType('Pass')
var EXCLAM = exports.EXCLAM = TokenType('Exclamation symbol')
var WHERE = exports.WHERE = TokenType('Where')
var DEF = exports.DEF = TokenType('Def')
var RESEND = exports.RESEND = TokenType('Resend')
var NEW = exports.NEW = TokenType('New')
var INDENT = exports.INDENT = TokenType('Indent')
var OUTDENT = exports.OUTDENT = TokenType('Outdent')
var CONSTANT = exports.CONSTANT = TokenType('Constant')
var ME = exports.ME = TokenType('This')
var MY = exports.MY = TokenType('My sign')
var IN = exports.IN = TokenType('In')
var PROTOMEMBER = exports.PROTOMEMBER = TokenType('Prototype member symbol')
var ASSIGN = exports.ASSIGN = TokenType('Assign symbol')
var BIND = exports.BIND = TokenType('Bind symbol')
var BACKSLASH = exports.BACKSLASH = TokenType('Backslash')
var TRY = exports.TRY = TokenType('Try')
var CATCH = exports.CATCH = TokenType('Catch')
var DOWNSLASH = exports.DOWNSLASH = TokenType('Downslash')

var NEWLINE = TokenType('Newline');


var Token = exports.Token = function (t, v, p, s, i) {
	this.type = t;
	this.value = v;
	this.position = p;
	this.spaced = s;
	this.isName = i;
}
Token.prototype.toString = function () {
	return '[' + tokenTypeStrs[this.type] + (this.value !== undefined ? ' ' + this.value : '') + ']'
}
var condF = function (match, $1) {
	if ($1.length > 1) {
		return String.fromCharCode(parseInt($1.slice(1), 16));
	} else {
		return {
			'r': '\r',
			'n': '\n',
			'\\': '\\',
			'"': '"',
			'\'': '\'',
			't': '\t',
			'v': '\v'
		}[$1];
	}
};
var lfUnescape = function (str) {
	return str.replace(/\\\s*\\/g, '').replace(/\\(\\|n|"|'|t|v|u[a-fA-F0-9]{4})/g, condF);
};
var REPSTR = function(){
	var cache = [];
	return function(n){
		if(cache[n]) return cache[n];
		if(n <= 0) return '';
		if(n <= 1) return 'T';
		var q = REPSTR(n >>> 1);
		q += q;
		if (n & 1) q += 'T';
		return cache[n] = q;
	};
}();
var nameTypes = {
	'and': OPERATOR,
	'arguments': ARGUMENTS,
	'as': OPERATOR,
	'break': BREAK,
	'case': CASE,
	'def': DEF,
	'do': DO,
	'else': ELSE,
	'false': CONSTANT,
	'for': FOR,
	'function': FUNCTION,
	'if': IF,
	'in': IN,
	'is': OPERATOR,
	'label': LABEL,
	'negate': CONSTANT,
	'new': NEW,
	'not': CONSTANT,
	'null': CONSTANT,
	'or': OPERATOR,
	'otherwise': OTHERWISE,
	'pass': PASS,
	'piecewise': PIECEWISE,
	'repeat': REPEAT,
	'resend': RESEND,
	'return': RETURN,
	'this': ME,
	'throw': CONSTANT,
	'true': CONSTANT,
	'try': TRY,
	'catch': CATCH,
	'undefined': CONSTANT,
	'until': UNTIL,
	'var': VAR,
	'when': WHEN,
	'where': WHERE,
	'while': WHILE
};
var nameType = function (m) {
	if (nameTypes[m] > -65536)
		return nameTypes[m]
	else
		return ID
};
var symbolTypes = {
	'+': OPERATOR,
	'-': OPERATOR,
	'*': OPERATOR,
	'/': OPERATOR,
	'%': OPERATOR,
	'<': OPERATOR,
	'>': OPERATOR,
	'<=': OPERATOR,
	'>=': OPERATOR,
	'==': OPERATOR,
	'!=': OPERATOR,
	'===': OPERATOR,
	'!==': OPERATOR,
	'=~': OPERATOR,
	'!~': OPERATOR,
	'&&': OPERATOR,
	'||': OPERATOR,
	'->': OPERATOR,
	'=': ASSIGN,
	'+=': ASSIGN,
	'-=': ASSIGN,
	'*=': ASSIGN,
	'/=': ASSIGN,
	'%=': ASSIGN,
	'<-': BIND,
	':>': LAMBDA,
	'=>': LAMBDA,
	'#': SHARP,
	'(': OPEN,
	'[': OPEN,
	'{': OPEN,
	'}': CLOSE,
	']': CLOSE,
	')': CLOSE,
	',': COMMA,
	':': COLON,
	'|>': PIPE,
	'<|': PIPELEFT,
	'|.': PIPEDOT,
	'.': DOT,
	'..': OPERATOR,
	'...': OPERATOR,
	'!': EXCLAM,
	';': SEMICOLON,
	'@': MY,
	'\\': BACKSLASH,
	'::': PROTOMEMBER,
	'|': DOWNSLASH
};
var symbolType = function (m) {
	return symbolTypes[m]
};

var walkRex = require('./compiler.rt').walkRex;
var composeRex = require('./compiler.rt').composeRex;

var LexerBackend = function(input, config){
	var tokens = [], tokl = 0, SPACEQ = {' ': true, '\t': true};
	config = config || {};
	var token_err = config.PE
	var make = function (t, v, p, isn) {
		ignoreComingNewline = false;
		tokens[tokl++] = new Token(t, // type
				v, // value
				p, // position
				SPACEQ[input.charAt(p - 1)], // space before?
				isn); // is name?
	};
	var ignoreComingNewline = false;
	var noImplicits = function () {
		icomp.desemi();
	};
	var noSemicolons = function(){
		while (tokens[tokl - 1] && tokens[tokl - 1].type === SEMICOLON) {
			tokl -= 1;
		}
	};
	var p_symbol = function (t, s, n) {
		switch (t) {
			case OPERATOR:
			case COMMA:
			case PIPE:
			case PIPELEFT:
			case PIPEDOT:
			case DOT:
			case PROTOMEMBER:
			case SHARP:
			case MY:
			case EXCLAM:
			case COLON:
			case ASSIGN:
			case LAMBDA:
			case BIND:
			case DOWNSLASH:
				make(t, s, n);
				break;
			case OPEN:
			case CLOSE:
				make(t, s.charAt(0), n);
				break;
			case SEMICOLON:
				make(t, "Explicit", n);
				break;
			case BACKSLASH:
				make(t, s, n);
				break;
			default:
				throw token_err("Unexpected symbol " + s + ' .', n)
		}
	};
	var CTRLCHR = function (c) {
		var x = c.charCodeAt(0).toString(16), q = x.length;
		return '\\u' + (q < 4 ? '0' + (q < 3 ? '0' + (q < 2 ? '0' + x : x) : x) : x);
	};
	var regexLiteral = function(match, n){
		var flags = match.match(/[gimx]*$/)[0];
		var face = match.slice(1, -(flags.length + 1));
		if(flags.indexOf('x') >= 0){
			// extended regular expression
			flags = flags.replace(/x/g, '');
			face = face.replace(/(\\.)|(\[(?:\\.|[^\[\]])*\])|(\/)|(\s|#.*)|([^\s\\\/\[])/g, function(m, escape, charclass, slash, ignore, normal){
				if(escape === '\\L') return ('[' + UNICODE_LETTERS.source + ']');
				else if(escape === '\\M') return ('[' + UNICODE_MARKS.source + ']');
				else if(escape === '\\N') return ('[' + UNICODE_NUMBERS.source + ']');
				else if(slash) return '\\/';
				else if(ignore) return '';
				else return m;
			});
		};
		face = face.replace(/[\u0000-\u001f\u007f-\uffff]/g, CTRLCHR);
		var r;
		try {
			r = new RegExp(face, flags)
		} catch(e) {
			throw token_err("Wrong Regular Expression Syntax.", n);
		};
		return make(REGEX, r, n);
	};
	var stringliteral = function(match, n, $4){
		switch(match.charAt(0)) {
			case("`"): return regexLiteral(match, n);
			case("'"): case('"'): return make(STRING, lfUnescape(match.slice(1, -1)), n);
			default: // Lua style strings
				return make(STRING, match.slice($4.length + 2, -($4.length + 2)))
		}
	};
	var LayoutComputer = function(start, make){
		var compare = function(a, b, p){
			if(a === b) return 0;
			else if (a.length < b.length && b.slice(0, a.length) === a) return 1
			else if (a.length > b.length && a.slice(0, b.length) === b) return -1
			else throw token_err("Wrong indentation.", p)
		};
		var stack = [''], top = 0;
		var process = function(b, p){
			var c = compare(stack[top], b, p);
			if(c === 1){
				// indent
				stack[++top] = b;
				make(INDENT, 0, p);
			} else if(c === -1) {
				// outdent
				dump(b, p);
			} else {
				// a semicolon
				make(SEMICOLON, "Implicit", p);
			};
		};
		var dump = function(b, p){
			var n = b.length;
			while(stack[top].length > n){
				top --;
				noSemicolons();
				if(tokens[tokl - 1] && tokens[tokl - 1].type === INDENT){
					// Remove INDENT-SEMICOLON-OUTDENT sequences.
					tokl --;
				} else {
					make(OUTDENT, 0, p);
				}
				make(SEMICOLON, "Implicit", p);
			};
			if(stack[top] < b) {
					// indent
					stack[++top] = b;
					make(INDENT, 0, p);
			};
		};
		var desemi = function(){
			while(tokens[tokl - 1] && (tokens[tokl - 1].type === INDENT ||
					tokens[tokl - 1].type === SEMICOLON && tokens[tokl - 1].value === "Implicit")){
				tokl --;
				if(tokens[tokl].type === INDENT)
					top --;
			}
		};
		process(start);
		return {
			process: process,
			dump: dump,
			desemi: desemi
		}
	};

	var ignoresIncomingNewline = function(token){
		return token &&  ( token.type === OPERATOR 
						|| token.type === DOT
						|| token.type === OPEN
						|| token.type === COMMA
						|| token.type === PROTOMEMBER
						|| token.type === BACKSLASH)
	}
	var ignoresPreviousNewline = function(token){
		return token &&  ( token.type === OPERATOR 
						|| token.type === DOT
						|| token.type === CLOSE
						|| token.type === COMMA
						|| token.type === PIPE
						|| token.type === PIPELEFT
						|| token.type === PIPEDOT
						|| token.type === PROTOMEMBER
						|| token.type === NEWLINE)
	}

	var layout = function(tokens){
		var ans = []
		var fmake = function(t, s, n){
			ans.push(new Token(t, s, n, false, false))
		};
		var icomp = LayoutComputer(input.match(/^[ \t]*/)[0], fmake);
		var nBrackets = 0;
		for(var i = 0; i < tokens.length; i++){
			var token = tokens[i];
			if(token.type === NEWLINE) {
				if(ignoresIncomingNewline(tokens[i - 1]) || ignoresPreviousNewline(tokens[i + 1]) || nBrackets) {
					// Ignore this line break
				} else {
					icomp.process(token.value, token.position)
				}
			} else {
				if(token.type === OPEN)
					nBrackets += 1
				else if(token.type === CLOSE)
					nBrackets -= 1
				if(token.type !== BACKSLASH)
					ans.push(token);
			}
		}
		return ans;
	}

	return {
		comment: function(){},
		nme: function(type, match, n){
			make(type, match, n, true);
			ignoreComingNewline = type === OPERATOR
		},
		str: function(type, match, n, $4){stringliteral(match, n, $4)},
		number: function(type, match, n){make(NUMBER, (match.replace(/^0+([1-9])/, '$1') - 0), n)},
		symbol: function(type, match, n){p_symbol(type, match, n)},
		newline: function(type, match, n){make(NEWLINE, match.slice(1), n)},
		mismatch: function(m, pos){
			if(m.trim())
				throw token_err("Unexpected character.", pos + m.match(/^\s*/)[0].length);
		},
		output: function(){
			return layout(tokens);
		}
	}
};

var UNICODE_LETTERS = /A-Za-z\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u0527\u0531-\u0556\u0559\u0561-\u0587\u05D0-\u05EA\u05F0-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u08A0\u08A2-\u08AC\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0977\u0979-\u097F\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C33\u0C35-\u0C39\u0C3D\u0C58\u0C59\u0C60\u0C61\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D60\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F4\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u1700-\u170C\u170E-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1877\u1880-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191C\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19C1-\u19C7\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4B\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1CE9-\u1CEC\u1CEE-\u1CF1\u1CF5\u1CF6\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2183\u2184\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2E2F\u3005\u3006\u3031-\u3035\u303B\u303C\u3041-\u3096\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FCC\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA697\uA6A0-\uA6E5\uA717-\uA71F\uA722-\uA788\uA78B-\uA78E\uA790-\uA793\uA7A0-\uA7AA\uA7F8-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA80-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uABC0-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC/;
var UNICODE_MARKS = /\u0300-\u036F\u0483-\u0489\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED\u0711\u0730-\u074A\u07A6-\u07B0\u07EB-\u07F3\u0816-\u0819\u081B-\u0823\u0825-\u0827\u0829-\u082D\u0859-\u085B\u08E4-\u08FE\u0900-\u0903\u093A-\u093C\u093E-\u094F\u0951-\u0957\u0962\u0963\u0981-\u0983\u09BC\u09BE-\u09C4\u09C7\u09C8\u09CB-\u09CD\u09D7\u09E2\u09E3\u0A01-\u0A03\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A70\u0A71\u0A75\u0A81-\u0A83\u0ABC\u0ABE-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AE2\u0AE3\u0B01-\u0B03\u0B3C\u0B3E-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B56\u0B57\u0B62\u0B63\u0B82\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD7\u0C01-\u0C03\u0C3E-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C62\u0C63\u0C82\u0C83\u0CBC\u0CBE-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CE2\u0CE3\u0D02\u0D03\u0D3E-\u0D44\u0D46-\u0D48\u0D4A-\u0D4D\u0D57\u0D62\u0D63\u0D82\u0D83\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DF2\u0DF3\u0E31\u0E34-\u0E3A\u0E47-\u0E4E\u0EB1\u0EB4-\u0EB9\u0EBB\u0EBC\u0EC8-\u0ECD\u0F18\u0F19\u0F35\u0F37\u0F39\u0F3E\u0F3F\u0F71-\u0F84\u0F86\u0F87\u0F8D-\u0F97\u0F99-\u0FBC\u0FC6\u102B-\u103E\u1056-\u1059\u105E-\u1060\u1062-\u1064\u1067-\u106D\u1071-\u1074\u1082-\u108D\u108F\u109A-\u109D\u135D-\u135F\u1712-\u1714\u1732-\u1734\u1752\u1753\u1772\u1773\u17B4-\u17D3\u17DD\u180B-\u180D\u18A9\u1920-\u192B\u1930-\u193B\u19B0-\u19C0\u19C8\u19C9\u1A17-\u1A1B\u1A55-\u1A5E\u1A60-\u1A7C\u1A7F\u1B00-\u1B04\u1B34-\u1B44\u1B6B-\u1B73\u1B80-\u1B82\u1BA1-\u1BAD\u1BE6-\u1BF3\u1C24-\u1C37\u1CD0-\u1CD2\u1CD4-\u1CE8\u1CED\u1CF2-\u1CF4\u1DC0-\u1DE6\u1DFC-\u1DFF\u20D0-\u20F0\u2CEF-\u2CF1\u2D7F\u2DE0-\u2DFF\u302A-\u302F\u3099\u309A\uA66F-\uA672\uA674-\uA67D\uA69F\uA6F0\uA6F1\uA802\uA806\uA80B\uA823-\uA827\uA880\uA881\uA8B4-\uA8C4\uA8E0-\uA8F1\uA926-\uA92D\uA947-\uA953\uA980-\uA983\uA9B3-\uA9C0\uAA29-\uAA36\uAA43\uAA4C\uAA4D\uAA7B\uAAB0\uAAB2-\uAAB4\uAAB7\uAAB8\uAABE\uAABF\uAAC1\uAAEB-\uAAEF\uAAF5\uAAF6\uABE3-\uABEA\uABEC\uABED\uFB1E\uFE00-\uFE0F\uFE20-\uFE26/;
var UNICODE_NUMBERS = /0-9\xB2\xB3\xB9\xBC-\xBE\u0660-\u0669\u06F0-\u06F9\u07C0-\u07C9\u0966-\u096F\u09E6-\u09EF\u09F4-\u09F9\u0A66-\u0A6F\u0AE6-\u0AEF\u0B66-\u0B6F\u0B72-\u0B77\u0BE6-\u0BF2\u0C66-\u0C6F\u0C78-\u0C7E\u0CE6-\u0CEF\u0D66-\u0D75\u0E50-\u0E59\u0ED0-\u0ED9\u0F20-\u0F33\u1040-\u1049\u1090-\u1099\u1369-\u137C\u16EE-\u16F0\u17E0-\u17E9\u17F0-\u17F9\u1810-\u1819\u1946-\u194F\u19D0-\u19DA\u1A80-\u1A89\u1A90-\u1A99\u1B50-\u1B59\u1BB0-\u1BB9\u1C40-\u1C49\u1C50-\u1C59\u2070\u2074-\u2079\u2080-\u2089\u2150-\u2182\u2185-\u2189\u2460-\u249B\u24EA-\u24FF\u2776-\u2793\u2CFD\u3007\u3021-\u3029\u3038-\u303A\u3192-\u3195\u3220-\u3229\u3248-\u324F\u3251-\u325F\u3280-\u3289\u32B1-\u32BF\uA620-\uA629\uA6E6-\uA6EF\uA830-\uA835\uA8D0-\uA8D9\uA900-\uA909\uA9D0-\uA9D9\uAA50-\uAA59\uABF0-\uABF9\uFF10-\uFF19/;


var LexMeta = exports.LexMeta = function (input, backend) {
	var rComment = /(?:\/\/|--).*/;
	var rIdentifier = composeRex(/[$_#letter][$_#letter#mark#number]*/, {
		letter: UNICODE_LETTERS,
		mark: UNICODE_MARKS,
		number: UNICODE_NUMBERS
	});
	var rString = /(?:`[^\\`]*(?:\\.[^\\`]*)*`)[gimx]*|'[^\\'\n]*(?:\\(?:\S|\s+\\)[^\\'\n]*)*'|"[^\\"\n]*(?:\\(?:\S|\s+\\)[^\\"\n]*)*"/
	var rNumber = /0[xX][a-fA-F0-9]+|\d+(?:\.\d+(?:[eE]-?\d+)?)?/;
	var rSymbol = /\.{1,3}|<-|\|\.|[+\-*\/<>=!%~|&][<>=~|&]*|:[:>]|[()\[\]\{\}@\\;,#:]/;
	var rNewline = /\n[ \t]*/;
	var rToken = composeRex(/(#comment)|(#identifier)|(#string)|(\[(=+)\[[\s\S]*?\]\5\])|(#number)|(#symbol)|(#newline)/gm, {
		comment: rComment,
		identifier: rIdentifier,
		string: rString,
		number: rNumber,
		symbol: rSymbol,
		newline: rNewline
	});
	walkRex(rToken, input,
		function (match, comment, nme, strlit, heredoc, $5, number, symbol, newline, n) {
			after_space = false;
			if(comment){
				backend.comment(COMMENT, match, n)
			} if (nme) {
				backend.nme(nameType(match), match, n);
			} else if (strlit) {
				backend.str(STRING, match, n);
			} else if (heredoc) {
				backend.str(STRING, match, n, $5);
			} else if (number) {
				backend.number(NUMBER, match, n);
			} else if (symbol) {
				backend.symbol(symbolType(match), match, n);
			} else if (newline) {
				backend.newline(null, newline, n);
			};
			return '';
		}, backend.mismatch);
	return backend.output();
};

var lex = exports.lex = function(input, cfgMap, token_err){
	input += '\n\n\n';
	return LexMeta(input, LexerBackend(input, cfgMap, token_err));
}