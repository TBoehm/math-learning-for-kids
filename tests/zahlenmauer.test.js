// Knobeln: Zahlenmauern (js/formats/zahlenmauer.js) – Plusmauern und Minusmauern.
'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const Tasks = require('../js/tasks.js');
const Check = require('../js/check.js');
const ZM = require('../js/formats/zahlenmauer.js');
const { seeded, solve, fields } = require('./knobel-helpers.js');

const allBricks = (task) => [].concat(...task.wall.levels);
const inputBrick = (task, id) => allBricks(task).find((b) => b.id === id);

// jeder Stein ist die Summe der beiden Steine darunter
function assertWall(levels) {
  for (let k = 1; k < levels.length; k++) {
    assert.equal(levels[k].length, levels[k - 1].length - 1);
    levels[k].forEach((b, j) => assert.equal(b.v, levels[k - 1][j].v + levels[k - 1][j + 1].v));
  }
}

describe('Zahlenmauer: Bausteine', () => {
  test('Mauer aus der unteren Reihe bauen', () => {
    assert.deepEqual(ZM.build([3, 5, 2]), [[3, 5, 2], [8, 7], [15]]);
    assert.deepEqual(ZM.build([1, 2, 3, 4]), [[1, 2, 3, 4], [3, 5, 7], [8, 12], [20]]);
  });

  test('Lösungsweg finden: Minusmauer mit Spitze, Stein in der Mitte und unten links', () => {
    const levels = ZM.build([10, 12, 16]);
    const given = [[true, false, false], [true, false], [true]];
    const steps = ZM.deduce(levels, given);
    assert.deepEqual(steps.map((s) => [s.k, s.j, s.kind]), [[1, 1, 'sub'], [0, 1, 'sub'], [0, 2, 'sub']]);
  });

  test('nicht lösbar (nur mit Gleichungen) -> null', () => {
    const levels = ZM.build([10, 12, 16]);
    // Spitze und die beiden äußeren unteren Steine: 50 = 10 + 2x + 16 – das geht nicht Schritt für Schritt
    assert.equal(ZM.deduce(levels, [[true, false, true], [false, false], [true]]), null);
  });
});

describe('Plusmauer (untere Reihe gegeben, nach oben rechnen)', () => {
  test('feste Mauer: Reihe für Reihe nach oben, Spitze ist das Ergebnis', () => {
    const t = ZM.plusTask([12, 25, 31]);
    assert.equal(t.layout, 'wall');
    assert.equal(t.title, 'Zahlenmauer');
    assert.equal(t.answer, 93);
    assert.equal(t.rows.length, 2);
    assert.deepEqual(fields(t.rows[0]).map((f) => f.answer), [37, 56]);
    assert.deepEqual(fields(t.rows[1]).map((f) => f.id), ['res']);
    assert.match(t.rows[0].hint, /12 \+ 25/);
    const vals = solve(t);
    assert.equal(Check.isSolved(t, vals), true);
  });

  test('falsche Steine werden abgelehnt', () => {
    const t = ZM.plusTask([12, 25, 31]);
    const ids = fields(t.rows[0]).map((f) => f.id);
    const r = Check.checkRow(t.rows[0], { [ids[0]]: '37', [ids[1]]: '55' }, {});
    assert.deepEqual(r.fields.map((f) => f.status), ['correct', 'wrong']);
  });

  test('Prüfung nimmt die Steine, die das Kind darunter eingetragen hat', () => {
    const t = ZM.plusTask([12, 25, 31]);
    const ids = fields(t.rows[0]).map((f) => f.id);
    const top = fields(t.rows[1])[0];
    assert.equal(top.check(93, { [ids[0]]: 37, [ids[1]]: 56 }), true);
    assert.equal(top.expected({ [ids[0]]: 37, [ids[1]]: 56 }), 93);
  });

  for (const max of [100, 1000]) {
    for (const level of ['hilfe', 'zerlegen', 'selbst']) {
      test(`zufällige Mauern bis ${max}, Stufe ${level}: stimmen, bleiben im Zahlenraum, lassen sich lösen`, () => {
        const rnd = seeded(max + level.length);
        for (let i = 0; i < 300; i++) {
          const t = ZM.plus({ max, level, rnd });
          const n = t.wall.levels.length;
          assert.equal(n, level === 'hilfe' ? 3 : 4);
          assertWall(t.wall.levels);
          assert.ok(t.wall.levels[0].every((b) => b.given), 'untere Reihe gegeben');
          assert.ok(t.wall.levels.slice(1).every((l) => l.every((b) => !b.given)), 'Rest wird gerechnet');
          const top = t.wall.levels[n - 1][0].v;
          assert.equal(t.answer, top);
          assert.ok(top <= max && top >= max * 0.3, 'Spitze ' + top);
          assert.ok(allBricks(t).every((b) => b.v >= 1));
          solve(t);
        }
      });
    }
  }
});

