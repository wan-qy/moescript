var dummy = require('moe/dummy')
dummy.config.runtimeBind = 'require.main.require("moe/runtime").runtime';
var gvm = new (require('../compiler/gvm')).GlobalVariableManager(require)
gvm.bind('require', 'require');
gvm.bind('module', 'module');
gvm.bind('exports', 'exports');
gvm.addLibImport('moe/prelude', 'require.main.require("moe/prelude")');
gvm.bind('console', 'console');
gvm.bind('process', 'process');
dummy.useRequireManager(gvm);

if(process.argv[2]) {
	var path = require('path')
	return require(path.resolve(process.argv[2]))
} else {
	startRepl();
}

// Start a repl
function startRepl(){

	var META = require('../package.json')
	
	var vm = require('vm');
	var util = require('util');
	var sandbox = vm.createContext({
		require: require,
		process: process,
		console: console,
		module: module,
		exports: exports,
		exit: function(){rl.close()}
	});
	dummy.bind('exit', 'exit');
	var initialScript = dummy.compile('\n\n');
	var globalDump = initialScript.trees[0].variables;
	var cGlobalDump = function(f){
		for(var each in globalDump)
			if(globalDump[each] === 1)
				f('null', each, true)
	};
	vm.runInContext(initialScript.script, sandbox);

	var compiler = require('../compiler');

	var rl = require('readline').createInterface(process.stdin, process.stdout, null);
	var NORMAL_PROMPT = 'moe :> '
	  , CONT_PROMPT   = '--- :> '
	  , SYNT_PROMPT   = '...... '
	  , RETURNED      = '    << '
	  , ERROR         = '[ERROR]'
	  , WARNED        = '    !! ';
	var prompt = function(s){
		rl.setPrompt(s, s.length);
		rl.prompt()
	};
	var buf = '';

	rl.on('line', function(line){
		line = line.replace(/^\n+/, '');
		var syntaxError = false;
		buf += '\n' + line;

		if(/^\s/.test(line)) {
			var indent = line.match(/^\s+/)[0];
			prompt(CONT_PROMPT);
			rl.write(indent);
			return;
		};

		try {
			var script = compiler.compile(buf, {
				optiomMaps : {},
				initVariables: cGlobalDump,
				warn: function(s){ console.log(s.replace(/^/gm, WARNED)) }
			})
			globalDump = script.trees[0].variables;
		} catch(e) {
			syntaxError = e;
		};

		if(syntaxError){
			if(!line.trim()){
				buf = '';
				console.log(ERROR + syntaxError);
				prompt(NORMAL_PROMPT);
			} else {
				prompt(SYNT_PROMPT);
			}
		} else {
			try {
				var ret = vm.runInContext(script.generatedCode, sandbox);
				console.log(util.inspect(ret).replace(/^/gm, RETURNED));
			} catch(e) {
				console.log(util.inspect(e).replace(/^/gm, ERROR))
			}
			buf = '';
			prompt(NORMAL_PROMPT)
		}
	});
	rl.on('close', function(){
		console.log('Bye.');
		process.exit(0)
	});

	console.log("Moescript moei version " + META.version + ' on Nodejs. By ' + META.author);
	prompt(NORMAL_PROMPT);
}