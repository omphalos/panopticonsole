(function() { 'use strict'

WebInspector.installPortStyles()

var devtools = chrome.devtools
  , inspectedWindow = devtools.inspectedWindow
  , sources = devtools.panels.sources
  , history = JSON.parse(localStorage.history || '[]')
  , consolePrompt = document.getElementById('console-prompt')
  , reloadPage = document.getElementById('reload-page')
  , message = document.getElementById('message')
  , body = document.body
  , autoInstrument = document.getElementById('auto-instrument')
  , autoInstrumentLabel = document.getElementById('auto-instrument-label')
  , cache = document.getElementById('cache')
  , cacheLabel = document.getElementById('cache-label')
  , refreshLocals = document.getElementById('refresh-locals')
  , contextSelector = WebInspector.ExecutionContextSelector
  , completions = contextSelector.completionsForTextPromptInCurrentContext
  , prompt = new WebInspector.TextPromptWithHistory(completions)

prompt.setSuggestBoxEnabled(true)
prompt.renderAsBlock();
prompt.attach(document.getElementById('console-prompt'))
prompt.proxyElement.addEventListener('keydown', onKeyDown, false)
prompt.setHistoryData(history)

// Rendering
var renderFns = {

  isInstrumented: function() {
    if(sessionStorage.isInstrumented) {
      message.style.display = 'none'
      refreshLocals.style.display = ''
      consolePrompt.style.display = ''
    } else {
      message.style.display = ''
      refreshLocals.style.display = 'none'
      consolePrompt.style.display = 'none'
    }
  },

  sessionStarted: function() {
    cacheLabel.style.display = autoInstrumentLabel.style.display =
      sessionStorage.sessionStarted ? 'block' : 'none'
  },

  autoInstrument: function() {
    autoInstrument.checked = localStorage.autoInstrument ? 'checked' : ''
  },

  cache: function() {
    cache.checked = localStorage.cache ? 'checked' : ''
  }
}

addEventListener('storage', function(evt) {
  var renderFn = renderFns[evt.key]
  renderFn && renderFn()
}, false)

Object.keys(renderFns).forEach(function(key) {
  renderFns[key]()
})

// Event handlers
autoInstrument.addEventListener('change', function(evt) {
  localStorage.autoInstrument = autoInstrument.checked ? true : ''
})

cache.addEventListener('change', function(evt) {
  localStorage.cache = cache.checked ? true : ''
})

refreshLocals.addEventListener('click', function() {
  delete sessionStorage.trigger
  sessionStorage.trigger = 'refresh-locals'
})

reloadPage.addEventListener('click', function() {
  delete sessionStorage.trigger
  sessionStorage.trigger = 'reload-page'
})

function onKeyDown(event) {
  if (isEnterKey(event)) {
      enterKeyPressed(event)
      return
  }

  /* TODO handle shortcuts */
  return
}

function enterKeyPressed(event) {
  if (event.altKey || event.ctrlKey || event.shiftKey)
    return
  event.consume(true)
  prompt.clearAutoComplete(true)
  var str = prompt.text
  if (!str.length) return
  prompt.text = ''

  sessionStorage.userCode = ''
  sessionStorage.userCode = str
  prompt.pushHistoryItem(str)
  localStorage.history = JSON.stringify(history.slice(0, 30))
}

function getSelectedCallFrameVariablesRemotely() {
  var root = window['\u2182']
    , vars = { 'this': true }
  root.scopes.forEach(function(scope) {
    scope.vars.forEach(function(v) { vars[v] = true })
  })
  Object.keys(window).forEach(function(windowKey) {
    vars[windowKey] = true
  })
  return vars
}

// Autocomplete
function getSelectedCallFrameVariables(callback) {

  var remoteEval = buildRemoteEval(
    '(' + getSelectedCallFrameVariablesRemotely + ')()',
    { return: true })

  inspectedWindow.eval(remoteEval, function(result, error) {
    if(error) return console.error(error)
    callback(result)
  })
}

function evaluateOnSelectedCallFrame() {

  var code = arguments[0]
    , returnByValue = arguments[4]
    , callback = arguments[6]

  if(returnByValue) {
    var remoteEval = buildRemoteEval(code, { return: true })
    return inspectedWindow.eval(remoteEval, function(result, error) {
      if(error) console.warn(error)
      callback(null, !!error, { value: result })
    })
  }

  var remoteEval = buildRemoteEval(code, { return: true })
  inspectedWindow.eval('typeof ' + remoteEval, function(type, error) {
    if(error) return console.warn(error)
    callback({ type: type, callFunctionJSON: callFunctionJSON }, error)
  })

  function callFunctionJSON(remoteFn, ignoredArgs, callback) {
    var propertyQuery = '(' + remoteFn + ').call(' + code + ')'
      , remoteEval = buildRemoteEval(propertyQuery, { return: true })

    inspectedWindow.eval(remoteEval, function(result, error) {
      if(error) console.warn(error)
      callback(result, error)
    })
  }
}

var targetStub = {
  runtimeAgent: function() { return { releaseObjectGroup: function() {} } },
  debuggerModel: {
    selectedCallFrame: function() { return {} },
    getSelectedCallFrameVariables: getSelectedCallFrameVariables,
    evaluateOnSelectedCallFrame: evaluateOnSelectedCallFrame
  }
}

var executionContext = new WebInspector.ExecutionContext(targetStub)
WebInspector.context.setFlavor(WebInspector.ExecutionContext, executionContext)

WebInspector.Dialog.setModalHostView({ element: document.body })

})()