describe('Minusmauer (Spitze und einige Steine gegeben)', () => {
  test('feste Mauer: jeder Schritt ist eine Minusaufgabe, Hinweise passen', () => {
    const t = ZM.minusTask([10, 12, 16], [[true, false, false], [true, false], [true]]);
    assert.equal(t.rows.length, 3);
    assert.deepEqual(t.rows.map((r) => fields(r)[0].answer), [28, 12, 16]);
    assert.match(t.rows[0].hint, /50 − 22/);
    assert.equal(fields(t.rows[2])[0].id, 'res');
    assert.equal(t.answer, 16);
    solve(t);
  });

  test('Prüfung nimmt die Steine, die das Kind vorher eingetragen hat', () => {
    const t = ZM.minusTask([10, 12, 16], [[true, false, false], [true, false], [true]]);
    const first = fields(t.rows[0])[0].id;
    const last = fields(t.rows[2])[0];
    // 16 = 28 − 12: hängt von den Steinen aus Zeile 1 und 2 ab
    assert.equal(last.expected({ [first]: 28, [fields(t.rows[1])[0].id]: 12 }), 16);
  });

  for (const max of [100, 1000]) {
    for (const level of ['hilfe', 'selbst']) {
      test(`zufällige Minusmauern bis ${max}, Stufe ${level}`, () => {
        const rnd = seeded(7 * max + level.length);
        for (let i = 0; i < 300; i++) {
          const t = ZM.minus({ max, level, rnd });
          const n = t.wall.levels.length;
          assertWall(t.wall.levels);
          assert.ok(t.wall.levels[n - 1][0].given, 'Spitze gegeben');
          assert.equal(allBricks(t).filter((b) => b.given).length, n, 'genau so viele Steine wie unten gegeben');
          assert.ok(t.wall.levels[n - 1][0].v <= max);
          assert.ok(allBricks(t).every((b) => b.v >= 1));
          assert.ok(t.rows.every((r) => fields(r).length === 1), 'ein Stein pro Schritt');
          assert.ok(t.steps.some((s) => s.kind === 'sub'), 'mindestens eine Minusaufgabe');
          // jede Zahl in den Hinweisen ist definiert
          t.rows.forEach((r) => assert.doesNotMatch(r.hint + r.label, /undefined|NaN/));
          solve(t);
        }
      });
    }
  }
});

describe('Zahlenmauer für die Darstellung', () => {
  test('jeder eingetragene Stein gehört zu genau einer Zeile, alle Steine einer Zeile liegen in einer Reihe', () => {
    const rnd = seeded(42);
    for (let i = 0; i < 200; i++) {
      const t = i % 2 ? ZM.plus({ max: 1000, level: 'selbst', rnd }) : ZM.minus({ max: 100, level: 'selbst', rnd });
      t.rows.forEach((row, r) => {
        const ks = fields(row).map((f) => inputBrick(t, f.id));
        assert.ok(ks.every((b) => b && b.row === r));
        assert.equal(new Set(ks.map((b) => b.k)).size, 1);
      });
      allBricks(t).filter((b) => !b.given).forEach((b) => assert.ok(fields(t.rows[b.row]).some((f) => f.id === b.id)));
    }
  });
});

describe('Zahlenmauer ist angemeldet', () => {
  test('bei Plus und Minus in der Gruppe Knobeln, mit Zahlenraum', () => {
    for (const op of ['+', '−']) {
      const s = Tasks.STRATEGIES[op].find((x) => x.key === 'zahlenmauer');
      assert.equal(s.group, 'knobeln');
      const t = Tasks.generate({ op, strategy: 'zahlenmauer', max: 1000, level: 'selbst' });
      assert.equal(t.layout, 'wall');
      assert.equal(t.strategyName, s.name);
      assert.ok(t.intro && !/undefined/.test(t.intro));
      solve(t);
    }
  });
});
