(function() { 'use strict'

var locationJSON = 'null'
  , sources = chrome.devtools.panels.sources

sources.onSelectionChanged.addListener(function(location) {
  locationJSON = JSON.stringify(location)
})

function remoteScopeEval(str, loc, options) {
  var warned = false

  if(!window['\u2182'] && options.log) {
    console.log('Code has not been instrumented. Running in global scope.')
    warned = true // TODO refactor this
  }
  var references = window['\u2182'] || { globals: [] }
    , scopes = []

  for(var key in references) {
    if(!loc || !loc.url) break
    if(key.indexOf('@') < 0) continue
    var ref = window['\u2182'][key]
      , splitAt = key.lastIndexOf('@')
      , refUrl = key.substring(0, splitAt)
      , refLoc = ref.loc
    if(refUrl !== loc.url && refUrl + '.inst' !== loc.url) continue
    var refStartLine = refLoc[0]
      , refStartColumn = refLoc[1]
      , refEndLine = refLoc[2]
      , refEndColumn = refLoc[3]
    var isAtOrAfter = loc.startLine > refStartLine ||
      (loc.startLine === refStartLine && loc.startColumn >= refStartColumn)
    var isAtOrBefore = loc.endLine < refEndLine ||
      (loc.endLine === refEndLine && loc.endColumn <= refEndColumn)
    if(isAtOrBefore && isAtOrAfter)
      scopes.push(ref)
  }

  var uniqueGlobalVars = {}
  references.globals.forEach(function(g) { uniqueGlobalVars[g] = 1 })
  uniqueGlobalVars = Object.keys(uniqueGlobalVars)

  scopes.push({
    loc: null,
    evalFn: window.eval,
    vars: uniqueGlobalVars
  })
  var evalFn = scopes[0].evalFn || window.eval

  if(!scopes[0].evalFn && options.log && !warned)
    console.warn(
      'No calls recorded at this location. Running in global scope.')

  references.scopes = scopes
  references.evalFn = evalFn

  var result = evalFn(str)
  if(options.log)
    console.log(result)
  if(options.return)
    return result
}

function buildRemoteEval(str, options) {
  return ('(' + remoteScopeEval + ')(' + 
    (JSON.stringify(str)) + ',' +
    locationJSON + ',' +
    JSON.stringify(options) + ')')
}

window.buildRemoteEval = buildRemoteEval

})()