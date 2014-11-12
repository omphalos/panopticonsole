(function() { 'use strict'

WebInspector.installPortStyles();

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

var prompt = new WebInspector.TextPromptWithHistory(
  completionsForTextPromptInCurrentContext)
prompt.setSuggestBoxEnabled(true)
prompt.renderAsBlock();
prompt.attach(document.getElementById('console-prompt'))
prompt.proxyElement.addEventListener('keydown', onKeyDown, false)
prompt.setHistoryData(history)

// Rendering
var renderFns = {

  isInstrumented: function() {
    console.log('rendering isInstrumented')
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

function completionsForTextPromptInCurrentContext(proxyElement, wordRange, force, completionsReadyCallback) {
    // completionsReadyCallback(['abc', 'def']);
    completionsReadyCallback([]);
    return;
    // TODO add completions

    // TODO check out completionsForExpression

    // Pass less stop characters to rangeOfWord so the range will be a more complete expression.
    var expressionRange = wordRange.startContainer.rangeOfWord(wordRange.startOffset, " =:[({;,!+-*/&|^<>", proxyElement, "backward");
    var expressionString = expressionRange.toString();
    var prefix = wordRange.toString();
    console.log('TODO get completions for', expressionString, prefix, force, completionsReadyCallback);
}

})()
