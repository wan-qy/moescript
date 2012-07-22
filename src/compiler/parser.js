//:module: parse
//	:author:		infinte (aka. be5invis)
//	:info:			Parser for lofn
var moe = require('../runtime');
var moecrt = require('./compiler.rt');
var lexer = require('./lexer');

var COMMENT = lexer.COMMENT
var ID = lexer.ID
var OPERATOR = lexer.OPERATOR
var COLON = lexer.COLON
var COMMA = lexer.COMMA
var NUMBER = lexer.NUMBER
var STRING = lexer.STRING
var SEMICOLON = lexer.SEMICOLON
var OPEN = lexer.OPEN
var CLOSE = lexer.CLOSE
var DOT = lexer.DOT
var IF = lexer.IF
var FOR = lexer.FOR
var WHILE = lexer.WHILE
var REPEAT = lexer.REPEAT
var UNTIL = lexer.UNTIL
var ARGUMENTS = lexer.ARGUMENTS
var CASE = lexer.CASE
var PIECEWISE = lexer.PIECEWISE
var WHEN = lexer.WHEN
var FUNCTION = lexer.FUNCTION
var RETURN = lexer.RETURN
var BREAK = lexer.BREAK
var LABEL = lexer.LABEL
var END = lexer.END
var ELSE = lexer.ELSE
var OTHERWISE = lexer.OTHERWISE
var PIPE = lexer.PIPE
var VAR = lexer.VAR
var SHARP = lexer.SHARP
var DO = lexer.DO
var TASK = lexer.TASK
var LAMBDA = lexer.LAMBDA
var PASS = lexer.PASS
var EXCLAM = lexer.EXCLAM
var WAIT = lexer.WAIT
var USING = lexer.USING
var WHERE = lexer.WHERE
var DEF = lexer.DEF
var RESEND = lexer.RESEND
var NEW = lexer.NEW
var INDENT = lexer.INDENT
var OUTDENT = lexer.OUTDENT
var CONSTANT = lexer.CONSTANT
var ME = lexer.ME
var MY = lexer.MY
var IN = lexer.IN
var PROTOMEMBER = lexer.PROTOMEMBER
var ASSIGN = lexer.ASSIGN
var BIND = lexer.BIND
var BACKSLASH = lexer.BACKSLASH
var TRY = lexer.TRY
var CATCH = lexer.CATCH
var FINALLY = lexer.FINALLY

var Token = lexer.Token

var SQSTART = '[', SQEND = ']',
	RDSTART = '(', RDEND = ')',
	CRSTART = '{', CREND = '}';

