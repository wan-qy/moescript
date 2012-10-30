ifeq ($(OS),Windows_NT)
	MKDIR = -@mkdir.exe -p
else
	MKDIR = -@mkdir -p
endif

everything: __all

DIST = dist
NODEMODDIR = dist/node_modules
MOD = $(NODEMODDIR)/moe
MOEC = $(MOD)/compiler

DIRS = dist/ dist/node_modules/ $(MOD)/ $(MOD)/bin/ $(MOEC)/

$(DIRS):
	$(MKDIR) $@
dirs: $(DIST)/ $(MOD)/ $(MOD)/bin/ $(MOEC)/


runtimeMods = $(MOD)/runtime.js $(MOD)/dummy.js
compilerMods = $(MOEC)/compiler.rt.js $(MOEC)/compiler.js $(MOEC)/codegen.js $(MOEC)/lexer.js $(MOEC)/parser.js $(MOEC)/resolve.js $(MOEC)/gvm.js
commandLineMods = $(MOD)/bin/options.js $(MOD)/bin/moec.js  $(MOD)/bin/moei.js $(MOD)/bin/moec $(MOD)/bin/moei
metadatas = $(MOD)/package.json $(MOEC)/package.json

moecCompoments = $(runtimeMods) $(compilerMods) $(commandLineMods) $(metadatas)

$(moecCompoments): $(MOD)/%: src/%
	cp $< $@

moec: dirs $(moecCompoments)

PRELUDE_CONFIG = --bare -g exports -g moert --runtime-bind moert.runtime
$(MOD)/prelude.js: src/prelude/overture.js src/prelude/prelude.moe moec
	node $(MOD)/bin/moec $(PRELUDE_CONFIG) --include-js $(word 1,$^) $(word 2,$^) -o $@

moePrelude: $(MOD)/prelude.js

### Web test environment
### Always updates all scripts
WEBTEST = doc/webtest
WEBMOD  = $(WEBTEST)/moe
webtestDir:
	$(MKDIR) doc
	$(MKDIR) $(WEBTEST)
	$(MKDIR) $(WEBMOD)
	$(MKDIR) $(WEBMOD)/prelude
	$(MKDIR) $(WEBMOD)/compiler

nessatEXE = node tools/nessat

webMods = $(subst $(MOD)/,$(WEBMOD)/,$(runtimeMods) $(compilerMods) $(MOD)/prelude.js)
$(webMods): $(WEBMOD)/%.js: $(MOD)/%.js
	$(nessatEXE) $< $@ $(NODEMODDIR)/

webtestENV = $(WEBTEST)/index.html $(WEBTEST)/smapdemo.html $(WEBTEST)/webtest.css $(WEBTEST)/demosmap.js $(WEBTEST)/webtest.js $(WEBTEST)/mod.rt.js
$(webtestENV): $(WEBTEST)/% : webtest_env/%
	cp $< $@

webtest: moec moePrelude webtestDir $(webMods) $(webtestENV)

clean:
	rm -rf dist
	rm -rf doc/webtest

force:
	make clean
	make everything

__all: webtest

publish:
	git push origin master:master
	git push cafe   master:master
	git push mirror master:master
npmpublish: force
	cd $(MOD) && npm publish