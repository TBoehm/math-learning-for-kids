// Knobeln: Fehler finden (js/formats/fehler.js) – in einer fertigen Rechnung steckt genau ein typischer Fehler.
'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const Tasks = require('../js/tasks.js');
const Check = require('../js/check.js');
const FE = require('../js/formats/fehler.js');
const { seeded, solve, fields } = require('./knobel-helpers.js');

// Bausteine wie im Generator (Stufe "Mit Hilfe")
const T = (v) => ({ t: 'txt', v });
const N = (v) => ({ t: 'num', v });
const R = (id) => ({ t: 'ref', id });
const I = (id, answer) => ({ t: 'in', id, answer, check: (x) => x === answer });
const row = (tokens) => ({ tokens, label: '', hint: '' });

// 47 + 38 schrittweise
const schritt = () => ({
  op: '+', strategy: 'schrittweise', a: 47, b: 38, answer: 85, rows: [
    row([N(38), T('='), N(30), T('+'), N(8)]),
    row([N(47), T('+'), N(30), T('='), I('s1', 77)]),
    row([R('s1'), T('+'), N(8), T('='), I('res', 85)])
  ]
});
// 47 + 39 mit Hilfsaufgabe
const hilfs = () => ({
  op: '+', strategy: 'hilfsaufgabe', a: 47, b: 39, answer: 86, rows: [
    row([N(39), T('='), N(40), T('−'), N(1)]),
    row([N(47), T('+'), N(40), T('='), I('s1', 87)]),
    row([R('s1'), T('−'), N(1), T('='), I('res', 86)])
  ]
});
// 4 · 23 zerlegen
const mal = () => ({
  op: '·', strategy: 'zerlegen', a: 4, b: 23, answer: 92, rows: [
    row([N(23), T('='), N(20), T('+'), N(3)]),
    row([N(4), T('·'), N(20), T('='), I('p1', 80)]),
    row([N(4), T('·'), N(3), T('='), I('p2', 12)]),
    row([R('p1'), T('+'), R('p2'), T('='), I('res', 92)])
  ]
});
// 87 : 6 = 14 R 3
const geteilt = () => ({
  op: ':', strategy: 'zerlegen', a: 87, b: 6, answer: 14, rest: 3, rows: [
    row([N(87), T('='), N(60), T('+'), N(27)]),
    row([N(60), T(':'), N(6), T('='), I('q1', 10)]),
    row([N(27), T(':'), N(6), T('='), I('q2', 4), T('R'), I('r', 3)]),
    row([R('q1'), T('+'), R('q2'), T('='), I('res', 14), T('R'), R('r')])
  ]
});
const text = (r) => r.tokens.map((x) => x.t === 'in' ? '[' + x.answer + ']' : x.v).join(' ');
const find = (cands, line, type) => cands.find((c) => c.line === line && c.type === type);

describe('Rechnung als Zeilen', () => {
  test('alle Zahlen werden eingesetzt, jede Zeile stimmt', () => {
    const lines = FE.lines(schritt());
    assert.deepEqual(lines.map(FE.text), ['38 = 30 + 8', '47 + 30 = 77', '77 + 8 = 85']);
    assert.ok(lines.every(FE.lineOk));
  });
  test('mit Rest', () => {
    const lines = FE.lines(geteilt());
    assert.deepEqual(lines.map(FE.text), ['87 = 60 + 27', '60 : 6 = 10', '27 : 6 = 4 R 3', '10 + 4 = 14 R 3']);
    assert.ok(lines.every(FE.lineOk));
    assert.equal(FE.lineOk(FE.lines(geteilt())[2].map((x, k) => (k === 4 ? Object.assign({}, x, { v: 5 }) : x))), false);
  });
});

describe('Typische Fehler', () => {
  test('Zehnerübergang vergessen, Zehner verzählt', () => {
    const c = FE.candidates(FE.lines(schritt()), 'schrittweise');
    assert.equal(find(c, 2, 'uebertrag').w, 75);
    assert.ok([67, 87].includes(find(c, 1, 'verzaehlt').w));
    assert.equal(c.filter((x) => x.line === 0).length, 0, 'Zerlegung hat kein Ergebnis');
  });
  test('Hilfsaufgabe: falsches Rechenzeichen beim Ausgleichen', () => {
    const v = find(FE.candidates(FE.lines(hilfs()), 'hilfsaufgabe'), 2, 'vorzeichen');
    assert.equal(v.w, 88);
  });
  test('Mal: Null vergessen, Einmaleins-Fehler, Einer vergessen', () => {
    const c = FE.candidates(FE.lines(mal()), 'zerlegen');
    assert.equal(find(c, 1, 'null').w, 8);
    assert.ok([16, 8, 15, 9].includes(find(c, 2, 'einmaleins').w));
    assert.equal(find(c, 3, 'einer').w, 90);
  });
  test('Geteilt: Null vergessen; Zeilen mit Rest bleiben richtig', () => {
    const c = FE.candidates(FE.lines(geteilt()), 'zerlegen');
    assert.equal(find(c, 1, 'null').w, 1);
    assert.equal(c.filter((x) => x.line === 2).length, 0);
  });
});

