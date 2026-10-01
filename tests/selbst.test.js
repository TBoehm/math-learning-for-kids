// Stufe "Alles selbst": das Kind erkennt und schreibt jeden Zwischenschritt selbst.
'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const Tasks = require('../js/tasks.js');
const Check = require('../js/check.js');

const ALL = [];
for (const op of Tasks.OPS) for (const s of Tasks.STRATEGIES[op]) ALL.push([op, s.key]);
const gen = (op, strategy, extra) => Tasks.generate(Object.assign({ op, strategy, level: 'selbst' }, extra));
const inputs = (row) => row.tokens.filter((t) => t.t === 'in');
const opOf = (row) => (row.tokens.find((t) => t.t === 'txt' && t.v !== '=' && t.v !== 'R') || {}).v;

// Löst eine Aufgabe mit den hinterlegten Antworten; raw(row, answers) darf sie verändern.
function solve(task, tweak) {
  let vals = {};
  task.rows.forEach((row, i) => {
    const answers = inputs(row).map((t) => t.answer);
    const used = tweak ? tweak(row, answers.slice(), i, vals) : answers;
    const raw = {};
    inputs(row).forEach((t, k) => { raw[t.id] = String(used[k]); });
    const r = Check.checkRow(row, raw, vals);
    assert.equal(r.correct, true, Tasks.taskText(task) + ' Zeile ' + i + ' (' + row.label + '): ' + used.join(','));
    vals = r.vals;
  });
  assert.equal(Check.isSolved(task, vals), true, Tasks.taskText(task));
  return vals;
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
        const t = gen(op, strategy, { rest: k % 2 === 0 });
        for (const row of t.rows) {
          for (const tok of row.tokens) {
            assert.ok(tok.t === 'in' || tok.t === 'txt', Tasks.taskText(t) + ' ' + row.label + ': vorgegebene Zahl ' + JSON.stringify(tok));
          }
          assert.ok(inputs(row).length >= 3, row.label + ': mindestens zwei Zahlen und ein Ergebnis');
          assert.ok(!/Zerlegen|Hilfszahl/.test(row.label), 'keine vorgegebene Zerlegungszeile');
        }
        solve(t);
      }
    });
  }

  test('falsche Zahl wird abgelehnt (jede Zeile)', () => {
    for (const [op, strategy] of ALL) {
      for (let k = 0; k < 80; k++) {
        const t = gen(op, strategy);
        let vals = {};
        t.rows.forEach((row) => {
          const ins = inputs(row);
          const raw = {};
          ins.forEach((x) => { raw[x.id] = String(x.answer); });
          const last = ins[ins.length - 1];
          const wrong = Object.assign({}, raw, { [last.id]: String(last.answer + 1) });
          assert.equal(Check.checkRow(row, wrong, vals).correct, false, Tasks.taskText(t) + ' ' + row.label);
          vals = Check.checkRow(row, raw, vals).vals;
        });
      }
    }
  });

  test('bei Plus und Mal ist die Reihenfolge egal (außer beim Ergänzen: Startzahl zuerst)', () => {
    for (const [op, strategy] of ALL) {
      for (let k = 0; k < 80; k++) {
        const t = gen(op, strategy);
        solve(t, (row, answers) => {
          const o = opOf(row);
          if ((o === '+' || o === '·') && !row.fixedOrder) {
            const n = inputs(row).length - 1 - (row.tokens.some((x) => x.v === 'R') ? 1 : 0);
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
        const t = gen(op, strategy);
        let vals = {};
        for (const row of t.rows) {
          const ins = inputs(row);
          const raw = {};
          ins.forEach((x) => { raw[x.id] = String(x.answer); });
          const o = opOf(row);
          if ((o === '−' || o === ':' || row.fixedOrder) && ins[0].answer !== ins[1].answer) {
            const swapped = Object.assign({}, raw, { [ins[0].id]: raw[ins[1].id], [ins[1].id]: raw[ins[0].id] });
            assert.equal(Check.checkRow(row, swapped, vals).correct, false, Tasks.taskText(t) + ' ' + row.label);
          }
          vals = Check.checkRow(row, raw, vals).vals;
        }
      }
    }
  });

  test('Zwischenergebnis muss selbst übernommen werden – und zwar das richtige', () => {
    const t = gen('+', 'schrittweise');
    const [r1, r2] = t.rows;
    const v1 = Check.checkRow(r1, Object.fromEntries(inputs(r1).map((x) => [x.id, String(x.answer)])), {}).vals;
    const s1 = inputs(r1)[2].answer;
    const ins = inputs(r2);
    const bad = Check.checkRow(r2, { [ins[0].id]: String(s1 + 10), [ins[1].id]: String(ins[1].answer), [ins[2].id]: String(t.answer + 10) }, v1);
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

  test('Geteilt: freie Zerlegung, die zweite Zeile richtet sich nach der ersten', () => {
    for (let k = 0; k < 300; k++) {
      const t = gen(':', 'zerlegen', { rest: k % 2 === 0 });
      const D = t.a, d = t.b;
      if (t.answer < 13) continue;
      const vals = solve(t, (row, answers, i, v) => {
        if (i === 0) return [d, d, 1];                       // 6 : 6 = 1
        if (i === 1) return [D - d, d, Math.floor((D - d) / d)].concat(t.rest ? [(D - d) % d] : []);
        if (i === 2) return [1, v.q2, t.answer].concat(t.rest ? [t.rest] : []);
        return answers;
      });
      assert.equal(vals.res, t.answer);
      // umständliche Zerlegung: Rat nach der zweiten Zeile
      const adv = t.rows[1].advice(vals);
      if (!Tasks.isEasySplit(d, D - d, d)) assert.match(adv, /leichter/);
    }
  });

  test('Geteilt: Teiler und Rest müssen stimmen', () => {
    const t = gen(':', 'zerlegen', { rest: true });
    const [p1, d1, q1] = inputs(t.rows[0]);
    const r = Check.checkRow(t.rows[0], { [p1.id]: String(p1.answer), [d1.id]: String(d1.answer + 1), [q1.id]: String(q1.answer) }, {});
    assert.deepEqual(r.fields.map((f) => f.status), ['correct', 'wrong', 'pending']);
  });

  test('Ergänzen: Sprünge in beliebiger Reihenfolge zusammenrechnen', () => {
    for (let k = 0; k < 200; k++) {
      const t = gen('−', 'ergaenzen');
      solve(t, (row, answers) => (row.label === 'Zusammen' ? answers.slice(0, -1).reverse().concat(answers.slice(-1)) : answers));
    }
  });
});
