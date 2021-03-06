var moe = require('../runtime');
var MOE_UNIQ = moe.UNIQ;
var OWNS = moe.OWNS;
var moecrt = require('./compiler.rt');
var nt = moecrt.NodeType;
var ScopedScript = moecrt.ScopedScript;

var reducePasses = require('./passes/ast-reduce-1').passes;
var cpsTransform = require('./passes/cps-transform').transform;

var endofRebinds = function(s){var t = s; while(t && t.blockQ) t = t.parent; return t}

var positionOf = function(node){
	if(node.begins || node.begins === 0) return node.begins
	else return node.position
}

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
						s.prepareVariableDeclaredMark(paramName, true, true, positionOf(node));
					} else {
						s.markTempUsed(paramName, ScopedScript.PARAMETERTEMP)
					}
				};
				moecrt.walkNode(s.code, fWalk);

				stack.pop();

				checkBreakPosition(s);
				checkPesudoFunction(s);
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
			enterScope.prepareVariableDeclaredMark(n, true, !constantQ);
			enterScope.markVariableUsed(n, 0);
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
			scope.markTempUsed('SCHEMATA', ScopedScript.SPECIALTEMP);
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
					positionOf(node));
				s.labels[label] = node;
				moecrt.walkNode(node, fWalk);
				s.labels[label] = 0
			} else if(node.type === nt.BREAK && node.destination) {
				ensure(s.labels[node.destination] && s.labels[node.destination].type === nt.LABEL, 
					"BREAK statement used a unfound label.",
					positionOf(node))
			} else {
				if(node.declareVariable){
					if(node.insideWhereClauseQ) {
						declareMessage = s.prepareVariableDeclaredMark(node.declareVariable, false, node.constantQ, positionOf(node));
					} else {
						declareMessage = endofRebinds(s).prepareVariableDeclaredMark(node.declareVariable, false, node.constantQ, positionOf(node));
					}
				};

				if(node.type === nt.ASSIGN && node.left.type === nt.VARIABLE && !node.constantQ){
					s.usedVariablesAssignOcc.put(node.left.name, node.left.position);
				};

				if(node.type === nt.VARIABLE) {
					s.markVariableUsed(node.name, positionOf(node));
				} else if(node.type === nt.THIS || node.type === nt.ARGUMENTS || node.type === nt.ARGN || node.type === nt.ARG0){
					endofRebinds(s)[
					  node.type === nt.THIS ?      'thisOccurs' : 
					  node.type === nt.ARGUMENTS ? 'argsOccurs' : 
					  node.type === nt.ARG0 ?      'arg0Occurs' : 
					                               'argnOccurs' ] = true;
				} else if(node.type === nt.TEMPVAR && !node.builtin){
					s.markTempUsed(node.name, node.processing)
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
			if(node.type === nt.BREAK)
				throw PE("Break is at the outside of a loop.", positionOf(node));
			return moecrt.walkNode(node, fWalk);
		};
		moecrt.walkNode(scope.code, fWalk);
	};

	var checkPesudoFunction = function(scope){
		// "PESUDO_FUNCTION" check
		var fWalk = function(node){
			if(node.type === nt.PESUDO_FUNCTION) {
				throw PE("Invalid pesudo-function usage.", positionOf(node));
			}
			return moecrt.walkNode(node, fWalk);
		};
		moecrt.walkNode(scope.code, fWalk);
	};

	// Variables resolve
	var resolveVariables = function(scope, trees, explicitQ) {
		// Step I: declare variables
		for(var j = 0; j < scope.prepareVariableDeclaredMarks.length; j++){
			var warnMessage, term = scope.prepareVariableDeclaredMarks[j];
			try {
				warnMessage = scope.markVariableDeclared(term.name, term.parQ, term.constQ, explicitQ)
			} catch(e) {
				throw PE(e + '', term.pos)
			}
			if(warnMessage){
				config.warn(PW(warnMessage, term.pos))
			}
		};

		// Step II: check used variables
		scope.usedVariables.forEach(function(each){
			if(!scope.variables.get(each)){
				// A variable is used, but not declared
				if(!explicitQ) {
					if(!/^[a-z][\d_$]?$/.test(each)) {
						config.warn(PW('Undeclared variable "' + each + '".',
							(scope.usedVariablesOcc && scope.usedVariablesOcc.get(each)) || 0));
					}
					endofRebinds(scope).markVariableDeclared(each, false, false, explicitQ);
					endofRebinds(scope).locals.push(each);
				} else {
					throw PE(
						'Undeclared variable "' + each + '" when using `-!option explicit`.',
						(scope.usedVariablesOcc && scope.usedVariablesOcc.get(each)) || 0
					)
				};
			} else {
				var variableRecord = scope.variables.get(each);
				var livingScope = trees[variableRecord.id];
				livingScope.locals.push(each);
				if(variableRecord.constQ) {
					var s = scope;
					do {
						if(s.usedVariablesAssignOcc.get(each) >= 0) {
							throw PE(
								'Attempt to redefine or assign to constant "' + each + '".', 
								s.usedVariablesAssignOcc.get(each)
							)
						}
						if(s === livingScope) break;
						s = s.parent;
					} while(s)
				}
			};			
		});

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
	for(var j = 0; j < reducePasses.length; j++) trees = reducePasses[j](trees)
	return trees;
}