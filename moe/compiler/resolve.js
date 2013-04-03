var moe = require('../runtime');
var MOE_UNIQ = moe.UNIQ;
var OWNS = moe.OWNS;
var moecrt = require('./compiler.rt');
var nt = moecrt.NodeType;
var ScopedScript = moecrt.ScopedScript;

var cpsTransform = require('./cps').transform;

var quenchRebinds = function(s){var t = s; while(t && t.blockQ) t = t.parent; return t}

exports.resolve = function(ast, ts, config){
	// Config satisifies <.initVariable()>, <.PE()>, <.PW()> and <.warn()>
	var PE = config.PE;
	var PW = config.PW;
	var ensure = function(c, m, p){
		if(!c) throw PE(m, p);
		return c;
	};

	var createScopes = function(overallAst){
		var scopes = [];
		var stack = [];

		var fWalk = function(node){
			if(node.type === nt.FUNCTION) {
				var s = new ScopedScript(scopes.length, stack[stack.length - 1]);
				s.parameters = node.parameters;
				s.blockQ = node.blockQ;
				s.noVarDecl = node.noVarDecl;
				s.code = node.code;
				scopes[scopes.length] = s;
				node.parameters = node.code = null;

				stack.push(s);
				
				for (var i = 0; i < s.parameters.names.length; i++) {
					var paramName = s.parameters.names[i].name
					if(s.parameters.names[i].type === nt.VARIABLE){
						ensure(s.variables[paramName] !== s.id, 
							'Parameters list duplication detected.', 
							s.parameters.names[i].begins);
						s.pendNewVar(paramName, true, true, node.begins || node.position);
					} else {
						s.useTemp(paramName, ScopedScript.PARAMETERTEMP)
					}
				};
				moecrt.walkNode(s.code, fWalk);

				stack.pop();

				checkBreakPosition(s);
				checkCallWrap(s);
				fAfterScopeFormation(s);
				generateCPSTransform(s);
				
				node.mPrim = node.blockQ && s.mPrim;
				node.tree = s.id;
			} else {
				moecrt.walkNode(node, fWalk);
			}
		};

		var virtualRootAst = {
			type: nt.FUNCTION, 
			code: overallAst
		}

		moecrt.walkNode(overallAst, fWalk);
		var enterScope = scopes[0];

		ts.fInits(function(v, n, constantQ){
			enterScope.pendNewVar(n, true, !constantQ);
			enterScope.useVar(n, 0);
		});

		return scopes;
	};

	var generateCPSTransform = function(scope){
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
			scope.useTemp('SCHEMATA', ScopedScript.SPECIALTEMP);
			scope.code.bindPoint = true;
			scope.code = cpsTransform(scope.code, scope, config, {});
			scope.mPrim = true;
		};
	};

	var fAfterScopeFormation = function(s){
		var fWalk = function(node){
			if(node.type === nt.LABEL) {
				var label = node.name;
				ensure(!s.labels[label] && s.labels[label] !== 0,
					'Unable to re-label a statement.',
					node.position);
				s.labels[label] = node;
				moecrt.walkNode(node, fWalk);
				s.labels[label] = 0
			} else if(node.type === nt.BREAK && node.destination) {
				ensure(s.labels[node.destination] && s.labels[node.destination].type === nt.LABEL, 
					"BREAK statement used a unfound label.",
					node.position)
			} else {
				if(node.declareVariable){
					if(node.whereClauseQ) {
						declareMessage = s.pendNewVar(node.declareVariable, false, node.constantQ, node.begins || node.position);
					} else {
						declareMessage = quenchRebinds(s).pendNewVar(node.declareVariable, false, node.constantQ, node.begins || node.position);
					}
				};
				if(node.type === nt.ASSIGN && node.left.type === nt.VARIABLE && !node.constantQ){
					s.usedVariablesAssignOcc[node.left.name] = node.left.position;
				};
				if(node.type === nt.VARIABLE) {
					s.useVar(node.name, node.position);
				} else if(node.type === nt.THIS || node.type === nt.ARGUMENTS || node.type === nt.ARGN){
					quenchRebinds(s)[node.type === nt.THIS ? 'thisOccurs' : 
					  node.type === nt.ARGUMENTS ? 'argsOccurs' : 'argnOccurs'] = true;
				} else if(node.type === nt.TEMPVAR && !node.builtin){
					s.useTemp(node.name, node.processing)
				};
				moecrt.walkNode(node, fWalk);
			}
		};
		return moecrt.walkNode(s.code, fWalk);
	}

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
			if(node.type === nt.CALLWRAP) {
				debugger;
				throw PE("Invalid CALLWRAP usage.", node.position);
			}
			return moecrt.walkNode(node, fWalk);
		};
		moecrt.walkNode(scope.code, fWalk);
	};

	// Variables resolve
	var resolveVariables = function(scope, trees, explicitQ) {
		// Step I: declare variables
		for(var j = 0; j < scope.pendNewVars.length; j++){
			var warnMessage, term = scope.pendNewVars[j];
			try {
				warnMessage = scope.newVar(term.name, term.parQ, term.constQ, explicitQ)
			} catch(e) {
				throw PE(e + '', term.pos)
			}
			if(warnMessage){
				config.warn(PW(warnMessage, term.pos))
			}
		}
		// Step II: check used variables
		for (var each in scope.usedVariables) if (scope.usedVariables[each] === true) {
			if(!scope.variables[each]){
				if(!explicitQ) {
					if(!/^[a-z][\d_$]?$/.test(each))
						config.warn(PW('Undeclared variable "' + each + '".',
							(scope.usedVariablesOcc && scope.usedVariablesOcc[each]) || 0));
					quenchRebinds(scope).newVar(each, false, false, explicitQ);
					quenchRebinds(scope).locals.push(each);
				} else {
					throw PE(
						'Undeclared variable "' + each + '" when using `-!option explicit`.',
						(scope.usedVariablesOcc && scope.usedVariablesOcc[each]) || 0
					)
				};
			} else {
				var variableRecord = scope.variables[each]
				var livingScope = trees[variableRecord.id];
				livingScope.locals.push(each);
				if(variableRecord.constQ) {
					var s = scope;
					do {
						if(s.usedVariablesAssignOcc[each] >= 0) {
							throw PE('Attempt to redefine or assign to constant "' + each + '".', s.usedVariablesAssignOcc[each])
						}
						if(s === livingScope) break;
						s = s.parent;
					} while(s)
				}
			};
		};
		// Step III: recurse to nested scopes
		for (var i = 0; i < scope.nest.length; i++) {
			resolveVariables(trees[scope.nest[i]], trees, explicitQ);
		}
	};

	var trees = createScopes(ast);
	var enter = trees[0];
	if(enter.mPrim) {
		throw PE("The global scope cannot be a monadic primitive.", 1);
	}
	resolveVariables(enter, trees, !!ast.options.explicit);
	return trees;
}