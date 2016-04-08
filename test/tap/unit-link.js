'use strict'
var util = require('util')
var test = require('tap').test
var requireInject = require('require-inject')
var dezalgo = require('dezalgo')
var mkdirp = require('mkdirp')

test('gently/force', function (t) {
  t.plan(5)

  linkOk(t, 'gently=true, force=false, works', {
    // args
    from: 'wibble',
    to: '/foo/bar/baz',
    gently: true,
    abs: true,
    force: false,

    // expect
    rm: {'/foo/bar/baz': {gently: true}},
    mkdir: {'/foo/bar': true},
    stat: {'/foo/bar/baz/wibble': true},
    symlink: {'/foo/bar/baz/wibble': {'/foo/bar/baz': 'junction'}},
    readlink: {}
  })

  linkNotOk(t, 'gently=true, force=false, does not work', {
    // args
    from: 'wibble',
    to: '/foo/bar/baz',
    gently: true,
    abs: true,
    force: false,

    // expect
    rm: {'/foo/bar/baz': {gently: false}},
    mkdir: {'/foo/bar': true},
    stat: {'/foo/bar/baz/wibble': true},
    symlink: {'/foo/bar/baz/wibble': {'/foo/bar/baz': 'junction'}},
    readlink: {}
  })

  linkOk(t, 'gently=false, force=false, aok', {
    // args
    from: 'wibble',
    to: '/foo/bar/baz',
    gently: false,
    abs: true,
    force: false,

    // expect
    rm: {'/foo/bar/baz': {gently: false}},
    mkdir: {'/foo/bar': true},
    stat: {'/foo/bar/baz/wibble': true},
    symlink: {'/foo/bar/baz/wibble': {'/foo/bar/baz': 'junction'}},
    readlink: {}
  })

  linkOk(t, 'gently=true, force=true, aok', {
    // args
    from: 'wibble',
    to: '/foo/bar/baz',
    gently: true,
    abs: true,
    force: true,

    // expect
    rm: {'/foo/bar/baz': {gently: false}},
    mkdir: {'/foo/bar': true},
    stat: {'/foo/bar/baz/wibble': true},
    symlink: {'/foo/bar/baz/wibble': {'/foo/bar/baz': 'junction'}},
    readlink: {}
  })

  linkOk(t, 'gently=false, force=true, aok', {
    // args
    from: 'wibble',
    to: '/foo/bar/baz',
    gently: false,
    abs: true,
    force: true,

    // expect
    rm: {'/foo/bar/baz': {gently: false}},
    mkdir: {'/foo/bar': true},
    stat: {'/foo/bar/baz/wibble': true},
    symlink: {'/foo/bar/baz/wibble': {'/foo/bar/baz': 'junction'}},
    readlink: {}
  })
})

test('abs, noabs', function (t) {
  t.plan(4)

  linkOk(t, 'abs', {
    // args
    from: 'wibble',
    to: '/foo/bar/baz',
    gently: true,
    abs: true,
    force: false,

    // expect
    rm: {'/foo/bar/baz': {gently: true}},
    mkdir: {'/foo/bar': true},
    stat: {'/foo/bar/baz/wibble': true},
    symlink: {'/foo/bar/baz/wibble': {'/foo/bar/baz': 'junction'}},
    readlink: {}
  })

  linkOk(t, 'relative', {
    // args
    from: 'wibble',
    to: '/foo/bar/baz',
    gently: true,
    abs: false,
    force: false,

    // expect
    rm: {'/foo/bar/baz': {gently: true}},
    mkdir: {'/foo/bar': true},
    stat: {'/foo/bar/baz/wibble': true},
    symlink: {'wibble': {'/foo/bar/baz': 'junction'}},
    readlink: {}
  })

  linkOk(t, 'relative ..', {
    // args
    from: '../wibble/bark/blump',
    to: '/foo/bar/baz',
    gently: true,
    abs: false,
    force: false,

    // expect
    rm: {'/foo/bar/baz': {gently: true}},
    mkdir: {'/foo/bar': true},
    stat: {'/foo/bar/wibble/bark/blump': true},
    symlink: {'../wibble/bark/blump': {'/foo/bar/baz': 'junction'}},
    readlink: {}
  })

  linkOk(t, 'relative .. deep', {
    // args
    from: 'zib/zap/../../../wibble/bark/blump',
    to: '/foo/bar/baz',
    gently: true,
    abs: false,
    force: false,

    // expect
    rm: {'/foo/bar/baz': {gently: true}},
    mkdir: {'/foo/bar': true},
    stat: {'/foo/bar/wibble/bark/blump': true},
    symlink: {'../wibble/bark/blump': {'/foo/bar/baz': 'junction'}},
    readlink: {}
  })
})

function linkOk (t, msg, opts) {
  testLink(opts, function (err) {
    t.ifError(err, msg)
  })
}

function linkNotOk (t, msg, opts) {
  testLink(opts, function (err) {
    t.ok(err, msg)
  })
}

function testLink (opts, cb) {
  var mkdirpMock = dezalgo(function (dir, cb) {
    if (opts.mkdir[dir]) {
      cb()
    } else {
      cb(new Error('mkdirp failed: ' + util.inspect(dir)))
    }
  })
  // sync version used by istanbul for test coverage
  // we shouldn't have to do this ;.;
  // require-inject and/or instanbul will need patching
  mkdirpMock.sync = mkdirp.sync

  var link = requireInject('../../lib/utils/link.js', {
    '../../lib/npm.js': {
      config: {
        get: function (name) {
          if (name !== 'force') return new Error('unknown config key: ' + name)
          return opts.force
        }
      }
    },
    '../../lib/utils/gently-rm.js': dezalgo(function (toRemove, gently, cb) {
      if (opts.rm[toRemove] && opts.rm[toRemove].gently === gently) {
        cb()
      } else {
        cb(new Error('Removing toRemove: ' + util.inspect(toRemove) +
          ' gently: ' + util.inspect(gently) +
          ' not allowed: ' + util.inspect(opts.rm)))
      }
    }),
    'mkdirp': mkdirpMock,
    'graceful-fs': {
      'stat': dezalgo(function (file, cb) {
        if (opts.stat[file]) {
          cb(null, {})
        } else {
          cb(new Error('stat failed for: ' + util.inspect(file)))
        }
      }),
      'symlink': dezalgo(function (from, to, type, cb) {
        if (!cb) {
          cb = type
          type = null
        }
        if (opts.symlink[from] && opts.symlink[from][to] === type) {
          cb()
        } else {
          cb(new Error('symlink failed from: ' + util.inspect(from) + ' to: ' + util.inspect(to) + ' type: ' + util.inspect(type)))
        }
      }),
      'readlink': function (file, cb) {
        if (opts.readlink[file]) {
          cb()
        } else {
          cb(new Error('readlink failed for: ' + util.inspect(file)))
        }
      }
    }
  })
  link(opts.from, opts.to, opts.gently, opts.abs, cb)
}
