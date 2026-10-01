// Tests für die Prüf-Logik (js/check.js) – geschrieben vor der Implementierung.
'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const Check = require('../js/check.js');
const Tasks = require('../js/tasks.js');
const UI = require('../js/ui-logic.js');

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
    for (const s of ['-3', '4a', 'a4', '1e2', '3.5', '3,5', '+4', '1 2', '0x10', '12345']) {
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
    // Mal Zerlegen, Zerlegung selbst: 4 · 23 = 4 · [m1] + 4 · [m2] – der erste Teil frei, der zweite ergänzt ihn
    const t = malSplit();
    const big = Math.max(t.a, t.b), split = t.rows[0];
    let r = Check.checkRow(split, { m1: String(big - 1), m2: '1' }, {});
    assert.equal(r.correct, true, 'auch eine ungewöhnliche, aber gültige Zerlegung');
    r = Check.checkRow(split, { m1: '1', m2: String(big - 2) }, {});
    assert.deepEqual(r.fields.map((f) => f.status), ['correct', 'wrong'], 'Summe stimmt nicht');
    r = Check.checkRow(split, { m1: String(big), m2: '0' }, {});
    assert.equal(r.fields[0].status, 'wrong', 'die ganze Zahl ist keine Zerlegung');
  });
});

/** Mal Zerlegen, Zerlegung selbst: erste Zeile a · b = s · [m1] + s · [m2] */
function malSplit() { return Tasks.generate({ op: '·', strategy: 'zerlegen', level: 'zerlegen', max: 100 }); }

describe('ganze Aufgaben lösen', () => {
  // Löst eine Aufgabe mit den hinterlegten Lösungen – auch Zeilen, die das Kind selbst anhängt (task.nextRow)
  function solveAll(task, wrongAt) {
    let vals = {};
    for (let i = 0; i < 40; i++) {
      if (i >= task.rows.length) task.rows.push(task.nextRow(vals));
      const row = task.rows[i];
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
      if (!Object.keys(raw).length) continue;
      if (UI.afterCorrect(task, vals, i) === 'finish') return vals;
    }
    throw new Error('nicht fertig geworden');
  }

  test('jede Aufgabe ist mit den hinterlegten Lösungen lösbar und endet beim richtigen Ergebnis', () => {
    for (const op of Tasks.OPS) {
      for (const s of Tasks.STRATEGIES[op]) {
        for (const level of ['hilfe', 'zerlegen', 'selbst']) {
          for (const rest of [false, true]) {
            for (let k = 0; k < 100; k++) {
              const t = Tasks.generate({ op, strategy: s.key, level, rest });
              const vals = solveAll(t, k % (t.rows.length + 1));
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
    const t = malSplit(), big = Math.max(t.a, t.b);
    const r = Check.checkRow(t.rows[0], { m1: '1', m2: '1' }, {});
    assert.deepEqual(r.fields.map((f) => f.status), ['correct', 'wrong']);
    assert.equal(Check.solutionText(t.rows[0], r), String(big - 1));
  });
});

describe('Abhängige Felder (Review-Befunde)', () => {
  test('falsches erstes Feld: das abhängige Feld gilt nicht als richtig', () => {
    const t = malSplit(), big = Math.max(t.a, t.b);
    const r = Check.checkRow(t.rows[0], { m1: String(big), m2: '0' }, {});
    assert.equal(r.fields[0].status, 'wrong');
    assert.equal(r.fields[1].status, 'pending', 'hängt von einem falschen Feld ab');
    assert.equal(r.correct, false);
  });

  test('pending-Felder erscheinen im Lösungstext mit der Musterlösung', () => {
    const t = malSplit(), big = Math.max(t.a, t.b);
    const m1 = t.rows[0].tokens.find((x) => x.id === 'm1');
    const m2 = t.rows[0].tokens.find((x) => x.id === 'm2');
    const r = Check.checkRow(t.rows[0], { m1: String(big), m2: '0' }, {});
    assert.equal(Check.solutionText(t.rows[0], r), m1.answer + ' und ' + m2.answer);
  });
});
