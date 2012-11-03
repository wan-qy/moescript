var moe = require('../runtime');
var MOE_UNIQ = moe.runtime.UNIQ;
var OWNS = moe.runtime.OWNS;
var moecrt = require('./compiler.rt');
var nt = moecrt.NodeType;
var ScopedScript = moecrt.ScopedScript;

var quenchRebinds = function(s){var t = s; while(t && t.blockQ) t = t.parent; return t}

exports.resolve = function(ast, ts, config){
	// Config satisifies <.initVariable()>, <.PE()>, <.PW()> and <.warn()>
	var PE = config.PE;
	var PW = config.PW;

	var createScopes = function(overallAst){
		var scopes = [];
		var stack = [];
		var ensure = function(c, m, p){
			if(!c) throw PE(m, p);
			return c;
		};

		var fWalk = function(node){
			if(node.type === nt.FUNCTION) {
				var s = new ScopedScript(scopes.length + 1, current);
				if(current){
					current.hasNested = true;
					current.nest.push(s.id);
				};
				s.parameters = node.parameters;
				s.blockQ = node.blockQ;
				s.noVarDecl = node.noVarDecl;
				for (var i = 0; i < s.parameters.names.length; i++) {
					s.newVar(s.parameters.names[i].name, true)
				};
				s.code = node.code;

				scopes[scopes.length] = s;
				stack.push(s);
				current = s;

				moecrt.walkNode(node, fWalk);
				
				stack.pop();
				current = stack[stack.length - 1];

				node.parameters = node.code = null;

				generateBindRequirement(s, scopes);
				node.mPrim = node.blockQ && s.mPrim;
				node.tree = s.id;
			} else if(node.type === nt.LABEL) {
				var label = node.name;
				ensure(!current.labels[label] && current.labels[label] !== 0,
					'Unable to re-label a statement.',
					node.position);
				current.labels[label] = node;
				moecrt.walkNode(node, fWalk);
				current.labels[label] = 0
			} else if(node.type === nt.BREAK && node.destination) {
				ensure(current.labels[node.destination] && current.labels[node.destination].type === nt.LABEL, 
					"BREAK statement used a unfound label.",
					node.position)
			} else {
				if(node.declareVariable){
					try {
						if(node.whereClauseQ)
							current.newVar(node.declareVariable, false, node.constantQ)
						else
							quenchRebinds(current).newVar(node.declareVariable, false, node.constantQ);
					} catch(ex) {
						throw PE(ex, node.begins || node.position)
					};
				};
				if(node.type === nt.ASSIGN && node.left.type === nt.VARIABLE && !node.constantQ){
					current.usedVariablesAssignOcc[node.left.name] = node.left.position;
				};
				if(node.type === nt.VARIABLE) {
					current.useVar(node.name, node.position)
				} else if(node.type === nt.THIS || node.type === nt.ARGUMENTS || node.type === nt.ARGN){
					var e = current;
					while(e.blockQ && e.parent) e = e.parent;
					e[node.type === nt.THIS ? 'thisOccurs' : 
					  node.type === nt.ARGUMENTS ? 'argsOccurs' : 'argnOccurs'] = true;
				} else if(node.type === nt.TEMPVAR && !node.builtin){
					current.useTemp(node.name, node.processing)
				};
				moecrt.walkNode(node, fWalk);
			}
		};

		var current = scopes[0] = stack[0] = new ScopedScript(1);
		current.parameters = overallAst.parameters;
		current.code = overallAst.code;
		overallAst.tree = 1;

		ts.fInits(function(v, n, constantQ){
			current.newVar(n, false, !constantQ);
			current.varIsArg[n] = true
		});

		moecrt.walkNode(overallAst, fWalk);
		return scopes;
	};

	var generateBindRequirement = function(scope, scopes){
		var mPrimQ = false;
		var fWalk = function (node) {
			if(!node || !node.type) return false;
			var hasBindPointQ = false;
			if(node.type === nt.BINDPOINT || node.type === nt.BREAK || node.type === nt.RETURN || node.mPrim){
				hasBindPointQ = true;
				mPrimQ = mPrimQ || node.type === nt.BINDPOINT || node.mPrim;
			};
			hasBindPointQ = moecrt.walkNode(node, fWalk) || hasBindPointQ;
			if(hasBindPointQ) node.bindPoint = true;
			return hasBindPointQ;
		};
		moecrt.walkNode(scope.code, fWalk);
		if(mPrimQ) {
			scope.mPrim = true;
			scope.code.bindPoint = true;
		};
	};

	var checkBreakPosition = function(scope){
		var fWalk = function (node) {
			if(node.type === nt.WHILE || node.type === nt.FOR || node.type === nt.REPEAT || node.type === nt.OLD_FOR)
				return;
			if(node.type === nt.EXPRSTMT) return;
			if(node.type === nt.BREAK)
				throw PE("Break is at the outside of a loop.", node.position);
			return moecrt.walkNode(node, fWalk);
		};
		moecrt.walkNode(scope.code, fWalk);
	};

	var checkCallWrap = function(scope){
		// "CALLWRAP" check
		var fWalk = function(node){
			if(node.type === nt.CALLWRAP)
				throw PE("Invalid CALLWRAP usage.", node.position);
			return moecrt.walkNode(node, fWalk);
		};
		moecrt.walkNode(scope.code, fWalk);
	};

	var checkFunction = function(s){
		checkBreakPosition(s);
		checkCallWrap(s);
//		generateBindRequirement(s);
	};

	// Variables resolve
	var resolveVariables = function(scope, trees, explicitQ) {
		for (var each in scope.usedVariables) if (scope.usedVariables[each] === true) {
			if(!(scope.variables[each] > 0)){
				if(!explicitQ) {
					if(!/^[a-z][\d_$]?$/.test(each))
						config.warn(PW('Undeclared variable "' + each + '".',
							(scope.usedVariablesOcc && scope.usedVariablesOcc[each]) || 0));
					var s = scope;
					s.newVar(each);
					trees[s.variables[each] - 1].locals.push(each);
				} else {
					throw PE(
						'Undeclared variable "' + each + '" when using `-!option explicit`.',
						(scope.usedVariablesOcc && scope.usedVariablesOcc[each]) || 0
					)
				};
			} else {
				var livingScope = trees[scope.variables[each] - 1];
				livingScope.locals.push(each);
				if(scope.varIsConst[each]) {
					var s = scope;
					do {
						if(s.usedVariablesAssignOcc[each] >= 0)
							throw PE('Attempt to redefine or assign to constant "' + each + '".', s.usedVariablesAssignOcc[each])
						s = s.parent;
					} while(s && s !== livingScope)
				}
			};
		};
		for (var i = 0; i < scope.nest.length; i++)
			resolveVariables(trees[scope.nest[i] - 1], trees, explicitQ);

		// minimalize AST size
		// scope.cleanup();
	};

	var trees = createScopes(ast.tree);
	var enter = trees[0];
	generateBindRequirement(enter);
	
	if(enter.mPrim){
		throw PE("The global scope cannot be a monadic primitive.", 1);
	}

	for(var i = 0; i < trees.length; i++)
		checkFunction(trees[i]);

	resolveVariables(enter, trees, !!ast.options.explicit);
	return trees;
}