describe('Aufgabe: Fehler finden und verbessern', () => {
  test('Fehler in der letzten Zeile: wählen, dann verbessern (= Ergebnis)', () => {
    const base = schritt();
    const t = FE.build(base, find(FE.candidates(FE.lines(base), 'schrittweise'), 2, 'uebertrag'), { rnd: seeded(1) });
    assert.equal(t.layout, 'fehler');
    assert.equal(t.rows.length, 2);
    const c = fields(t.rows[0])[0];
    assert.deepEqual(c.options, ['38 = 30 + 8', '47 + 30 = 77', '77 + 8 = 75']);
    assert.equal(c.answer, 2);
    assert.equal(c.check(1), false);
    assert.equal(text(t.rows[1]), '77 + 8 = [85]');
    assert.equal(fields(t.rows[1])[0].id, 'res');
    assert.match(t.rows[0].advice({ zeile: 2 }), /Zeile 3/);
    const vals = solve(t);
    assert.equal(Check.isSolved(t, vals), true);
    // die falsche Zahl wird beim Verbessern nicht angenommen
    assert.equal(Check.checkRow(t.rows[1], { res: '75' }, vals).correct, false);
  });

  test('Fehler weiter oben: Folgezeilen rechnen mit der falschen Zahl weiter, am Ende das richtige Ergebnis', () => {
    const base = schritt();
    const cand = Object.assign({}, find(FE.candidates(FE.lines(base), 'schrittweise'), 1, 'verzaehlt'), { w: 67 });
    const t = FE.build(base, cand, { rnd: seeded(2) });
    assert.deepEqual(fields(t.rows[0])[0].options, ['38 = 30 + 8', '47 + 30 = 67', '67 + 8 = 75']);
    assert.equal(text(t.rows[1]), '47 + 30 = [77]');
    assert.equal(text(t.rows[2]), '47 + 38 = [85]');
    solve(t);
  });

  test('falsches Rechenzeichen: verbessert wird mit dem richtigen Zeichen', () => {
    const base = hilfs();
    const t = FE.build(base, find(FE.candidates(FE.lines(base), 'hilfsaufgabe'), 2, 'vorzeichen'), { rnd: seeded(3) });
    assert.deepEqual(fields(t.rows[0])[0].options, ['39 = 40 − 1', '47 + 40 = 87', '87 + 1 = 88']);
    assert.equal(text(t.rows[1]), '87 − 1 = [86]');
    solve(t);
  });

  test('Geteilt mit Rest: Ergebnis-Zeile mit Rest', () => {
    const base = geteilt();
    const t = FE.build(base, find(FE.candidates(FE.lines(base), 'zerlegen'), 1, 'null'), { rnd: seeded(4) });
    assert.deepEqual(fields(t.rows[0])[0].options.slice(1), ['60 : 6 = 1', '27 : 6 = 4 R 3', '1 + 4 = 5 R 3']);
    assert.equal(text(t.rows[2]), '87 : 6 = [14] R 3');
    solve(t);
  });
});

describe('Zufällige Fehler-Aufgaben aus echten Rechenwegen', () => {
  for (const op of Tasks.OPS) {
    test(`${op}: genau eine Zeile ist falsch, Musterlösung geht, falsche Wahl nicht`, () => {
      const rnd = seeded(op.charCodeAt(0));
      const types = new Set(), bases = new Set();
      for (let i = 0; i < 400; i++) {
        const t = FE.gen({ max: 100, rnd, rest: i % 2 === 0 }, op);
        types.add(t.mistake);
        bases.add(t.base);
        const c = fields(t.rows[0])[0];
        const shown = t.shown;
        assert.equal(shown.length, c.options.length);
        shown.forEach((items) => items.forEach((x) => { if (x.num) assert.ok(x.v >= 0 && x.v <= 100, FE.text(items)); }));
        shown.forEach((items, k) => {
          if (k === c.answer) {
            if (t.mistake === 'vorzeichen') assert.ok(FE.lineOk(items));
            else assert.equal(FE.lineOk(items), false, FE.text(items));
          } else assert.ok(FE.lineOk(items), 'Zeile ' + k + ' sollte stimmen: ' + FE.text(items));
        });
        c.options.forEach((o, k) => { if (k !== c.answer) assert.equal(c.check(k), false); });
        // Einmaleins-Fehler nur bei echten Einmaleins-Aufgaben (nicht mit 1)
        if (t.mistake === 'einmaleins') assert.ok(shown[c.answer][0].v > 1 && shown[c.answer][2].v > 1, FE.text(shown[c.answer]));
        t.rows.forEach((r) => assert.doesNotMatch(r.hint + r.label, /undefined|NaN/));
        assert.doesNotMatch(t.rows[0].advice({ zeile: c.answer }), /undefined|NaN/);
        const vals = solve(t);
        assert.equal(vals.res, t.answer);
      }
      const want = { '+': ['uebertrag', 'verzaehlt', 'vorzeichen'], '−': ['uebertrag', 'verzaehlt', 'vorzeichen'], '·': ['null', 'einmaleins', 'einer'], ':': ['null', 'einmaleins'] }[op];
      for (const w of want) assert.ok(types.has(w), op + ': Fehlerart ' + w + ' kommt vor (' + [...types] + ')');
      assert.ok(bases.size >= Math.min(2, Tasks.STRATEGIES[op].filter((s) => s.group === 'weg').length));
    });
  }
});

describe('Fehler finden ist angemeldet', () => {
  test('bei allen Rechenarten in der Gruppe Knobeln', () => {
    for (const op of Tasks.OPS) {
      const s = Tasks.STRATEGIES[op].find((x) => x.key === 'fehler');
      assert.equal(s.group, 'knobeln');
      const t = Tasks.generate({ op, strategy: 'fehler', max: 100 });
      assert.ok(t.intro);
      assert.notEqual(t.base, 'fehler');
      solve(t);
    }
  });
});
