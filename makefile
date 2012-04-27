everything: __all

DIST = dist
NODEMODDIR = dist/node_modules
MOD = $(NODEMODDIR)/moe
MOEC = $(MOD)/compiler
dirs:
	-@mkdir -p $(DIST)
	-@mkdir -p $(MOD)
	-@mkdir -p $(MOD)/bin
	-@mkdir -p $(MOD)/prelude
	-@mkdir -p $(MOEC)
	-@mkdir -p $(MOEC)/targets

moeRTMods = $(MOD)/runtime.js $(MOD)/dummy.js
$(moeRTMods): $(MOD)/%.js: src/%.js
	cp $< $@
moePreludeMods = $(MOD)/prelude/std.js $(MOD)/prelude/async.js
$(moePreludeMods): $(MOD)/prelude/%.js: src/prelude/%.js
	cp $< $@

moert: dirs $(moeRTMods) $(moePreludeMods)

moecMods = $(MOEC)/compiler.rt.js $(MOEC)/compiler.js $(MOEC)/codegen.js $(MOEC)/lexer.js $(MOEC)/parser.js \
			$(MOEC)/resolve.js $(MOEC)/requirements.js
moecNodeMods = $(MOD)/bin/opts.js $(MOD)/bin/moec.js  $(MOD)/bin/moei.js $(MOD)/bin/moec $(MOD)/bin/moei
moecTargets = $(MOEC)/targets/node.js $(MOEC)/targets/least.js
$(moecMods) $(moecTargets): $(MOEC)/%: src/compiler/%
	cp $< $@
$(moecNodeMods): $(MOD)/bin/%: src/moec/%
	cp $< $@
$(MOEC)/package.json: src/compiler/package.json
	cp $< $@

moecPackageMeta: $(MOD)/package.json
$(MOD)/package.json: src/package.json
	cp $< $@

moecLib: $(moecMods) $(MOEC)/package.json
moecNodeLib: $(moecNodeMods)
moecTargets: $(moecTargets)
moecMain: moecLib moecNodeLib moecTargets
moec: moert moecMain moecPackageMeta

moecEXE = node $(MOD)/bin/moec --rtbind moert.runtime

moeFullPreludeMods = $(MOD)/prelude/stdenum.js
$(moeFullPreludeMods): $(MOD)/%.js: src/%.moe
	$(moecEXE) -t least -o $@ $<

moePrelude: $(moeFullPreludeMods)
	node tools/preludesquash $(MOD)/prelude.js $(moePreludeMods) $(moeFullPreludeMods)


### Web test environment
### Always updates all scripts
WEBTEST = doc/webtest
WEBMOD  = $(WEBTEST)/moe
webtestDir:
	-@mkdir -p doc
	-@mkdir -p $(WEBTEST)
	-@mkdir -p $(WEBMOD)
	-@mkdir -p $(WEBMOD)/prelude
	-@mkdir -p $(WEBMOD)/compiler

nessatEXE = node tools/nessat

webMods = $(subst $(MOD)/,$(WEBMOD)/,$(moeRTMods) $(moecMods) $(MOD)/prelude.js)
$(webMods): $(WEBMOD)/%.js: $(MOD)/%.js
	$(nessatEXE) $< $@ $(NODEMODDIR)/
webMods: $(webMods)

webtestENV = $(WEBTEST)/index.html $(WEBTEST)/inputbox.js $(WEBTEST)/mod.rt.js
$(webtestENV):
	cp $< $@
$(WEBTEST)/index.html:  webtest_env/index.html
$(WEBTEST)/inputbox.js: webtest_env/inputbox.js
$(WEBTEST)/mod.rt.js:   src/webrt/mod.rt.js
webtestENV: $(webtestENV)

webtest: moec moePrelude webtestDir webMods webtestENV

clean:
	rm -rf dist
	rm -rf doc/webtest

__all: webtest
	rm -rf $(MOD)/prelude