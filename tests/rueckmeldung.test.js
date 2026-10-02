// Rückmeldung bei Fehlern: Rechnet das Kind mit einer unpassenden Zahl richtig weiter (13 + 60 = 73 statt
// 13 + 50 = 63), sagt der Begleiter das gleich beim ersten Prüfen – mit dem Grund und der passenden Zahl.
'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const Tasks = require('../js/tasks.js');
const Check = require('../js/check.js');
const UI = require('../js/ui-logic.js');
const S = require('../js/formats/schriftlich.js');
const UE = require('../js/formats/ueberschlag.js');
const ZM = require('../js/formats/zahlenmauer.js');
const FE = require('../js/formats/fehler.js');
const WW = require('../js/formats/welcherweg.js');
const { play, fresh } = require('./helfer.js');

const inputs = (row) => row.tokens.filter((t) => t.t === 'in' || t.t === 'choice');
/** Zeile mit Eingaben in der Reihenfolge der Felder prüfen */
function tryRow(row, values, vals) {
  const raw = {};
  inputs(row).forEach((t, k) => { raw[t.id] = values[k] === undefined || values[k] === null ? '' : String(values[k]); });
  return Check.checkRow(row, raw, vals || {});
}
const statuses = (r) => r.fields.map((f) => f.status);
/** Text, den der Begleiter nach dem n-ten Fehlversuch sagt */
const say = (row, r, n = 1) => UI.wrongText(row, r, n, () => 'Fast!');
function has(text, ...parts) {
  assert.ok(text, 'keine Rückmeldung');
  for (const p of parts) assert.ok(text.includes(p), `"${p}" fehlt in: ${text}`);
}
/** Werte nach den ersten n Zeilen (Musterlösung) */
function valsAfter(task, n) {
  let out = {};
  play(fresh(task), null, (row, i, vals) => { if (i === n - 1) out = vals; });
  return out;
}
function find(gen, ok) {
  for (let i = 0; i < 5000; i++) { const t = gen(); if (ok(t)) return t; }
  throw new Error('keine passende Aufgabe');
}

describe('Grundlage: richtig gerechnet, aber unpassende Zahl', () => {
  test('Schrittweise, Zerlegung selbst: 13 + 60 = 73 – Rechnung stimmt, 60 steckt nicht in 54, nimm 50', () => {
    const t = Tasks.build('+', 'schrittweise', 13, 54, { level: 'zerlegen', max: 100 });
    const r = tryRow(t.rows[0], [60, 73]);
    assert.deepEqual(statuses(r), ['wrong', 'pending']);
    has(r.why, '13 + 60 = 73', 'stimmt', '60 steckt nicht in 54', '50');
    assert.ok(!r.why.includes(' 4.') || r.why.indexOf('50') < r.why.lastIndexOf('4'), r.why);
    // gleich beim ersten Prüfen, ohne Tipp-Knopf
    assert.equal(say(t.rows[0], r, 1), r.why);
    assert.equal(say(t.rows[0], r, 2), r.why);
    // beim dritten Versuch die Lösung
    has(say(t.rows[0], r, 3), 'Die Lösung ist');
  });

  test('falsch gerechnet mit passender Zahl: keine besondere Rückmeldung (nur Ermutigung)', () => {
    const t = Tasks.build('+', 'schrittweise', 13, 54, { level: 'zerlegen', max: 100 });
    const r = tryRow(t.rows[0], [50, 64]);
    assert.equal(r.why, null);
    assert.equal(say(t.rows[0], r, 1), 'Fast!');
  });

  test('unpassende Zahl, auch noch falsch gerechnet: Grund ohne "stimmt"', () => {
    const t = Tasks.build('+', 'schrittweise', 13, 54, { level: 'zerlegen', max: 100 });
    const r = tryRow(t.rows[0], [60, 70]);
    has(r.why, '60 steckt nicht in 54', '50');
    assert.ok(!r.why.includes('stimmt'), r.why);
    assert.match(r.why, /^[A-Z0-9ÄÖÜ]/, 'beginnt groß');
  });

  test('ohne eigenen Grund: Rechnung stimmt, Zahl passt nicht, dazu der Tipp der Zeile', () => {
    const row = { label: 'x', hint: 'Nimm die Zehner.', tokens: [
      { t: 'num', v: 13 }, { t: 'txt', v: '+' }, { t: 'in', id: 'q', answer: 50, check: (v) => v === 50 },
      { t: 'txt', v: '=' }, { t: 'in', id: 'res', answer: 63, deps: ['q'], check: (v, vals) => v === 13 + vals.q }] };
    const r = tryRow(row, [60, 73]);
    has(r.why, '13 + 60 = 73', 'stimmt', '60 passt hier nicht', 'Nimm die Zehner.');
  });
});

