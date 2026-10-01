// Knobeln: Welcher Weg passt? (js/formats/welcherweg.js) – geschickten Rechenweg wählen, dann damit rechnen.
'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const Tasks = require('../js/tasks.js');
const Check = require('../js/check.js');
const WW = require('../js/formats/welcherweg.js');
const UI = require('../js/ui-logic.js');
const { seeded, solve, fields, numbersOf } = require('./knobel-helpers.js');
const { play } = require('./helfer.js');

const LEVELS = ['hilfe', 'zerlegen', 'selbst'];

const ALL = { '+': ['stellenweise', 'schrittweise', 'hilfsaufgabe', 'vereinfachen'], '−': ['schrittweise', 'ergaenzen', 'hilfsaufgabe', 'vereinfachen'] };
const keysOf = (task, idx) => idx.map((k) => task.offered[k]);
const acceptedIdx = (task) => fields(task.rows[0])[0].options.map((o, k) => k).filter((k) => fields(task.rows[0])[0].check(k));

describe('Welcher Weg ist geschickt?', () => {
  const cases = [
    [328, '+', 99, 1000, ['hilfsaufgabe', 'vereinfachen'], 'hilfsaufgabe'],
    [239, '+', 41, 1000, ['vereinfachen', 'hilfsaufgabe'], 'vereinfachen'],
    [346, '+', 228, 1000, ['stellenweise', 'schrittweise'], 'schrittweise'],
    [702, '−', 698, 1000, ['ergaenzen', 'hilfsaufgabe', 'vereinfachen'], 'ergaenzen'],
    [523, '−', 198, 1000, ['hilfsaufgabe', 'vereinfachen'], 'hilfsaufgabe'],
    [674, '−', 231, 1000, ['schrittweise'], 'schrittweise'],
    [47, '+', 39, 100, ['hilfsaufgabe', 'vereinfachen'], 'hilfsaufgabe'],
    [81, '−', 77, 100, ['ergaenzen'], 'ergaenzen']
  ];
  for (const [a, op, b, max, accepted, canonical] of cases) {
    test(`${a} ${op} ${b}: ${accepted.join(', ')}`, () => {
      const c = WW.classify(a, op, b, max, ALL[op]);
      assert.deepEqual(c.accepted.slice().sort(), accepted.slice().sort());
      assert.equal(c.canonical, canonical);
    });
  }
  test('nur Wege, die es gibt: ohne Vereinfachen bleibt die Hilfsaufgabe', () => {
    const c = WW.classify(239, '+', 41, 1000, ['stellenweise', 'schrittweise', 'hilfsaufgabe']);
    assert.deepEqual(c.accepted, ['hilfsaufgabe']);
    assert.equal(c.canonical, 'hilfsaufgabe');
  });
});

