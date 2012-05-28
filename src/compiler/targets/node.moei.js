var nullTarget = require('./least')

exports.composite = nullTarget.composite
exports.addInits = function(rm){
	nullTarget.addInits(rm);
	rm.addLibImport('moe/prelude', 'require.main.require("moe/prelude")');
	rm.addDirectMap('console', 'console');
	rm.addDirectMap('process', 'process');
};