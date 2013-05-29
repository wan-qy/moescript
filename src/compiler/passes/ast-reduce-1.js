var moe = require('../../runtime');
var OWNS = moe.OWNS;
var moecrt = require('../compiler.rt');
var nt = moecrt.NodeType;
var Node = moecrt.MakeNode;
var nodeSideEffectiveQ = moecrt.nodeSideEffectiveQ;

var Pass = function(typeConcern, definition){
	var f = function(node){
		node = recurse(node);
		if(node && node.type === typeConcern) {
			return definition.call(node, recurse) || node;
		} else {
			return node;
		}
	};
	var recurse = function(node){
		return moecrt.walkNodeTF(node, f);
	};
	return (function(scopes){
		for(var j = 0; j < scopes.length; j++)
			scopes[j].code = f(scopes[j].code);
		return scopes;
	});
};

var ungroup = Pass(nt.GROUP, function(){
	return this.operand;
});

var reduceAndPass1 = Pass(nt['&&'], function(recurse){
	return new Node(nt.and, {
		left: node.left,
		right: node.right,
		begins: node.begins,
		ends: node.ends
	});
	return this;
});
var reduceOrPass1 = Pass(nt['||'], function(recurse){
	return new Node(nt.or, {
		left: node.left,
		right: node.right,
		begins: node.begins,
		ends: node.ends
	});
	return this;
});

var reduceAndPass2 = Pass(nt.and, function(recurse){
	if(this.left.type === nt.LITERAL && this.left.value && this.left.value.map === 'true') {
		return this.right
	};
	return this;
});
var reduceOrPass2 = Pass(nt.or, function(recurse){
	if(this.left.type === nt.LITERAL && this.left.value && this.left.value.map === 'false') {
		return this.right
	};
	return this;
});

var reduceThenNode = Pass(nt.then, function(recurse){
	var a = [];
	for(var j = 0; j < this.args.length; j++) if(this.args[j]){
		if(this.args[j].type === nt.then) a = a.concat(this.args[j].args);
		else a.push(this.args[j]);
	};
	for(var j = 0; j < a.length - 1; j++){
		if(!nodeSideEffectiveQ(a[j])) a[j] = null;
	};
	this.args = a.filter(function(x){return x != null});
	return this;
});

var reduceScriptNode = Pass(nt.SCRIPT, function(recurse){
	var a = [];
	for(var j = 0; j < this.content.length; j++) if(this.content[j]){
		var sub = this.content[j];
		if(sub.type === nt.SCRIPT && sub.content) {
			a = a.concat(sub.content);
		} else if(sub.type === nt.then){
			for(var k = 0; k < sub.args.length; k++){
				if(sub.args[k] && nodeSideEffectiveQ(sub.args[k])) {
					a.push(sub.args[k]);
				}
			}
		} else if(sub.type === nt.RETURN){
			if(sub.expression.type === nt.then) {
				var kmax = sub.expression.args.length - 1;
				while(kmax >= 0 && !sub.expression.args[kmax]) kmax--;
				for(var k = 0; k < kmax; k++) {
					if(sub.expression.args[k] && nodeSideEffectiveQ(sub.expression.args[k])) {
						a.push(sub.expression.args[k]);
					}
				}
				a.push(new Node(nt.RETURN, {
					expression: sub.expression.args[kmax]
				}));
			} else {
				a.push(sub);
			}
			break;
		} else if(sub.type === nt.BREAK){
			a.push(sub);
			break;
		} else {
			a.push(sub);
		}
	};
	this.content = a;
	return this;
});

exports.passes = [
	ungroup,
	reduceAndPass1,
	reduceAndPass2,
	reduceOrPass1,
	reduceOrPass2,
	reduceThenNode,
	reduceScriptNode
]