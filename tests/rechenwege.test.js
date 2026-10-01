// Zahlenraum bis 1000, Korrekturen nach dem Lehrplan-Abgleich und neue Rechenwege
// (Vereinfachen, Hilfsaufgabe beim Malnehmen, Probe beim Teilen und Ergänzen).
'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { Tasks, Check, UI, inputs, opsOf, fresh, play, assertTrueEquation } = require('./helfer.js');

const LEVELS = ['hilfe', 'zerlegen', 'selbst'];
const gen = (op, strategy, level, max, extra) =>
  Tasks.generate(Object.assign({ op, strategy, level, max, crossing: 'egal' }, extra));
const wege = (op) => Tasks.STRATEGIES[op].filter((s) => s.group === 'weg');

/** Löst eine Aufgabe auf dem erwarteten Weg; prüft jede Gleichung und den Zahlenraum. -> gespielte Kopie */
function solveChecked(t) {
  const task = fresh(t);
  const max = t.max;
  const r = play(task, null, (row, i, vals) => {
    const nums = assertTrueEquation(task, row, vals, i);
    nums.forEach((n) => assert.ok(Number.isInteger(n) && n >= 0 && n <= max,
      Tasks.taskText(task) + ' Zeile ' + i + ': Zahl ' + n + ' außerhalb 0…' + max));
    assert.ok(row.hint && row.hint.length > 5, Tasks.taskText(task) + ' Zeile ' + i + ': Tipp fehlt');
  });
  assert.ok(r.ok, Tasks.taskText(t) + ' ' + t.strategy + ' ' + t.level + ': Musterweg abgelehnt in Zeile ' + r.row);
  assert.equal(r.vals.res, t.answer);
  if (t.op === ':' && t.rest) assert.equal(Object.values(r.vals).includes(t.rest), true);
  task.vals = r.vals;
  return task;
}
const exact = (t) => ({ '+': t.a + t.b, '−': t.a - t.b, '·': t.a * t.b, ':': Math.floor(t.a / t.b) })[t.op];

// Übergang an irgendeiner Stelle (Zehner- oder Hunderterübergang)
function carries(a, b) {
  return (a % 10) + (b % 10) >= 10 || (a % 100) + (b % 100) >= 100;
}
function borrows(a, b) {
  return (a % 10) < (b % 10) || (a % 100) < (b % 100);
}

