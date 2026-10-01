// Knobeln: Welcher Weg passt? (js/formats/welcherweg.js) – geschickten Rechenweg wählen, dann damit rechnen.
'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const Tasks = require('../js/tasks.js');
const Check = require('../js/check.js');
const WW = require('../js/formats/welcherweg.js');
const { seeded, solve, fields, numbersOf } = require('./knobel-helpers.js');

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

describe('Erst wählen, dann mit dem gewählten Weg rechnen', () => {
  test('328 + 99: Hilfsaufgabe wählen, dann 328 + 100 − 1', () => {
    const t = WW.build(328, '+', 99, { max: 1000, offered: ALL['+'] });
    assert.equal(t.rows.length, 1);
    const c = fields(t.rows[0])[0];
    assert.equal(c.t, 'choice');
    assert.deepEqual(c.options, ['Stellenweise', 'Schrittweise', 'Hilfsaufgabe', 'Vereinfachen']);
    assert.match(t.rows[0].label, /Welcher Rechenweg ist hier besonders geschickt\?/);
    assert.equal(c.check(0), false);
    assert.equal(c.check(1), false);
    const vals = solve(t, (row, i) => (i === 0 ? { weg: '2' } : null));
    const text = (r) => r.tokens.map((x) => x.t === 'in' ? '[' + x.answer + ']' : x.t === 'ref' ? '(' + x.id + ')' : x.v).join(' ');
    assert.deepEqual(t.rows.slice(1).map(text), ['328 + 100 = [428]', '(s1) − 1 = [427]']);
    assert.equal(vals.res, 427);
    assert.equal(Check.isSolved(t, vals), true);
  });

  test('328 + 99 mit Vereinfachen: 327 + 100', () => {
    const t = WW.build(328, '+', 99, { max: 1000, offered: ALL['+'] });
    solve(t, (row, i) => (i === 0 ? { weg: '3' } : null));
    assert.deepEqual(t.rows.slice(1).map((r) => fields(r).map((f) => f.answer)), [[327], [100], [427]]);
  });

  test('702 − 698 ergänzen: 698 → 700 → 702', () => {
    const t = WW.build(702, '−', 698, { max: 1000, offered: ALL['−'] });
    solve(t, (row, i) => (i === 0 ? { weg: '1' } : null));
    assert.deepEqual(t.rows.slice(1).map((r) => fields(r).map((f) => f.answer)), [[2], [2], [4]]);
    assert.match(t.rows[1].hint, /698/);
  });

  test('346 + 228 stellenweise: Hunderter, Zehner, Einer, zusammen', () => {
    const t = WW.build(346, '+', 228, { max: 1000, offered: ALL['+'] });
    solve(t, (row, i) => (i === 0 ? { weg: '0' } : null));
    assert.deepEqual(t.rows.slice(1).map((r) => fields(r).map((f) => f.answer)), [[500], [60], [14], [574]]);
  });

  test('nach der Wahl gibt der Begleiter einen passenden Rat', () => {
    const t = WW.build(523, '−', 198, { max: 1000, offered: ALL['−'] });
    const r = Check.checkRow(t.rows[0], { weg: '2' }, {});
    assert.match(t.rows[0].advice(r.vals), /198/);
  });

  for (const op of ['+', '−']) {
    for (const max of [100, 1000]) {
      test(`zufällige Aufgaben ${op} bis ${max}: jeder sinnvolle Weg führt zum Ziel, alles im Zahlenraum`, () => {
        const rnd = seeded(op.charCodeAt(0) * 3 + max);
        const types = new Set();
        for (let i = 0; i < 300; i++) {
          const t = WW.gen({ max, rnd, offered: ALL[op] }, op);
          types.add(t.canonical);
          const ok = acceptedIdx(t);
          assert.ok(ok.length >= 1);
          assert.ok(keysOf(t, ok).includes(t.canonical));
          assert.doesNotMatch(t.rows[0].hint, /undefined|NaN/);
          for (const k of ok) {
            assert.doesNotMatch(t.rows[0].advice({ weg: k }), /undefined|NaN/);
            const copy = WW.build(t.a, op, t.b, { max, offered: ALL[op] });
            const vals = solve(copy, (row, j) => (j === 0 ? { weg: String(k) } : null));
            assert.equal(vals.res, op === '+' ? t.a + t.b : t.a - t.b);
            assert.ok(numbersOf(copy).every((n) => n >= 0 && n <= max), `${t.a} ${op} ${t.b} mit ${t.offered[k]}: ${numbersOf(copy)}`);
            copy.rows.forEach((r) => assert.doesNotMatch(r.hint + r.label, /undefined|NaN/));
          }
          // ein nicht sinnvoller Weg wird abgelehnt (wenn es einen gibt)
          const bad = t.offered.map((x, k) => k).filter((k) => !ok.includes(k));
          for (const k of bad) assert.equal(fields(t.rows[0])[0].check(k), false);
        }
        assert.deepEqual([...types].sort(), (op === '+' ? ['hilfsaufgabe', 'schrittweise', 'vereinfachen'] : ['ergaenzen', 'hilfsaufgabe', 'schrittweise']).sort());
      });
    }
  }
});

describe('Welcher Weg ist angemeldet', () => {
  test('bei Plus und Minus in der Gruppe Knobeln; bietet nur vorhandene Rechenwege an', () => {
    for (const op of ['+', '−']) {
      const s = Tasks.STRATEGIES[op].find((x) => x.key === 'welcherweg');
      assert.equal(s.group, 'knobeln');
      const t = Tasks.generate({ op, strategy: 'welcherweg', max: 1000 });
      assert.ok(t.intro);
      assert.ok(t.offered.every((k) => Tasks.STRATEGIES[op].some((x) => x.key === k && x.group === 'weg')));
      solve(t);
    }
  });
  test('Vereinfachen ist ein eigener Rechenweg und wird bei Plus und Minus angeboten', () => {
    assert.ok(Tasks.STRATEGIES['+'].some((x) => x.key === 'vereinfachen' && x.group === 'weg'));
    assert.deepEqual(WW.offeredKeys('+'), ['stellenweise', 'schrittweise', 'hilfsaufgabe', 'vereinfachen']);
    assert.deepEqual(WW.offeredKeys('−'), ['schrittweise', 'ergaenzen', 'hilfsaufgabe', 'vereinfachen']);
  });
});
