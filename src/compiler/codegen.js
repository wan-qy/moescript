var moe = require('../runtime');
var moecrt = require('./compiler.rt');
var nt = moecrt.NodeType;
var ScopedScript = moecrt.ScopedScript;
var walkRex = moecrt.walkRex;


var UNIQ = moe.runtime.UNIQ;
var OWNS = moe.runtime.OWNS;

"Code Emission Util Functions"
var TO_ENCCD = function (name) {
	return name.replace(/[^a-zA-Z0-9_]/g, function (m) {
		return '$' + m.charCodeAt(0).toString(36) + '$'
	});
};
var STRIZE = exports.STRIZE = function(){
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

var C_NAME = exports.C_NAME = function (name) { return TO_ENCCD(name) + '$' },
	C_LABELNAME = function (name) { return TO_ENCCD(name) + '$L' },
	C_TEMP = exports.C_TEMP = function (type){ return type + '$_' },
	T_THIS = function (env) { return '_$_THIS' },
	T_ARGN = function(){ return '_$_ARGND' },
	T_ARGS = function(){ return '_$_ARGS' },
	C_BLOCK = function(label){ return 'block_' + label }

var INDENT = function(s){ return s.replace(/^/gm, '    ') };

var JOIN_STMTS = function (statements) {
	var ans = [], ansl = 0, statement;
	for(var i = 0; i < statements.length; i++) if((statement = statements[i])){
		statement = statement.replace(/^[\s;]+/g, '').replace(/[\s;]+$/g, '')
		if(/[^\s]/.test(statement))
			ans[ansl++] = statement;
	}
	return '\n' + INDENT(ans.join(';\n')) + ';\n';
}

var THIS_BIND = function (env) {
	return (env.thisOccurs) ? 'var ' + T_THIS() + ' = this' : ''
};
var ARGS_BIND = function (env, ReplGlobalQ) {
	if(ReplGlobalQ) return 'var ' + T_ARGS() + ' = ' + '[]';
	else return (env.argsOccurs) ? 'var ' + T_ARGS() + ' = ' + C_TEMP('SLICE') + '(arguments, 0)' : ''
};
var ARGN_BIND = function (env, ReplGlobalQ) {
	if(ReplGlobalQ) return 'var ' + T_ARGN() + ' = ' + '{}';
	else return (env.argnOccurs) ? 
		'var ' + T_ARGN() + ' = ' + C_TEMP('CNARG') + '(arguments[arguments.length - 1])' : ''
};
var TEMP_BIND = function (env, tempName) {
	return C_TEMP(tempName);
};

var $ = function(template, items_){
	var a = arguments;
	return template.replace(/%(\d+)/g, function(m, $1){
		return a[parseInt($1, 10)] || '';
	});
};

var GETV = function (node) { return C_NAME(node.name) };
var SETV = function (node, val) { return '(' + C_NAME(node.name) + ' = ' + val + ')' };

var SPECIALNAMES = {
	"break":1, "continue":1, "do":1, "for":1, "import":1, 
	"new":1, "this":1, "void":1, "case":1, 
	"default":1, "else":1, "function":1, "in":1, 
	"return":1, "typeof":1, "while":1, "comment":1, 
	"delete":1, "export":1, "if":1, "label":1, 
	"switch":1, "var":1, "with":1, "abstract":1, 
	"implements":1, "protected":1, "boolean":1, "instanceof":1, 
	"public":1, "byte":1, "int":1, "short":1, 
	"char":1, "interface":1, "static":1, "double":1, 
	"long":1, "synchronized":1, "false":1, "native":1, 
	"throws":1, "final":1, "null":1, "transient":1, 
	"float":1, "package":1, "true":1, "goto":1, 
	"private":1, "catch":1, "enum":1, "throw":1, 
	"class":1, "extends":1, "try":1, "const":1, 
	"finally":1, "debugger":1, "super":1
};
var IDENTIFIER_Q = /^[a-zA-Z$][\w$]*$/;

var PART = exports.PART = function(left, right){
	// Generates 'Parting' code.
	// Left: expression
	// Right: name
	if (!IDENTIFIER_Q.test(right) || SPECIALNAMES[right] === 1)
		return left + '[' + STRIZE(right) + ']';
	else 
		return left + '.' + right;
};

var GListTmpType = function(type){
	// Generates a function lists specific type of temp vars
	// used in a scope.

	// See compiler.rt/ScopedScript.useTemp
	type = type + 1;
	return function(scope){
		var l = [];
		for(var each in scope.usedTemps){
			if(scope.usedTemps[each] === type)
				l.push(each);
		}
		return l;
	};
};
var listTemp = GListTmpType(ScopedScript.VARIABLETEMP);
var listParTemp = GListTmpType(ScopedScript.PARAMETERTEMP);

exports.Generator = function(g_envs, g_config){
	var env = g_envs[0];
	var makeT = g_config.makeT;

	var ungroup = function(node){
		while(node.type === nt.GROUP)
			node = node.operand;
		return node;
	};

	var WPOS = function(node, s){
		var r = s;
		if(node.begins >= 0 && node.ends >= 0){
			r = '/*\x1b [' + node.begins + '\x1b */' + r + '/*\x1b ]' + node.ends + '\x1b */';
		};
		return r;
	}

	var NTF = function(f){
		return function(node){
			return WPOS(node, f.apply(this, arguments));;
		}
	}

	"Common Functions";
	var compileFunctionBody = function (tree, ReplGlobalQ) {
		// Generates code for normal function.
		// Skip when necessary.
		if (tree.transformed) return tree.transformed;
		if (tree.mPrim) return compileMPrim(tree, ReplGlobalQ);
		var backupenv = env;
		env = tree;

		var s = transform(tree.code).replace(/^    /gm, '');

		var locals = UNIQ(tree.locals),
			vars = [],
			temps = listTemp(tree);

		var pars = tree.parameters.names.slice(0), temppars = listParTemp(tree);



		for (var i = 0; i < locals.length; i++)
			if (!(tree.varIsArg[locals[i]])){
				vars.push(C_NAME(locals[i]));
			}

		for (var i = 0; i < temps.length; i++)
			temps[i] = TEMP_BIND(tree, temps[i]);

		s = JOIN_STMTS([
			THIS_BIND(tree),
			ARGS_BIND(tree, ReplGlobalQ),
			ARGN_BIND(tree, ReplGlobalQ),
			(temps.length ? 'var ' + temps.join(', '): ''),
			(vars.length ? 'var ' + vars.join(', ') : ''),
			s
		]);

		for (var i = 0; i < pars.length; i++) {
			pars[i] = WPOS(pars[i], C_NAME(pars[i].name));
		};		
		for (var i = 0; i < temppars.length; i++) {
			temppars[i] = C_TEMP(temppars[i]);
		};

		if(ReplGlobalQ) return s.replace(/^    /gm, '');
		s = $('function (%1){%2}',  pars.concat(temppars).join(','), s);
	
		tree.transformed = s;
		env = backupenv;
		return s;
	};

	"Monadic Primitives";
	var compileMPrim = function(tree){
		// Generates code for MPs.
		if(tree.transformed) return tree.transformed;
		var backupenv = env;
		env = tree;
		
		var s = transformMPrim(tree);

		tree.useTemp('SCHEMATA', ScopedScript.SPECIALTEMP);


		var locals = UNIQ(tree.locals),
			vars = [],
			temps = listTemp(tree);
		for (var i = 0; i < locals.length; i++) {
			if (!(tree.varIsArg[locals[i]])){
				vars.push(C_NAME(locals[i]));
			}
		};
		for (var i = 0; i < temps.length; i++) {
			temps[i] = TEMP_BIND(tree, temps[i]);
		};

		var pars = tree.parameters.names.slice(0), temppars = listParTemp(tree);
		for (var i = 0; i < pars.length; i++)
			pars[i] = WPOS(pars[i], C_NAME(pars[i].name));
		for (var i = 0; i < temppars.length; i++)
			temppars[i] = C_TEMP(temppars[i])

		s = $('{build:function(%1){return function(%2){%3}}}', 
				C_TEMP('SCHEMATA'),
				pars.concat(temppars).join(', '),
				JOIN_STMTS([
					THIS_BIND(tree),
					ARGS_BIND(tree),
					ARGN_BIND(tree),
					(temps.length ? 'var ' + temps.join(', '): ''),
					(vars.length ? 'var ' + vars.join(', ') : ''),
					s.s,
					'return ' + s.enter
				]));
		tree.transformed = s;
		env = backupenv;
		return s;
	};

	"Transforming Utils";
	// vmSchemata: Transformation schemata for non-bindPoint parts
	var vmSchemata = [];
	var vmSchemataDef = function (tf, trans) {
		if(!tf) throw "Unexpected schemata name"
		vmSchemata[tf] = trans;
	};
	// epSchemata: Transformation schemata for both non- and bindPoint nodes.
	// Used for expressions only.
	var epSchemata = [];
	var eSchemataDef = function(type, f){
		if(!type) throw "Unexpected schemata name"
		epSchemata[type] = f;
	};

	var transform = NTF(function (node) {
		if (vmSchemata[node.type]) {
			return vmSchemata[node.type].call(node, node, env);
		} else if (epSchemata[node.type]) {
			return epSchemata[node.type].call(node, transform, env);
		} else {
			throw node
		};
	});


	"Common schematas";
	eSchemataDef(nt.VARIABLE, function (transform, env) {
		return GETV(this);
	});
	eSchemataDef(nt.TEMPVAR, function(){
		return C_TEMP(this.name);
	});
	eSchemataDef(nt.LITERAL, function () {
		if (typeof this.value === 'string') {
			return STRIZE(this.value);
		} else if (typeof this.value === 'number'){
			return '' + this.value;
		} else if (this.value.tid){
			return C_TEMP(this.value.tid);
		} else if (this.value instanceof RegExp){
			return '(/' + (this.value.source.replace(/(\\.)|(\[(?:\\.|[^\[\]])*\])|(\/)|([^\\\/\[])/g, function(m, escape, charclass, slash, normal){
				if(slash) return '\\/'
				else return m
			})) + '/' + (this.value.global ? 'g' : '') + (this.value.ignoreCase ? 'i' : '') + (this.value.multiline ? 'm' : '') + ')';
		} else return '' + this.value.map;
	});
	eSchemataDef(nt.GROUP, function(transform, env){
		return '(' + transform(ungroup(this.operand)) + ')'
	});
	eSchemataDef(nt.THIS, function (transform, e) {
		return T_THIS(e);
	});
	eSchemataDef(nt.ARGN, function (transform, e){
		return T_ARGN();
	});
	eSchemataDef(nt.ARGUMENTS, function (transform, e) {
		return T_ARGS();
	});
	eSchemataDef(nt.PARAMETERS, function () {
		throw new Error('Unexpected parameter group');
	});
	eSchemataDef(nt.UNIT, function(){
		return 'undefined';
	})



	eSchemataDef(nt.OBJECT, function (transform) {
		var inits = [],
		    terms = [],
			x = 0,
			hasNameQ = this.nameused;
		for (var i = 0; i < this.args.length; i++) {
			var right = transform(ungroup(this.args[i]))
			if (typeof this.names[i] === "string") {
				hasNameQ = true;
				inits.push(STRIZE(this.names[i]) + ': ' + right);
			} else {
				inits.push(STRIZE('' + x) + ': ' + right);
				x++;
			};
			terms.push(right);
		};
		if(hasNameQ)
			return $('{%1}',
				(this.args.length < 4 ? inits.join(', ') : '\n' + INDENT(inits.join(',\n')) + '\n'));
		else
			return $('[%1]', terms.join(', '));
	});
	eSchemataDef(nt.FUNCTION, function (n, e) {
		var	f = g_envs[this.tree - 1];
		var s = (f.mPrim ? compileMPrim : compileFunctionBody)(f);
		return '(' + s + ')';
	});

	eSchemataDef(nt.MEMBER, function (transform) {
		if(this.right.type === nt.LITERAL 
			&& typeof this.right.value === 'string' 
			&& !(this.left.type === nt.LITERAL && typeof this.left.value === 'number')) {
			return PART(transform(this.left), this.right.value);
		} else {
			return $('%1[%2]', transform(this.left), transform(this.right))
		}
	});

	var binoper = function (operator, tfoper) {
		eSchemataDef(nt[operator], function (transform) {
			var left = transform(this.left);
			var right = transform(this.right);
			if(this.left.type > this.type) left = '(' + left + ')';
			if(this.right.type > this.type) right = '(' + right + ')';
			return $('%1 %2 %3', left, tfoper, right);
		});
	};
	var libfuncoper = function (operator, func){
		eSchemataDef(nt[operator], function (transform) {
			return $('(%1(%2, %3))', func, transform(this.left), transform(this.right));
		});
	};

	binoper('+', '+');
	binoper('-', '-');
	binoper('*', '*');
	binoper('/', '/');
	binoper('%', '%');
	binoper('<', '<');
	binoper('>', '>');
	binoper('<=', '<=');
	binoper('>=', '>=');
	binoper('==', '===');
	binoper('=~', '==');
	binoper('===', '===');
	binoper('!==', '!==');
	binoper('!=', '!==');
	binoper('!~', '!=');
	binoper('&&', '&&');
	binoper('||', '||');
	binoper('and', '&&');
	binoper('or', '||');
	libfuncoper('is', C_TEMP('IS'));
	libfuncoper('as', C_TEMP('AS'));
	libfuncoper('..', C_TEMP('RANGE_EX'));
	libfuncoper('...', C_TEMP('RANGE_INCL'));

	eSchemataDef(nt.NEGATIVE, function (transform) {
		return '(-(' + transform(this.operand) + '))';
	});
	eSchemataDef(nt.NOT, function (transform) {
		return '(!(' + transform(this.operand) + '))';
	});
	eSchemataDef(nt.CTOR, function(transform){
		return 'new (' + transform(this.expression) + ')'
	});


	eSchemataDef(nt.VAR, function(){return ''});

	"Normal transformation specific rules";
	vmSchemataDef(nt.CALLBLOCK, function(){
		return $('(%1())', transform(this.func))
	})
	vmSchemataDef(nt.ASSIGN, function () {
		return $('(%1 = %2)', transform(this.left), transform(this.right));
	});

	vmSchemataDef(nt.EXPRSTMT, function(){
		var s = transform(ungroup(this.expression));
		if(this.expression.type === nt.ASSIGN && s.charAt(0) === '(')
			s = s.slice(1, -1);
		// Two schemas are avoided due to JS' restrictions
		if(s.slice(0, 8) === 'function' || s.charAt(0) === '{'){
			s = '(' + s + ')';
		};
		return s;
	});

	var flowPush = function(flow, env, expr){
		var t = makeT(env);
		flow.push(C_TEMP(t) + '=' + expr);
		return C_TEMP(t);
	};
	var irregularOrderArgs = function(flow, env, pipelineQ){
		var args = [], olits = [], hasNameQ = false;

		if(pipelineQ){
			var t = makeT(env);
			flow.unshift(C_TEMP(t) + '=' + transform(ungroup(this.args[0])));
			args.push(C_TEMP(t));
		}
		
		for (var i = (pipelineQ ? 1 : 0); i < this.args.length; i++) {
			if (this.names[i]) {
				var tn = flowPush(flow, env, transform(ungroup(this.args[i])));
				olits.push(STRIZE(this.names[i]));
				olits.push(tn);
				hasNameQ = true;
			} else {
				var tn = flowPush(flow, env, transform(ungroup(this.args[i])));
				args.push(tn);
			}
		};

		if(hasNameQ){
			args.push('new '+C_TEMP('NARGS')+'(' + olits.join(', ') + ')');
		}

		return args;
	};
	var regularOrderArgs = function(){
		var args = [], olits = [], hasNameQ = false;
		
		for (var i = 0; i < this.args.length; i++) {
			if (this.names[i]) {
				olits.push(STRIZE(this.names[i]));
				olits.push(transform(ungroup(this.args[i])));
				hasNameQ = true;
			} else {
				args.push(transform(ungroup(this.args[i])));
			}
		};

		if(hasNameQ){
			args.push('new '+C_TEMP('NARGS')+'(' + olits.join(', ') + ')');
		}

		return args;
	};

	var flowFuncParts = function(flow){
		var pivot, right, b;
		switch (this.type) {
			case nt.MEMBER:
				pivot = transform(this.left)
				right = '[' + transform(this.right) + ']'
				break;
			case nt.CTOR:
				pivot = null
				right = transform(this.expression)
				    b = 'new'
				break;
			default:
				pivot = null
				right = transform(this)
				break;
		};
		if(pivot){
			var tP = flowPush(flow, env, pivot);
			var tF = flowPush(flow, env, tP + right);
		} else {
			var tF = flowPush(flow, env, right);
		};
		if(b) tF = b + '(' + tF + ')';
		return {
			p: tP, f: tF
		}
	};

	vmSchemataDef(nt.CALL, function (node, env) {
		// this requires special pipeline processing:
		var pipelineQ = node.pipeline && node.func // pipe line invocation...
			&& !(node.func.type === nt.VARIABLE || node.func.type === nt.THIS) // and side-effective.
		this.names = this.names || []
		var hasNameQ = false;
		var irregularOrderQ = pipelineQ;
		for(var i = 0; i < this.names.length; i++) {
			if(this.names[i])
				hasNameQ = true;
			// Irregular evaluation order found.
			if(hasNameQ && !this.names[i])
				irregularOrderQ = true;
		};

		if(irregularOrderQ){
			var flow = [];
			var func = flowFuncParts.call(this.func, flow, env);
			var args = irregularOrderArgs.call(this, flow, env, pipelineQ);
			if(func.p){
				args.unshift(func.p);
				flow.push(func.f + '.call(' + args.join(', ') + ')')
			} else {
				flow.push(func.f + '(' + args.join(', ') + ')')
			}
			return '(' + flow.join(',') + ')';
		} else {
			// Otherwise: use normal transformation.
			return $('%1(%2)', transform(this.func), regularOrderArgs.call(this).join(', '))
		}
	});
	vmSchemataDef(nt['then'], function(){
		var a = []
		for(var i = 0; i < this.args.length; i++)
			a.push(transform(this.args[i]))
		return '(' + a.join(',') + ')';
	});
	vmSchemataDef(nt.CONDITIONAL, function(){
		return $("(%1 ? %2 : %3)", transform(this.condition), transform(this.thenPart), transform(this.elsePart))
	});

	vmSchemataDef(nt.RETURN, function () {
		return 'return ' + transform(ungroup(this.expression));
	});
	vmSchemataDef(nt.IF, function () {
		return $('if (%1){%2} %3', 
			transform(ungroup(this.condition)),
			transform(this.thenPart),
			this.elsePart ? "else {" + transform(this.elsePart) + "}" : '');
	});
	vmSchemataDef(nt.PIECEWISE, function () {
		var a = [], cond = '';
		for (var i = 0; i < this.conditions.length; i++) {
			if (!this.bodies[i]) { // fallthrough condition
				cond += '(' + transform(ungroup(this.conditions[i])) + ') || ';
			} else {
				cond += '(' + transform(ungroup(this.conditions[i])) + ')';
				a.push('if (' + cond + '){' + transform(this.bodies[i]) + '}');
				cond = '';
			}
		}

		var s = a.join(' else ');
		if (this.otherwise) {
			s += ' else {' + transform(this.otherwise) + '}';
		}

		return s;
	});

	vmSchemataDef(nt.CASE, function (node, env) {
		var t = makeT(env);
		var sAssignment = C_TEMP(t) + ' = ' + transform(ungroup(this.expression));
		// create temp node
		var tempNode = {
			type: nt.PIECEWISE, 
			bodies: this.bodies, 
			conditions: this.conditions.map(function(right){return {
				type: '==',
				left: {type: nt.TEMPVAR, name: t},
				right: right,
			}}),
			otherwise: this.otherwise
		};
		return sAssignment + ';\n' + transform(tempNode);
	});
	vmSchemataDef(nt.REPEAT, function () {
		return $('do{%2}while(!(%1))', transform(ungroup(this.condition)), transform(this.body));
	});
	vmSchemataDef(nt.WHILE, function () {
		return $('while(%1){%2}', transform(ungroup(this.condition)), transform(this.body));
	});
	vmSchemataDef(nt.OLD_FOR, function(){
		return $('for(%1; %2; %3){%4}',
			this.start ? transform(this.start) : '',
			transform(ungroup(this.condition)),
			this.step ? transform(ungroup(this.step)) : '',
			transform(this.body));
	});
	vmSchemataDef(nt.FOR, function (nd, e) {
		var tEnum = makeT(e);
		var tYV = makeT(e);
		var s_enum = $('(%1 = %2())',
			C_TEMP(tYV),
			C_TEMP(tEnum));
		
		if(this.pass){
			var varAssign = [C_NAME(this.vars[0]) + ' = ' + C_TEMP(tYV)];
		} else {
			var varAssign = [];
			for(var i = 0; i < this.vars.length; i += 1)
				varAssign.push($('%1 = %2[%3]', C_NAME(this.vars[i]), C_TEMP(tYV), i + ''));
		}

		return $('%1 = ' + C_TEMP('GET_ENUM') + '(%2);\nwhile(%3){\n%4;%5}',
			C_TEMP(tEnum),
			transform(this.range),
			s_enum,
			INDENT(varAssign.join(';\n')),
			transform(this.body));
	});
	vmSchemataDef(nt.BREAK, function () {
		return 'break ' + (this.destination ? C_LABELNAME(this.destination) : '');
	});
	vmSchemataDef(nt.LABEL, function () {
		return C_LABELNAME(this.name) + ':{' + transform(this.body) + '}';
	});

	vmSchemataDef(nt.TRY, function(){
		var t = makeT();
		return $('try{%1}catch(%2){%3;%4}',
			transform(this.attemption),
			C_TEMP(t),
			C_NAME(this.eid.name) + '=' + C_TEMP(t),
			transform(this.catcher))
	});
	
	// vmSchemataDef(nt.TRY, function(){
	// 	return $('try{%1}catch(e){}', transform(this.body))
	// });

	vmSchemataDef(nt.SCRIPT, function (n) {
		var a = [];
		for (var i = 0; i < n.content.length; i++) {
			if (n.content[i]){
				a.push(transform(n.content[i]));
			}
		}
		return JOIN_STMTS(a)
	});
	
	"Obstructive Proto Flow";
	var mPrimFlow = function(ct){
		var block = [];
		var labelPlacements = [];
		var joint = function(){
			var basicBlocks = [];
			var ilast = 0;
			for(var i = 1; i <= block.length; i++){
				if(labelPlacements[i]){
					basicBlocks.push({
						statements: block.slice(ilast, i),
						id: labelPlacements[ilast][0],
						labels: labelPlacements[ilast]
					});
					ilast = i;
				}
			};
			var ans = [];
			for(var i = 0; i < basicBlocks.length; i++){
				var b = basicBlocks[i];
				var sContinue = (i < basicBlocks.length - 1 && !/^return /.test(b.statements[b.statements.length - 1]))
					? [GOTO(basicBlocks[i + 1].id)] : []
				ans.push('function ' + C_BLOCK(b.id) + '(' + C_TEMP(b.id) + '){'
					+ JOIN_STMTS(b.statements.concat(sContinue)) + '}')
				for(var j = 1; j < b.labels.length; j++){
					ans.push('var ' + C_BLOCK(b.labels[j]) + ' = ' + C_BLOCK(b.id));
				}
			}
			return {s: ans.join(';\n'), enter: C_BLOCK(basicBlocks[0].id)};
		};
		var label_dispatch = function(){
			return makeT()
		};

		var GOTO = function(label){
			return 'return ' + C_BLOCK(label) + '()'
		}
		var LABEL = function(label){
			if(labelPlacements[block.length])
				labelPlacements[block.length].push(label)
			else
				labelPlacements[block.length] = [label];
		}
		var pushStatement = function(s){
			if(s) block.push(s);
		};
		var bindPartID = function(){
			return C_TEMP(makeT(env));
		};


		return {
			ps: pushStatement,
			GOTO: GOTO,
			LABEL: LABEL,
			label: label_dispatch,
			joint: joint,
			bindPartID: bindPartID
		}
	};

	"Obstructive Protos Transformer";
	var transformMPrim = function(tree, aux){
		var aux = aux || {};
		// Get a flow manager
		var flowM = mPrimFlow(ct);
		var ps = flowM.ps,
			label = flowM.label,
			GOTO = flowM.GOTO,
			LABEL = flowM.LABEL,
			bindPartID = flowM.bindPartID;
		var pct = function(node){ return ps(ct(node))};

		// Obstructive schemata
		// Note that it is flow-dependent
		var mSchemata = vmSchemata.slice(0);
		var ct = function (node) {
			var r;
			if (!node.bindPoint)
				return transform(node);
			if (mSchemata[node.type]) {
				if(node && node.begins >= 0 && node.ends >= 0) ps('/*\x1b [' + node.begins + '\x1b */');
				var r = mSchemata[node.type].call(node, node, env, g_envs);
				if(node && node.begins >= 0 && node.ends >= 0) ps('/*\x1b ]' + node.ends + '\x1b */');
				return r;
			} else if(epSchemata[node.type]) {
				return epSchemata[node.type].call(node, expPart, env)
			} else {
				throw node;
			}
		};
		var expPart = function(node){
			return expPush(ct(node));
		};
		var expPush = function(s){
			if(/^\d+$|^\w+\$_$/.test(s))
				return s;
			var id = bindPartID();
			ps(id + ' = (' + s + ')');
			return id;
		};
		var mSchemataDef = function(){
			var func = arguments[arguments.length - 1];
			for(var i = arguments.length - 2; i >= 0; i--) {
				if(!arguments[i]) throw "Unexpected schemata name"
				mSchemata[arguments[i]] = func;
			}
		};

		// Labels
		var lNearest = aux.lNearest || 0;
		var scopeLabels = aux.scopeLabels || {};
		var lReturn = aux.lReturn || label();

		mSchemataDef(nt.ASSIGN, function () {
			if(this.left.type === nt.MEMBER) {
				var pivot = expPart(this.left.left);
				var member = expPart(this.left.right);
				return $('(%1[%2] = %3)', pivot, member, expPart(this.right));
			} else {
				return $('(%1 = %2)', transform(this.left), expPart(this.right));
			}
		});

		mSchemataDef(nt.EXPRSTMT, function(){
			pct(this.expression);
			return '';
		})

		// bindPoint expressions
		var mArgsList = function(node, env, skip, skips){
			var args = [], olits = [], hasNameQ = false;
			
			for (var i = (skip || 0); i < node.args.length; i++) {
				if (node.names[i]) {
					olits.push(STRIZE(node.names[i]));
					olits.push(expPart(node.args[i]));
					hasNameQ = true
				} else {
					args.push(expPart(node.args[i]));
				}
			};

			if(skip){
				args = (skips).concat(args)
			};

			if(hasNameQ){
				args.push('new ' + C_TEMP('NARGS') + '(' + olits.join(',') + ')')
			};

			return {
				hasNameQ: hasNameQ,
				args: args
			};
		};

		var bindFunctionPart = function(){
			switch (this.type) {
				case nt.MEMBER:
					var p = expPart(this.left);
					return { p: p, f: expPush('((' + p + ')[' + expPart(this.right) + '])') }
				case nt.CTOR:
					var f = expPart(this.expression);
					return { p: null, f: f, b: 'new (' + f + ')' }
				default:
					return {
						f : expPart(this),
						p : null
					}
			}
		};

		mSchemataDef(nt.CALL, function (node, env) {
			if(this.func && this.func.type === nt.BINDPOINT)
				return awaitCall.apply(this, arguments);

			var skip = 0, skips = [];

			// this requires special pipeline processing:
			var pipelineQ = node.pipeline && node.func // pipe line invocation...
				&& !(node.func.type === nt.VARIABLE || node.func.type === nt.THIS) // and side-effective.

			if(pipelineQ){
				skip = 1;
				skips = [expPart(this.args[0])];
			};

			var func = bindFunctionPart.call(this.func);
			var ca = mArgsList(this, env, skip, skips);
			if(func.p) {
				ca.args.unshift(func.p);
				return $('(%1.call(%2))', func.b || func.f, ca.args.join(','))
			} else {
				return $('(%1(%2))', func.b || func.f, ca.args.join(','))
			}
		});

		var awaitCall = function(node, env){
			var skip, skips
			// this requires special pipeline processing:
			var pipelineQ = node.pipeline && node.func // pipe line invocation...

			if(pipelineQ){
				skip = 1;
				skips = [expPart(this.args[0])];
			};

			if(this.func.expression){
				var func = bindFunctionPart.call(this.func.expression);
				var finalProcess = PART(C_TEMP('SCHEMATA'), 'bindYield');
			} else {
				var func = null;
				var finalProcess = PART(C_TEMP('SCHEMATA'), 'bind')
			}
			var ca = mArgsList(this, env, skip, skips);
			var l = label();
			ca.args.push(C_BLOCK(l));
			if(!func) {

			} else if(func.p) {
				ca.args.unshift(func.p);
				ca.args.unshift(func.b || func.f);
			} else if(finalProcess) {
				ca.args.unshift('null');
				ca.args.unshift(func.b || func.f);
			};

			ps($('return %1(%2)',
				finalProcess,
				ca.args.join(',')));

			LABEL(l);
			return C_TEMP(l);
		};

		mSchemataDef(nt.BINDPOINT, function (n, env) {
			var node = {
				type: nt.CALL,
				func: this,
				args: [],
				names: []
			};
			return awaitCall.call(node, node, env);
		});

		mSchemataDef(nt.then, function(){
			for(var i = 0; i < this.args.length - 1; i++)
				pct(this.args[i]);
			return expPart(this.args[this.args.length - 1]);
		})

		mSchemataDef(nt.CALLBLOCK, function(){
			var l = label();
			ps($("return (" + C_TEMP('SCHEMATA_BLOCK') + "(%1, %2, %3))",
				transform(this.func),
				C_TEMP('SCHEMATA'),
				C_BLOCK(l)));
			LABEL(l);
			return C_TEMP(l);
		});

		mSchemataDef(nt['and'], nt['&&'], function(){
			var left = expPart(this.left);
			var lElse = label();
			ps('if(!(' + left + '))' + GOTO(lElse));
			var right = expPart(this.right);
			var lEnd = label();
			ps(GOTO(lEnd));
			(LABEL(lElse));
			ps(right + '= false');
			(LABEL(lEnd));
			return left + '&&' + right;
		});

		mSchemataDef(nt['or'], nt['||'], function(){
			var left = expPart(this.left);
			var lElse = label();
			ps('if(' + left + ')' + GOTO(lElse));
			var right = expPart(this.right);
			var lEnd = label();
			ps(GOTO(lEnd));
			(LABEL(lElse));
			ps(right + '= true');
			(LABEL(lEnd));
			return left + '||' + right;
		});

		mSchemataDef(nt.CONDITIONAL, function(){
			var cond = expPart(this.condition);
			var lElse = label();
			ps('if(!(' + cond + '))' + GOTO(lElse));
			var thenp = expPart(this.thenPart);
			var lEnd = label();
			ps(GOTO(lEnd));
			LABEL(lElse);
			var elsep = expPart(this.elsePart)
			LABEL(lEnd);
			return cond + '?' + thenp + ':' + elsep
		});


		// Statements

		mSchemataDef(nt.IF, function(node){
			var lElse = label();
			var lEnd = label();
			ps('if(!(' + ct(this.condition) + '))' + GOTO(lElse));
			pct(this.thenPart);
			if(this.elsePart){
				ps(GOTO(lEnd));
				LABEL(lElse)
				pct(this.elsePart);
				LABEL(lEnd)
			} else {
				LABEL(lElse)
			}
			return '';
		});

		mSchemataDef(nt.PIECEWISE, nt.CASE, function () {
			var b = [], l = [], cond = '', lElse;
			if(this.type === nt.CASE)
				var expr = expPart(this.expression);

			for (var i = this.conditions.length-1; i >= 0; i--) {
				if (!this.bodies[i]) { // fallthrough condition
					l[i] = l[i+1]
				} else {
					var li = label();
					l[i] = li;
					b[i] = this.bodies[i];
				}
			};

			for (var i = 0; i < this.conditions.length; i++) {
				if(this.type === nt.PIECEWISE){
					ps('if (' + ct(this.conditions[i]) + '){\n' + GOTO(l[i]) + '\n}');
				} else {
					ps('if (' + expr + '=== (' + ct(this.conditions[i]) + ')){\n' + GOTO(l[i]) + '\n}');
				}
			}

			var lEnd = label();	
			if (this.otherwise) {
				var lElse = label()
				ps(GOTO(lElse));
			} else {
				ps(GOTO(lEnd));
			}

			for(var i = 0; i < b.length; i += 1) if(b[i]) {
				LABEL(l[i])
				pct(b[i])
				ps(GOTO(lEnd))
			}

			if (this.otherwise) {
				LABEL(lElse)
				pct(this.otherwise);
				ps(GOTO(lEnd));
			}
	
			LABEL(lEnd)
			return '';
		});

		mSchemataDef(nt.WHILE, function(){
			var lLoop = label();
			var bk = lNearest;
			var lEnd = lNearest = label();
			(LABEL(lLoop));
			ps('if(!(' + ct(this.condition) + '))' + GOTO(lEnd)); 
			pct(this.body);
			ps(GOTO(lLoop));
			(LABEL(lEnd));
			lNearest = bk;
			return '';
		});
		mSchemataDef(nt.OLD_FOR, function () {
			var lLoop = label();
			var bk = lNearest;
			var lEnd = lNearest = label();
			if(this.start) ps(ct(this.start));
			(LABEL(lLoop));
			ps('if(!(' + ct(this.condition) + '))' + GOTO(lEnd));
			pct(this.body);
			if(this.step) ps(ct(this.step));
			ps(GOTO(lLoop));
			(LABEL(lEnd));
			lNearest = bk;
			return '';
		});
		mSchemataDef(nt.FOR, function(node, env){
			var tEnum = makeT(env);
			var tYV = makeT(env);

			if(this.pass){
				var varAssign = [C_NAME(this.vars[0]) + '=' + C_TEMP(tYV)]
			} else {
				var varAssign = [];
				for(var i = 0; i < this.vars.length; i += 1)
					varAssign.push($('%1 = %2[%3]', C_NAME(this.vars[i]), C_TEMP(tYV), i + ''));
			}
			var s_enum = $('(%1 = %2()) ? ( %3 ): undefined',
				C_TEMP(tYV),
				C_TEMP(tEnum),
				varAssign.join(', '));

			var lLoop = label();
			var bk = lNearest;
			var lEnd = lNearest = label();
			ps(C_TEMP(tEnum) + '=' + C_TEMP('GET_ENUM') + '(' + ct(this.range) + ')');
			ps(s_enum);
			(LABEL(lLoop));
			ps('if(!(' + C_TEMP(tYV) + '))' + GOTO(lEnd));
			pct(this.body);
			ps(s_enum);
			ps(GOTO(lLoop));
			(LABEL(lEnd))
			lNearest = bk;
			return '';
		});

		mSchemataDef(nt.REPEAT, function(){
			var lLoop = label();
			var bk = lNearest;
			var lEnd = lNearest = label();
			(LABEL(lLoop));
			pct(this.body);
			ps('if(!(' + ct(this.condition) + '))' + GOTO(lLoop));
			(LABEL(lEnd));
			lNearest = bk;
			return ''
		});
	

		mSchemataDef(nt.RETURN, function() {
			ps($('return %1(%2)',
				C_BLOCK(lReturn),
				ct(this.expression)));
			return '';
		});

		mSchemataDef(nt.LABEL, function () {
			var l = scopeLabels[this.name] = label();
			pct(this.body);
			(LABEL(l));
			return ''
		});
		mSchemataDef(nt.BREAK, function () {
			ps(GOTO(this.destination ? scopeLabels[this.destination] : lNearest));
			return ''
		});
		mSchemataDef(nt.TRY, function() {
			var bTry = makeT();
			var bCatch = makeT();
			var sAttemption = transformMPrim({code: {type: nt.SCRIPT, content: this.attemption.content, bindPoint: true}}, 
				{lNearest: lNearest, scopeLabels: scopeLabels, lReturn: lReturn, nested: true});
			var sCatcher = transformMPrim({code: {type: nt.SCRIPT, content: this.catcher.content, bindPoint: true}}, 
				{lNearest: lNearest, scopeLabels: scopeLabels, lReturn: lReturn, nested: true});

			var l = label();
			ps(C_TEMP(bTry) + ' = ' + 'function(' + C_TEMP('SCHEMATA') + '){' + sAttemption.s + '; return ' + sAttemption.enter + '}');
			ps(C_TEMP(bCatch) + ' = ' + 'function(' + C_TEMP('SCHEMATA') + '){' + sCatcher.s +
				'; return function(x){' + C_NAME(this.eid.name) + '= x; ' + sCatcher.enter + '()}}');
			ps('return ' + PART(C_TEMP('SCHEMATA'), 'try') + '(' + C_TEMP(bTry) + ',' + C_TEMP(bCatch) + ',' + C_BLOCK(l) + ')');
			LABEL(l);
			return '';
		});

		mSchemataDef(nt.SCRIPT, function (n) {
			var gens;
			for (var i = 0; i < n.content.length; i++){
				if (n.content[i]){
					gens = ct(n.content[i]);
					if(gens) ps(gens);
				}
			};
		});

		// -------------------------------------------------------------
		// Here we go

		LABEL(label());
		ct(tree.code);
		ps('return ' + C_TEMP('SCHEMATA') + '["return"]' + '()');
		if(!aux.nested){
			LABEL(lReturn);
			ps('return ' + PART(C_TEMP('SCHEMATA'), 'return') + '(' + C_TEMP(lReturn) + ')');
		};
		LABEL(label());
		return flowM.joint();
	}

	var addSmapInfo = function(info){
		var code = info.generatedCode.replace(/(?:;|\s|\/\*\x1b [\[\]]\d+\x1b \*\/)*;/g, 
			function(m){
				return (m.match(/\/\*\x1b [\[\]]\d+\x1b \*\//g) || []).join('') + ';';
			});
		code = code.replace(/\{((?:\s|\/\*\x1b [\[\]]\d+\x1b \*\/)*);/, '{$1');
		var smapPoints = [];
		var buf = '';
		walkRex(/\/\*\x1b ([\[\]])(\d+)\x1b \*\//g, code, function(match, $1, $2){
			var p = buf.length;
			var q = $2 - 0;
			var type = $1;
			smapPoints.push({p: p, q: q, type: type});
		}, function(match){
			buf += match;
		});
		return {
			generatedCode: buf,
			smapPoints: smapPoints
		}
	};
	return function(){
		var generatedCode = compileFunctionBody.apply(this, arguments);

		// Create SMAP Array


		return addSmapInfo({generatedCode: generatedCode})
	}
};