var NodeType = moecrt.NodeType;
var MakeNode = moecrt.MakeNode;
var HAS_DUPL = function (arr) {
	var b = arr.slice(0).sort();
	for (var i = 0; i < b.length - 1; i++)
		if (b[i] && b[i] == b[i + 1])
			return true;
};
exports.parse = function (input, source, config) {
	var tokens = input.tokens,
		token = tokens[0],
		next = tokens[1],
		j = 0,
		len = tokens.length,
		nt = NodeType,
		token_type = token ? token.type : undefined,
		token_value = token ? token.value : undefined
	var makeT = config.makeT,
		initInterator = config.initInterator;
	// Token processor
	var moveTo = function (position) {
		var t = token;
		j = position;
		token = tokens[j];
		if(token){
			token_type = token.type;
			token_value = token.value;
		} else {
			token_type = token_value = undefined;
		}
		next = tokens[j + 1];
		return t;
	};
	var moveNext = function () {
		return moveTo(j + 1)
	};
	var advance = function (type, test, errorMessage) {
		var nt, value, t, node;
		if (!token)
			throw PE(errorMessage || 'Requires token type#' + type + '.');
		if (type !== undefined && token.type !== type || test !== undefined && token.value !== test)
			throw PE(errorMessage || 'Unexpected token: got' + token + ' instead ' + new Token(type, test) + '.');
		return moveNext();
	};
	var saveState = function(){
		return {position: j}
	};
	var loadState = function(state){
		moveTo(state.position)
	};
	var tokenIs = function (t, v) {
		return token && token_type === t && (v ? token_value === v : true);
	};
	var nextIs = function (t, v) {
		return next && next.type === t && (v ? next.value === v : true);
	};
	var shiftIs = function (n, t, v) {
		return tokens[j + n] && tokens[j + n].type === t && (v ? tokens[j + n].value === v : true);
	};
	var pos = function(){
		if(token)
			return token.position
		else
			return source.length;
	}
	// Parse warning and error
	var PW = moecrt.PWMeta(source, function(p){
		return p == undefined ? (token && token.position >= 0 ? token.position : source.length) : p
	});
	var PE = moecrt.PEMeta(PW);
	// Assert
	var ensure = function(c, m, p){
		if(!c) throw PE(m, p);
		return c;
	};

	// Node constructor
	var Node = function(t, p){
		return MakeNode(t, p, token ? token.position: undefined)
	};
	var MemberNode = function(left, name){
		return new Node(nt.MEMBER, {
			left: left,
			right: new Node(nt.LITERAL, {value: name})
		})
	};

	// Implicit return generation
	var implicitReturn = function(node){
		if(!node || !node.content || node.type !== nt.SCRIPT) return node;
		var last = node.content.length - 1;
		while(last >= 0 && node.content[last] && node.content[last].type === nt.BREAK) last--;
		var laststmt = node.content[last];
		if(!laststmt) return;
		var lasttype = laststmt.type;
		if(lasttype === nt.EXPRSTMT){
			node.content[last] = new Node(nt.RETURN, {
				expression: laststmt.expression,
				begins: laststmt.begins,
				ends: laststmt.ends
			})
		} else {
			implicitReturnCpst(laststmt, false);
		}
		return node;
	};
	var implicitReturnCpst = function(node, caseQ){
		var ir = implicitReturn;
		var lasttype = node.type;
		if(lasttype === nt.SCRIPT){
			ir(node);
		} else if(lasttype === nt.IF){
			ir(node.thenPart);
			if(node.elsePart){
				ir(node.elsePart);
			}
		} else if(lasttype === nt.PIECEWISE || lasttype === nt.CASE){
			for(var i = 0; i < node.bodies.length; i++){
				ir(node.bodies[i]);
			};
			if(node.otherwise){
				ir(node.otherwise);
			};
		};
	};

	var optimizeOnelineWhere = function(code){
		if(code.content.length === 1                              // one statement
			&& code.content[0].type === nt.RETURN                // it is return
			&& code.content[0].expression.type === nt.CALLBLOCK){ // and it is a WHERE
			return code.content[0].expression.func.code;
		}
		return code;
	}


	// Here we go
	// Identifier: like the javascript
	var variable = function () {
		var t = advance(ID, undefined, "A variable is required here.");
		return new Node(NodeType.VARIABLE, { name: t.value, position: t.position });
	};
	var lname = function () {
		var t = advance(ID);
		return t.value;
	};
	var name = function () {
		if(token && token.isName) var t = advance();
		else throw PE("A name is needed here.");
		return t.value;
	};
	// literals: number, string
	// number: stricter than javascript, 0.0E(-)0
	// strings: single and double quote. Single quotes only support escaping '' into '
	// Double quotes support \\ \n \" \t \uxxxx
	var literal = function () {
		var t = advance();
		return new Node(NodeType.LITERAL, { value: t.value });
	};
	// constants
	var consts = {
		'true': 'true',
		'false': 'false',
		'null': 'null',
		'undefined': 'undefined'
	};
	var rtConsts = {
		'try': 'TRY',
		'throw': 'THROW',
		'negate': 'NEGATE',
		'not': 'NOT',
		'in': 'IN'
	};
	var constant = function () {
		var t = advance();
		return new Node(nt.LITERAL, {
			value: consts[t.value] ? {map: consts[t.value]} : {tid: rtConsts[t.value]},
			operatorType: (t.value === 'not' ? nt.NOT :
				           t.value === 'negate' ? nt.NEGATIVE :
				           null)
		});
	};
	// this pointer
	var thisp = function () {
		var t = advance(ME);
		return new Node(nt.THIS);
	};
	// 'my' construct: "my" Identifier
	var thisprp = function () {
		var t = advance(MY);
		var n = name();
		return MemberNode(new Node(nt.THIS), n);
	};
	// 'arguments' pointer
	var argsp = function () {
		var t = advance(ARGUMENTS);
		return new Node(nt.ARGUMENTS);
	};
	var generateDefaultParameters = function(p, c){
		var last = null;
		for(var i = 0; i < p.names.length; i++){
			if(p.names[i].defaultValue){
				last = new Node(nt.IF, {
					condition: new Node(nt['<'], {
						left: MemberNode(new Node(nt.ARGUMENTS), 'length'),
						right: new Node(nt.LITERAL, {value: i + 1})}),
					thenPart: new Node(nt.SCRIPT, {
						content: [last, new Node(nt.ASSIGN, {
							left: new Node(nt.VARIABLE, {name: p.names[i].name}),
							right: p.names[i].defaultValue
						})]})})
			}
		};
		c.content.unshift(last);
	};
	var functionLiteral = function () {
		var f, p;
		if (tokenIs(OPEN, RDSTART)) {
			p = parameters();
		};
		if (tokenIs(OPEN, RDSTART)) { // currying arguments
			f = curryBody(p);
		} else if (tokenIs(COLON) || tokenIs(ASSIGN, '=')) {
			f = blockBody(p);
		} else if (tokenIs(LAMBDA)){
			f = completeLambdaExpression(p);
		} else {
			f = expressionBody(p);
		};
		return f;
	};
	var lambdaExpression = function(){
		if(tokenIs(ID)){
			var p = new Node(nt.PARAMETERS, {names: [{name: lname()}]});
		} else if(tokenIs(LAMBDA)) {
			var p = null;
		} else {
			var p = parameters();
		}
		var f = completeLambdaExpression(p);
		return f;
	};
	var expressionBody = function (p) {
		advance(OPEN, CRSTART);
		var parameters = p || new Node(nt.PARAMETERS, { names: [] });
		if(tokenIs(PIPE)) { // {|args| } form
			if(p)
				throw PE('Attempting to add parameters to a parameter-given function.');
			advance(PIPE);
			parameters.names = parlist();
			advance(PIPE);
		};
		var code = onelineStatements();
		implicitReturn(code);
		code = optimizeOnelineWhere(code);
		advance(CLOSE, CREND);
		return new Node(nt.FUNCTION, { parameters: parameters, code: code });
	};
	var blockBody = function (p) {
		var t = advance();
		var parameters = p || new Node(nt.PARAMETERS, { names: [] });
		var code = block();
		if(t.type === ASSIGN && t.value === '=')
			implicitReturn(code);
		code = optimizeOnelineWhere(code);
		generateDefaultParameters(parameters, code);
		return new Node(nt.FUNCTION, {parameters: parameters, code: code});
	};
	var curryBody = function (p) {
		var parameters = p;
		var code = new Node(nt.SCRIPT, {
			content: [new Node(nt.RETURN, { expression: functionLiteral() })]
		});
		return new Node(nt.FUNCTION, {parameters: parameters, code: code});
	};
	var completeLambdaExpression = function (p) {
		var t = advance(LAMBDA);
		var parameters = p || new Node(nt.PARAMETERS, { names: [] });
		var code = block();
		if(t.value === '=>')
			implicitReturn(code);
		code = optimizeOnelineWhere(code);
		generateDefaultParameters(parameters, code);
		return new Node(nt.FUNCTION, {
			parameters: parameters,
			code: code
		});
	};
	var parlist = function(){
		var arr = [];
		var dfvArgQ = false;
		while (tokenIs(ID)) {
			arr[arr.length] = {name: lname()}
			if(tokenIs(ASSIGN, '=') || dfvArgQ){
				dfvArgQ = true;
				advance(ASSIGN, '=');
				arr[arr.length - 1].defaultValue = callItem();
			};
			if(tokenIs(COMMA)) advance()
			else break;
		};
		return arr;
	};
	var parameters = function () {
		var arr = [];
		advance(OPEN, RDSTART);
		if (!tokenIs(CLOSE, RDEND)) {
			arr = parlist();
		};
		advance(CLOSE, RDEND);
		ensure(!HAS_DUPL(arr), 'Parameter list contains duplicate');
		return new Node(nt.PARAMETERS, { names: arr });
	};
	// object
	var objectLiteral = function () {
		advance(OPEN, SQSTART);
		var node = new Node(nt.OBJECT);
		if (tokenIs(CLOSE, SQEND)) {
			node.args = [];
		} else if (tokenIs(COMMA)) {
			advance();
			node.args = [];
		} else if (tokenIs(COLON)) {
			advance();
			node.args = [];
			node.names = [];
			node.nameused = true;
		} else {
			argList(node, true);
		}
		advance(CLOSE, SQEND);
		return node;
	};
	var groupOperatorForm = function(){
		var opType = nt[advance(OPERATOR).value];
		if(tokenIs(CLOSE, RDEND)) {
			advance();
			return new Node(nt.FUNCTION, {
				parameters: new Node(nt.PARAMETERS, {names: [{name: 'x'}, {name: 'y'}]}),
				code: new Node(nt.SCRIPT, {content: [
					new Node(nt.IF, { 
						condition: new Node(nt['<'], {
							left: MemberNode(new Node(nt.ARGUMENTS), 'length'),
							right: new Node(nt.LITERAL, {value: 2})
						}),
						thenPart: new Node(nt.RETURN, {
							expression: new Node(nt.FUNCTION, {
								parameters: new Node(nt.PARAMETERS, {names: [{name: 'z'}]}),
								code: new Node(nt.RETURN, {
									expression: new Node(opType, {
										left: new Node(nt.VARIABLE, {name: 'z'}),
										right: new Node(nt.VARIABLE, {name: 'x'})
									})
								})
							})
						}),
						elsePart: new Node(nt.RETURN, {
							expression: new Node(opType, {
								left: new Node(nt.VARIABLE, {name: 'x'}),
								right: new Node(nt.VARIABLE, {name: 'y'})
							})
						})
					})
				]}),
				operatorType: opType
			})
		} else if(opType === nt['-']) {
			var r = new Node(nt['-'], {
				left: new Node(nt.LITERAL, {value: 0}),
				right: unary()
			});
			advance(CLOSE, RDEND);
			return r;
		} else if(opType === nt['+']) {
			var r = new Node(nt['-'], {
				left: unary(),
				right: new Node(nt.LITERAL, {value: 0})
			});
			advance(CLOSE, RDEND);
			return r;
		} else {
			throw new PE('Unexpected Operator.')
		}
	}
	var groupLike = function(){
		if(nextIs(OPERATOR)){
			advance(OPEN, RDSTART);
			return groupOperatorForm();
		} else if(nextIs(EXCLAM)){
			advance();
			advance();
			var r = new Node(nt.NOT, {
				operand: unary()
			});
			advance(CLOSE, RDEND);
			return r;
		} else if(nextIs(CLOSE, RDEND) && !shiftIs(2, LAMBDA)) {
			advance();
			advance();
			return new Node(nt.UNIT);
		}
		
		if(nextIs(CLOSE, RDEND) && shiftIs(2, LAMBDA)
			|| nextIs(ID) && (shiftIs(2, CLOSE, RDEND) && shiftIs(3, LAMBDA) || shiftIs(2, COMMA))) {
			return lambdaExpression();
		};
		var state = saveState();
		try {
			advance(OPEN, RDSTART);
			var r = assignmentExpression();
			advance(CLOSE, RDEND);
		} catch(e) {
			loadState(state);
			try {
				var s = lambdaExpression()
			} catch(e2) {
				throw e
			}
		};
		if(tokenIs(LAMBDA)){
			loadState(state);
			return lambdaExpression()
		} else {
			return new Node(nt.GROUP, {operand: r})
		}
	};
	var esp = [];
	esp[ID] = variable;
	esp[NUMBER] = esp[STRING] = literal;
	esp[CONSTANT] = esp[IN] = constant;
	esp[ME] = thisp;
	esp[MY] = thisprp;
	esp[ARGUMENTS] = argsp;
	esp[OPEN] = function(){
		if (token.value === SQSTART) {
			return objectLiteral();
		} else if (token.value === RDSTART) {
			return groupLike();
		} else if (token.value === CRSTART) {
			return expressionBody();
		}
	};
	esp[SHARP] = function(){
		// # form
		// depended on coming token
		// #{number} --> Arguments[number]
		// #{identifier} --> ArgNS[identifier]
		var p = advance();
		if (tokenIs(NUMBER) && !token.spaced) {
			return new Node(nt.MEMBER, {
				left : new Node(nt.ARGUMENTS),
				right : literal()
			});
		} else if (token && token.isName && !token.spaced) {
			return new Node(nt.MEMBER, {
				left : new Node(nt.ARGN),
				right : new Node(nt.LITERAL, {value: name()})
			});
		} else if (tokenIs(SHARP) && !token.spaced) {
			advance();
			return new Node(nt.ARGUMENTS);
		} else if (tokenIs(MY, '@') && !token.spaced){
			advance();
			return new Node(nt.ARGN);
		} else {
			throw new PE('Invalid # usage.')
		}
	};
	esp[FUNCTION] = function(){
		advance(FUNCTION);
		return functionLiteral();
	};
	esp[LAMBDA] = lambdaExpression;
	esp[NEW] = esp[RESEND] = esp[DO] = esp[WAIT] = function(){
		return new Node(nt.CALLWRAP, {value: advance().type})
	};

	var exprStartQ = function(){
		return token && esp[token.type];
	};
	var argStartQ = function(){
		if(token && (token.isName || tokenIs(STRING)) && nextIs(COLON) && !(shiftIs(2, SEMICOLON) || shiftIs(2, INDENT)))
			return 2;
		else if(exprStartQ())
			return 1;
		else return false;
	};
	var primary = function () {
		ensure(token, 'Unable to get operand: missing token');
		if(esp[token.type])
			return esp[token.type](token.type)
		else
			throw PE("Unexpected token " + token + '.')
	};
	var memberitem = function (left) {
		var right;
		if(tokenIs(PROTOMEMBER)) { // P::Q prototype form
			advance();
			right = name();
			return MemberNode(MemberNode(left, 'prototype'), right);
		} else {
			advance();
			if (tokenIs(STRING)) {
				right = literal();
				return new Node(nt.MEMBER, { left: left, right: right });
			} else { // . Identifier  format
				right = name();
				return MemberNode(left, right);
			}
		}
	};

	var completeCallExpression = function(m){
		while (tokenIs(OPEN) && !token.spaced || tokenIs(DOT) || tokenIs(EXCLAM) || tokenIs(PROTOMEMBER)) 
		switch (token.type) {
			case EXCLAM:
				var m = new Node(nt.BINDPOINT, { expression: m });
				advance();
				continue;
			case OPEN:
				if (token.value === RDSTART) { // invocation f(a,b,c...)
					var state = saveState();
					var m_ = m;
					try {
						while(tokenIs(OPEN, RDSTART)) {
							advance(OPEN, RDSTART);
							m = new Node(nt.CALL, {
								func: m
							});
							if (tokenIs(CLOSE, RDEND)) { m.args = []; advance(); continue; };
							argList(m, true);
							advance(CLOSE, RDEND);
							m = wrapCall(m);
						};
						if(tokenIs(ASSIGN, '=') || tokenIs(COLON)) { // a declaration
							loadState(state);
							return m_;
						};
					} catch (e) {
						loadState(state);
						return m_;
					};
				} else if (token.value === SQSTART) { // [] operator
					advance();
					m = new Node(nt.MEMBER, {
						left: m,
						right: callItem()
					});
					advance(CLOSE, SQEND);
				} else if (token.value === CRSTART) {
					m = wrapCall(new Node(nt.CALL, {
						func: m,
						args:[expressionBody()],
						names: [null]
					}));
				};
				continue;
			case DOT:
			case PROTOMEMBER:
				m = memberitem(m);
				continue;
		}
		return m;
	};
	var pusharg = function(nc, bracedQ, relaxQ){
		var argTypeDetect = argStartQ()
		if (argTypeDetect) {
			if (argTypeDetect === 2) {
				// named argument
				// name : value
				nc.names.push(token.value);
				advance();
				advance(COLON);
			} else {
				nc.names.push(null);
			}
			nc.args.push((bracedQ ? callItem : callExpression)());
			return true
		} else if(relaxQ){
			return false
		} else {
			throw new PE("Expecting argument.")
		}
	}
	var completeArgList = function(nc, bracedQ){
		while(tokenIs(COMMA)) {
			advance();
			pusharg(nc, bracedQ);
		};
		return nc;
	}
	var argList = function (nc, bracedQ) {
		nc.args = nc.args || []
		nc.names = nc.names || []
		if(pusharg(nc, bracedQ, true)) {
			completeArgList(nc, bracedQ)
		};
		return nc;
	};
	var callItem = function(omit){
		var node = callExpression();
		if(tokenIs(OPERATOR)){
			return operatorPiece(node, callExpression);
		} else {
			return node;
		}
	};

	var wrapCall = function(n){
		if(n.type === nt.CALL){
			if(n.func.type === nt.CALLWRAP && n.args.length === 1 && !n.names[0]) {
				return callWrappers[n.func.value](n.args[0])
			} else if(n.func.type === nt.CALLWRAP) {
				throw new PE('Wrong call wrapper usage.')
			} else if(n.func.operatorType) {
				return callWrappers.OPERATOR(n);
			}
		};
		return n;
	};
	var callWrappers = [];
	callWrappers[RESEND] = function(n){
		if(n.type === nt.CALL){
			return new Node(nt.CALL, {
				func: MemberNode(n.func, 'call'),
				args: [new Node(nt.THIS, {})].concat(n.args),
				names:[null].concat(n.names)
			});
		} else {
			throw new PE('resend must connect a function call.');
		}
	};
	callWrappers[WAIT] = function(n){
		if(n.type === nt.CALL){
			return new Node(nt.CALL, {
				func: new Node(nt.BINDPOINT, { expression: n.func }),
				args: n.args,
				names: n.names
			});
		} else {
			throw new PE('wait must connect a function call.');
		}
	};
	callWrappers[DO] = function(n){
		return new Node(nt.CALL, {
			func: MemberNode(n, 'apply'),
			args: [new Node(nt.THIS, {}), new Node(nt.ARGUMENTS, {})],
			names:[null, null]
		});
	};
	callWrappers[NEW] = function(n){
		if(n.type === nt.CALL){
			return new Node(nt.CALL, {
				func: new Node(nt.CTOR, { expression: n.func }),
				args: n.args,
				names:n.names
			});
		} else {
			return new Node(nt.CALL, {
				func: new Node(nt.CTOR, { expression: n }),
				args: [],
				names:[]
			});
		}
	};
	callWrappers.OPERATOR = function(node){
		if((node.func.operatorType === nt.NOT || node.func.operatorType === nt.NEGATIVE)
			&& (node.args.length === 1 && !node.names[0])) {
			return new Node(node.func.operatorType, { operand: node.args[0] });
		} else if(node.args.length === 2 && !node.names[0] && !node.names[1]) {
			if(node.func.operatorType === nt['and'] || node.func.operatorType === nt['or']
				|| node.func.operatorType === nt['&&'] || node.func.operatorType === nt['||'])
				return new Node(nt.CALL, {
					func: new Node(nt.FUNCTION, {
							parameters: new Node(nt.PARAMETERS, {names: [{name: 'x'}, {name: 'y'}]}),
							code: new Node(nt.RETURN, {
								expression: new Node(node.func.operatorType, {
									left: new Node(nt.VARIABLE, {name: 'x'}),
									right: new Node(nt.VARIABLE, {name: 'y'})
								})
							})
						}),
					args: node.args,
					names: node.names
				})
			else
				return new Node(node.func.operatorType, {
					left: node.args[0],
					right: node.args[1]
				});
		} else if(node.args.length === 1 && !node.names[0]) {
			return new Node(nt.CALL, {
				func: new Node(nt.FUNCTION, {
					parameters: new Node(nt.PARAMETERS, {names: [{name: 'y'}]}),
					code: new Node(nt.RETURN, {
						expression: new Node(nt.FUNCTION, {
							parameters: new Node(nt.PARAMETERS, {names: [{name: 'x'}]}),
							code: new Node(nt.RETURN, {
								expression: new Node(node.func.operatorType, {
									left: new Node(nt.VARIABLE, {name: 'x'}),
									right: new Node(nt.VARIABLE, {name: 'y'})
								})
							})
						})
					})
				}),
				args: [node.args[0]],
				names: [null]
			});
		}
		return node;
	};


	var callExpression = function () {
		return completeCallExpression(primary());
	};
	var completeOmissionCall = function(head){
		var argTypeDetect;
		if(!(argTypeDetect = argStartQ())) return head;
		// Named arguments detected
		if(argTypeDetect === 2){
			var node = new Node(nt.CALL, {
				func: head
			});
			argList(node);
			return wrapCall(node);
		} else {
			if(tokenIs(OPEN, RDSTART) && nextIs(CLOSE, RDEND) && !(shiftIs(2, LAMBDA))) {
				advance();
				advance();
				return wrapCall(new Node(nt.CALL, {
					func: head,
					args: [],
					names: []
				}));
			} else {
				var term = callExpression();
				if(tokenIs(COMMA)){
					var node = new Node(nt.CALL, {
						func: head,
						args: [term],
						names: [null]
					});
					completeArgList(node);
					return wrapCall(node);
				} else {
					return wrapCall(new Node(nt.CALL, {
						func: head,
						args: [completeOmissionCall(term)],
						names: [null]
					}));
				}
			}
		}
	};
	var unary = function(){return completeOmissionCall(callExpression())};
	var operatorPiece = function(){
		var L = 0, R = 1, N = 2;
		var bp = {
			'*': 10, '/': 10, '%': 10,
			'+': 20, '-': 20,
			'<': 30, '>': 30, '<=': 30, '>=': 30,
			'is': 35,
			'==': 40, '!=': 40, '=~': 40, '!~': 40, '===':40, '!==':40,
			'and': 50, '&&': 50,
			'or': 55, '||': 55,
			'..': 57, '...': 57,
			'as': 60
		};
		var combp = {
			'*': L, '/': L, '%': L,
			'+': L, '-': L,
			'<': N, '>': N, '<=': N, '>=': N,
			'is': L,
			'==': N, '!=': N, '=~': N, '!~': N, '===':N, '!==':N,
			'and': L, 'or': L, '&&': L, '||' : L,
			'..': N, '...': N,
			'as': L
		}
		return function (start, progress) {
			// operators.
			// the "->" operator gets a "Rule" object
			// the "is" and "as" operators are costumizable.
			var uber = { right: start, bp: 65536 }, t, tv, operand, nbp, combining, n, node, p;
			while (tokenIs(OPERATOR) && ensure(bp[token.value] > 0, "Invalid Operator")) {
				// if is a valid operator, then...
				t = advance(OPERATOR), tv = t.value, p = t.position;
				operand = progress();
				nbp = bp[tv], combining = combp[tv];
				node = new Node(nt[tv], {
					right: operand,
					bp: nbp
				});
				n = uber;
				if(combining === L || combining === N) {
					// Left combining & uncombining
					/*    H       H
					 *   / X ->  / !
					 *    / \     X R
					 *           / \
					 */
					while (n.right.bp > nbp)
						n = n.right;
					if (combining === N && n.right.bp === nbp)
						throw PE("Attempting to combine uncombinable operator.", p);
					node.left = n.right;
					n.right = node;
				} else if (combining === R){
					/* Right combining
					 *     H             H
					 *      L     ->      L
					 *     / L           / L
					 *      / \           / !
					 *         A           A R
					 */
					while (n.right.bp >= nbp)
						n = n.right;
					node.left = n.right;
					n.right = node;
				}
			};
			return new Node(nt.GROUP, {operand: uber.right});
		};
	}();
	var singleExpression = function(c){
		if(tokenIs(OPERATOR)){ // f + g
			c = operatorPiece(c, unary);
		};
		ensure(!exprStartQ(), 'Unexpected expression termination.');
		return c;
	};
	var expression = function (c) {
		var r = whenClausize(pipeClausize(singleExpression(c || unary())));
		ensure(!exprStartQ(), 'Unexpected expression termination.');
		return r;
	};

	var pipeClausize = function(node){
		// Pipeline calls
		if(!tokenIs(PIPE)) return node;
		advance();
		var c;
		if (tokenIs(DOT)) {
			// |.name chaining
			advance(DOT);
			ensure(token && token.isName, 'Missing identifier for Chain invocation');
			c = new Node(nt.CALL, {
				func: MemberNode(node, name()),
				args: [],
				names: []
			});
		} else {
			// pipeline
			c = new Node(nt.CALL, {
				func: callExpression(),
				args: [node],
				names: [null],
				pipeline: true
			});
		};
		if(tokenIs(PIPE)) {
			return pipeClausize(wrapCall(c))
		} else {
			return completePipelineCall(c)
		};
	};
	var completePipelineCall = function(node){
		var argTypeDetect = argStartQ();
		if(!argTypeDetect) return node;
		// Named arguments detected
		if(argTypeDetect === 2){
			argList(node);
			return pipeClausize(wrapCall(node));
		} else {
			var term = callExpression();
			if(tokenIs(COMMA)){
				node.args.push(term);
				node.names.push(null);
				advance(COMMA);
				argList(node);
				return pipeClausize(wrapCall(node));
			} else {
				node.args.push(completeOmissionCall(term))
				node.names.push(null);
				return pipeClausize(node);
			}
		}
	};

	var whenClausize = function(node){
		// when affix
		if(tokenIs(WHEN)){
			advance(); advance(OPEN, RDSTART);
			var c = new Node(nt.CONDITIONAL, {
				condition: expression(),
				thenPart: node
			});
			advance(CLOSE, RDEND);
			if(tokenIs(COMMA)){
				advance(COMMA);
				c.elsePart = expression()
			} else {
				c.elsePart = new Node(nt.LITERAL, {value: {map: undefined}});
			};
			return c;
		} else if(tokenIs(OTHERWISE)) {
			advance()
			return node;
		} else {
			return node;
		}
	};

var assignmentExpression = function(){
		var c = unary();
		if (tokenIs(ASSIGN) || tokenIs(BIND)){
			if(tokenIs(ASSIGN)) {
				return formAssignment(c, advance().value, assignmentExpression());
			} else {
				return formAssignment(c, (advance(), '='), new Node(nt.CALL, {
					func: new Node(nt.BINDPOINT),
					args: [assignmentExpression()],
					names: [null]
				}));
			}
		} else {
			return expression(c);
		}
	};
	var formAssignment = function(left, oper, right, declVarQ, constantQ, whereClauseQ){
		ensure( left.type === nt.VARIABLE 
			 || left.type === nt.MEMBER 
			 || left.type === nt.TEMPVAR 
			 || left.type === nt.OBJECT
			 || left.type === nt.UNIT,
			"Invalid assignment/bind", left.position);
		if(left.type === nt.OBJECT){
			var objt = makeT();
			var seed = new Node(nt.then, {
				args: [formAssignment(new Node(nt.TEMPVAR, {name: objt}), '=', right)],
				names: [null]
			});
			var j = 0;
			for(var i = 0; i < left.args.length; i++){
				if(!left.names[i]) j += 1;
				if(left.args[i].type !== nt.UNIT) {
					if(left.names[i]) {
						seed.args.push(formAssignment(left.args[i], oper, 
								MemberNode(new Node(nt.TEMPVAR, {name: objt}), left.names[i]), declVarQ, constantQ));
					} else {
						seed.args.push(formAssignment(left.args[i], oper, 
								MemberNode(new Node(nt.TEMPVAR, {name: objt}), j - 1), declVarQ, constantQ));
					}
					seed.names.push(null);
				}
			};
			seed.args.push(new Node(nt.TEMPVAR, {name: objt}))
			seed.names.push(null);
			return seed
		} else if(left.type === nt.UNIT) {
			return right;
		} else {
			return new Node(nt.ASSIGN, {
				left: left,
				right: oper === "=" ? right : new Node(nt[oper.slice(0, oper.length - 1)], {
					left: left,
					right: right
				}),
				position: left.position,
				declareVariable: (declVarQ && left.type === nt.VARIABLE ? left.name : undefined),
				constantQ: constantQ,
				whereClauseQ: whereClauseQ
			})
		}
	};

	var whereClausedExpression = function(singleLineQ){
		var begins = pos()
		var e = assignmentExpression();
		e.begins = begins;
		e.ends = pos();
		return whereClausize(e, singleLineQ);
	};
	var whereClausize = function(node, singleLineQ){
		var shift = 0;
		// Clearify WHERE in oneline statements
		if(singleLineQ && !(tokenIs(WHERE))) return node;
		while(shiftIs(shift, SEMICOLON)) shift++;
		if(shiftIs(shift, WHERE)) {
			stripSemicolons();
			advance(WHERE);
			var stmts = whereClauses();
			stmts.push(new Node(nt.RETURN, { 
				expression: node,
				begins: node.begins,
				ends: node.ends
			}));
			return whereClausize(new Node(nt.CALLBLOCK, {
				func: new Node(nt.FUNCTION, {
						parameters: new Node(nt.PARAMETERS, {names: []}),
						code: new Node(nt.SCRIPT, {content: stmts}),
						rebind: true })}))
		} else {
			return node;
		}
	};
	var whereClauses = function(){
		var stmts = [];
		if(!tokenIs(INDENT)){
			stmts.push(whereClause());
			var s = 0;
			if(!(tokenIs(INDENT) || tokenIs(SEMICOLON, "Implicit") && nextIs(INDENT)))
				return stmts;
		};
		stripSemicolons();
		advance(INDENT);
		while(token && !tokenIs(OUTDENT)){
			stmts.push(whereClause());
			stripSemicolons();
		};
		advance(OUTDENT);
		return stmts;
	};
	var whereClause = function(){
		return new Node(nt.EXPRSTMT, {expression: varDefinition(false, false, true, true)})
	};

	var stover = function () {
		return !token || (token.type === SEMICOLON || token.type === END || token.type === CLOSE || token.type === OUTDENT);
	};
	var nextstover = function () {
		return !next || (next.type === SEMICOLON || next.type === END || next.type === CLOSE || next.type === OUTDENT);
	};
	var aStatementEnded = false;

	var SINGLE_LINE = true
	var statement = function(singleLineQ){
		aStatementEnded = false;
		var begins = pos();
		var r = statement_r.apply(this, arguments);
		var ends = pos();
		aStatementEnded = true;
		if(r){
			r.begins = begins;
			r.ends = ends;
			if(r.type === nt.EXPRSTMT){
				r.expression.begins = begins;
				r.expression.ends = ends;
			}
		};
		return r;
	};
	var block = function(){
		if(tokenIs(INDENT)){
			return statements()
		} else {
			return blocky(statement(SINGLE_LINE))
		};
	};
	var statements = function () {
		if(tokenIs(INDENT)){
			advance(INDENT);
			var r = statements();
			advance(OUTDENT);
			return r;
		} else {
			var script = new Node(nt.SCRIPT, {content: []});
			var s;
			do {
				stripSemicolons();
				if (tokenIs(OUTDENT)) break;
				script.content.push(statement());
			} while(aStatementEnded && token);
			aStatementEnded = false;
			return script;
		}
	};
	var onelineStatements = function(){
		var script = new Node(nt.SCRIPT, {content: []});
		var s;
		do {
			while(tokenIs(SEMICOLON, "Explicit")) advance();
			if (tokenIs(CLOSE)) break;
			script.content.push(statement(SINGLE_LINE));
		} while(aStatementEnded && token);
		aStatementEnded = false;

		return script;
	};

	var statement_r = function (singleLineQ) {
		if (token)
			switch (token.type) {
			case RETURN:
				advance();
				if(tokenIs(BIND)){
					advance(BIND);
					return new Node(nt.CALL, {
						func: new Node(nt.BINDPOINT),
						args: [assignmentExpression()],
						names: [null]
					});
				} else {
					return new Node(nt.RETURN, { expression: whereClausedExpression() })
				}
			case IF:
				return ifstmt(singleLineQ);
			case WHILE:
				return whilestmt(singleLineQ);
			case REPEAT:
				return repeatstmt(singleLineQ);
			case PIECEWISE:
				return piecewise(false, singleLineQ);
			case CASE:
				return piecewise(true, singleLineQ);
			case FOR:
				return forstmt(singleLineQ);
			case LABEL:
				return labelstmt(singleLineQ);
			case BREAK:
				return brkstmt(singleLineQ);
			case END:
			case ELSE:
			case OTHERWISE:
			case WHEN:
			case CLOSE:
				throw PE('Unexpected statement symbol.');
			case VAR:
				advance();
				return varstmt(singleLineQ);
			case DEF:
				advance();
				return defstmt(singleLineQ);
			case PASS:
				advance(PASS);
				return;
// I will complete it when I found how to catch exceptions in monads.
//			case TRY:
//				return trystmt();
			default:
				return new Node(nt.EXPRSTMT, {expression: whereClausedExpression(singleLineQ), exprStmtQ : true});
		};
	};
	var blocky = function(node){
		if (!node || node.type !== nt.SCRIPT) {
			return new Node(nt.SCRIPT, { content: [node] })
		} else {
			return node
		}
	};
	var varstmt = function(singleLineQ){
		if(tokenIs(ID) && (nextIs(COMMA) || nextstover())){
			return vardecls();
		} else {
			return new Node(nt.EXPRSTMT, {expression: varDefinition(false, false, singleLineQ)});
		};
	}
	var vardecls = function () {
		var a = [variable()];
		while(tokenIs(COMMA)){
			advance();
			a.push(variable());
		};
		for(var i = 0; i < a.length; i++){
			a[i].declareVariable = a[i].name;
		};
		return new Node(nt.VAR, {terms: a});
	};

	var defstmt = function (singleLineQ) {
		return new Node(nt.EXPRSTMT, {expression: varDefinition(true, false, singleLineQ)});
	};

	var DEF_ASSIGNMENT = 1;
	var DEF_FUNCTIONAL = 2;
	var DEF_BIND = 3;
	// defPartQ: detects the type of declaration
	// <expr> = 
	//        ^ -- Simple assignment
	// <expr> <-
	//        ^ -- Bind assignment
	// <expr> : 
	// <expr> (
	//        ^ -- Function declaration
	var defPartQ = function(){
		if(tokenIs(ASSIGN, '=')) return DEF_ASSIGNMENT;
		else if(tokenIs(BIND)) return DEF_BIND;
		else if(tokenIs(COLON) || tokenIs(OPEN, RDSTART)) return DEF_FUNCTIONAL;
	};

	var varDefinition = function(){
		var dp = function(constantQ, forQ){
			var v = callExpression();
			var defType;
			if (defType = defPartQ()){
				if (defType === DEF_ASSIGNMENT) { // assigned variable
					if(forQ) throw new PE("Invalid Declaration.")
					advance();
					return [v, expression()]
				} else if (defType === DEF_FUNCTIONAL){
					if(forQ) throw new PE("Invalid Declaration.")
					return [v, functionLiteral(true)]
				} else if (defType === DEF_BIND){
					advance();
					if(forQ){
						return [v, expression()]
					} else {
						return [v, new Node(nt.CALL, {
							func: new Node(nt.BINDPOINT),
							args: [assignmentExpression()],
							names: [null]
						})];
					}
				}
			} else {
				if(forQ) throw new PE("Invalid Declaration.")
				var rhs = dp(constantQ);
				return [rhs[0], new Node(nt.CALL, {
					func: v,
					args: [rhs[1]],
					names: [null],
				})]
			}
		};
		return function(constantQ, forQ, singleLineQ, whereClauseQ){
			var r = dp(constantQ, forQ);
			if(forQ) return r;
			r = formAssignment(r[0], "=", r[1], true, constantQ, whereClauseQ);
			if(!singleLineQ)
				r = whereClausize(r);
			return r;
		}
	}();


	var contExpression = function(){
		advance(OPEN, RDSTART);
		if(tokenIs(OPERATOR))
			return groupOperatorForm();
		if(tokenIs(EXCLAM)){
			advance();
			var r = new Node(nt.NOT, {
				operand: unary()
			});
			advance(CLOSE, RDEND);
			return r;
		};
		var r = expression();
		advance(CLOSE, RDEND);
		return r;
	};
	var stripSemicolons = function () {
		var hasLinebreaks = false
		while (tokenIs(SEMICOLON)) hasLinebreaks = (advance().value == "Implicit") || hasLinebreaks;
		return hasLinebreaks;
	};

	var ifstmt = function (singleLineQ) {
		advance(IF);
		var n = new Node(nt.IF);
		n.condition = contExpression();
		n.thenPart = block();
		stripSemicolons();
		if(!singleLineQ && tokenIs(ELSE)){
			advance(ELSE);
			if(tokenIs(IF)){
				n.elsePart = blocky(ifstmt());
			} else {
				n.elsePart = block();
			}
		}
		return n;
	};
	var whilestmt = function () {
		advance(WHILE);
		var n = new Node(nt.WHILE, {
			condition: contExpression(),
			body: block()
		});
		return n;
	};
	var repeatstmt = function () {
		advance(REPEAT);
		var n = new Node(nt.REPEAT, {
			body: block()
		});
		stripSemicolons();
		advance(UNTIL);
		n.condition = contExpression();
		return n;
	};
	var forstmt = function () {
		advance(FOR);
		advance(OPEN, RDSTART);
		var declAssignment = varDefinition(false, true);
		advance(CLOSE, RDEND);
		var body = block();

		var bind = declAssignment[0]
		var range = declAssignment[1];
		while(range.type === nt.GROUP) range = range.operand;
		if(bind.type === nt.VARIABLE && (range.type === nt['..'] || range.type === nt['...'])){
			var hightmp = makeT()
			return new Node(nt.OLD_FOR, {
					start: new Node(nt.then, {
						args: [
							formAssignment(bind, '=', range.left, true),
							formAssignment(new Node(nt.TEMPVAR, {name: hightmp}), '=', range.right)
						],
						names: [null, null]
					}),
					condition: new Node((range.type === nt['..'] ? nt['<'] : nt['<=']), {
						left: bind,
						right: new Node(nt.TEMPVAR, {name: hightmp})}),
					step: formAssignment(bind, '=',
						new Node(nt['+'], {
							left: bind,
							right: new Node(nt.LITERAL, {value: 1})})),
					body: body
				});
		} else {
			var t = makeT();
			return new Node(nt.OLD_FOR, {
				start: formAssignment(bind, '=', new Node(nt.CALL, {
					func: MemberNode(
						formAssignment(new Node(nt.TEMPVAR, {name: t}), '=', new Node(nt.CALL, {
							func: new Node(nt.TEMPVAR, {name: 'GET_ENUM', builtin: true}),
							args: [range],
							names: [null]
						})), 
						'emit'
					),
					args: [],
					names: []
				}), true),
				condition: MemberNode(new Node(nt.TEMPVAR, {name: t}), 'active'),
				step: formAssignment(bind, '=', new Node(nt.CALL, {
					func: MemberNode(new Node(nt.TEMPVAR, {name: t}), 'emit'),
					args: [],
					names: []
				})),
				body: body
			})
		}
	};

	var piecewise = function (t) {
		var n = new Node(t ? nt.CASE : nt.PIECEWISE);
		n.conditions = [], n.bodies = [];
		advance();
		if (t) {
			n.expression = contExpression();
		};
		advance(INDENT);
		stripSemicolons();
		ensure(token, 'Unterminated piecewise/case block');
		while (tokenIs(WHEN) || tokenIs(OTHERWISE)) {
			if (tokenIs(WHEN)) {
				advance(WHEN);
				var condition = contExpression();
				stripSemicolons();
				if (tokenIs(WHEN)) {
					n.conditions.push(condition);
					n.bodies.push(null);
					continue;
				} else {
					n.conditions.push(condition);
					n.bodies.push(block());
					stripSemicolons();
				}
			} else {
				advance(OTHERWISE);
				n.otherwise = block();
				stripSemicolons();
				break;
			}
		};
		advance(OUTDENT);
		return n;
	};
	var labelstmt = function () {
		advance(LABEL);
		ensure(tokenIs(ID));
		var label = lname();
		var node = new Node(nt.LABEL, {
			name: label
		});
		advance(COLON);
		ensure(tokenIs(WHILE) || tokenIs(FOR) || tokenIs(REPEAT), "You can only label a loop statement");
		node.body = new Node(nt.SCRIPT, {
			content: [ statement() ]
		});
		return node;
	};
	var brkstmt = function () {
		advance(BREAK);
		if (tokenIs(ID)) {
			var name = token.value;
			advance();
			return new Node(nt.BREAK, { destination: name });
		} else {
			ensure(stover(), 'Something more after BREAK statement');
			return new Node(nt.BREAK, { destination: null });
		}
	};

	///
	stripSemicolons();
	var ws_code = statements();
	stripSemicolons();
	return {
		tree: new Node(nt.FUNCTION, {
			parameters: new Node(nt.PARAMETERS, { names: [] }),
			code: ws_code
		}),
		options: input.options,
		module: input.module
	};
};