describe('Erst wählen, dann mit dem gewählten Weg rechnen – passend zur Stufe', () => {
  const text = (r) => r.tokens.map((x) => x.t === 'in' ? '[' + x.answer + ']' : x.t === 'ref' ? '(' + x.id + ')' : x.v).join(' ');
  const answers = (t) => t.rows.slice(1).map((r) => fields(r).map((f) => f.answer));
  const ww = (a, op, b, level) => WW.build(a, op, b, { max: a >= 100 ? 1000 : 100, offered: ALL[op], level });
  /** Weg k wählen, dann rows[i] als Eingaben (fehlend = erwartete Werte) */
  const path = (t, k, rows) => play(t, (row, i) => (i === 0 ? [k] : rows[i - 1] || null));

  test('328 + 99: Hilfsaufgabe wählen, dann 328 + 100 − 1', () => {
    const t = ww(328, '+', 99, 'hilfe');
    assert.equal(t.rows.length, 1);
    const c = fields(t.rows[0])[0];
    assert.equal(c.t, 'choice');
    assert.deepEqual(c.options, ['Stellenweise', 'Schrittweise', 'Hilfsaufgabe', 'Vereinfachen']);
    assert.match(t.rows[0].label, /Welcher Rechenweg ist hier besonders geschickt\?/);
    assert.equal(c.check(0), false);
    assert.equal(c.check(1), false);
    const vals = solve(t, (row, i) => (i === 0 ? { weg: '2' } : null));
    // Mit Hilfe: die Info-Zeile "99 = 100 − 1" fällt weg, die Tipps erklären die glatte Zahl
    assert.deepEqual(t.rows.slice(1).map(text), ['328 + 100 = [428]', '(s1) − 1 = [427]']);
    assert.match(t.rows[1].hint, /100/);
    assert.equal(vals.res, 427);
    assert.equal(Check.isSolved(t, vals), true);
  });

  test('328 + 99, Zerlegung selbst: die Hilfszahl trägt das Kind ein', () => {
    const t = ww(328, '+', 99, 'zerlegen');
    solve(t, (row, i) => (i === 0 ? { weg: '2' } : null));
    assert.deepEqual(t.rows.slice(1).map(text), ['328 + [100] = [428]', '(s1) − [1] = [427]']);
  });

  test('328 + 99, alles selbst: jede Zahl selbst, auch 330 + 99 − 2 ist richtig', () => {
    const t = ww(328, '+', 99, 'selbst');
    solve(t, (row, i) => (i === 0 ? { weg: '2' } : null));
    assert.deepEqual(t.rows.slice(1).map(text), ['[328] + [100] = [428]', '[428] − [1] = [427]']);
    assert.ok(path(ww(328, '+', 99, 'selbst'), 2, [[330, 99, 429], [429, 2, 427]]).ok);
    assert.ok(path(ww(328, '+', 99, 'selbst'), 2, [[99, 330, 429], [429, 2, 427]]).ok);
    // falsch ausgeglichen wird abgelehnt
    const r = path(ww(328, '+', 99, 'selbst'), 2, [[330, 99, 429], [429, 1, 428]]);
    assert.equal(r.ok, false);
    assert.equal(r.row, 2);
  });

  test('328 + 99 mit Vereinfachen: 327 + 100', () => {
    const t = ww(328, '+', 99, 'hilfe');
    solve(t, (row, i) => (i === 0 ? { weg: '3' } : null));
    assert.deepEqual(t.rows.slice(1).map(text), ['328 + 99 = [327] + 100', '327 + 100 = [427]']);
    // alles selbst: auch 330 + 97 ist richtig
    assert.ok(path(ww(328, '+', 99, 'selbst'), 3, [[330, 97, 427]]).ok);
  });

  test('239 + 41: bei der Hilfsaufgabe wird 239 glatt', () => {
    const t = ww(239, '+', 41, 'hilfe');
    solve(t, (row, i) => (i === 0 ? { weg: String(t.offered.indexOf('hilfsaufgabe')) } : null));
    assert.deepEqual(t.rows.slice(1).map(text), ['240 + 41 = [281]', '(s1) − 1 = [280]']);
    const v = ww(239, '+', 41, 'hilfe');
    solve(v, (row, i) => (i === 0 ? { weg: String(v.offered.indexOf('vereinfachen')) } : null));
    assert.deepEqual(v.rows.slice(1).map(text), ['239 + 41 = 240 + [40]', '240 + 40 = [280]']);
  });

  test('702 − 698 ergänzen: Sprünge, zusammen, Probe', () => {
    const t = ww(702, '−', 698, 'hilfe');
    solve(t, (row, i) => (i === 0 ? { weg: '1' } : null));
    assert.deepEqual(answers(t), [[2], [2], [4], [702]]);
    assert.match(t.rows[1].hint, /698/);
  });

  test('702 − 698 ergänzen, alles selbst: ein großer Sprung oder zwei kleine mit Probe', () => {
    const one = path(ww(702, '−', 698, 'selbst'), 1, [[698, 4, 702], [702, 698, 4]]);
    assert.ok(one.ok);
    assert.equal(one.vals.res, 4);
    const t = ww(702, '−', 698, 'selbst');
    const two = path(t, 1, [[698, 2, 700], [700, 2, 702], [2, 2, 4], [698, 4, 702]]);
    assert.ok(two.ok);
    assert.equal(two.vals.pa, 702, 'nach dem Zusammenrechnen kommt die Probe');
    assert.equal(t.rows[t.rows.length - 1].label, 'Probe');
  });

  test('346 + 228 stellenweise: Hunderter, Zehner, Einer, zusammen', () => {
    const t = ww(346, '+', 228, 'hilfe');
    solve(t, (row, i) => (i === 0 ? { weg: '0' } : null));
    assert.deepEqual(answers(t), [[500], [60], [14], [574]]);
  });

  test('346 + 228 stellenweise, alles selbst: Reihenfolge frei, danach heißt die Zeile wie die Stelle', () => {
    const t = ww(346, '+', 228, 'selbst');
    const names = [];
    const r = play(t, (row, i) => (i === 0 ? [0] : [[6, 8, 14], [20, 40, 60], [300, 200, 500], [500, 60, 14, 574]][i - 1]),
      (row, i, vals) => names.push(UI.doneLabel(row, vals)));
    assert.ok(r.ok);
    assert.deepEqual(names.slice(1), ['Einer', 'Zehner', 'Hunderter', 'Zusammen']);
  });

  test('346 + 228 schrittweise, alles selbst: mit 228 anfangen geht auch', () => {
    assert.ok(path(ww(346, '+', 228, 'selbst'), 1, [[228, 300, 528], [528, 40, 568], [568, 6, 574]]).ok);
    assert.ok(path(ww(346, '+', 228, 'selbst'), 1, [[346, 200, 546], [546, 28, 574]]).ok);
  });

  test('nach der Wahl gibt der Begleiter einen passenden Rat', () => {
    const t = ww(523, '−', 198, 'hilfe');
    const r = Check.checkRow(t.rows[0], { weg: '2' }, {});
    assert.match(t.rows[0].advice(r.vals), /198/);
  });

  test('die Zeilen kommen aus dem echten Rechenweg (Tasks.build), ohne Rechenstrich', () => {
    for (const level of LEVELS) {
      const t = ww(523, '−', 198, level);
      solve(t, (row, i) => (i === 0 ? { weg: '2' } : null));
      const ref = Tasks.build('−', 'hilfsaufgabe', 523, 198, { level, max: 1000 });
      assert.equal(text(t.rows[1]), text(ref.rows.find((r) => fields(r).length)), level);
      assert.equal(t.line, undefined);
      assert.equal(t.viz, undefined);
    }
  });

  for (const op of ['+', '−']) {
    for (const max of [100, 1000]) {
      for (const level of LEVELS) {
        test(`zufällige Aufgaben ${op} bis ${max}, Stufe ${level}: jeder sinnvolle Weg führt zum Ziel, alles im Zahlenraum`, () => {
          const rnd = seeded(op.charCodeAt(0) * 3 + max + level.length);
          const types = new Set();
          for (let i = 0; i < 120; i++) {
            const t = WW.gen({ max, rnd, offered: ALL[op], level }, op);
            types.add(t.canonical);
            const ok = acceptedIdx(t);
            assert.ok(ok.length >= 1);
            assert.ok(keysOf(t, ok).includes(t.canonical));
            assert.doesNotMatch(t.rows[0].hint, /undefined|NaN/);
            for (const k of ok) {
              assert.doesNotMatch(t.rows[0].advice({ weg: k }), /undefined|NaN/);
              const copy = WW.build(t.a, op, t.b, { max, offered: ALL[op], level });
              const vals = solve(copy, (row, j) => (j === 0 ? { weg: String(k) } : null));
              assert.equal(vals.res, op === '+' ? t.a + t.b : t.a - t.b);
              assert.ok(numbersOf(copy).every((n) => n >= 0 && n <= max), `${t.a} ${op} ${t.b} mit ${t.offered[k]}: ${numbersOf(copy)}`);
              copy.rows.forEach((r) => assert.doesNotMatch(r.hint + r.label, /undefined|NaN/));
              copy.rows.slice(1).forEach((r) => {
                assert.ok(fields(r).length > 0, 'keine Info-Zeile nach der Wahl');
                assert.ok(fields(r).every((f) => f.id !== 'weg'), 'Ids kollidieren nicht mit weg');
              });
            }
            // ein nicht sinnvoller Weg wird abgelehnt (wenn es einen gibt)
            const bad = t.offered.map((x, k) => k).filter((k) => !ok.includes(k));
            for (const k of bad) assert.equal(fields(t.rows[0])[0].check(k), false);
          }
          assert.deepEqual([...types].sort(), (op === '+' ? ['hilfsaufgabe', 'schrittweise', 'vereinfachen'] : ['ergaenzen', 'hilfsaufgabe', 'schrittweise']).sort());
        });
      }
    }
  }
});

