// Rechenwege zu festen Zahlen: Tasks.build(op, weg, a, b, opt) baut dieselbe Aufgabe wie der
// Zufallsgenerator, nur mit vorgegebenen Zahlen (z. B. für "Welcher Weg?"). Jede Stufe, jeder Weg.
'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { Tasks, Check, inputs, fresh, play, playPath } = require('./helfer.js');

const WEGE = { '+': ['stellenweise', 'schrittweise', 'hilfsaufgabe', 'vereinfachen'], '−': ['schrittweise', 'ergaenzen', 'hilfsaufgabe', 'vereinfachen'] };
const LEVELS = ['hilfe', 'zerlegen', 'selbst'];

/** Zeile als Text: feste Zahlen, [Lösung] für Felder, (id) für Verweise */
const text = (r) => r.tokens.map((x) => (x.t === 'in' ? '[' + x.answer + ']' : x.t === 'ref' ? '(' + x.id + ')' : x.v)).join(' ');
/** Vergleichbare Form einer Aufgabe (ohne Funktionen) */
const shape = (t) => ({
  a: t.a, b: t.b, answer: t.answer, strategy: t.strategy, line: t.line, level: t.level, max: t.max, group: t.group,
  strategyName: t.strategyName, rows: t.rows.map((r) => ({ label: r.label, hint: r.hint, text: text(r) }))
});

