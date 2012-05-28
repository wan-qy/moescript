var dummy = require('moe/dummy')
dummy.setTarget('node.moei.js')
dummy.config.runtimeBind = 'require.main.require("moe/runtime")';

var path = require('path')

return require(path.resolve(process.argv[2]))