describe('Plus und Minus', () => {
  test('Schrittweise, Zerlegung selbst, Minus: 85 − 40 = 45 bei 85 − 37 – nimm 30', () => {
    const t = Tasks.build('−', 'schrittweise', 85, 37, { level: 'zerlegen', max: 100 });
    has(tryRow(t.rows[0], [40, 45]).why, '85 − 40 = 45', 'stimmt', '40 steckt nicht in 37', '30');
  });

  test('Schrittweise, alles selbst: alles auf einmal oder zu viel', () => {
    const t = Tasks.build('+', 'schrittweise', 13, 54, { level: 'selbst', max: 100 });
    has(tryRow(t.rows[0], [13, 54, 67]).why, 'auf einmal', '50');
    has(tryRow(t.rows[0], [13, 60, 73]).why, '13 + 60 = 73', 'stimmt', '60', 'mehr als 54', '50');
    const m = Tasks.build('−', 'schrittweise', 85, 37, { level: 'selbst', max: 100 });
    has(tryRow(m.rows[0], [85, 40, 45]).why, 'stimmt', 'mehr als 37', '30');
    has(tryRow(m.rows[0], [37, 30, 7]).why, 'mit 85 an');
  });

  test('Stellenweise, Zerlegung selbst: falsche Zehnerzahl', () => {
    const t = Tasks.build('+', 'stellenweise', 346, 228, { level: 'zerlegen', max: 1000 });
    const zehner = t.rows.find((r) => r.label === 'Zehner');
    has(tryRow(zehner, [30, 20, 50]).why, '30 + 20 = 50', 'stimmt', '346', '40');
  });

  test('Stellenweise, alles selbst: keine Stelle, oder verschiedene Stellen gemischt', () => {
    const t = Tasks.build('+', 'stellenweise', 346, 228, { level: 'selbst', max: 1000 });
    has(tryRow(t.rows[0], [346, 228, 574]).why, 'stimmt', '346 ist keine Stelle');
    has(tryRow(t.rows[0], [300, 20, 320]).why, 'stimmt', 'dieselbe Stelle', '200');
  });

  test('Hilfsaufgabe, Zerlegung selbst: 43 + 30 = 73 bei 43 + 18 – die nächste glatte Zahl ist 20', () => {
    const t = Tasks.build('+', 'hilfsaufgabe', 43, 18, { level: 'zerlegen', max: 100 });
    const r = tryRow(t.rows[0], [30, 73]);
    assert.deepEqual(statuses(r), ['wrong', 'pending'], 'das Ergebnis hängt von der glatten Zahl ab');
    has(r.why, '43 + 30 = 73', 'stimmt', '20', 'näher');
    // Ausgleichen: falscher Unterschied, richtig gerechnet
    const v = valsAfter(t, 1);
    has(tryRow(t.rows[1], [3, 60], v).why, '63 − 3 = 60', 'stimmt', '18', '20');
  });

  test('Hilfsaufgabe, alles selbst: zu weit weg oder nichts glatt', () => {
    const t = Tasks.build('+', 'hilfsaufgabe', 43, 18, { level: 'selbst', max: 100 });
    has(tryRow(t.rows[0], [43, 30, 73]).why, 'stimmt', '30 ist zu weit weg von 18', '20');
    has(tryRow(t.rows[0], [43, 18, 61]).why, 'glatt', '20');
    const m = Tasks.build('−', 'hilfsaufgabe', 82, 39, { level: 'selbst', max: 100 });
    has(tryRow(m.rows[0], [82, 30, 52]).why, 'stimmt', '30 ist zu weit weg von 39', '40');
  });

  test('Vereinfachen: Gleichung stimmt, aber keine Zahl glatt; Ausgleich in die falsche Richtung', () => {
    const t = Tasks.build('+', 'vereinfachen', 239, 41, { level: 'zerlegen', max: 1000 });
    has(tryRow(t.rows[0], [238, 42]).why, 'stimmt', 'glatt', '240');
    has(tryRow(t.rows[0], [240, 42]).why, '239 hat 1 bekommen', '41', 'abgeben');
    const m = Tasks.build('−', 'vereinfachen', 73, 29, { level: 'selbst', max: 100 });
    has(tryRow(m.rows[0], [74, 31, 43]).why, '73 + 1 = 74', '29 + 1');
  });

  test('Ergänzen, alles selbst: bei der großen Zahl angefangen, über das Ziel gesprungen', () => {
    const t = Tasks.build('−', 'ergaenzen', 56, 19, { level: 'selbst', max: 100 });
    has(tryRow(t.rows[0], [56, 4, 60]).why, 'kleineren Zahl 19', '56');
    has(tryRow(t.rows[0], [19, 40, 59]).why, '19 + 40 = 59', 'stimmt', 'über 56');
  });
});

