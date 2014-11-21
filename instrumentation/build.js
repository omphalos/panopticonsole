'use strict'

var fs = require('fs')
  , esprima = fs.readFileSync('../vendor/esprima.js').toString()
  , estraverse = fs.readFileSync('../vendor/estraverse.js').toString()
  , escope = fs.readFileSync('../vendor/escope.js').toString()
  , falafel = fs.readFileSync('../vendor/umd-falafel.js').toString()
  , instrument = fs.readFileSync('./instrument.js').toString()

var code =
  '(function() {\n\n' +
    esprima + ';\n\n' +
    estraverse + ';\n\n' +
    escope + ';\n\n' +
    falafel + ';\n\n' +
    instrument + ';\n\n' +
    'return this.instrument\n\n' +
  '})'

var assignment =
  'window.getInstrumentCode = function(cache) {\n' +
  '  console.log("cacheVar", cache);\n' +
  '  var fn = ' + JSON.stringify(code) + ';\n' +
  '  fn += ".bind({ cache: " + cache + " })()";\n' +
  '  return fn\n' +
  '}\n'

fs.writeFileSync('./built-instrument.js', assignment)
