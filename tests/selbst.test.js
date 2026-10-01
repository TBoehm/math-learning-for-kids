// Stufe "Alles selbst": das Kind erkennt und schreibt jeden Zwischenschritt selbst.
'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const Tasks = require('../js/tasks.js');
const Check = require('../js/check.js');
const { fresh, play, expectedValues, opsOf } = require('./helfer.js');

const ALL = [];
for (const op of Tasks.OPS) for (const s of Tasks.STRATEGIES[op]) ALL.push([op, s.key]);
const gen = (op, strategy, extra) => Tasks.generate(Object.assign({ op, strategy, level: 'selbst' }, extra));
const inputs = (row) => row.tokens.filter((t) => t.t === 'in');
const opOf = (row) => opsOf(row)[0];

// Löst eine Aufgabe auf dem erwarteten Weg; tweak(row, werte, i, vals) darf die Eingaben verändern.
function solve(task, tweak) {
  const played = fresh(task);
  const r = play(played, (row, i, vals) => {
    const answers = expectedValues(row, vals);
    return tweak ? tweak(row, answers.slice(), i, vals) : answers;
  });
  assert.equal(r.ok, true, Tasks.taskText(task) + ' Zeile ' + r.row + ': ' + JSON.stringify(r.used));
  assert.equal(Check.isSolved(played, r.vals), true, Tasks.taskText(task));
  played.vals = r.vals;
  return played;
}

describe('Stufen', () => {
  test('Stufe wird an der Aufgabe vermerkt, "profi" bleibt als alter Name für "zerlegen"', () => {
    assert.equal(Tasks.generate({ op: '+' }).level, 'hilfe');
    assert.equal(Tasks.generate({ op: '+', profi: true }).level, 'zerlegen');
    assert.equal(Tasks.generate({ op: '+', level: 'zerlegen' }).level, 'zerlegen');
    assert.equal(Tasks.generate({ op: '+', level: 'selbst' }).level, 'selbst');
    assert.deepEqual(Tasks.LEVELS.map((l) => l.key), ['hilfe', 'zerlegen', 'selbst']);
  });
});

