// Knobeln: Überschlagen (js/formats/ueberschlag.js) – erst grob, dann genau, dann vergleichen.
'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const Tasks = require('../js/tasks.js');
const Check = require('../js/check.js');
const UI = require('../js/ui-logic.js');
const UE = require('../js/formats/ueberschlag.js');
const { seeded, solve, fields } = require('./knobel-helpers.js');

const ids = (row) => fields(row).map((f) => f.id);
const status = (row, values, vals) => {
  const raw = {};
  ids(row).forEach((id, k) => { raw[id] = values[k] === undefined ? '' : String(values[k]); });
  return Check.checkRow(row, raw, vals || {}).fields.map((f) => f.status);
};

describe('Runden', () => {
  test('auf Zehner und Hunderter, ab 5 aufrunden', () => {
    assert.equal(UE.round(328, 10), 330);
    assert.equal(UE.round(325, 10), 330);
    assert.equal(UE.round(324, 10), 320);
    assert.equal(UE.round(350, 100), 400);
    assert.equal(UE.round(349, 100), 300);
    assert.equal(UE.round(47, 10), 50);
  });
});

describe('Überschlag-Zeile', () => {
  const t = UE.build(328, '+', 249, { max: 1000, rnd: seeded(1) });
  const ue = t.rows[0];
  test('Musterlösung: auf Zehner gerundet', () => {
    assert.equal(ue.label, 'Überschlag');
    assert.deepEqual(fields(ue).map((f) => f.answer), [330, 250, 580]);
    assert.deepEqual(status(ue, [330, 250, 580]), ['correct', 'correct', 'correct']);
  });
  test('beide auf Hunderter ist auch richtig', () => {
    assert.deepEqual(status(ue, [300, 200, 500]), ['correct', 'correct', 'correct']);
  });
  test('gemischt gerundet, falsch gerundet oder falsch gerechnet wird abgelehnt', () => {
    assert.deepEqual(status(ue, [330, 200, 530]), ['correct', 'wrong', 'pending']);
    assert.deepEqual(status(ue, [320, 250, 570]), ['wrong', 'pending', 'pending']);
    assert.deepEqual(status(ue, [330, 250, 570]), ['correct', 'correct', 'wrong']);
  });
  test('erlaubte Rundungen: Hunderter nur bis 1000 und nur bei dreistelligen Zahlen', () => {
    assert.deepEqual(UE.units(328, '+', 249, 1000), [10, 100]);
    assert.deepEqual(UE.units(47, '+', 38, 100), [10]);
    assert.deepEqual(UE.units(7, '·', 48, 1000), [10]);
    assert.deepEqual(UE.units(6, '·', 148, 1000), [10, 100]);
  });
  test('bis 100 nur auf Zehner', () => {
    const small = UE.build(47, '+', 38, { max: 100, rnd: seeded(2) }).rows[0];
    assert.deepEqual(status(small, [50, 40, 90]), ['correct', 'correct', 'correct']);
    assert.deepEqual(status(small, [0, 0, 0]), ['wrong', 'pending', 'pending']);
  });
  test('Minus: 702 − 398 ≈ 700 − 400', () => {
    const m = UE.build(702, '−', 398, { max: 1000, rnd: seeded(3) }).rows[0];
    assert.deepEqual(status(m, [700, 400, 300]), ['correct', 'correct', 'correct']);
  });
  test('Mal: nur die große Zahl wird gerundet', () => {
    const m = UE.build(7, '·', 48, { max: 1000, rnd: seeded(4) }).rows[0];
    assert.deepEqual(fields(m).map((f) => f.answer), [50, 350]);
    assert.deepEqual(status(m, [50, 350]), ['correct', 'correct']);
    assert.deepEqual(status(m, [40, 280]), ['wrong', 'pending']);
  });
});

