// Tests für die Prüf-Logik (js/check.js) – geschrieben vor der Implementierung.
'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const Check = require('../js/check.js');
const Tasks = require('../js/tasks.js');

// kleine Bausteine wie im Generator
const T = (v) => ({ t: 'txt', v });
const N = (v) => ({ t: 'num', v });
const R = (id) => ({ t: 'ref', id });
const I = (id, answer) => ({ t: 'in', id, answer, check: (x) => x === answer });

describe('parseNumber', () => {
  test('liest ganze Zahlen', () => {
    assert.equal(Check.parseNumber('85'), 85);
    assert.equal(Check.parseNumber('0'), 0);
    assert.equal(Check.parseNumber('100'), 100);
  });
  test('ignoriert Leerzeichen am Rand und führende Nullen', () => {
    assert.equal(Check.parseNumber(' 42 '), 42);
    assert.equal(Check.parseNumber('07'), 7);
  });
  test('leere Eingabe ist null', () => {
    assert.equal(Check.parseNumber(''), null);
    assert.equal(Check.parseNumber('   '), null);
    assert.equal(Check.parseNumber(undefined), null);
    assert.equal(Check.parseNumber(null), null);
  });
  test('ungültige Eingaben sind NaN', () => {
    for (const s of ['-3', '4a', 'a4', '1e2', '3.5', '3,5', '+4', '1 2', '0x10', '1234']) {
      assert.ok(Number.isNaN(Check.parseNumber(s)), s);
    }
  });
});

describe('checkRow', () => {
  const row = { tokens: [N(47), T('+'), N(30), T('='), I('s1', 77)] };

  test('richtige Eingabe', () => {
    const r = Check.checkRow(row, { s1: '77' }, {});
    assert.equal(r.complete, true);
    assert.equal(r.correct, true);
    assert.deepEqual(r.fields, [{ id: 's1', status: 'correct', value: 77 }]);
    assert.deepEqual(r.vals, { s1: 77 });
  });

  test('falsche Eingabe', () => {
    const r = Check.checkRow(row, { s1: '76' }, {});
    assert.equal(r.complete, true);
    assert.equal(r.correct, false);
    assert.equal(r.fields[0].status, 'wrong');
  });

  test('leere Eingabe ist unvollständig, nicht falsch', () => {
    const r = Check.checkRow(row, { s1: '' }, {});
    assert.equal(r.complete, false);
    assert.equal(r.correct, false);
    assert.equal(r.fields[0].status, 'empty');
  });

  test('Unsinn ist ungültig', () => {
    const r = Check.checkRow(row, { s1: '7x' }, {});
    assert.equal(r.fields[0].status, 'invalid');
    assert.equal(r.correct, false);
  });

  test('werte bei Fehlern nicht übernehmen', () => {
    const r = Check.checkRow(row, { s1: '76' }, { a: 1 });
    assert.deepEqual(r.vals, { a: 1 });
  });

  test('gibt vorhandene Werte weiter, verändert sie aber nicht', () => {
    const before = { z: 70 };
    const r = Check.checkRow({ tokens: [R('z'), T('+'), N(15), T('='), I('res', 85)] }, { res: '85' }, before);
    assert.deepEqual(r.vals, { z: 70, res: 85 });
    assert.deepEqual(before, { z: 70 });
  });

  test('mehrere Felder werden einzeln bewertet', () => {
    const r2 = { tokens: [I('at', 40), T('+'), I('bt', 30), T('='), I('z', 70)] };
    const r = Check.checkRow(r2, { at: '40', bt: '3', z: '70' }, {});
    assert.deepEqual(r.fields.map((f) => f.status), ['correct', 'wrong', 'correct']);
    assert.equal(r.correct, false);
  });

  test('Zeile ohne Eingabefelder ist sofort gelöst', () => {
    const r = Check.checkRow({ tokens: [N(38), T('='), N(30), T('+'), N(8)] }, {}, {});
    assert.equal(r.complete, true);
    assert.equal(r.correct, true);
    assert.deepEqual(r.fields, []);
  });

  test('Felder dürfen von vorherigen Feldern derselben Zeile abhängen', () => {
    // Profi-Division 84 : 6 – erste Teilzahl frei wählbar
    const t = Tasks.generate({ op: ':', profi: true });
    const D = t.a, d = t.b;
    const split = t.rows[0];
    let r = Check.checkRow(split, { p1: String(d * 10), p2: String(D - d * 10) }, {});
    assert.equal(r.correct, true, 'Zehnfaches des Teilers');
    r = Check.checkRow(split, { p1: String(d), p2: String(D - d) }, {});
    assert.equal(r.correct, true, 'auch eine ungewöhnliche, aber gültige Zerlegung');
    r = Check.checkRow(split, { p1: String(d * 10), p2: String(D - d * 10 + 1) }, {});
    assert.deepEqual(r.fields.map((f) => f.status), ['correct', 'wrong'], 'Summe stimmt nicht');
    r = Check.checkRow(split, { p1: String(d * 10 + 1), p2: String(D - d * 10 - 1) }, {});
    assert.equal(r.fields[0].status, 'wrong', 'nicht durch den Teiler teilbar');
  });
});

