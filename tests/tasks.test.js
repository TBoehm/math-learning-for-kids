// Prüft den Aufgaben-Generator (js/tasks.js).
'use strict';
var { test } = require('node:test');
var Tasks = require('../js/tasks.js');
var assert = require('assert');

var H = require('./helfer.js');
var RUNS = 3000, checked = 0;

// Löst eine Aufgabe auf dem erwarteten Weg (auch mit Zeilen, die das Kind selbst anhängt) und prüft
// jede Zeile: Gleichung stimmt, alle Zahlen im Zahlenraum, Musterlösungen werden angenommen.
function solve(task) {
  var max = task.max || Tasks.MAX;
  var played = H.fresh(task);
  var r = H.play(played, null, function (row, ri, vals) {
    row.tokens.forEach(function (tok) {
      if (tok.t === 'num') assert(Number.isInteger(tok.v) && tok.v >= 0 && tok.v <= max, 'Zahl außerhalb: ' + tok.v);
      if (tok.t === 'in') {
        assert(Number.isInteger(tok.answer) && tok.answer >= 0 && tok.answer <= max,
          Tasks.taskText(task) + ' Zeile ' + ri + ': Lösung ' + tok.answer);
        // auf dem Musterweg ist die hinterlegte Lösung genau das, was erwartet wird
        assert.strictEqual(vals[tok.id], tok.answer, Tasks.taskText(task) + ' Zeile ' + ri + ' ' + tok.id);
      }
    });
    H.assertTrueEquation(played, row, vals, ri).forEach(function (n) {
      assert(n >= 0 && n <= max, Tasks.taskText(task) + ' Zeile ' + ri + ': ' + n);
    });
    var j = typeof row.jump === 'function' ? row.jump(vals) : row.jump;
    if (j) assert.strictEqual(j.to, (j.text[0] === '+' ? 1 : -1) * parseInt(j.text.slice(1), 10) + j.from);
  });
  assert(r.ok, Tasks.taskText(task) + ' ' + task.strategy + ' ' + task.level + ': Musterweg abgelehnt in Zeile ' + r.row);
  var vals = r.vals;
  // Musterlösungen der vorgegebenen Zeilen werden angenommen, eine falsche Zahl nicht
  task.rows.forEach(function (row) {
    row.tokens.forEach(function (tok) {
      if (tok.t === 'in' && !tok.expected) assert(!tok.check(tok.answer + 1, vals) || task.profi, 'Falsche Antwort akzeptiert: ' + tok.id);
    });
  });
  assert.strictEqual(vals.res, task.answer, Tasks.taskText(task) + ': Endergebnis');
  var exact = { '+': task.a + task.b, '−': task.a - task.b, '·': task.a * task.b }[task.op];
  if (task.op === ':') { exact = Math.floor(task.a / task.b); assert.strictEqual(task.a % task.b, task.rest || 0); }
  assert.strictEqual(task.answer, exact, Tasks.taskText(task) + ' falsches Ergebnis');
  assert(task.a <= max && task.answer <= max);
  checked++;
}