describe('Zahlenraum bis 1000', () => {
  test('alle Rechenwege und Stufen: richtige Gleichungen, alle Zahlen bis 1000', () => {
    for (const op of Tasks.OPS) {
      for (const s of wege(op)) {
        for (const level of LEVELS) {
          for (let k = 0; k < 120; k++) {
            const t = gen(op, s.key, level, 1000, { rest: k % 2 === 0 });
            assert.equal(t.max, 1000);
            assert.equal(t.answer, exact(t), Tasks.taskText(t));
            if (t.op === ':') assert.equal(t.a % t.b, t.rest || 0);
            assert.ok(t.a <= 1000 && t.b <= 1000 && t.answer <= 1000, Tasks.taskText(t));
            solveChecked(t);
          }
        }
      }
    }
  });

  test('bis 100 bleibt alles bis 100 (Wiederholung)', () => {
    for (const op of Tasks.OPS) {
      for (const s of wege(op)) {
        for (const level of LEVELS) {
          for (let k = 0; k < 80; k++) {
            const t = gen(op, s.key, level, 100, { rest: k % 2 === 0 });
            assert.ok(t.a <= 100 && t.b <= 100 && t.answer <= 100, Tasks.taskText(t));
            solveChecked(t);
          }
        }
      }
    }
  });

  test('Plus und Minus: Aufgaben wie 328 + 54, 346 + 228, 460 + 390', () => {
    for (const op of ['+', '−']) {
      for (const key of ['stellenweise', 'schrittweise']) {
        if (!wege(op).some((s) => s.key === key)) continue;
        const ts = Array.from({ length: 400 }, () => gen(op, key, 'selbst', 1000));
        const big = ts.filter((t) => t.a > 100 || (op === '+' && t.answer > 100));
        assert.ok(big.length >= 360, op + ' ' + key + ': meistens über 100');
        assert.ok(ts.some((t) => t.b >= 100 && t.b % 10 !== 0), op + ' ' + key + ': HZE ± HZE');
        assert.ok(ts.some((t) => t.b < 100 && t.a >= 100), op + ' ' + key + ': HZE ± ZE');
        assert.ok(ts.some((t) => t.a % 10 === 0 && t.b % 10 === 0 && t.b >= 100), op + ' ' + key + ': HZ0 ± HZ0');
      }
    }
  });

  test('Hilfsaufgabe bis 1000: auch mit Hunderterzahlen (328 + 99, 314 − 99)', () => {
    for (const op of ['+', '−']) {
      const ts = Array.from({ length: 400 }, () => gen(op, 'hilfsaufgabe', 'selbst', 1000));
      assert.ok(ts.some((t) => t.b % 100 >= 98), op + ': fast ein Hunderter');
      assert.ok(ts.every((t) => t.b % 10 >= 8), op + ': zweite Zahl knapp unter einer glatten Zahl');
      assert.ok(ts.filter((t) => t.a > 100).length > 300);
    }
  });

  test('Ergänzen bis 1000 (590 + __ = 930)', () => {
    const ts = Array.from({ length: 300 }, () => gen('−', 'ergaenzen', 'selbst', 1000));
    assert.ok(ts.filter((t) => t.a > 100).length > 250);
    assert.ok(ts.some((t) => t.answer > 100));
  });

  test('Mal: 6 · 13, 64 · 3, 7 · 48, 3 · 240 (Ergebnis bis 1000)', () => {
    const ts = Array.from({ length: 600 }, () => gen('·', 'zerlegen', 'selbst', 1000));
    assert.ok(ts.some((t) => t.a < 10 && t.b > 10), 'kleine Zahl vorn');
    assert.ok(ts.some((t) => t.a > 10 && t.b < 10), 'kleine Zahl hinten');
    assert.ok(ts.some((t) => Math.max(t.a, t.b) >= 100 && Math.max(t.a, t.b) % 10 === 0), 'HZ · E');
    assert.ok(ts.filter((t) => t.answer > 100).length > 300, 'meistens über 100');
    assert.ok(ts.every((t) => t.answer <= 1000));
  });

  test('Geteilt: 52 : 4, 648 : 6, 852 : 4, 95 : 3 (Ergebnisse mit H, Z und E)', () => {
    const ts = Array.from({ length: 600 }, (x, k) => gen(':', 'zerlegen', 'hilfe', 1000, { rest: k % 3 === 0 }));
    assert.ok(ts.some((t) => t.answer >= 100), 'dreistelliges Ergebnis');
    assert.ok(ts.some((t) => t.answer < 100 && t.a > 100), 'zweistelliges Ergebnis, großer Dividend');
    assert.ok(ts.some((t) => t.rows[0].tokens.filter((x) => x.t === 'num').length === 4), 'drei Teile (852 = 800 + 40 + 12)');
    assert.ok(ts.filter((t) => t.a > 100).length > 300);
  });

  test('Kernaufgaben bleiben im Einmaleins', () => {
    for (let k = 0; k < 500; k++) {
      const t = gen('·', 'kernaufgaben', LEVELS[k % 3], 1000);
      assert.ok(t.a <= 10 && t.b <= 10 && t.answer <= 100, Tasks.taskText(t));
    }
  });

  test('Zehner- und Hunderterübergang: Einstellung wird beachtet', () => {
    for (const [op, keys, test] of [['+', ['stellenweise', 'schrittweise', 'hilfsaufgabe', 'vereinfachen'], carries],
      ['−', ['schrittweise', 'ergaenzen', 'hilfsaufgabe', 'vereinfachen'], borrows]]) {
      for (const key of keys) {
        for (const crossing of ['ohne', 'mit']) {
          for (const max of [100, 1000]) {
            for (let k = 0; k < 150; k++) {
              const t = Tasks.generate({ op, strategy: key, crossing, level: 'selbst', max });
              assert.equal(test(t.a, t.b), crossing === 'mit', op + ' ' + key + ' ' + crossing + ' ' + max + ': ' + Tasks.taskText(t));
            }
          }
        }
      }
    }
  });
});

