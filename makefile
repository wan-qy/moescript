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
dirs:
	$(MKDIR) $(DIST)
	$(MKDIR) $(MOD)
	$(MKDIR) $(MOD)/bin
	$(MKDIR) $(MOD)/prelude
	$(MKDIR) $(MOEC)


moeRTMods = $(MOD)/runtime.js $(MOD)/dummy.js
$(moeRTMods): $(MOD)/%.js: src/%.js
	cp $< $@
moePreludeMods = $(MOD)/prelude/overture.js
$(moePreludeMods): $(MOD)/prelude/%.js: src/prelude/%.js
	cp $< $@

moert: dirs $(moeRTMods) $(moePreludeMods)

moecMods = $(MOEC)/compiler.rt.js $(MOEC)/compiler.js $(MOEC)/codegen.js $(MOEC)/lexer.js $(MOEC)/parser.js \
			$(MOEC)/resolve.js $(MOEC)/gvm.js
moecNodeMods = $(MOD)/bin/opts.js $(MOD)/bin/moec.js  $(MOD)/bin/moei.js $(MOD)/bin/moec $(MOD)/bin/moei

$(moecMods): $(MOEC)/%: src/compiler/%
	cp $< $@
$(moecNodeMods): $(MOD)/bin/%: src/bin/%
	cp $< $@
$(MOEC)/package.json: src/compiler/package.json
	cp $< $@

moecPackageMeta: $(MOD)/package.json
$(MOD)/package.json: src/package.json
	cp $< $@

moecLib: $(moecMods) $(MOEC)/package.json
moecNodeLib: $(moecNodeMods)
moecMain: moecLib moecNodeLib
moec: moert moecMain moecPackageMeta

preludeMoecEXE = node $(MOD)/bin/moec --no-prelude -g moert --runtime-bind moert.runtime 

moeFullPreludeMods = $(MOD)/prelude/prelude.js
$(moeFullPreludeMods): $(MOD)/%.js: src/%.moe
	$(preludeMoecEXE) -o $@ $<

moePrelude: $(moeFullPreludeMods)
	node tools/preludesquash $(MOD)/prelude.js $(moePreludeMods) $(moeFullPreludeMods)


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

webMods = $(subst $(MOD)/,$(WEBMOD)/,$(moeRTMods) $(moecMods) $(MOD)/prelude.js)
$(webMods): $(WEBMOD)/%.js: $(MOD)/%.js
	$(nessatEXE) $< $@ $(NODEMODDIR)/
webMods: $(webMods)

webtestENV = $(WEBTEST)/index.html $(WEBTEST)/smapdemo.html $(WEBTEST)/inputbox.js $(WEBTEST)/demosmap.js $(WEBTEST)/webtest.js $(WEBTEST)/mod.rt.js
$(webtestENV):
	cp $< $@
$(WEBTEST)/index.html:  webtest_env/index.html
$(WEBTEST)/smapdemo.html:  webtest_env/smapdemo.html
$(WEBTEST)/inputbox.js: webtest_env/inputbox.js
$(WEBTEST)/webtest.js: webtest_env/webtest.js
$(WEBTEST)/demosmap.js: webtest_env/demosmap.js
$(WEBTEST)/mod.rt.js:   src/webrt/mod.rt.js
webtestENV: $(webtestENV)

webtest: moec moePrelude webtestDir webMods webtestENV

clean:
	rm -rf dist
	rm -rf doc/webtest

force:
	make clean
	make everything

__all: webtest
	rm -rf $(MOD)/prelude