describe('Tasks.build: feste Zahlen', () => {
  test('canBuild kennt die Rechenwege für Plus und Minus', () => {
    for (const op of ['+', '−']) for (const key of WEGE[op]) assert.equal(Tasks.canBuild(op, key), true, op + ' ' + key);
    assert.equal(Tasks.canBuild('+', 'ergaenzen'), false);
    assert.equal(Tasks.canBuild('+', 'welcherweg'), false);
    assert.throws(() => Tasks.build('+', 'ergaenzen', 47, 38, {}));
  });

  test('zufällige Aufgaben lassen sich mit denselben Zahlen genau so nachbauen', () => {
    for (const op of ['+', '−']) {
      for (const key of WEGE[op]) {
        for (const level of LEVELS) {
          for (const max of [100, 1000]) {
            for (let i = 0; i < 15; i++) {
              const t = Tasks.generate({ op, strategy: key, level, max });
              const u = Tasks.build(op, key, t.a, t.b, { level, max, round: t.round });
              assert.deepEqual(shape(u), shape(t), `${t.a} ${op} ${t.b} ${key} ${level}`);
            }
          }
        }
      }
    }
  });

  test('328 + 99 Hilfsaufgabe mit Hilfe: 99 ist fast 100', () => {
    const t = Tasks.build('+', 'hilfsaufgabe', 328, 99, { level: 'hilfe', max: 1000 });
    // wie im Heft: keine eigene Zeile "99 = 100 − 1", nur die Teilaufgaben untereinander
    assert.deepEqual(t.rows.map(text), ['328 + 100 = [428]', '(s1) − 1 = [427]']);
    assert.match(t.rows[0].hint, /99 ist fast 100/);
    assert.equal(t.answer, 427);
    assert.equal(t.strategyName, 'Hilfsaufgabe');
    assert.equal(t.level, 'hilfe');
  });

  test('239 + 41 Hilfsaufgabe: die erste Zahl wird glatt (round: a)', () => {
    const t = Tasks.build('+', 'hilfsaufgabe', 239, 41, { level: 'hilfe', max: 1000, round: 'a' });
    assert.deepEqual(t.rows.map(text), ['240 + 41 = [281]', '(s1) − 1 = [280]']);
    assert.match(t.rows[0].hint, /239 ist fast 240/);
    const z = Tasks.build('+', 'hilfsaufgabe', 239, 41, { level: 'zerlegen', max: 1000, round: 'a' });
    assert.deepEqual(z.rows.map(text), ['[240] + 41 = [281]', '(s1) − [1] = [280]']);
    const s = Tasks.build('+', 'hilfsaufgabe', 239, 41, { level: 'selbst', max: 1000, round: 'a' });
    assert.equal(text(s.rows[0]), '[240] + [41] = [281]');
    assert.match(s.rows[0].hint, /239 ist fast 240/);
    // auch die andere Zahl darf glatt werden: 239 + 40 = 279, 279 + 1 = 280
    assert.ok(playPath(s, [[239, 40, 279], [279, 1, 280]]).ok);
    assert.ok(playPath(s, [[240, 41, 281], [281, 1, 280]]).ok);
    for (const level of LEVELS) assert.ok(play(fresh(Tasks.build('+', 'hilfsaufgabe', 239, 41, { level, max: 1000, round: 'a' }))).ok, level);
  });

  test('Schrittweise wie im Heft: keine Zeile "46 = 40 + 6", nur die Schritte untereinander', () => {
    let t = Tasks.build('+', 'schrittweise', 14, 46, { level: 'hilfe', max: 100 });
    assert.deepEqual(t.rows.map(text), ['14 + 40 = [54]', '(s1) + 6 = [60]']);
    assert.match(t.rows[0].hint, /Zehner/);
    t = Tasks.build('−', 'schrittweise', 833, 124, { level: 'hilfe', max: 1000 });
    assert.deepEqual(t.rows.map(text), ['833 − 100 = [733]', '(s1) − 20 = [713]', '(s2) − 4 = [709]']);
    // Zerlegung selbst: die Stelle trägt das Kind in den Schritt ein, die Reihenfolge ist frei
    const z = Tasks.build('+', 'schrittweise', 14, 46, { level: 'zerlegen', max: 100 });
    assert.deepEqual(z.rows.map(text), ['14 + [40] = [54]', '(s1) + [6] = [60]']);
    assert.ok(playPath(z, [[40, 54], [6, 60]]).ok);
    assert.ok(playPath(Tasks.build('+', 'schrittweise', 14, 46, { level: 'zerlegen', max: 100 }), [[6, 20], [40, 60]]).ok, 'erst die Einer');
    const r = playPath(Tasks.build('+', 'schrittweise', 14, 46, { level: 'zerlegen', max: 100 }), [[7, 21]]);
    assert.equal(r.ok, false, '7 ist keine Stelle von 46');
  });

  test('Minus wird immer beim Subtrahenden glatt gemacht (round wird ignoriert)', () => {
    const t = Tasks.build('−', 'hilfsaufgabe', 523, 198, { level: 'hilfe', max: 1000, round: 'a' });
    assert.deepEqual(t.rows.map(text), ['523 − 200 = [323]', '(s1) + 2 = [325]']);
  });

  test('239 + 41 Vereinfachen: 239 bekommt 1 dazu, 41 gibt 1 ab', () => {
    const t = Tasks.build('+', 'vereinfachen', 239, 41, { level: 'hilfe', max: 1000, round: 'a' });
    assert.deepEqual(t.rows.map(text), ['239 + 41 = 240 + [40]', '240 + 40 = [280]']);
    const u = Tasks.build('+', 'vereinfachen', 328, 99, { level: 'hilfe', max: 1000 });
    assert.deepEqual(u.rows.map(text), ['328 + 99 = [327] + 100', '327 + 100 = [427]']);
    const m = Tasks.build('−', 'vereinfachen', 702, 698, { level: 'hilfe', max: 1000 });
    assert.deepEqual(m.rows.map(text), ['702 − 698 = [704] − 700', '704 − 700 = [4]']);
  });

  test('702 − 698 Ergänzen und 346 + 228 Stellenweise', () => {
    const e = Tasks.build('−', 'ergaenzen', 702, 698, { level: 'hilfe', max: 1000 });
    assert.deepEqual(e.rows.map(text), ['698 + [2] = 700', '700 + [2] = 702', '(j1) + (j2) = [4]', '698 + (res) = [702]']);
    assert.deepEqual(e.line, { start: 698, end: 702 });
    const s = Tasks.build('+', 'stellenweise', 346, 228, { level: 'hilfe', max: 1000 });
    assert.deepEqual(s.rows.map(text), ['300 + 200 = [500]', '40 + 20 = [60]', '6 + 8 = [14]', '(z1) + (z2) + (z3) = [574]']);
  });

  test('jeder Weg lässt sich zu festen Zahlen in jeder Stufe lösen', () => {
    const cases = { '+': [[328, 99], [239, 41], [346, 228], [47, 39], [58, 27]], '−': [[702, 698], [523, 198], [674, 231], [81, 77], [73, 29]] };
    for (const op of ['+', '−']) {
      for (const [a, b] of cases[op]) {
        const max = a >= 100 ? 1000 : 100;
        for (const key of WEGE[op]) {
          for (const level of LEVELS) {
            for (const round of ['a', 'b']) {
              const t = Tasks.build(op, key, a, b, { level, max, round });
              assert.equal(t.answer, op === '+' ? a + b : a - b);
              const r = play(fresh(t));
              assert.ok(r.ok, `${a} ${op} ${b} ${key} ${level} ${round}`);
              assert.equal(r.vals.res, t.answer);
            }
          }
        }
      }
    }
  });
});