describe('Geteilt: Ergebniszeile und Probe statt Zusammen-Zeile', () => {
  test('keine falsche Gleichung wie 30 + 2 = 32 R 1; Ergebnis, dann Probe', () => {
    for (const level of LEVELS) {
      for (const max of [100, 1000]) {
        for (let k = 0; k < 150; k++) {
          const t = gen(':', 'zerlegen', level, max, { rest: k % 2 === 0 });
          const played = solveChecked(t);
          const rows = played.rows;
          rows.forEach((row) => {
            const o = opsOf(row);
            assert.ok(!(o.includes('+') && row.tokens.some((x) => x.v === 'R')), Tasks.taskText(t) + ': Plus mit Rest');
            assert.notEqual(row.label, 'Zusammen');
          });
          // Ergebniszeile: 52 : 4 = [13] (R [1])
          const fin = rows[rows.length - 2];
          const nums = fin.tokens.filter((x) => x.t === 'num').map((x) => x.v);
          assert.deepEqual(nums, [t.a, t.b], Tasks.taskText(t) + ': Ergebniszeile');
          assert.equal(fin.tokens.find((x) => x.t === 'in').id, 'res');
          assert.equal(fin.tokens.some((x) => x.v === 'R'), !!t.rest);
          // Probe: 13 · 4 (+ 1) = 52
          const probe = rows[rows.length - 1];
          assert.equal(probe.label, 'Probe');
          assert.deepEqual(opsOf(probe), t.rest ? ['·', '+'] : ['·']);
          const vals = played.vals;
          const right = probe.tokens[probe.tokens.length - 1];
          assert.equal(right.t === 'num' ? right.v : vals[right.id], t.a);
        }
      }
    }
  });
});

describe('Kernaufgaben', () => {
  test('nur 1 ·, 2 ·, 5 ·, 10 ·; 8 · b = 10 · b − 2 · b', () => {
    for (const level of LEVELS) {
      for (let k = 0; k < 300; k++) {
        const t = gen('·', 'kernaufgaben', level, 100);
        const played = solveChecked(t), vals = played.vals;
        const parts = [];
        played.rows.forEach((row) => {
          if (opsOf(row).length !== 1 || opsOf(row)[0] !== '·') return;
          const [x, y] = row.tokens.filter((z) => z.t !== 'txt').map((z) => (z.t === 'num' ? z.v : vals[z.id]));
          // einer der Faktoren bleibt, der andere ist eine Kernzahl
          const kern = [1, 2, 5, 10];
          const okPart = ([t.a, t.b].includes(x) && kern.includes(y)) || ([t.a, t.b].includes(y) && kern.includes(x));
          assert.ok(okPart, Tasks.taskText(t) + ': ' + x + ' · ' + y);
          parts.push([t.a, t.b].includes(x) && kern.includes(y) ? y : x);
        });
        if (t.a === 8) assert.ok(parts.includes(10) && parts.includes(2), Tasks.taskText(t) + ': ' + parts);
      }
    }
  });
});

test('keine Zeile heißt "Rest" (Verwechslung mit dem Rest beim Teilen)', () => {
  for (const op of Tasks.OPS) {
    for (const s of wege(op)) {
      for (const level of LEVELS) {
        for (let k = 0; k < 30; k++) {
          solveChecked(gen(op, s.key, level, k % 2 ? 100 : 1000, { rest: true })).rows
            .forEach((row) => assert.notEqual(row.label, 'Rest', op + ' ' + s.key));
        }
      }
    }
  }
});