describe('ganze Aufgaben lösen', () => {
  function solveAll(task, wrongAt) {
    let vals = {};
    task.rows.forEach((row, i) => {
      const raw = {};
      row.tokens.filter((t) => t.t === 'in').forEach((t) => { raw[t.id] = String(t.answer); });
      if (i === wrongAt && Object.keys(raw).length) {
        const id = Object.keys(raw)[0];
        const bad = Check.checkRow(row, Object.assign({}, raw, { [id]: String(Number(raw[id]) + 1) }), vals);
        assert.equal(bad.correct, false, Tasks.taskText(task) + ' Zeile ' + i + ' akzeptiert falschen Wert');
      }
      const r = Check.checkRow(row, raw, vals);
      assert.equal(r.correct, true, Tasks.taskText(task) + ' Zeile ' + i);
      vals = r.vals;
    });
    return vals;
  }

  test('jede Aufgabe ist mit den hinterlegten Lösungen lösbar und endet beim richtigen Ergebnis', () => {
    for (const op of Tasks.OPS) {
      for (const s of Tasks.STRATEGIES[op]) {
        for (const level of ['hilfe', 'zerlegen', 'selbst']) {
          for (const rest of [false, true]) {
            for (let k = 0; k < 100; k++) {
              const t = Tasks.generate({ op, strategy: s.key, level, rest });
              const vals = solveAll(t, k % t.rows.length);
              assert.equal(Check.isSolved(t, vals), true);
              assert.equal(vals.res, t.answer);
            }
          }
        }
      }
    }
  });

  test('isSolved ist erst nach der letzten Zeile wahr', () => {
    const t = Tasks.generate({ op: '+', strategy: 'schrittweise' });
    assert.equal(Check.isSolved(t, {}), false);
    assert.equal(Check.isSolved(t, { bt: 1, s1: 2 }), false);
  });
});

describe('Rückmeldung bei Fehlern', () => {
  test('hintLevel steigert sich mit der Anzahl der Fehlversuche', () => {
    assert.equal(Check.hintLevel(0), 'none');
    assert.equal(Check.hintLevel(1), 'encourage');
    assert.equal(Check.hintLevel(2), 'hint');
    assert.equal(Check.hintLevel(3), 'solution');
    assert.equal(Check.hintLevel(7), 'solution');
  });

  test('solutionText nennt die Lösungen der falschen Felder', () => {
    const row = { tokens: [I('at', 40), T('+'), I('bt', 30), T('='), I('z', 70)] };
    const r = Check.checkRow(row, { at: '40', bt: '3', z: '70' }, {});
    assert.equal(Check.solutionText(row, r), '30');
    const r2 = Check.checkRow(row, { at: '4', bt: '3', z: '70' }, {});
    assert.equal(Check.solutionText(row, r2), '40 und 30');
  });

  test('solutionText passt sich an eine freie, gültige Zerlegung an', () => {
    const t = Tasks.generate({ op: ':', profi: true });
    const D = t.a, d = t.b;
    const r = Check.checkRow(t.rows[0], { p1: String(d), p2: '1' }, {});
    assert.deepEqual(r.fields.map((f) => f.status), ['correct', 'wrong']);
    assert.equal(Check.solutionText(t.rows[0], r), String(D - d));
  });
});

describe('Abhängige Felder (Review-Befunde)', () => {
  test('Profi-Division 51 : 3 mit "50 + 1": die 1 darf nicht als richtig gelten', () => {
    let t;
    do { t = Tasks.generate({ op: ':', profi: true }); } while (t.a < 20 || (Math.floor(t.a / 10) * 10) % t.b === 0);
    const D = t.a, tensD = Math.floor(D / 10) * 10;
    const r = Check.checkRow(t.rows[0], { p1: String(tensD), p2: String(D - tensD) }, {});
    {
      assert.equal(r.fields[0].status, 'wrong');
      assert.equal(r.fields[1].status, 'pending', 'hängt von einem falschen Feld ab');
      assert.equal(r.correct, false);
    }
  });

  test('pending-Felder erscheinen im Lösungstext mit der Musterlösung', () => {
    const t = Tasks.generate({ op: ':', profi: true });
    const p1 = t.rows[0].tokens.find((x) => x.id === 'p1');
    const p2 = t.rows[0].tokens.find((x) => x.id === 'p2');
    const r = Check.checkRow(t.rows[0], { p1: String(p1.answer + 1), p2: String(t.a - p1.answer - 1) }, {});
    assert.equal(Check.solutionText(t.rows[0], r), p1.answer + ' und ' + p2.answer);
  });
});
