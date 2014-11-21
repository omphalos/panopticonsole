(function(root) { 'use strict'

var pendingRenders = []
  , pendingFrame

function ViewModel(attributes) {
  Object.keys(attributes).forEach(setUpAttribute.bind(this, attributes))
}

function setUpAttribute(attributes, key) {

  var attr = attributes[key]
    , storage = attr.storage || {}
    , value = parse(storage[key])

  if(!(key in storage) && attr.initial !== undefined)
    storage[key] = JSON.stringify(value = attr.initial)

  Object.defineProperty(this, key, {
    get: function() { return value },
    set: set
  })

  function set(newValue) {
    var json = JSON.stringify(newValue)
    if(json === storage[key]) return
    console.log('set', key, newValue)
    storage[key] = json
    value = newValue
    scheduleRender(attr.render)
  }

  scheduleRender(attr.render)

  if(!attr.storage) return
  addEventListener('storage', function(evt) {
    if(evt.key !== key) return
    value = parse(evt.newValue)
    scheduleRender(attr.render)
  }, false)
}

function scheduleRender(render) {
  if(!render) return
  if(render instanceof Array) return render.forEach(scheduleRender)
  if(pendingRenders.indexOf(render) >= 0) return
  pendingRenders.push(render)
  pendingFrame = pendingFrame || requestAnimationFrame(function() {
    pendingRenders.forEach(function(pendingRender) {
      console.log('rendering', pendingRender.name)
      pendingRender()
    })
    pendingRenders.length = 
    pendingFrame = null
  })
}

function parse(json) {
  return json === undefined ? undefined : JSON.parse(json)
}

root.ViewModel = ViewModel

})(this)