describe('Ergänzen nur, wenn es geschickt ist', () => {
  test('kleiner Abstand oder knapp unter einem Zehner/Hunderter', () => {
    for (const max of [100, 1000]) {
      for (let k = 0; k < 600; k++) {
        const t = gen('−', 'ergaenzen', LEVELS[k % 3], max);
        const d = t.a - t.b;
        const clever = max === 100 ? d <= 20 || t.b % 10 >= 7 : d <= 200 || t.b % 100 >= 80;
        assert.ok(clever, Tasks.taskText(t));
      }
    }
  });
  test('Umkehraufgabe als Probe: 37 + 45 = 82', () => {
    for (const level of LEVELS) {
      for (const max of [100, 1000]) {
        for (let k = 0; k < 100; k++) {
          const t = gen('−', 'ergaenzen', level, max);
          const played = solveChecked(t), vals = played.vals;
          const last = played.rows[played.rows.length - 1];
          const xs = last.tokens.filter((x) => x.t !== 'txt').map((x) => (x.t === 'num' ? x.v : vals[x.id]));
          if (opsOf(last)[0] === '+') {
            assert.equal(last.label, 'Probe');
            assert.deepEqual(xs.slice().sort((x, y) => x - y), [t.answer, t.b, t.a].sort((x, y) => x - y));
          } else {
            assert.deepEqual(xs, [t.a, t.b, t.answer], 'nur ein Sprung: Ergebnis als Minusaufgabe');
          }
        }
      }
    }
  });
});

describe('Neuer Rechenweg: Vereinfachen', () => {
  test('bei Plus und Minus angemeldet, Gruppe Rechenwege', () => {
    for (const op of ['+', '−']) {
      const s = Tasks.STRATEGIES[op].find((x) => x.key === 'vereinfachen');
      assert.ok(s, op);
      assert.equal(s.group, 'weg');
      assert.equal(s.name, 'Vereinfachen');
    }
  });
  test('der Musterweg macht eine Zahl glatt (239 + 41 = 240 + 40, 73 − 29 = 74 − 30)', () => {
    for (const op of ['+', '−']) {
      for (const max of [100, 1000]) {
        for (let k = 0; k < 200; k++) {
          const t = gen(op, 'vereinfachen', 'selbst', max);
          const [x, y] = inputs(t.rows[0]).map((i) => i.answer);
          assert.ok(x % 10 === 0 || y % 10 === 0, Tasks.taskText(t) + ': ' + x + ', ' + y);
          assert.ok(x !== t.a, Tasks.taskText(t));
          assert.equal(op === '+' ? x + y : x - y, t.answer);
          assert.ok(t.a % 10 !== 0 && t.b % 10 !== 0, 'keine glatte Zahl in der Aufgabe');
        }
      }
    }
  });
});

describe('Neuer Rechenweg: Hilfsaufgabe beim Malnehmen', () => {
  test('angemeldet, ein Faktor liegt knapp unter einer glatten Zahl', () => {
    const s = Tasks.STRATEGIES['·'].find((x) => x.key === 'hilfsaufgabe');
    assert.ok(s);
    assert.equal(s.group, 'weg');
    for (const max of [100, 1000]) {
      for (let k = 0; k < 300; k++) {
        const t = gen('·', 'hilfsaufgabe', LEVELS[k % 3], max);
        const nearTen = (n) => n % 10 >= 8 || (max === 1000 && n % 100 >= 95);
        assert.ok(nearTen(t.a) || nearTen(t.b), Tasks.taskText(t));
        assert.ok(t.answer <= max);
      }
    }
  });
  test('9 · 15 = 10 · 15 − 15, 6 · 39 = 6 · 40 − 6', () => {
    let t = null;
    for (let i = 0; i < 100000 && !t; i++) {
      const x = gen('·', 'hilfsaufgabe', 'hilfe', 1000);
      if ((x.a === 9 && x.b % 10 < 8) || (x.b === 9 && x.a % 10 < 8)) t = x;
    }
    assert.ok(t, '9 · 15 kommt vor');
    const played = solveChecked(t);
    const first = played.rows.find((r) => opsOf(r)[0] === '·' && inputs(r).length === 1);
    assert.ok(first.tokens.some((x) => x.t === 'num' && x.v === 10), 'erst mit 10 rechnen');
  });
});

