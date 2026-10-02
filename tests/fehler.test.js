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
const row = (tokens, label = '') => ({ tokens, label, hint: '' });

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
// 72 : 6 zerlegen, danach die Probe als Malaufgabe
const mitProbe = () => ({
  op: ':', strategy: 'zerlegen', a: 72, b: 6, answer: 12, rows: [
    row([N(60), T(':'), N(6), T('='), I('q1', 10)]),
    row([N(12), T(':'), N(6), T('='), I('q2', 2)]),
    row([N(72), T(':'), N(6), T('='), I('res', 12)]),
    row([R('res'), T('·'), N(6), T('='), I('pD', 72)], 'Probe')
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
  test('Punkt vor Strich: 8 · 7 = 10 · 7 − 2 · 7 stimmt', () => {
    const line = (xs) => xs.map((v) => (typeof v === 'number' ? { v, num: true } : { v }));
    assert.ok(FE.lineOk(line([8, '·', 7, '=', 10, '·', 7, '−', 2, '·', 7])));
    assert.ok(FE.lineOk(line([4, '·', 23, '=', 4, '·', 20, '+', 4, '·', 3])));
    assert.equal(FE.lineOk(line([8, '·', 7, '=', 10, '·', 7, '−', 3, '·', 7])), false);
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
  test('Vereinfachen: in die falsche Richtung verändert', () => {
    const plus = { op: '+', strategy: 'vereinfachen', a: 169, b: 77, answer: 246, rows: [
      row([N(169), T('+'), N(77), T('='), N(170), T('+'), I('vy', 76)]),
      row([N(170), T('+'), N(76), T('='), I('res', 246)])
    ] };
    assert.equal(find(FE.mistakes(plus), 0, 'abgeben').w, 78);
    const minus = { op: '−', strategy: 'vereinfachen', a: 697, b: 669, answer: 28, rows: [
      row([N(697), T('−'), N(669), T('='), I('vx', 698), T('−'), N(670)]),
      row([N(698), T('−'), N(670), T('='), I('res', 28)])
    ] };
    assert.equal(find(FE.mistakes(minus), 0, 'abgeben').w, 696);
    const t = FE.build(minus, find(FE.mistakes(minus), 0, 'abgeben'), { rnd: seeded(6) });
    // die nächste Zeile rechnet mit den falsch veränderten Zahlen weiter
    assert.deepEqual(fields(t.rows[0])[0].options, ['697 − 669 = 696 − 670', '696 − 670 = 26']);
    assert.equal(text(t.rows[1]), '697 − 669 = [698] − 670');
    assert.match(t.rows[1].hint, /beide/);
    solve(t);
  });
  test('verzählt heißt nicht: gar nicht gerechnet (190 + 100 = 190)', () => {
    const t = { op: '+', strategy: 'schrittweise', a: 190, b: 190, answer: 380, rows: [
      row([N(190), T('+'), N(100), T('='), I('s1', 290)]),
      row([R('s1'), T('+'), N(90), T('='), I('res', 380)])
    ] };
    assert.deepEqual(FE.candidates(FE.lines(t)).filter((c) => c.line === 0).map((c) => c.w), [390]);
  });
  test('Mal: Null vergessen, Einmaleins-Fehler, Einer vergessen', () => {
    const c = FE.candidates(FE.lines(mal()), 'zerlegen');
    assert.equal(find(c, 1, 'null').w, 8);
    assert.ok([16, 8, 15, 9].includes(find(c, 2, 'einmaleins').w));
    assert.equal(find(c, 3, 'einer').w, 90);
  });
  test('Geteilt: Null vergessen; mit Rest: falsch geteilt, der Rest bleibt', () => {
    const c = FE.candidates(FE.lines(geteilt()), 'zerlegen');
    assert.equal(find(c, 1, 'null').w, 1);
    assert.ok([3, 5].includes(find(c, 2, 'einmaleins').w));
  });
});

const OPS_SYM = ['+', '−', '·', ':'];
const opsIn = (items) => items.filter((x) => !x.num && OPS_SYM.includes(x.v)).map((x) => x.v);

describe('Nur Aufgaben der gewählten Rechenart', () => {
  test('Mal: Zerlegung und Zusammenrechnen fallen weg, unten steht die ganze Aufgabe', () => {
    const p = FE.pure(mal());
    assert.deepEqual(FE.lines(p).map(FE.text), ['4 · 20 = 80', '4 · 3 = 12', '4 · 23 = 92']);
    assert.ok(FE.lines(p).every(FE.lineOk));
  });
  test('Geteilt: keine Plus- und keine Malaufgabe, die Ergebniszeile mit Rest bleibt', () => {
    const p = FE.pure(mitProbe());
    assert.deepEqual(FE.lines(p).map(FE.text), ['60 : 6 = 10', '12 : 6 = 2', '72 : 6 = 12']);
    assert.deepEqual(FE.lines(FE.pure(geteilt())).map(FE.text), ['60 : 6 = 10', '27 : 6 = 4 R 3', '87 : 6 = 14 R 3']);
  });
  test('Plus mit Hilfsaufgabe braucht Minus – solche Wege kommen nicht dran', () => {
    // sonst: 23 + 20 = 43, 43 + 2 = 45 „falsches Rechenzeichen“ – ohne die Aufgabe 23 + 18 nicht zu finden
    assert.equal(FE.pure(hilfs()), null);
    assert.equal(FE.pure(Object.assign(hilfs(), { rows: hilfs().rows.slice(1) })), null);
    assert.deepEqual(FE.lines(FE.pure(schritt())).map(FE.text), ['38 = 30 + 8', '47 + 30 = 77', '77 + 8 = 85']);
  });
  test('auch Zeilen mit Rest und die Ergebniszeile können falsch sein', () => {
    const c = FE.mistakes(FE.pure(geteilt()));
    assert.ok([3, 5].includes(find(c, 1, 'einmaleins').w));
    assert.ok([13, 15].includes(find(c, 2, 'ergebnis').w));
    assert.ok([82, 102].includes(find(FE.mistakes(FE.pure(mal())), 2, 'ergebnis').w));
    // die Einmaleins-Fehler gibt es nur beim kleinen Einmaleins
    assert.equal(FE.mistakes(FE.pure(mal())).filter((x) => x.line === 2 && x.type === 'einmaleins').length, 0);
  });
  for (const op of Tasks.OPS) {
    test(`${op}: nur ${op}-Aufgaben, die falsche Zeile steht an zufälliger Stelle`, () => {
      const rnd = seeded(op.charCodeAt(0) + 7);
      const pos = {};
      for (let i = 0; i < 800; i++) {
        const cfg = (i % 2 ? 100 : 1000) + (i % 4 < 2 ? '' : ' Rest');
        const t = FE.gen({ max: i % 2 ? 100 : 1000, rnd, rest: i % 4 >= 2 }, op);
        t.shown.forEach((items) => opsIn(items).forEach((o) => assert.equal(o, op, FE.text(items))));
        const n = t.shown.length, k = fields(t.rows[0])[0].answer;
        const key = cfg + ', ' + n + ' Zeilen';
        pos[key] = pos[key] || { n: 0, at: new Array(n).fill(0) };
        pos[key].n++; pos[key].at[k]++;
      }
      for (const [key, p] of Object.entries(pos)) {
        if (p.n < 40) continue;
        // nicht fast immer die letzte Zeile, und die Stelle wechselt
        assert.ok(p.at[p.at.length - 1] <= p.n * 0.75, key + ': ' + p.at);
        assert.ok(p.at.filter((c) => c > 0).length >= 2, key + ': ' + p.at);
        // bei Mal und Geteilt kann jede Zeile die falsche sein, ungefähr gleich oft
        if (op === '·' || op === ':') p.at.forEach((c, k) => assert.ok(c >= p.n / p.at.length * 0.5, key + ', Zeile ' + (k + 1) + ': ' + p.at));
      }
    });
  }
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

  test('Fehler weiter oben: nur die falsche Zeile wird verbessert – keine zweite Aufgabe dazu', () => {
    const base = schritt();
    const cand = Object.assign({}, find(FE.candidates(FE.lines(base), 'schrittweise'), 1, 'verzaehlt'), { w: 67 });
    const t = FE.build(base, cand, { rnd: seeded(2) });
    assert.deepEqual(fields(t.rows[0])[0].options, ['38 = 30 + 8', '47 + 30 = 67', '67 + 8 = 75']);
    assert.equal(t.rows.length, 2);
    assert.equal(text(t.rows[1]), '47 + 30 = [77]');
    // oben steht keine Rechenaufgabe (47 + 38 = ?), nur ein Titel; fertig ist die Aufgabe mit der verbesserten Zeile
    assert.equal(t.title, 'Wo steckt der Fehler?');
    assert.equal(t.answer, 77);
    assert.equal(Check.isSolved(t, solve(t)), true);
  });

  test('Geteilt mit Rest: auch hier nur die falsche Zeile', () => {
    const base = geteilt();
    const t = FE.build(base, find(FE.candidates(FE.lines(base), 'zerlegen'), 1, 'null'), { rnd: seeded(4) });
    assert.deepEqual(fields(t.rows[0])[0].options.slice(1), ['60 : 6 = 1', '27 : 6 = 4 R 3', '1 + 4 = 5 R 3']);
    assert.equal(t.rows.length, 2);
    assert.equal(text(t.rows[1]), '60 : 6 = [10]');
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
            assert.equal(FE.lineOk(items), false, FE.text(items));
          } else assert.ok(FE.lineOk(items), 'Zeile ' + k + ' sollte stimmen: ' + FE.text(items));
        });
        c.options.forEach((o, k) => { if (k !== c.answer) assert.equal(c.check(k), false); });
        // Einmaleins-Fehler nur bei echten Einmaleins-Aufgaben (nicht mit 1)
        if (t.mistake === 'einmaleins') assert.ok(shown[c.answer][0].v > 1 && shown[c.answer][2].v > 1, FE.text(shown[c.answer]));
        t.rows.forEach((r) => assert.doesNotMatch(r.hint + r.label, /undefined|NaN/));
        assert.doesNotMatch(t.rows[0].advice({ zeile: c.answer }), /undefined|NaN/);
        assert.equal(t.rows.length, 2, 'nur auswählen und verbessern');
        assert.equal(t.title, 'Wo steckt der Fehler?');
        const vals = solve(t);
        assert.equal(Check.isSolved(t, vals), true);
      }
      const want = { '+': ['uebertrag', 'verzaehlt'], '−': ['uebertrag', 'verzaehlt'], '·': ['null', 'einmaleins', 'ergebnis'], ':': ['null', 'einmaleins', 'ergebnis'] }[op];
      assert.ok(!types.has('vorzeichen'));
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
