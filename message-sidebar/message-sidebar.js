(function() { 'use strict'

WebInspector.installPortStyles()

reloadPage.addEventListener('click', function() {
  bus.trigger('reloadPage')
})

})()
