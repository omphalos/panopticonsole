document.addEventListener('mousemove', function(evt) {

  document.getElementById('x').innerHTML = square(evt.x)
  document.getElementById('y').innerHTML = square(evt.y)

  function square(a) {
    return a * a;
  }

  function hypotenuse(a, b) {

    return sqrt(add(square(a), square(b)))

    function sqrt(a) {
      return Math.sqrt(a)
    }
  }
}.bind({ obj: 'label' }))

function add(a, b) {
  return a + b
}