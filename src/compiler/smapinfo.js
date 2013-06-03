var walkRex = require('./compiler.rt').walkRex;
var Nai = require('../runtime').Nai;

// Part I. SMAP Information extraction from codegen

var rSmapInfo = /\/\*\x1b MOESMAP\((\w+), (\w+)\)\x1b \*\//g;
var rBracketRemoval = /^(\/\*\x1b MOESMAP\((?:\w+), (?:\w+)\)\x1b \*\/)?\(([\s\S]*)\)(\/\*\x1b MOESMAP\((?:\w+), (?:\w+)\)\x1b \*\/)?$/;
var calculateSmapPoints = function(code){
	var smapPoints = [];
	var buf = '';
	walkRex(rSmapInfo, code, function(match, $1, $2){
		var p = buf.length;
		var q = /^\d+/.test($2) ? ($2 - 0) : $2
		var type = $1;
		smapPoints.push({p: p, q: q, type: type});
		return '';
	}, function(match){
		buf += match;
	});
	return {
		codeWithoutSmap: buf,
		smapPoints: smapPoints
	}
};
var smapRecord = function(type, body){
	return '/*\x1b MOESMAP(' + type + ', ' + body + ')\x1b */'
};

exports.calculateSmapPoints = calculateSmapPoints;
exports.smapRecord = smapRecord;
exports.rBracketRemoval = rBracketRemoval;


// Part II. base64 encoder
var charToIntMap = {};
var intToCharMap = {};

'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
	.split('')
	.forEach(function (ch, index) {
		charToIntMap[ch] = index;
		intToCharMap[index] = ch;
	});

var encodeDigit = function(aNumber) {
	return intToCharMap[aNumber];
};

var VLQ_BASE_SHIFT = 5;

// binary: 100000
var VLQ_BASE = 1 << VLQ_BASE_SHIFT;

// binary: 011111
var VLQ_BASE_MASK = VLQ_BASE - 1;

// binary: 100000
var VLQ_CONTINUATION_BIT = VLQ_BASE;

function toVLQSigned(aValue) {
	return aValue < 0 ? ((-aValue) << 1) + 1 : (aValue << 1) + 0;
}

function base64VLQ_encode(aValue) {
	var encoded = "";
	var digit;

	var vlq = toVLQSigned(aValue);

	do {
		digit = vlq & VLQ_BASE_MASK;
		vlq >>>= VLQ_BASE_SHIFT;
		if (vlq > 0) {
			// There are still more digits in this value, so we must make sure the
			// continuation bit is marked.
			digit |= VLQ_CONTINUATION_BIT;
		}
		encoded += encodeDigit(digit);
	} while (vlq > 0);

	return encoded;
};


// Part III. Position to Line-col.
// Assuming that the source is normalized (LF, Bomless)
var PositionToLineCol = function(s){
	var lines = s.split('\n');
	var map = [];
	for(var i = 0; i < lines.length; i++){
		for(var j = 0; j < lines[i].length; j++) {
			map.push({
				line: i,
				column: j
			})
		};
		map.push({
			line: i,
			column: j
		})
	};
	return map;
}

function cmpLocation(loc1, loc2) {
	var cmp = (loc1 && loc1.line) - (loc2 && loc2.line);
	return cmp ? cmp : (loc1 && loc1.column) - (loc2 && loc2.column);
}

function cmpMapping(mappingA, mappingB) {
	return cmpLocation(mappingA.generated, mappingB.generated) || cmpLocation(mappingA.original, mappingB.original)
		|| mappingA.sourceId - mappingB.sourceId || mappingA.nameId - mappingB.nameId
}

/// Part IV. Source Map Automaton
var generateSmapJson = function(generated, sources, points){
	var currentFileId = 0;
	var currentFileRev = PositionToLineCol(sources[0]);
	var generatedRev = PositionToLineCol(generated);
	var _mappings = [];
	var _nameHash = new Nai;
	var _names = []
	// NOTE: smap points from calculateSmapPoints is in the order of their occurance in the generated code
	// therefore, no extra sorting is needed.
	for(var j = 0; j < points.length; j++){
		var point = points[j];
		if(point.type === 'OPEN'){
			currentFileId = point.q - 0;
			PositionToLineCol(sources[point.q - 0])
		}
		if(point.type === 'LM' || point.type === 'RM'){
			var mappingNameId = null;
			if(point.type === 'LM' && points[j + 1] && points[j + 1].type === 'ID' && point.p === points[j + 1].p) {
				// An identifier
				j++;
				if(_nameHash[points[j].q] >= 0) {
					mappingNameId = _nameHash[points[j].q]
				} else {
					_names.push(points[j].q);
					mappingNameId = _nameHash[points[j].q] = _names.length - 1;
				}
			};
			_mappings.push({
				sourceId: currentFileId, // source#
				nameId: mappingNameId, // name#
				generated: generatedRev[point.p],
				original: currentFileRev[point.q]
			})
		}
	};
	
	var previousGeneratedColumn = 0;
	var previousGeneratedLine = 1;
	var previousOriginalColumn = 0;
	var previousOriginalLine = 0;
	var previousName = 0;
	var previousSource = 0;
	var result = '';
	var mapping;

	// The mappings must be guarenteed to be in sorted order before we start
	// serializing them or else the generated line numbers (which are defined
	// via the ';' separators) will be all messed up. Note: it might be more
	// performant to maintain the sorting as we insert them, rather than as we
	// serialize them, but the big O is the same either way.
	_mappings.sort(cmpMapping);

	for (var i = 0, len = _mappings.length; i < len; i++) {
		mapping = _mappings[i];

		if (mapping.generated.line !== previousGeneratedLine) {
			previousGeneratedColumn = 0;
			while (mapping.generated.line !== previousGeneratedLine) {
				result += ';';
				previousGeneratedLine++;
			}
		} else {
			if (i > 0) {
				result += ',';
			}
		}

		result += base64VLQ_encode(mapping.generated.column - previousGeneratedColumn);
		previousGeneratedColumn = mapping.generated.column;

		if (mapping.sourceId != null && mapping.original) {
			result += base64VLQ_encode(mapping.sourceId - previousSource);
			previousSource = mapping.sourceId;

			// lines are stored 0-based in SourceMap spec version 3
			result += base64VLQ_encode(mapping.original.line - 1 - previousOriginalLine);
			previousOriginalLine = mapping.original.line - 1;

			result += base64VLQ_encode(mapping.original.column - previousOriginalColumn);
			previousOriginalColumn = mapping.original.column;

			if (mapping.nameId !== null) {
				result += base64VLQ_encode(mapping.nameId - previousName);
				previousName = mapping.nameId;
			}
		}
	};

	return {
		version: 3,
		names: _names,
		mappings: result
	}
}

exports.generateSmapJson = generateSmapJson;