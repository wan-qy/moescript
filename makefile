ifeq ($(OS),Windows_NT)
	MKDIR = -@mkdir.exe -p
else
	MKDIR = -@mkdir -p
endif

everything: __all

MOD = dist/moe
MOEC = $(MOD)/compiler

DIRS = $(MOD)/ $(MOD)/bin/ $(MOEC)/ $(MOEC)/passes

$(DIRS):
	$(MKDIR) $@
dirs: $(DIRS)


runtimeMods = $(MOD)/runtime.js $(MOD)/dummy.js
compilerMods = $(MOEC)/compiler.rt.js $(MOEC)/compiler.js $(MOEC)/codegen.js $(MOEC)/lexer.js $(MOEC)/parser.js $(MOEC)/resolve.js $(MOEC)/passes/cps-transform.js $(MOEC)/passes/ast-reduce-1.js $(MOEC)/smapinfo.js
commandLineMods = $(MOD)/bin/options.js $(MOD)/bin/asoic $(MOD)/bin/asoi
metadatas = $(MOD)/package.json $(MOEC)/package.json

moecCompoments = $(runtimeMods) $(compilerMods) $(commandLineMods) $(metadatas)

$(moecCompoments): $(MOD)/%: src/%
	cp $< $@

moec: dirs $(moecCompoments)

PRELUDE_CONFIG = --explicit --bare -g exports -g moert --runtime-bind moert.runtime
$(MOD)/prelude.js: src/prelude/overture.js src/prelude/prelude.moe $(moecCompoments)
	node $(MOD)/bin/asoic $(PRELUDE_CONFIG) --include-js $(word 1,$^) $(word 2,$^) -o $@

moePrelude: $(MOD)/prelude.js

dist/moe-web-min.js: tools/makeStandaloneRuntime.js $(MOD)/runtime.js $(MOD)/prelude.js
	node $^ $@
	uglifyjs $@ -o $@ -m

webmin: dist/moe-web-min.js

### Web test environment
### Always updates all scripts
WEBTEST = doc/webtest
WEBMOD  = $(WEBTEST)/moe
webtestDir:
	$(MKDIR) doc
	$(MKDIR) doc/demo
	$(MKDIR) $(WEBTEST)
	$(MKDIR) $(WEBMOD)
	$(MKDIR) $(WEBMOD)/compiler
	$(MKDIR) $(WEBMOD)/compiler/passes

nessatEXE = node tools/nessat

###webMods = $(subst $(MOD)/,$(WEBMOD)/,$(runtimeMods) $(compilerMods))
webMods = $(subst $(MOD)/,$(WEBMOD)/,$(runtimeMods) $(compilerMods) $(MOD)/prelude.js)
$(webMods): $(WEBMOD)/%.js: $(MOD)/%.js
	$(nessatEXE) $< $@ dist/

webtestENV = $(WEBTEST)/index.html $(WEBTEST)/webtest.css $(WEBTEST)/webtest.js $(WEBTEST)/mod.rt.js
$(webtestENV): $(WEBTEST)/% : webtest_env/%
	cp $< $@

$(MOD)/README.md: README.md
	cp $< $@

###npmdist: moec
npmdist: moec moePrelude $(MOD)/README.md

webtest: npmdist webtestDir $(webMods) $(webtestENV)

clean:
	rm -rf dist
	rm -rf doc/webtest

force:
	make clean
	make everything

__all: webtest webmin

update:
	git push origin  asoi:asoi
	git push gitcafe asoi:asoi

release: webtest webmin
	rm -rf channel-release/moe/
	rm -rf channel-release/*.js
	cp -a dist/* channel-release/

	cd doc && make
	rm -rf doc/demo/*
	cp -a $(WEBTEST)/* doc/demo/

publish-release: release
	cd channel-release && git add .
	cd channel-release && git commit -m "Version $(ver)"
	cd channel-release && git tag -a "r$(ver)" -m "Version $(ver)"
	cd channel-release && git push origin release:release
	cd channel-release && git push cafe   release:release
	cd channel-release && git push origin --tag
	cd channel-release && git push cafe   --tag
	cd channel-release/moe && npm publish
	cd doc && git add demo
	cd doc && git commit -a -m "Demo: Version $(ver)"
	cd doc && make publish