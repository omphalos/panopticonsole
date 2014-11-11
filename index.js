(function() { 'use strict'

////////////////////
// Initialization //
////////////////////

var isOwnReload = false
  , sources = chrome.devtools.panels.sources
  , network = chrome.devtools.network
  , inspectedWindow = chrome.devtools.inspectedWindow

if(localStorage.autoInstrument === undefined)
  localStorage.autoInstrument = true
if(localStorage.cache === undefined)
  localStorage.cache = true

sources.createSidebarPane(
  'Panopticonsole',
  function(sidebar) {
    sidebar.setPage("console-sidebar/console-sidebar.html")
    sidebar.setHeight("100px")
  })

////////////////////
// Locals sidebar //
////////////////////

var localsSidebar
sources.createSidebarPane(
  'Panopticonsole - Locals',
  function(sidebar) {
    window.localsSidebar = localsSidebar = sidebar
    renderLocalsSidebar()
  })

function detectScopeChange() {
  var readScope = 'JSON.stringify((' + getScopeLocation + ')())'
    , code = buildRemoteCodeBlock(readScope, { return: true })
  inspectedWindow.eval(code, function(nextScopeLoc, error) {
    if(error) return console.error(error)
    //console.log('nextScopeLoc', nextScopeLoc, 'from', sessionStorage.scopeLoc)
    if(sessionStorage.scopeLoc === nextScopeLoc) return
    sessionStorage.scopeLoc = nextScopeLoc
    renderLocalsSidebar()
  })
}

function getScopeLocation() {
  if(!window['\u2182']) return undefined
  return window['\u2182'].scopes.filter(function(s) {
    return s.evalFn
  })[0].loc
}

function renderLocalsSidebar() {
  var localsExpression = buildRemoteCodeBlock(
    '(' + getLocalsObject + ')()', { return: true })
  localsSidebar.setExpression(localsExpression)
}

function getLocalsObject() {
  if(!window['\u2182'])
    return { '_\u2182': 'Not instrumented' }
  var result = {}
    , lowestEvalFn
  window['\u2182'].scopes.forEach(function(s) {
    if(!s.evalFn) {
      result['_\u2182'] = 'No calls recorded'
      return
    }
    s.vars.forEach(function(v) {
      if(v in result) return
      lowestEvalFn = lowestEvalFn || s.evalFn
      result[v] = s.evalFn(v)
    })
  })
  if(lowestEvalFn !== window.eval && !Object.keys(result).length)
    result['_\u2182'] = 'No locals found'
  if(lowestEvalFn === window.eval && !result['_\u2182'])
    result['_\u2182'] = 'Global scope'
  return result
}

///////////////////////////
// Storage event handler //
///////////////////////////

addEventListener('storage', function(evt) {
  if(evt.key !== 'location')
    console.log('index:storage', evt.key)
  // Event handling
  if(evt.key === 'trigger' && evt.newValue === 'reload-page')
    reloadWithInstrumentation()
  if(evt.key === 'trigger' && evt.newValue === 'refresh-locals')
    renderLocalsSidebar()
  if(evt.key === 'userCode' && evt.newValue) {
    console.log('executing', evt.newValue)
    var code = buildRemoteCodeBlock(evt.newValue, { log: true })
    inspectedWindow.eval(code, function(result, error) {
      if(!error) return
      var errorString = 'console.error(' + JSON.stringify(error.value) + ')'
      inspectedWindow.eval(errorString, logIfError)
    })
  }
  // Rendering
}, false)

sources.onSelectionChanged.addListener(function(location) {
  sessionStorage.location = JSON.stringify(location)
  // console.log('location changed to', sessionStorage.location)
  detectScopeChange()
})

/////////////////////////////////
// Handling resource committed //
/////////////////////////////////

var instrument = eval(window.getInstrumentCode(false))

inspectedWindow.onResourceContentCommitted.addListener(function(res, content) {
  console.log('committed')
  if(!sessionStorage.isInstrumented) return
  if(res.type !== 'script') return
  if(endsWith(res.url, '.inst')) return
  // Devtools incorrectly resets location
  inspectedWindow.getResources(function(resources, error) {
    if(error) return console.error(error)
    resources.filter(function(instRes) {
      return instRes.url === res.url + '.inst'
    }).forEach(function(instRes) {
      reinstrument(instRes, res)
    })
  })
})

function reinstrument(instRes, sourceRes) {
  sourceRes.getContent(function(sourceContent, error) {
    if(error) return console.error(error)
    var instrumented = instrument(sourceContent, sourceRes.url).toString()
      , setup = instrumented.substring(0, instrumented.indexOf('\u2182;'))
      , urlVar = JSON.stringify(sourceRes.url)
      , code = '(' + removeOldUrlReferences + ')(' + urlVar + ');' + setup
    inspectedWindow.eval(setup, function(result, error) {
      if(error) return console.error(error)
      instRes.setContent(instrumented, true, onContentSet)
    })
  })

  function onContentSet(result, error) {
    if(error) return console.error(error)
    renderLocalsSidebar()
  }
}

function removeOldUrlReferences(url) {
  if(!window['\u2182']) return
  Object.keys(window['\u2182']).forEach(function(key) {
    if(key.indexOf('@') < 0) return
    var splitAt = key.lastIndexOf('@')
      , refUrl = key.substring(0, splitAt)
    if(refUrl !== url) return
    console.log('deleting', key)
    delete window['\u2182'][key]
  })
}

///////////////
// Reloading //
///////////////

function reloadWithInstrumentation() {
  isOwnReload = true
  var cache = localStorage.cache === 'true'
  inspectedWindow.reload({
    ignoreCache: true,
    userAgent: undefined,
    preprocessingScript: '(' + window.getInstrumentCode(cache) + ')'
  })
}

network.onNavigated.addListener(function() {
  console.log('navigated')
  if(isOwnReload) {
    console.log('setting isOwnReload to false')
    isOwnReload = false
    console.log('setting isInstrumented to true from', sessionStorage.isInstrumented)
    sessionStorage.sessionStarted = true
    sessionStorage.isInstrumented = true
    renderLocalsSidebar()
  } else if(sessionStorage.sessionStarted && localStorage.autoInstrument) {
    console.log('reloading after uninstrumented navigation')
    reloadWithInstrumentation()
  } else {
    console.log('deleting isInstrumented from', sessionStorage.isInstrumented)
    delete sessionStorage.isInstrumented
    renderLocalsSidebar()
  }
})

//////////////////////////
// Remote eval in scope //
//////////////////////////

function logError(error) {
  if(!error) return
  console.warn(error.value)
  var errorString = JSON.stringify(error.value)
  var logCode = 'console.error(' + errorString + ')'
  inspectedWindow.eval(logCode, logIfError)
}

function buildRemoteCodeBlock(str, options) {
  return ('(' + remoteScopeEval + ')(' + 
    (JSON.stringify(str)) + ',' +
    (sessionStorage.location || 'null') + ',' +
    JSON.stringify(options) + ')')
}

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
    console.warn('No calls recorded at this location. Running in global scope.')

  references.scopes = scopes
  references.evalFn = evalFn

  var result = evalFn(str)
  if(options.log)
    console.log(result)
  if(options.return)
    return result
}

///////////////
// Utilities //
///////////////

function endsWith(str, end) {
  return str.lastIndexOf(end) + end.length === str.length
}

function logIfError(result, error) {
  error && console.error(error)
}

})()