describe('Aufgaben sind nicht zu leicht', () => {
  test('Mal Zerlegen: selten · 2 oder · 11, meist Einer ab 3', () => {
    for (const max of [100, 1000]) {
      const ts = Array.from({ length: 2000 }, () => gen('·', 'zerlegen', 'selbst', max));
      const small = ts.map((t) => Math.min(t.a, t.b)), big = ts.map((t) => Math.max(t.a, t.b));
      assert.ok(small.filter((x) => x === 2).length < 200, max + ': zu oft · 2');
      assert.ok(big.filter((x) => x === 11).length < 60, max + ': zu oft · 11');
      assert.ok(big.filter((x) => x % 10 >= 3 || x % 10 === 0).length > 1500, max + ': Einer ab 3');
    }
  });
  test('Geteilt: selten durch 2', () => {
    const ts = Array.from({ length: 2000 }, (x, k) => gen(':', 'zerlegen', 'selbst', k % 2 ? 100 : 1000));
    assert.ok(ts.filter((t) => t.b === 2).length < 200);
  });
});

describe('Texte', () => {
  test('Einleitung für die neuen Rechenwege', () => {
    const t1 = gen('+', 'vereinfachen', 'hilfe', 100);
    assert.match(UI.introText(t1, ''), /glatt/);
    const t2 = gen('·', 'hilfsaufgabe', 'hilfe', 100);
    assert.match(UI.introText(t2, ''), /glatt/);
  });
  test('nach einer richtigen Zeile: weiter, solange die Aufgabe noch eine Zeile will (Probe)', () => {
    const I = (id, answer) => ({ t: 'in', id, answer, check: (v) => v === answer });
    const task = {
      answer: 5, rows: [{ tokens: [I('res', 5)] }],
      more: (vals) => !('probe' in vals),
      nextRow: () => ({ tokens: [I('probe', 1)] })
    };
    assert.equal(UI.afterCorrect(task, { res: 5 }, 0), 'append');
    task.rows.push(task.nextRow({}));
    assert.equal(UI.afterCorrect(task, { res: 5, probe: 1 }, 1), 'finish');
  });
});

