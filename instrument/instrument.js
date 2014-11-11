(function(root) { 'use strict'

var falafel = root.falafel
  , escope = root.escope
  , cache = root.cache
  , options = { loc: true, raw: true }
  , functionTypes = ['FunctionExpression', 'FunctionDeclaration']
  , id = 0

function instrument(code, url) {
  if(!url) return code
  var cacheKey = '\u2182' + url
  if(cache) {
    var previous = JSON.parse(sessionStorage.getItem(cacheKey) || 'null')
    if(previous && previous.original === code)
      return previous.instrumented
  }
  var instrumented
  try {
    instrumented = falafel(code, options, visit.bind(null, url, [])).toString()
  } catch(err) {
    console.error(err)
    instrumented = code
  }
  if(cache) {
    var record = { original: code, instrumented: instrumented }
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify(record))
    } catch(err) {
      console.warn(err)
    }
  } else delete sessionStorage[cacheKey]
  return instrumented
}

function visit(url, refs, node) {
  return node.parent
    ? visitDescendant(url, refs, node)
    : visitRoot(url, refs, node)
}

function visitDescendant(url, refs, node) {

  if(functionTypes.indexOf(node.parent.type) < 0) return
  if(node.type !== 'BlockStatement') return

  ++id

  var loc = [
    node.loc.start.line - 1,
    node.loc.start.column,
    node.loc.end.line - 1,
    node.loc.end.column
  ]

  var key = JSON.stringify((url || '') + '@' + id)

  refs.push({ loc: loc, node: node.parent, key: key })

  node.update(
    '{\u2182[' + key + '].evalFn=function(\u2182a,\u2182c){' +
      'return eval(\u2182c)' +
    '}.bind(this,arguments);' +
    node.source().substring(1))
}

function visitRoot(url, refs, node) {

  var scopes = escope.analyze(node).scopes

  var globalNames = scopes[0].variables.map(function(v) {
    return v.name
  })

  var setup =
    'var \u2182=\u2182||{globals:[]};' +
    '\u2182.globals=\u2182.globals.concat(' +
      JSON.stringify(globalNames) + ');'

  refs.forEach(function(ref) {
    var vars =
      findScope(ref.node, scopes).variables.
      map(function(v) { return v.name })
    setup += '\u2182[' + ref.key + ']={' +
      'loc:[' + ref.loc + '],' +
      'vars:' + JSON.stringify(vars) +
    '};'
  })

  node.update(
    setup + '\u2182;' +
    node.source() +
    '\n//# sourceURL=' + url + '.inst')
}

function findScope(node, scopes) {
  for(var s = 0; s < scopes.length; s++)
    if(scopes[s].block === node) return scopes[s]
  console.error(node)
  console.error(scopes)
  debugger;
  throw new Error('Failed to find node in scopes')
}

root.instrument = instrument

})(this)
