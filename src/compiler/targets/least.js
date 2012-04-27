exports.composite= function(script, libs, enumInit, aux){
	return 'var ' + script.aux.runtimeName + ' = ' + (aux.runtimeBind || 'require("moe/runtime").runtime' ) + '\n' +
		script.initializationSource + '\n' +
		'(' + script.generatedSource + ')()';
}
exports.addInits = function(rm){
	rm.addDirectMap('require', 'require');
	rm.addDirectMap('module', 'module');
	rm.addDirectMap('exports', 'exports');
};