describe('Welcher Weg ist angemeldet', () => {
  test('bei Plus und Minus in der Gruppe Knobeln; bietet nur vorhandene Rechenwege an', () => {
    for (const op of ['+', '−']) {
      const s = Tasks.STRATEGIES[op].find((x) => x.key === 'welcherweg');
      assert.equal(s.group, 'knobeln');
      for (const level of LEVELS) {
        const t = Tasks.generate({ op, strategy: 'welcherweg', max: 1000, level });
        assert.ok(t.intro);
        assert.equal(t.level, level);
        assert.ok(t.offered.every((k) => Tasks.STRATEGIES[op].some((x) => x.key === k && x.group === 'weg')));
        solve(t);
      }
    }
  });
  test('Vereinfachen ist ein eigener Rechenweg und wird bei Plus und Minus angeboten', () => {
    assert.ok(Tasks.STRATEGIES['+'].some((x) => x.key === 'vereinfachen' && x.group === 'weg'));
    assert.deepEqual(WW.offeredKeys('+'), ['stellenweise', 'schrittweise', 'hilfsaufgabe', 'vereinfachen']);
    assert.deepEqual(WW.offeredKeys('−'), ['schrittweise', 'ergaenzen', 'hilfsaufgabe', 'vereinfachen']);
  });
});
