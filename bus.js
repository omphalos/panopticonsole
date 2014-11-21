(function(root) { 'use strict'

var subscriptions = {}

function trigger(topic, value) {
  delete sessionStorage.bus
  sessionStorage.bus = JSON.stringify({ topic: topic, value: value })
  propagateLocally(topic, value)
}

function propagateLocally(topic, value) {
  if(!(topic in subscriptions)) return
  subscriptions[topic].forEach(function(sub) { sub(value) })
}

addEventListener('storage', function(evt) {
  if(evt.key !== 'bus' || !evt.newValue) return
  var message = JSON.parse(evt.newValue)
  propagateLocally(message.topic, message.value)
}, false)

function on(topic, handler) {
  (subscriptions[topic] = subscriptions[topic] || []).push(handler)
}

function off(topic, handler) {
  if(!(topic in subscriptions)) return
  subscriptions[topic].splice(subscriptions[topic].indexOf(handler), 1)
  if(!subscriptions[topic].length) delete subscriptions[topic]
}

root.bus = { trigger: trigger, on: on, off: off }

})(this)