var OptionConfig = function(){
	this.config = {};
	this.onFile = function(){};
}
OptionConfig.prototype.on = function(){
	var processor = arguments[arguments.length - 1];
	for(var j = 0; j < arguments.length - 1; j++)
		this.config[arguments[j]] = processor
	return this;
}
OptionConfig.prototype.file = function(f){
	this.onFile = f;
	return this;
}
OptionConfig.prototype.parse = function(list){
	for(var i = 1; i < list.length; i += 1){
		if(typeof this.config[list[i]] === 'function'){
			// An option
			var option_argn = this.config[list[i]].apply(this, list.slice(i + 1, i + 1 + this.config[list[i]].length));
			i += this.config[list[i]].length;
		} else {
			this.onFile(list[i]);
		}
	}
}


exports.opts = function(){return new OptionConfig}
exports.argv = function(){
	var argv = process.argv;
	for(var j = 0; j < argv.length; j++){
    	if(argv[j] === require.main.filename){
    		argv = argv.slice(j);
    		break;
    	}
    }
    return argv;
}