// Schreibweise wie im Heft: Die Zerlegung steht in der Malaufgabe (8 · 7 = 10 · 7 − 2 · 7),
// nicht als eigene Zeile nur mit der Zahl (8 = 10 − 2).
describe('Mal: die Zerlegung steht in der Malaufgabe', () => {
  const text = (row, vals) => row.tokens.map((x) => (x.t === 'txt' || x.t === 'num' ? x.v : vals ? vals[x.id] : '[' + x.answer + ']')).join(' ');
  const find = (key, level, max, want) => {
    for (let i = 0; i < 20000; i++) {
      const t = gen('·', key, level, max);
      if (want(t)) return t;
    }
    throw new Error('nicht gefunden: ' + key);
  };

  for (const key of ['zerlegen', 'kernaufgaben', 'hilfsaufgabe']) {
    for (const level of ['hilfe', 'zerlegen']) {
      test(`${key}, ${level}: erste Zeile ist a · b = … · … ± … · …, keine Zeile nur mit einer Zahl links`, () => {
        for (let k = 0; k < 300; k++) {
          const t = gen('·', key, level, k % 2 ? 100 : 1000);
          const row0 = t.rows[0];
          const left = row0.tokens.slice(0, 4).map((x) => x.v);
          assert.deepEqual(left, [t.a, '·', t.b, '='], text(row0));
          const ops = opsOf(row0).filter((o) => o !== '=');
          assert.equal(ops.filter((o) => o === '·').length, 3, text(row0));
          assert.equal(ops.filter((o) => o === '+' || o === '−').length, 1, text(row0));
          // jeder Teil: der bleibende Faktor mal ein Stück vom anderen
          const played = solveChecked(t);
          t.rows.concat(played.rows).forEach((r) => {
            const eq = r.tokens.findIndex((x) => x.v === '=');
            assert.ok(eq !== 1, 'Zeile nur mit einer Zahl links: ' + text(r));
          });
          if (level === 'zerlegen') assert.equal(inputs(row0).length, 2, 'die zwei Teile trägt das Kind ein: ' + text(row0));
          else assert.equal(inputs(row0).length, 0);
        }
      });
    }
  }

  test('Beispiele: 8 · 7 = 10 · 7 − 2 · 7, 6 · 7 = 5 · 7 + 1 · 7', () => {
    let t = find('kernaufgaben', 'hilfe', 100, (x) => x.a === 8 && x.b === 7);
    assert.equal(text(t.rows[0]), '8 · 7 = 10 · 7 − 2 · 7');
    assert.equal(t.rows[0].label, 'Zerlegen');
    t = find('kernaufgaben', 'hilfe', 100, (x) => x.a === 6 && x.b === 7);
    assert.equal(text(t.rows[0]), '6 · 7 = 5 · 7 + 1 · 7');
    t = find('kernaufgaben', 'zerlegen', 100, (x) => x.a === 9 && x.b === 4);
    assert.equal(text(t.rows[0]), '9 · 4 = [10] · 4 − [1] · 4');
  });

  test('Beispiele Zerlegen: 4 · 23 = 4 · 20 + 4 · 3 und 64 · 3 = 60 · 3 + 4 · 3', () => {
    let t = find('zerlegen', 'hilfe', 100, (x) => x.a === 4 && x.b === 23);
    assert.equal(text(t.rows[0]), '4 · 23 = 4 · 20 + 4 · 3');
    t = find('zerlegen', 'hilfe', 1000, (x) => x.a === 64 && x.b === 3);
    assert.equal(text(t.rows[0]), '64 · 3 = 60 · 3 + 4 · 3');
    t = find('zerlegen', 'zerlegen', 100, (x) => x.a === 4 && x.b === 23);
    assert.equal(text(t.rows[0]), '4 · 23 = 4 · [20] + 4 · [3]');
    // die Zerlegung ist frei: 4 · 23 = 4 · 13 + 4 · 10 geht auch
    const r = play(fresh(t), (row, i) => (i === 0 ? [13, 10] : null));
    assert.ok(r.ok);
    assert.equal(r.vals.res, 92);
  });

  test('Beispiele Hilfsaufgabe: 6 · 39 = 6 · 40 − 6 · 1 und 19 · 4 = 20 · 4 − 1 · 4', () => {
    let t = find('hilfsaufgabe', 'hilfe', 1000, (x) => x.a === 6 && x.b === 39);
    assert.equal(text(t.rows[0]), '6 · 39 = 6 · 40 − 6 · 1');
    assert.equal(t.rows[0].label, 'Hilfszahl');
    t = find('hilfsaufgabe', 'hilfe', 100, (x) => x.a === 19 && x.b === 4);
    assert.equal(text(t.rows[0]), '19 · 4 = 20 · 4 − 1 · 4');
    t = find('hilfsaufgabe', 'zerlegen', 100, (x) => x.a === 3 && x.b === 28);
    assert.equal(text(t.rows[0]), '3 · 28 = 3 · [30] − 3 · [2]');
  });
});
