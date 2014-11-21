(function() { 'use strict'

WebInspector.installPortStyles()

var devtools = chrome.devtools
  , inspectedWindow = devtools.inspectedWindow
  , sources = devtools.panels.sources
  , history = JSON.parse(localStorage.history || '[]')
  , contextSelector = WebInspector.ExecutionContextSelector
  , completions = contextSelector.completionsForTextPromptInCurrentContext
  , consolePrompt = document.getElementById('console-prompt')

////////////
// prompt //
////////////

var prompt = new WebInspector.TextPromptWithHistory(completions)
prompt.setSuggestBoxEnabled(true)
prompt.renderAsBlock();
prompt.attach(consolePrompt)
prompt.proxyElement.addEventListener('keydown', onKeyDown, false)
prompt.setHistoryData(history)

///////////////
// ViewModel //
///////////////

var viewModel = new PanopticonsoleViewModel({
  autoInstrument: { render: renderAutoInstrument },
  cache: { render: renderCache },
  isConfiguring: { initial: false, render: renderIsConfiguring }
})

///////////////
// Rendering //
///////////////

function renderAutoInstrument() {
  autoInstrument.checked = viewModel.autoInstrument ? 'checked' : ''
}

function renderCache() {
  cache.checked = viewModel.cache ? 'checked' : ''
}

function renderIsConfiguring() {
  settingsContainer.style.display = viewModel.isConfiguring ? 'block' : 'none'
}

////////////////////
// Event handlers //
////////////////////

refreshScopeVariables.addEventListener('click', function() {
  bus.trigger('refreshScopeVariables')
})

settings.addEventListener('click', function() {
  viewModel.isConfiguring = true
})

closeSettings.addEventListener('click', function() {
  closeAndFocus()
})

autoInstrument.addEventListener('change', function(evt) {
  viewModel.autoInstrument = !!autoInstrument.checked
})

cache.addEventListener('change', function(evt) {
  viewModel.cache = !!cache.checked
})

document.body.addEventListener('click', function(evt) {
  consolePrompt.focus()
})

function closeAndFocus() {
  if(!viewModel.isConfiguring) return
  viewModel.isConfiguring = false
  consolePrompt.focus()
}

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

  bus.trigger('userCode', str)
  prompt.pushHistoryItem(str)
  localStorage.history = JSON.stringify(history.slice(0, 30))
}

///////////////////////////
// Autocomplete plumbing //
///////////////////////////

var executionContext = new WebInspector.ExecutionContext({
  runtimeAgent: function() { return { releaseObjectGroup: function() {} } },
  debuggerModel: {
    selectedCallFrame: function() { return {} },
    evaluateOnSelectedCallFrame: evaluateOnSelectedCallFrame,
    getSelectedCallFrameVariables: getSelectedCallFrameVariables,
  }
})

WebInspector.context.setFlavor(WebInspector.ExecutionContext, executionContext)
WebInspector.Dialog.setModalHostView({ element: document.body })

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

function getSelectedCallFrameVariables(callback) {

  var remoteEval = buildRemoteEval(
    '(' + getSelectedCallFrameVariablesRemotely + ')()',
    { return: true })

  inspectedWindow.eval(remoteEval, function(result, error) {
    if(error) return console.error(error)
    callback(result)
  })
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

})()
