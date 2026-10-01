// Prüft den Aufgaben-Generator (js/tasks.js).
'use strict';
var { test } = require('node:test');
var Tasks = require('../js/tasks.js');
var assert = require('assert');

var RUNS = 3000, checked = 0;

function solve(task) {
  var vals = {};
  task.rows.forEach(function (row, ri) {
    row.tokens.forEach(function (tok) {
      if (tok.t === 'num') {
        assert(Number.isInteger(tok.v) && tok.v >= 0 && tok.v <= Tasks.MAX, 'Zahl außerhalb: ' + tok.v);
      }
      if (tok.t === 'ref') assert(tok.id in vals, 'Referenz vor Eingabe: ' + tok.id);
      if (tok.t === 'in') {
        assert(Number.isInteger(tok.answer) && tok.answer >= 0 && tok.answer <= Tasks.MAX,
          Tasks.taskText(task) + ' Zeile ' + ri + ': Lösung ' + tok.answer);
        assert(tok.check(tok.answer, vals), Tasks.taskText(task) + ' Zeile ' + ri + ' ' + tok.id + ' lehnt eigene Lösung ab');
        assert(!tok.check(tok.answer + 1, vals) || task.profi, 'Falsche Antwort akzeptiert: ' + tok.id);
        vals[tok.id] = tok.answer;
      }
    });
    // Zeilen mit Gleichung prüfen: linke Seite rechnet sich zur rechten aus
    var toks = row.tokens.map(function (t) { return t.t === 'txt' ? t.v : (t.t === 'num' ? t.v : vals[t.id]); });
    var eq = toks.indexOf('=');
    var restIdx = toks.indexOf('R');
    var left = toks.slice(0, eq), right = toks.slice(eq + 1, restIdx < 0 ? undefined : restIdx);
    function ev(xs) {
      var v = xs[0];
      for (var i = 1; i < xs.length; i += 2) {
        var o = xs[i], n = xs[i + 1];
        if (o === '+') v += n; else if (o === '−') v -= n; else if (o === '·') v *= n;
        else if (o === ':') v = Math.floor(v / n); else throw new Error('Op ' + o);
      }
      return v;
    }
    assert.strictEqual(ev(left), ev(right), Tasks.taskText(task) + ' Zeile ' + ri + ': ' + toks.join(' '));
    if (row.jump) assert.strictEqual(row.jump.to, (row.jump.text[0] === '+' ? 1 : -1) * parseInt(row.jump.text.slice(1), 10) + row.jump.from);
  });
  assert.strictEqual(vals.res, task.answer, Tasks.taskText(task) + ': Endergebnis');
  if (task.rest) assert.strictEqual(vals.r, task.rest);
  var exact = { '+': task.a + task.b, '−': task.a - task.b, '·': task.a * task.b }[task.op];
  if (task.op === ':') { exact = Math.floor(task.a / task.b); assert.strictEqual(task.a % task.b, task.rest || 0); }
  assert.strictEqual(task.answer, exact, Tasks.taskText(task) + ' falsches Ergebnis');
  assert(task.a <= Tasks.MAX && task.answer <= Tasks.MAX);
  checked++;
}

test('alle Rechenwege und Einstellungen liefern korrekte, lösbare Aufgaben', function () {
Tasks.OPS.forEach(function (op) {
  Tasks.STRATEGIES[op].forEach(function (s) {
    ['ohne', 'mit', 'egal'].forEach(function (crossing) {
      [false, true].forEach(function (profi) {
        [false, true].forEach(function (rest) {
          for (var i = 0; i < RUNS / 10; i++) {
            var t = Tasks.generate({ op: op, strategy: s.key, crossing: crossing, profi: profi, rest: rest });
            assert.strictEqual(t.strategy, s.key);
            if (op === '+' && s.key !== 'hilfsaufgabe' && crossing !== 'egal') {
              assert.strictEqual(t.a % 10 + t.b % 10 >= 10, crossing === 'mit');
            }
            if (op === '−' && s.key !== 'hilfsaufgabe' && crossing !== 'egal') {
              assert.strictEqual(t.a % 10 < t.b % 10, crossing === 'mit');
            }
            solve(t);
          }
        });
      });
    });
  });
});
});

test('gemischte Aufgaben', function () {
  for (var i = 0; i < RUNS; i++) solve(Tasks.generate({ op: 'mix', profi: i % 2 === 0, rest: i % 3 === 0 }));

});

test('Profi-Division: freie Zerlegung wird akzeptiert', function () {
var t = Tasks.generate({ op: ':', profi: true });
var split = t.rows[0].tokens.filter(function (x) { return x.t === 'in'; });
var d = t.b;
assert(split[0].check(d, {}), 'Zerlegung mit kleinster Zahl der Reihe');
assert(!split[0].check(d + 1, {}) || (d + 1) % d === 0, 'Nicht teilbare Zerlegung abgelehnt');
assert(split[1].check(t.a - d, { p1: d }));
});
