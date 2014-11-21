(function() { 'use strict'

var sources = chrome.devtools.panels.sources
  , inspectedWindow = chrome.devtools.inspectedWindow

///////////////
// ViewModel //
///////////////

var viewModel = new PanopticonsoleViewModel({
  isInstrumented: { render: [renderScopeSidebar, renderPrimarySidebar] },
  sessionStarted: { render: [renderScopeSidebar, renderPrimarySidebar] },
  scopeLoc: { render: renderScopeSidebar }
})

/////////////////////
// Primary sidebar //
/////////////////////

var primarySidebar

sources.createSidebarPane(
  'Panopticonsole',
  function(sidebar) {
    primarySidebar = sidebar
    primarySidebar.setHeight("200px")
  })

function renderPrimarySidebar() {
  if(!primarySidebar) return setTimeout(renderPrimarySidebar, 100)
  primarySidebar.setPage(viewModel.isInstrumented ?
    'console-sidebar/console-sidebar.html' :
    'message-sidebar/message-sidebar.html')
}

bus.on('userCode', function(userCode) {
  var code = buildRemoteEval(userCode, { log: true })
  inspectedWindow.eval(code, function(result, error) {
    if(!error) return
    var errorString = 'console.error(' + JSON.stringify(error.value) + ')'
    inspectedWindow.eval(errorString, logIfError)
  })
})

///////////////////
// Scope sidebar //
///////////////////

var scopeSidebar

sources.createSidebarPane(
  'Panopticonsole - Scope Variables',
  function(sidebar) {
    scopeSidebar = sidebar
    scopeSidebar.setHeight("100px")
  })

function renderScopeSidebar() {
  if(!scopeSidebar) return setTimeout(renderScopeSidebar, 100)
  var scopeExpression = buildRemoteEval(
    '(' + getScopeObject + ')()', { return: true })
  scopeSidebar.setExpression(scopeExpression)
}

function getScopeObject() {
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
    result['_\u2182'] = 'No scope variables found'
  if(lowestEvalFn === window.eval && !result['_\u2182'])
    result['_\u2182'] = 'Global scope'
  return result
}

sources.onSelectionChanged.addListener(function() {
  var readScope = 'JSON.stringify((' + getScopeLocation + ')())'
    , code = buildRemoteEval(readScope, { return: true })
  inspectedWindow.eval(code, function(nextScopeLoc, error) {
    if(error) return console.error(error)
    viewModel.scopeLoc = nextScopeLoc
  })
})

function getScopeLocation() {
  if(!window['\u2182']) return undefined
  return window['\u2182'].scopes.filter(function(s) {
    return s.evalFn
  })[0].loc
}

bus.on('refreshScopeVariables', renderScopeSidebar)

///////////////////////////////
// Handle resource committed //
///////////////////////////////

var instrument = eval(window.getInstrumentCode(false /* no cache */))

inspectedWindow.onResourceContentCommitted.addListener(function(res, content) {
  console.log('committed')
  if(!viewModel.isInstrumented) return
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
    inspectedWindow.eval(code, function(result, error) {
      if(error) return console.error(error)
      instRes.setContent(instrumented, true, onContentSet)
    })
  })

  function onContentSet(result, error) {
    if(error) return console.error(error)
    renderScopeSidebar()
  }
}

function removeOldUrlReferences(url) {
  if(!window['\u2182']) return
  Object.keys(window['\u2182']).forEach(function(key) {
    if(key.indexOf('@') < 0) return
    var splitAt = key.lastIndexOf('@')
      , refUrl = key.substring(0, splitAt)
    if(refUrl !== url) return
    delete window['\u2182'][key]
  })
}

///////////////
// Reloading //
///////////////

var isOwnReload = false

function reloadWithInstrumentation() {
  isOwnReload = true
  var cache = viewModel.cache
  inspectedWindow.reload({
    ignoreCache: true,
    userAgent: undefined,
    preprocessingScript: '(' + window.getInstrumentCode(cache) + ')'
  })
}

chrome.devtools.network.onNavigated.addListener(function() {
  if(isOwnReload) {
    isOwnReload = false
    viewModel.sessionStarted = true
    viewModel.isInstrumented = true
  } else if(viewModel.sessionStarted && viewModel.autoInstrument)
    reloadWithInstrumentation()
  else viewModel.isInstrumented = false
})

bus.on('reloadPage', reloadWithInstrumentation)

///////////////
// Utilities //
///////////////

function endsWith(str, end) {
  return str.lastIndexOf(end) + end.length === str.length
}

function logIfError(result, error) {
  error && console.error(error)
}

function logError(error) {
  if(!error) return
  console.warn(error.value)
  var errorString = JSON.stringify(error.value)
  var logCode = 'console.error(' + errorString + ')'
  inspectedWindow.eval(logCode, logIfError)
}

})()