describe('Genau rechnen und vergleichen', () => {
  test('eigenes Ergebnis: genau rechnen, dann "Passt dein Ergebnis zum Überschlag?" – ja', () => {
    const t = UE.build(328, '+', 249, { max: 1000, rnd: seeded(5), variant: 'selbst' });
    assert.equal(t.rows.length, 3);
    assert.deepEqual(fields(t.rows[1]).map((f) => [f.id, f.answer]), [['res', 577]]);
    const c = fields(t.rows[2])[0];
    assert.equal(c.t, 'choice');
    assert.match(t.rows[2].label, /Passt dein Ergebnis zum Überschlag/);
    assert.equal(c.options[c.answer], 'ja');
    const vals = solve(t);
    assert.equal(Check.isSolved(t, vals), true);
  });

  test('fremdes Ergebnis: weit weg vom Überschlag -> passt nicht', () => {
    const t = UE.build(328, '+', 249, { max: 1000, rnd: seeded(6), variant: 'fremd', other: 777 });
    const c = fields(t.rows[1])[0];
    assert.equal(c.options[c.answer], 'nein');
    assert.ok(t.rows[1].tokens.some((tok) => tok.t === 'num' && tok.v === 777));
    assert.deepEqual(fields(t.rows[2]).map((f) => f.id), ['res']);
    solve(t);
  });

  test('fremdes Ergebnis: das richtige -> passt', () => {
    const t = UE.build(328, '+', 249, { max: 1000, rnd: seeded(7), variant: 'fremd', other: 577 });
    const c = fields(t.rows[1])[0];
    assert.equal(c.options[c.answer], 'ja');
    assert.equal(c.check(1), false);
  });
});

describe('Zufällige Überschlag-Aufgaben', () => {
  for (const op of ['+', '−', '·']) {
    for (const max of [100, 1000]) {
      test(`${op} bis ${max}: im Zahlenraum, Musterlösung und Hunderter-Überschlag werden angenommen`, () => {
        const rnd = seeded(op.charCodeAt(0) + max);
        for (let i = 0; i < 400; i++) {
          const t = UE.gen({ max, rnd }, op);
          assert.equal(t.op, op);
          assert.ok(t.answer >= 0 && t.answer <= max, op + ' ' + t.a + ' ' + t.b);
          if (op !== '·') assert.ok(t.a % 10 && t.b % 10, 'Zahlen sind nicht schon rund');
          if (max === 1000 && op !== '·') assert.ok(t.a >= 100 && t.b >= 100);
          solve(t);
          // auch mit Hunderter-Überschlag (wo es den gibt) lösbar
          if (max === 1000 && (op !== '·' || t.b >= 100)) {
            solve(UE.build(t.a, op, t.b, { max, rnd: seeded(i), variant: t.variant, other: t.other }), (row, k) => {
              if (k !== 0) return null;
              const [x, y] = op === '·' ? [t.a, UE.round(t.b, 100)] : [UE.round(t.a, 100), UE.round(t.b, 100)];
              const res = op === '+' ? x + y : op === '−' ? x - y : x * y;
              return op === '·' ? { rb: y, rs: res } : { ra: x, rb: y, rs: res };
            });
          }
          // fremdes Ergebnis "passt nicht": weit weg von jedem erlaubten Überschlag
          if (t.variant === 'fremd' && t.other !== t.answer) {
            for (const u of UE.units(t.a, op, t.b, max)) {
              const ue = UE.estimate(t.a, op, t.b, u);
              assert.ok(Math.abs(t.other - ue) >= 2 * Math.abs(t.answer - ue) + u, `${t.a} ${op} ${t.b}: ${t.other} vs Ü ${ue}`);
            }
            assert.ok(t.other >= 0 && t.other <= max);
          }
          t.rows.forEach((r) => assert.doesNotMatch(r.hint + r.label, /undefined|NaN/));
          // vor der Ja/Nein-Frage stellt der Begleiter die Frage selbst (kein "Weiter: …?.")
          t.rows.forEach((r, k) => {
            const next = t.rows[k + 1];
            if (next && next.tokens.some((x) => x.t === 'choice')) assert.match(UI.rowDoneText(r, next, {}), /Überschlag\?$/);
          });
        }
      });
    }
  }
});

describe('Überschlagen ist angemeldet', () => {
  test('bei Plus, Minus und Mal in der Gruppe Knobeln', () => {
    for (const op of ['+', '−', '·']) {
      const s = Tasks.STRATEGIES[op].find((x) => x.key === 'ueberschlag');
      assert.equal(s.group, 'knobeln');
      const t = Tasks.generate({ op, strategy: 'ueberschlag', max: 1000 });
      assert.ok(t.intro);
      solve(t);
    }
  });
});