describe('Stellenweise, alles selbst: Zeilen heißen nach der gerechneten Stelle', () => {
  test('vorher neutral, nach dem Rechnen Hunderter, Zehner oder Einer', () => {
    const t = Tasks.build('+', 'stellenweise', 346, 228, { level: 'selbst', max: 1000 });
    assert.deepEqual(t.rows.map((r) => r.label), ['Eine Stelle', 'Nächste Stelle', 'Letzte Stelle', 'Zusammen']);
    // das Kind fängt mit den Einern an, dann die Hunderter, dann die Zehner
    const done = [];
    const r = play(fresh(t), (row, i) => [[6, 8, 14], [200, 300, 500], [40, 20, 60]][i] || null,
      (row, i, vals) => done.push(row.labelDone ? row.labelDone(vals) : row.label));
    assert.ok(r.ok);
    assert.deepEqual(done, ['Einer', 'Hunderter', 'Zehner', 'Zusammen']);
  });
  test('zwei gemeinsame Stellen: "Eine Stelle", "Letzte Stelle"', () => {
    const t = Tasks.build('+', 'stellenweise', 47, 38, { level: 'selbst', max: 100 });
    assert.deepEqual(t.rows.map((r) => r.label), ['Eine Stelle', 'Letzte Stelle', 'Zusammen']);
    const vals = Check.checkRow(t.rows[0], { sx1: '40', sy1: '30', z1: '70' }, {}).vals;
    assert.equal(t.rows[0].labelDone(vals), 'Zehner');
  });
  test('andere Stufen behalten ihre festen Namen', () => {
    for (const level of ['hilfe', 'zerlegen']) {
      const t = Tasks.build('+', 'stellenweise', 346, 228, { level, max: 1000 });
      assert.deepEqual(t.rows.map((r) => r.label), ['Hunderter', 'Zehner', 'Einer', 'Zusammen']);
      assert.ok(t.rows.every((r) => !r.labelDone));
    }
  });
});