describe('Mal und Geteilt', () => {
  const gen = (op, strategy, level, max = 100) => () => Tasks.generate({ op, strategy, level, max });

  test('Mal Zerlegen, Zerlegung selbst: Teil größer als die Zahl', () => {
    const t = gen('·', 'zerlegen', 'zerlegen')();
    const big = Math.max(t.a, t.b);
    has(tryRow(t.rows[0], [big + 10, -1]).why, String(big + 10), 'größer als ' + big);
  });

  test('Kernaufgaben, Zerlegung selbst: 7 · 6 = 4 · 6 + 3 · 6 stimmt, ist aber keine Kernaufgabe', () => {
    const t = find(gen('·', 'kernaufgaben', 'zerlegen'), (x) => x.a === 7);
    const r = tryRow(t.rows[0], [4, 3]);
    has(r.why, 'stimmt', '4 · ' + t.b + ' ist keine Kernaufgabe', '5');
  });

  test('Mal Hilfsaufgabe, Zerlegung selbst: glatte Zahl zu weit weg – die nächste ist näher', () => {
    const t = find(gen('·', 'hilfsaufgabe', 'zerlegen'), (x) => Math.max(x.a, x.b) % 10 === 9 && Math.max(x.a, x.b) > 10);
    const f = Math.max(t.a, t.b), G = f + 1;
    const r = tryRow(t.rows[0], [G + 10, G + 10 - f]);
    assert.deepEqual(statuses(r), ['wrong', 'pending']);
    has(r.why, 'stimmt', String(G + 10) + ' ist zu weit weg von ' + f, String(G), 'näher');
  });

  test('Geteilt, Zerlegung selbst: Teil nicht in der Reihe, oder zu groß', () => {
    const t = find(gen(':', 'zerlegen', 'zerlegen'), (x) => x.b >= 3 && x.rows.filter((r) => r.label.endsWith('Teil')).length === 2);
    const d = t.b, D = t.a;
    const off = 10 * d + 1;
    has(tryRow(t.rows[0], [off, 10]).why, String(off) + ' ist nicht in der ' + d + 'er-Reihe');
    has(tryRow(t.rows[0], [D + d - (D % d), (D + d - (D % d)) / d]).why, 'stimmt', 'mehr als ' + D);
  });

  test('Geteilt, alles selbst: Teil nicht in der Reihe', () => {
    const t = gen(':', 'zerlegen', 'selbst')();
    const d = t.b;
    has(tryRow(t.rows[0], [10 * d + 1, d, 10]).why, 'nicht in der ' + d + 'er-Reihe');
  });
});