describe('Alles selbst', () => {
  for (const [op, strategy] of ALL) {
    test(`${op} ${strategy}: jede Zahl in jedem Schritt trägt das Kind ein`, () => {
      for (let k = 0; k < 300; k++) {
        const t = gen(op, strategy, { rest: k % 2 === 0, max: k % 2 ? 100 : 1000 });
        const played = solve(t);
        for (const row of played.rows) {
          // nur die Ergebniszeile beim Teilen wiederholt die Aufgabe (52 : 4 = …)
          if (row.label === 'Ergebnis') continue;
          for (const tok of row.tokens) {
            assert.ok(tok.t === 'in' || tok.t === 'txt', Tasks.taskText(t) + ' ' + row.label + ': vorgegebene Zahl ' + JSON.stringify(tok));
          }
          assert.ok(inputs(row).length >= 3, row.label + ': mindestens zwei Zahlen und ein Ergebnis');
          assert.ok(!/Zerlegen|Hilfszahl/.test(row.label), 'keine vorgegebene Zerlegungszeile');
        }
      }
    });
  }

  test('falsche Zahl wird abgelehnt (jede Zeile)', () => {
    for (const [op, strategy] of ALL) {
      for (let k = 0; k < 80; k++) {
        const t = gen(op, strategy, { rest: k % 2 === 0, max: k % 2 ? 100 : 1000 });
        play(fresh(t), (row, i, vals) => {
          const ins = inputs(row);
          const exp = expectedValues(row, vals);
          const raw = {};
          ins.forEach((x, n) => { raw[x.id] = String(n === ins.length - 1 ? exp[n] + 1 : exp[n]); });
          assert.equal(Check.checkRow(row, raw, vals).correct, false, Tasks.taskText(t) + ' ' + row.label);
          return exp;
        });
      }
    }
  });

  test('bei Plus und Mal ist die Reihenfolge egal (außer beim Ergänzen: Startzahl zuerst)', () => {
    for (const [op, strategy] of ALL) {
      for (let k = 0; k < 80; k++) {
        const t = gen(op, strategy, { max: k % 2 ? 100 : 1000 });
        solve(t, (row, answers) => {
          const ops = opsOf(row);
          const same = ops.length && ops.every((o) => o === ops[0]);
          if (same && (ops[0] === '+' || ops[0] === '·') && !row.fixedOrder && inputs(row).length === ops.length + 2) {
            const n = ops.length + 1;
            return answers.slice(0, n).reverse().concat(answers.slice(n));
          }
          return answers;
        });
      }
    }
  });

  test('bei Minus und Geteilt ist die Reihenfolge fest', () => {
    for (const [op, strategy] of ALL) {
      for (let k = 0; k < 60; k++) {
        const t = gen(op, strategy, { rest: k % 2 === 0, max: k % 2 ? 100 : 1000 });
        play(fresh(t), (row, i, vals) => {
          const ins = inputs(row);
          const exp = expectedValues(row, vals);
          const o = opOf(row);
          if ((o === '−' || o === ':' || row.fixedOrder) && ins.length >= 2 && exp[0] !== exp[1]) {
            const raw = {};
            ins.forEach((x, n) => { raw[x.id] = String(exp[n]); });
            const swapped = Object.assign({}, raw, { [ins[0].id]: raw[ins[1].id], [ins[1].id]: raw[ins[0].id] });
            assert.equal(Check.checkRow(row, swapped, vals).correct, false, Tasks.taskText(t) + ' ' + row.label);
          }
          return exp;
        });
      }
    }
  });

  test('Zwischenergebnis muss selbst übernommen werden – und zwar das richtige', () => {
    const t = fresh(gen('+', 'schrittweise'));
    const r1 = t.rows[0];
    const v1 = Check.checkRow(r1, Object.fromEntries(inputs(r1).map((x) => [x.id, String(x.answer)])), {}).vals;
    const r2 = t.nextRow(v1);
    const ins = inputs(r2);
    const exp = expectedValues(r2, v1);
    const bad = Check.checkRow(r2, { [ins[0].id]: String(exp[0] + 10), [ins[1].id]: String(exp[1]), [ins[2].id]: String(exp[2] + 10) }, v1);
    assert.deepEqual(bad.fields.map((f) => f.status), ['wrong', 'correct', 'pending']);
  });

  test('Ergebnis passt zu den eingetragenen Zahlen, auch wenn eine falsch ist: dann "pending"', () => {
    const t = gen('+', 'stellenweise');
    const row = t.rows[0];
    const [x, y, z] = inputs(row);
    const r = Check.checkRow(row, { [x.id]: String(x.answer + 1), [y.id]: String(y.answer), [z.id]: String(z.answer + 1) }, {});
    assert.equal(r.fields[0].status, 'wrong');
    assert.equal(r.fields[2].status, 'pending');
  });

  test('Geteilt: freie Zerlegung, die nächsten Zeilen richten sich nach den eingetragenen Zahlen', () => {
    for (let k = 0; k < 300; k++) {
      const t = gen(':', 'zerlegen', { rest: k % 2 === 0, max: k % 2 ? 100 : 1000 });
      const D = t.a, d = t.b, q = t.answer;
      if (q < 13) continue;
      const played = solve(t, (row, answers, i) => {
        if (i === 0) return [d, d, 1];                          // 6 : 6 = 1
        if (i === 1) return [(q - 1) * d, d, q - 1];             // der Rest der Reihe
        return answers;
      });
      assert.equal(played.vals.res, q);
      // umständliche Zerlegung: Rat nach der zweiten Zeile
      const adv = played.rows[1].advice ? played.rows[1].advice(played.vals) : null;
      if ((q - 1) > 10 && (q - 1) % 10 !== 0) assert.match(adv, /leichter/, Tasks.taskText(t));
      assert.ok(D >= q * d);
    }
  });

  test('Geteilt: Teiler muss stimmen', () => {
    const t = gen(':', 'zerlegen', { rest: true });
    const [p1, d1, q1] = inputs(t.rows[0]);
    const r = Check.checkRow(t.rows[0], { [p1.id]: String(p1.answer), [d1.id]: String(d1.answer + 1), [q1.id]: String(q1.answer) }, {});
    assert.deepEqual(r.fields.map((f) => f.status), ['correct', 'wrong', 'pending']);
  });

  test('Ergänzen: Sprünge in beliebiger Reihenfolge zusammenrechnen', () => {
    for (let k = 0; k < 200; k++) {
      const t = gen('−', 'ergaenzen', { max: k % 2 ? 100 : 1000 });
      solve(t, (row, answers) => (row.label === 'Zusammen' ? answers.slice(0, -1).reverse().concat(answers.slice(-1)) : answers));
    }
  });
});