// Mal und Geteilt zu festen Zahlen (z. B. für die Beispiele im „So geht's“-Dialog, js/explain.js)
describe('Tasks.build: Mal und Geteilt zu festen Zahlen', () => {
  const MG = { '·': ['zerlegen', 'kernaufgaben', 'hilfsaufgabe'], ':': ['zerlegen'] };

  test('canBuild kennt die Rechenwege für Mal und Geteilt', () => {
    for (const op of ['·', ':']) for (const key of MG[op]) assert.equal(Tasks.canBuild(op, key), true, op + ' ' + key);
  });

  test('zufällige Aufgaben lassen sich mit denselben Zahlen genau so nachbauen', () => {
    for (const op of ['·', ':']) {
      for (const key of MG[op]) {
        for (const level of LEVELS) {
          for (const max of [100, 1000]) {
            for (const rest of op === ':' ? [false, true] : [false]) {
              for (let i = 0; i < 15; i++) {
                const t = Tasks.generate({ op, strategy: key, level, max, rest });
                const u = Tasks.build(op, key, t.a, t.b, { level, max });
                assert.deepEqual(shape(u), shape(t), `${t.a} ${op} ${t.b} ${key} ${level}`);
              }
            }
          }
        }
      }
    }
  });

  test('wie im Heft: 9 · 29 zerlegt, 5 · 49 mit Hilfsaufgabe, 6 · 8 mit Kernaufgaben, 852 : 4 zerlegt', () => {
    const z = Tasks.build('·', 'zerlegen', 9, 29, { level: 'hilfe', max: 1000 });
    assert.deepEqual(z.rows.map(text), ['9 · 29 = 9 · 20 + 9 · 9', '9 · 20 = [180]', '9 · 9 = [81]', '(p1) + (p2) = [261]']);
    const h = Tasks.build('·', 'hilfsaufgabe', 5, 49, { level: 'hilfe', max: 1000 });
    assert.deepEqual(h.rows.map(text), ['5 · 49 = 5 · 50 − 5 · 1', '5 · 50 = [250]', '(s1) − 5 = [245]']);
    const n = Tasks.build('·', 'hilfsaufgabe', 9, 27, { level: 'hilfe', max: 1000 });
    assert.deepEqual(n.rows.map(text), ['9 · 27 = 10 · 27 − 1 · 27', '10 · 27 = [270]', '(s1) − 27 = [243]']);
    const k = Tasks.build('·', 'kernaufgaben', 6, 8, { level: 'hilfe', max: 100 });
    assert.deepEqual(k.rows.map(text), ['6 · 8 = 5 · 8 + 1 · 8', '5 · 8 = [40]', '1 · 8 = [8]', '(p1) + (p2) = [48]']);
    const d = Tasks.build(':', 'zerlegen', 852, 4, { level: 'hilfe', max: 1000 });
    assert.deepEqual(d.rows.map(text), ['800 : 4 = [200]', '40 : 4 = [10]', '12 : 4 = [3]', '852 : 4 = [213]', '(res) · 4 = [852]']);
    const r = Tasks.build(':', 'zerlegen', 87, 6, { level: 'hilfe', max: 100 });
    assert.equal(r.answer, 14);
    assert.equal(r.rest, 3);
    assert.deepEqual(r.rows.map(text), ['60 : 6 = [10]', '27 : 6 = [4] R [3]', '87 : 6 = [14] R [3]', '(res) · 6 + (rf) = [87]']);
  });

  test('Zahlen, die nicht zum Rechenweg passen, werden abgelehnt', () => {
    assert.throws(() => Tasks.build('·', 'zerlegen', 3, 245, { max: 1000 }), /Zerlegen/, 'drei Teile');
    assert.throws(() => Tasks.build('·', 'zerlegen', 4, 20, { max: 100 }), /Zerlegen/, 'nichts zu zerlegen');
    assert.throws(() => Tasks.build('·', 'kernaufgaben', 4, 7, { max: 100 }), /Kernaufgaben/, '4 hat keine Musterzerlegung');
    assert.throws(() => Tasks.build('·', 'hilfsaufgabe', 4, 23, { max: 100 }), /Hilfsaufgabe/, 'keine Zahl fast glatt');
    assert.throws(() => Tasks.build(':', 'zerlegen', 27, 3, { max: 100 }), /Geteilt/, 'Ergebnis einstellig');
  });

  test('jeder Weg lässt sich zu festen Zahlen in jeder Stufe lösen', () => {
    const cases = { '·': { zerlegen: [[9, 29], [4, 23], [64, 3]], kernaufgaben: [[6, 8], [9, 6], [7, 4], [8, 7]], hilfsaufgabe: [[5, 49], [9, 27], [3, 29], [6, 198]] },
      ':': { zerlegen: [[852, 4], [96, 8], [87, 6], [482, 2]] } };
    for (const op of ['·', ':']) {
      for (const key of MG[op]) {
        for (const [a, b] of cases[op][key]) {
          for (const level of LEVELS) {
            const t = Tasks.build(op, key, a, b, { level, max: 1000 });
            const r = play(fresh(t));
            assert.ok(r.ok, `${a} ${op} ${b} ${key} ${level}`);
            assert.equal(r.vals.res, t.answer);
          }
        }
      }
    }
  });
});
