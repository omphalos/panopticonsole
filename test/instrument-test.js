global.estraverse = require('../vendor/estraverse.js')
global.esprima = require('../vendor/esprima.js')
// Hack around the fact that we're using node but not npm:
var fs = require('fs')
  , escopeJs = fs.readFileSync('../vendor/escope.js').toString()
eval('(function() { exports = void 0; ' + escopeJs + '}).bind(global)()')

function fn(x, y) {

  return root(square(x) + square(y))

  function root(x) {
    return Math.sqrt(x)
  }

  function square(n) {
    return n * n
  }
}

var ast = esprima.parse(fn.toString(), { loc: true, raw: true })

var scopes = escope.analyze(ast).scopes

function getVars(scope, acc) {
  acc = acc || {}
  scope.variables.forEach(function(v) {
    if(v.name in acc) return
    acc[v.name] = null
  })
  return scope.upper ? getVars(scope.upper, acc) : Object.keys(acc)
}

scopes.forEach(function(s) {
  console.log()
  console.log('from', s.block.loc.start, 'to', s.block.loc.end)
  getVars(s).forEach(function(v) {
    console.log(' ', v)
  })
})
