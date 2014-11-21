(function(root) { 'use strict'

var shared = {
  autoInstrument: { initial: true, storage: localStorage },
  cache: { initial: true, storage: localStorage },
  scopeLoc: { storage: sessionStorage, },
  isInstrumented: { initial: false, storage: sessionStorage, },
  sessionStarted: { initial: false, storage: sessionStorage, }
}

function PanopticonsoleViewModel(overrides) {
  var attributes = {}
  mixin(attributes, shared)
  mixin(attributes, overrides || {})
  console.log('PanopticonsoleViewModel', attributes)
  ViewModel.call(this, attributes)
}
PanopticonsoleViewModel.prototype = Object.create(ViewModel.prototype)
PanopticonsoleViewModel.prototype.constructor = ViewModel

function mixin(target, source) {
  Object.keys(source).forEach(mixinProp.bind(null, target, source))
}

function mixinProp(target, source, key) {
  if(typeof target[key] !== 'object' || typeof source[key] !== 'object')
    return target[key] = source[key]
  mixin(target[key], source[key])
}

root.PanopticonsoleViewModel = PanopticonsoleViewModel

})(this)