describe('Knobeln und Schriftlich', () => {
  test('Überschlagen: 376 auf 370 gerundet – 380 ist näher', () => {
    const t = UE.build(376, '+', 248, { max: 1000, variant: 'selbst' });
    const r = tryRow(t.rows[0], [370, 250, 620]);
    has(r.why, 'Ü: 370 + 250 = 620', 'stimmt', '376', '380', 'näher');
    has(tryRow(t.rows[0], [380, 200, 580]).why, '248', '250');
  });

  test('Schriftlich: Überschlag mit falsch gerundeter Zahl', () => {
    const t = S.build('add', [376, 248], { level: 'zerlegen', max: 1000 });
    has(tryRow(t.rows[0], [370, 250, 620]).why, 'stimmt', '380', 'näher');
  });

  test('Schriftlich subtrahieren: kleine minus große Ziffer vertauscht', () => {
    const t = S.build('sub', [354, 127], { level: 'hilfe', max: 1000 });
    const einer = t.rows.find((r) => r.col === 0);
    // Einer: 4 − 7 geht nicht; wer 7 − 4 = 3 schreibt, hat vertauscht (richtig: 14 − 7 = 7)
    const ds = inputs(einer).map((x) => (x.id === 'd0' ? 3 : null));
    has(tryRow(einer, ds).why, '7 − 4', '4 − 7 geht nicht');
  });

  test('Schriftlich addieren: Übertrag vergessen', () => {
    const t = S.build('add', [358, 127], { level: 'hilfe', max: 1000 });
    const v = valsAfter(t, 2); // Überschlag und Einer
    const zehner = t.rows.find((r) => r.col === 1);
    const ds = inputs(zehner).map((x) => (x.id === 'd1' ? 7 : undefined));
    has(tryRow(zehner, ds, v).why, 'Übertrag');
  });

  test('Zahlenmauer mit Lücken: plus statt minus gerechnet', () => {
    let t, k = -1;
    for (let i = 0; i < 500 && k < 0; i++) {
      t = ZM.minus({ max: 100, level: 'zerlegen' });
      k = t.steps.findIndex((x) => x.kind !== 'sum');
    }
    assert.ok(k >= 0, 'Mauer mit Minus-Schritt');
    const at = (p) => t.wall.levels[p[0]][p[1]].v;
    const [top, side] = t.steps[k].parts.map(at);
    const v = k ? valsAfter(t, k) : {};
    has(tryRow(t.rows[k], [top + side], v).why, 'plus', top + ' − ' + side);
  });

  test('Fehler finden: richtige Zeile angetippt – "die stimmt"', () => {
    const t = FE.gen({ max: 100 }, '+');
    const ch = inputs(t.rows[0])[0];
    const wrong = ch.options.findIndex((o, i) => i !== ch.answer);
    has(tryRow(t.rows[0], [wrong]).why, 'stimmt');
  });

  test('Welcher Weg: nicht geschickter Weg – Grund nennen', () => {
    const t = WW.build(328, '+', 99, { max: 1000 });
    const ch = inputs(t.rows[0])[0];
    const k = ch.options.indexOf('Stellenweise');
    has(tryRow(t.rows[0], [k]).why, 'Stellenweise', '99');
  });
});

describe('Robust: jede falsche Eingabe in jeder Aufgabe ergibt einen sauberen Text oder null', () => {
  test('alle Aufgabenarten und Stufen', () => {
    for (const op of Tasks.OPS) {
      for (const s of Tasks.STRATEGIES[op]) {
        for (const level of ['hilfe', 'zerlegen', 'selbst']) {
          for (let k = 0; k < 12; k++) {
            const t = Tasks.generate({ op, strategy: s.key, level, max: k % 2 ? 1000 : 100, rest: k % 3 === 0 });
            play(fresh(t), (row, i, vals) => {
              for (let j = 0; j < 6; j++) {
                const vs = inputs(row).map((x) => (x.t === 'choice' ? j % x.options.length : Math.floor(Math.random() * 120)));
                const r = tryRow(row, vs, vals);
                if (r.why === null) continue;
                assert.equal(typeof r.why, 'string');
                assert.ok(!/undefined|NaN|null|\[object/.test(r.why), s.key + ' ' + level + ': ' + r.why);
              }
              return null;
            });
          }
        }
      }
    }
  });
});