test('alle Rechenwege und Einstellungen liefern korrekte, lösbare Aufgaben', function () {
Tasks.OPS.forEach(function (op) {
  Tasks.STRATEGIES[op].forEach(function (s) {
    ['ohne', 'mit', 'egal'].forEach(function (crossing) {
      ['hilfe', 'zerlegen', 'selbst'].forEach(function (level) {
        [false, true].forEach(function (rest) {
          for (var i = 0; i < RUNS / 15; i++) {
            var t = Tasks.generate({ op: op, strategy: s.key, crossing: crossing, level: level, rest: rest });
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
  for (var i = 0; i < RUNS; i++) solve(Tasks.generate({ op: 'mix', level: ['hilfe', 'zerlegen', 'selbst'][i % 3], rest: i % 2 === 0 }));

});

test('Profi-Division: freie Zerlegung wird akzeptiert', function () {
var t = Tasks.generate({ op: ':', profi: true });
var split = t.rows[0].tokens.filter(function (x) { return x.t === 'in'; });
var d = t.b;
assert(split[0].check(d, {}), 'Zerlegung mit kleinster Zahl der Reihe');
assert(!split[0].check(d + 1, {}) || (d + 1) % d === 0, 'Nicht teilbare Zerlegung abgelehnt');
assert(split[1].check(t.a - d, { p1: d }));
});

function hintsOf(t) { return t.rows.map(function (r) { return r.hint; }).join(' | '); }

test('Minus schrittweise: kein "Erst bis X", wenn man schon bei X ist', function () {
  for (var i = 0; i < 3000; i++) {
    var t = Tasks.generate({ op: '−', strategy: 'schrittweise' });
    var s1 = t.a - Math.floor(t.b / 10) * 10;
    assert(hintsOf(t).indexOf('Erst bis ' + s1 + ',') < 0, Tasks.taskText(t) + ': ' + hintsOf(t));
  }
});

test('Plus schrittweise: kein "Erst bis X", wenn X schon das Ergebnis ist', function () {
  for (var i = 0; i < 3000; i++) {
    var t = Tasks.generate({ op: '+', strategy: 'schrittweise' });
    assert(hintsOf(t).indexOf('Erst bis ' + t.answer + ',') < 0, Tasks.taskText(t) + ': ' + hintsOf(t));
  }
});

test('Hilfsaufgabe beachtet die Einstellung Zehnerübergang', function () {
  for (var i = 0; i < 1500; i++) {
    ['ohne', 'mit'].forEach(function (crossing) {
      var p = Tasks.generate({ op: '+', strategy: 'hilfsaufgabe', crossing: crossing });
      assert.strictEqual(p.a % 10 + p.b % 10 >= 10, crossing === 'mit', 'Plus ' + crossing + ': ' + Tasks.taskText(p));
      var m = Tasks.generate({ op: '−', strategy: 'hilfsaufgabe', crossing: crossing });
      assert.strictEqual(m.a % 10 < m.b % 10, crossing === 'mit', 'Minus ' + crossing + ': ' + Tasks.taskText(m));
    });
  }
});

test('Ergänzen: die Zusammen-Zeile hat immer mindestens zwei Sprünge', function () {
  for (var i = 0; i < 3000; i++) {
    var t = Tasks.generate({ op: '−', strategy: 'ergaenzen', max: i % 2 ? 100 : 1000 });
    var sum = t.rows.filter(function (r) { return r.label === 'Zusammen'; })[0];
    if (sum) {
      var refs = sum.tokens.filter(function (x) { return x.t === 'ref'; }).length;
      assert(refs >= 2, Tasks.taskText(t) + ' hat eine Zusammen-Zeile mit ' + refs + ' Sprung');
    }
    assert(t.rows.some(function (r) { return r.tokens.some(function (x) { return x.id === 'res'; }); }));
  }
});

test('Hinweise: "zusammen rechnen" statt "zählen", "dazugerechnet" statt "dazugetan"', function () {
  for (var i = 0; i < 500; i++) {
    var h = hintsOf(Tasks.generate({ op: 'mix', profi: i % 2 === 0 }));
    assert(!/Zähle [^|.!]*zusammen|dazugetan/.test(h), h);
  }
});

test('isEasySplit: beide Teile lassen sich leicht teilen (Zehnerzahl oder Einmaleins)', function () {
  assert.strictEqual(Tasks.isEasySplit(60, 24, 6), true, '60 : 6 = 10, 24 : 6 = 4');
  assert.strictEqual(Tasks.isEasySplit(42, 42, 6), true, 'zweimal Einmaleins');
  assert.strictEqual(Tasks.isEasySplit(80, 16, 4), true);
  assert.strictEqual(Tasks.isEasySplit(48, 48, 8), true, '48 : 8 = 6');
  assert.strictEqual(Tasks.isEasySplit(60, 27, 6), true, 'mit Rest: 27 : 6 = 4 R 3');
  assert.strictEqual(Tasks.isEasySplit(3, 65, 3), false, '65 : 3 ist so schwer wie die Aufgabe');
  assert.strictEqual(Tasks.isEasySplit(48, 48, 4), false, '48 : 4 = 12 ist nicht leicht');
  assert.strictEqual(Tasks.isEasySplit(66, 2, 3), false, '66 : 3 = 22 ist nicht leicht');
});

test('Profi-Division: Rat nur bei umständlicher Zerlegung, mit einem leichten Vorschlag', function () {
  for (var i = 0; i < 500; i++) {
    var t = Tasks.generate({ op: ':', profi: true, rest: i % 2 === 0 });
    var row = t.rows[0], D = t.a, d = t.b;
    var c1 = row.tokens.filter(function (x) { return x.id === 'p1'; })[0].answer;
    assert.strictEqual(typeof row.advice, 'function');
    assert.strictEqual(row.advice({ p1: c1, p2: D - c1 }), null, 'Musterzerlegung braucht keinen Rat');
    // d + (D - d): (D - d) : d = Ergebnis − 1 (Rest bleibt). Leicht nur, wenn das
    // höchstens 10 oder (ohne Rest) eine Zehnerzahl ist – z. B. 42 = 2 + 40.
    if (t.answer - 1 <= 10 || (!t.rest && (t.answer - 1) % 10 === 0)) {
      assert.strictEqual(row.advice({ p1: d, p2: D - d }), null, Tasks.taskText(t));
      continue;
    }
    var msg = row.advice({ p1: d, p2: D - d });
    assert.strictEqual(typeof msg, 'string', Tasks.taskText(t));
    assert(msg.indexOf(c1 + ' + ' + (D - c1)) >= 0, msg);
    assert(/leichter/.test(msg), msg);
  }
  // andere Rechenwege haben keinen Rat
  var p = Tasks.generate({ op: '+', profi: true });
  p.rows.forEach(function (r) { assert.strictEqual(r.advice, undefined); });
});
