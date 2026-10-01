// Inhalte der Anschauungen ohne DOM: Malkreuz, Zerlegungsbaum, Punktefeld, Rechenstrich (js/viz-logic.js).
'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const VizLogic = require('../js/viz-logic.js');
const Tasks = require('../js/tasks.js');
const { fresh, play } = require('./helfer.js');

const show = VizLogic.show;

describe('show', () => {
  test('fehlende Werte als Fragezeichen', () => {
    assert.equal(show(undefined), '?');
    assert.equal(show(null), '?');
    assert.equal(show(0), 0);
    assert.equal(show('= 5'), '= 5');
  });
});

describe('Malkreuz', () => {
  test('"Alles selbst": die Zerlegung erscheint erst nach dem Rechenschritt', () => {
    const v = { type: 'malkreuz', a: 4, parts: [20, 3], cells: ['p1', 'p2'], partsAfter: ['p1', 'p2'] };
    assert.deepEqual(VizLogic.malkreuz(v, {}), { a: 4, heads: [null, null], cells: [undefined, undefined], sum: '= ?' });
    assert.deepEqual(VizLogic.malkreuz(v, { p1: 80 }), { a: 4, heads: [20, null], cells: [80, undefined], sum: '= ?' });
    assert.deepEqual(VizLogic.malkreuz(v, { p1: 80, p2: 12, res: 92 }), { a: 4, heads: [20, 3], cells: [80, 12], sum: '= 92' });
  });

  test('"Mit Hilfe": die Zerlegung steht von Anfang an da', () => {
    const v = { type: 'malkreuz', a: 4, parts: [20, 3], cells: ['p1', 'p2'], partIds: null };
    const m = VizLogic.malkreuz(v, {});
    assert.deepEqual(m.heads, [20, 3]);
    assert.equal(show(m.cells[0]), '?');
  });

  test('"Zerlegung selbst": die Zerlegung zeigt, was das Kind eingetragen hat', () => {
    const v = { type: 'malkreuz', a: 4, parts: [20, 3], cells: ['p1', 'p2'], partIds: ['bt', 'bo'] };
    assert.equal(show(VizLogic.malkreuz(v, {}).heads[0]), '?');
    assert.deepEqual(VizLogic.malkreuz(v, { bt: 3, bo: 20 }).heads, [3, 20]);
  });

  test('passt zu den echten Aufgaben aller Stufen und Zahlenräume', () => {
    for (const level of ['hilfe', 'zerlegen', 'selbst']) {
      for (const max of [100, 1000]) {
        const t = Tasks.generate({ op: '·', strategy: 'zerlegen', level, max });
        const before = VizLogic.malkreuz(t.viz, {});
        assert.equal(show(before.heads[0]) === '?', level !== 'hilfe', level + ': Zerlegung am Anfang ' + (level === 'hilfe' ? 'sichtbar' : 'verborgen'));
        const played = fresh(t);
        const r = play(played);
        const m = VizLogic.malkreuz(played.viz, r.vals);
        assert.equal(m.cells.reduce((x, y) => x + y, 0), t.answer, Tasks.taskText(t));
        assert.equal(m.heads.reduce((x, y) => x + y, 0), m.a === t.a ? t.b : t.a);
        assert.equal(m.sum, '= ' + t.answer);
      }
    }
  });

  test('"Alles selbst": eigene Zerlegung (7 · 48 = 5 · 48 + 2 · 48, 23 = 10 + 10 + 3) erscheint im Malkreuz', () => {
    let t;
    do { t = Tasks.generate({ op: '·', strategy: 'zerlegen', level: 'selbst', max: 1000 }); } while (Math.min(t.a, t.b) < 3 || Math.max(t.a, t.b) < 21);
    const big = Math.max(t.a, t.b), small = Math.min(t.a, t.b);
    const a = fresh(t);
    const r1 = play(a, (row, i) => [[2, big, 2 * big], [big, small - 2, big * (small - 2)]][i] || null);
    assert.ok(r1.ok);
    const m1 = VizLogic.malkreuz(a.viz, r1.vals);
    assert.equal(m1.a, big);
    assert.deepEqual(m1.heads, [2, small - 2]);
    const b = fresh(t);
    const r2 = play(b, (row, i) => [[small, 10, small * 10], [10, small, small * 10], [small, big - 20, small * (big - 20)]][i] || null);
    assert.ok(r2.ok);
    const m2 = VizLogic.malkreuz(b.viz, r2.vals);
    assert.equal(m2.a, small);
    assert.deepEqual(m2.heads, [10, 10, big - 20]);
    assert.deepEqual(m2.cells, [small * 10, small * 10, small * (big - 20)]);
  });
});

describe('Platz für den nächsten Teil ("Alles selbst")', () => {
  test('Malkreuz: nach dem ersten Teil eine leere Spalte für den nächsten', () => {
    const t = Tasks.generate({ op: '·', strategy: 'zerlegen', level: 'selbst', max: 100 });
    const s = Math.min(t.a, t.b), big = Math.max(t.a, t.b);
    const vals = { mx1: s, my1: 10, mp1: s * 10 };
    const m = VizLogic.malkreuz(t.viz, vals);
    assert.deepEqual(m.heads, [10, null]);
    assert.deepEqual(m.cells, [s * 10, undefined]);
    assert.equal(m.a, s);
    assert.ok(big > 10);
  });
  test('Zerlegungsbaum: nach dem ersten Teil ein Ast mit Fragezeichen, solange noch etwas übrig ist', () => {
    const t = { rest: 0, viz: { type: 'baum', D: 84, d: 6, dyn: true } };
    assert.deepEqual(VizLogic.baum(t, {}).parts, ['? : 6 = ?', '? : 6 = ?']);
    assert.deepEqual(VizLogic.baum(t, { p1: 60, q1: 10 }).parts, ['60 : 6 = 10', '? : 6 = ?']);
    assert.deepEqual(VizLogic.baum(t, { p1: 60, q1: 10, p2: 24, q2: 4 }).parts, ['60 : 6 = 10', '24 : 6 = 4']);
  });
});

describe('Zerlegungsbaum', () => {
  const task = { rest: 0, viz: { type: 'baum', D: 84, d: 6, parts: [60, 24], quots: ['q1', 'q2'] } };

  test('vorgegebene Teile, Ergebnisse erst nach dem Rechnen', () => {
    assert.deepEqual(VizLogic.baum(task, {}), { parts: ['60 : 6 = ?', '24 : 6 = ?'], s: '' });
    assert.deepEqual(VizLogic.baum(task, { q1: 10, q2: 4, res: 14 }), { parts: ['60 : 6 = 10', '24 : 6 = 4'], s: '= 14' });
  });

  test('selbst zerlegte Teile kommen aus den Eingaben', () => {
    const t = { rest: 0, viz: { type: 'baum', D: 84, d: 6, parts: ['p1', 'p2'], quots: ['q1', 'q2'] } };
    assert.deepEqual(VizLogic.baum(t, {}).parts, ['? : 6 = ?', '? : 6 = ?']);
    assert.equal(VizLogic.baum(t, { p1: 60, p2: 24 }).parts[1], '24 : 6 = ?');
  });

  test('mit Rest', () => {
    const t = { rest: 3, viz: { type: 'baum', D: 87, d: 6, parts: [60, 27], quots: ['q1', 'q2'], rests: [null, 'r'] } };
    assert.equal(VizLogic.baum(t, { q1: 10, q2: 4 }).parts[1], '27 : 6 = 4', 'Rest erst, wenn er eingetragen ist');
    const done = VizLogic.baum(t, { q1: 10, q2: 4, r: 3, res: 14 });
    assert.equal(done.parts[1], '27 : 6 = 4 R 3');
    assert.equal(done.s, '= 14 R 3');
  });

  test('"Alles selbst": so viele Teile, wie das Kind rechnet', () => {
    let t;
    do { t = Tasks.generate({ op: ':', strategy: 'zerlegen', level: 'selbst', max: 1000 }); } while (t.answer < 4);
    const d = t.b, q = t.answer;
    const played = fresh(t);
    const r = play(played, (row, i) => [[d, d, 1], [d, d, 1], [(q - 2) * d, d, q - 2]][i] || null);
    assert.ok(r.ok);
    const b = VizLogic.baum(played, r.vals);
    assert.deepEqual(b.parts, [d + ' : ' + d + ' = 1', d + ' : ' + d + ' = 1', (q - 2) * d + ' : ' + d + ' = ' + (q - 2)]);
    assert.equal(b.s, '= ' + q + (t.rest ? ' R ' + t.rest : ''));
  });
});

describe('Punktefeld', () => {
  test('Plus-Kernaufgabe: Teilergebnisse neben den Reihen', () => {
    const v = { type: 'punktefeld', rows: 7, cols: 8, split: 5 };
    assert.deepEqual(VizLogic.punktefeld(v, {}).labels, [null, null], 'nichts ändern');
    assert.deepEqual(VizLogic.punktefeld(v, { p1: 40 }).labels, [40, null]);
    assert.deepEqual(VizLogic.punktefeld(v, { p1: 40, p2: 16 }).labels, [40, 16]);
    assert.deepEqual(VizLogic.punktefeld(v, {}), { rows: 7, cols: 8, split: 5, minus: false, labels: [null, null] });
  });
  test('Minus-Kernaufgabe: 10 Reihen, die letzten sind zu viel', () => {
    const v = { type: 'punktefeld', rows: 10, cols: 6, split: 9, minus: true };
    assert.deepEqual(VizLogic.punktefeld(v, { p1: 60, p2: 6 }).labels, ['10 · 6', '− 6']);
  });
  test('"Alles selbst": das Punktefeld folgt der Zerlegung des Kindes', () => {
    let t;
    do { t = Tasks.generate({ op: '·', strategy: 'kernaufgaben', level: 'selbst' }); } while (t.b !== 7 || t.a === 7);
    // 7 = 5 + 2 bei der zweiten Zahl: 5 · a, dann 2 · a
    const played = fresh(t);
    const r = play(played, (row, i) => [[5, t.a, 5 * t.a], [2, t.a, 2 * t.a], [5 * t.a, 2 * t.a, t.answer]][i]);
    assert.ok(r.ok);
    const m = VizLogic.punktefeld(played.viz, r.vals);
    assert.equal(m.rows, 7);
    assert.equal(m.cols, t.a);
    assert.equal(m.split, 5);
    assert.equal(m.minus, false);
    // 10 − 2 bei 8
    let u;
    do { u = Tasks.generate({ op: '·', strategy: 'kernaufgaben', level: 'selbst' }); } while (u.a !== 8);
    const pu = fresh(u);
    const ru = play(pu);
    const mu = VizLogic.punktefeld(pu.viz, ru.vals);
    assert.deepEqual([mu.rows, mu.cols, mu.split, mu.minus], [10, u.b, 8, true]);
  });
});

describe('Rechenstrich', () => {
  test('Breite passt sich dem Platz an (320 bis 640)', () => {
    assert.equal(VizLogic.lineWidth(1000), 640);
    assert.equal(VizLogic.lineWidth(450.4), 450);
    assert.equal(VizLogic.lineWidth(200), 320);
    assert.equal(VizLogic.lineWidth(0), 640, 'ohne Messwert die volle Breite');
    assert.equal(VizLogic.lineWidth(-60), 640);
  });

  test('alle Zahlen passen auf den Strich, ohne sich zu überlappen', () => {
    for (const W of [320, 450, 640]) {
      for (let k = 0; k < 400; k++) {
        const t = Tasks.generate({ op: k % 2 ? '+' : '−', level: ['hilfe', 'zerlegen', 'selbst'][k % 3] });
        if (!t.line) continue;
        const L = VizLogic.lineLayout(t, W);
        const values = [t.line.start].concat(L.jumps.map((x) => x.j.to));
        const xs = [...new Set(values)].sort((a, b) => a - b).map(L.x);
        assert.ok(xs[0] >= VizLogic.PAD - 0.01, 'links im Bild');
        assert.ok(xs[xs.length - 1] <= W - VizLogic.PAD + 0.01, Tasks.taskText(t) + ': rechts im Bild bei ' + W);
        for (let i = 1; i < xs.length; i++) {
          assert.ok(xs[i] - xs[i - 1] >= VizLogic.GAP - 0.01, Tasks.taskText(t) + ': Abstand ' + (xs[i] - xs[i - 1]));
        }
      }
    }
  });

  test('Sprünge gehören zu ihrer Zeile', () => {
    const t = { line: { start: 37 }, rows: [{ jump: { from: 37, to: 40, text: '+3' } }, {}, { jump: { from: 40, to: 82, text: '+42' } }] };
    const L = VizLogic.lineLayout(t, 640);
    assert.deepEqual(L.jumps.map((x) => x.row), [0, 2]);
    assert.ok(L.x(37) < L.x(40) && L.x(40) < L.x(82));
  });

  test('Sprünge können von den Eingaben abhängen (Funktion)', () => {
    const row = { jump: (vals) => ({ from: vals.x1, to: vals.x1 + vals.y1, text: '+' + vals.y1 }) };
    assert.deepEqual(VizLogic.resolveJump(row, { x1: 47, y1: 3 }), { from: 47, to: 50, text: '+3' });
    assert.deepEqual(VizLogic.resolveJump({ jump: { from: 1, to: 2, text: '+1' } }, {}), { from: 1, to: 2, text: '+1' });
    assert.equal(VizLogic.resolveJump({}, {}), null);
  });

  test('"Alles selbst": eigene Schritte liegen auf dem Strich, Start ist der erste eigene Start', () => {
    for (const W of [320, 640]) {
      for (let k = 0; k < 200; k++) {
        const [op, strategy] = [['+', 'schrittweise'], ['+', 'hilfsaufgabe'], ['−', 'schrittweise'], ['−', 'hilfsaufgabe'], ['−', 'ergaenzen']][k % 5];
        const t = Tasks.generate({ op, strategy, level: 'selbst', max: k % 4 < 2 ? 100 : 1000 });
        if (!t.line) continue;
        const played = fresh(t), resolved = [];
        play(played, null, (row, i, vals) => {
          const j = VizLogic.resolveJump(row, vals);
          if (j) resolved.push({ row: i, j });
        });
        assert.ok(resolved.length >= 1, Tasks.taskText(t));
        const L = VizLogic.lineLayout(played, W, resolved);
        assert.equal(L.start, resolved[0].j.from);
        const values = [L.start].concat(resolved.map((x) => x.j.to));
        const xs = [...new Set(values)].sort((a, b) => a - b).map(L.x);
        assert.ok(xs[0] >= VizLogic.PAD - 0.01 && xs[xs.length - 1] <= W - VizLogic.PAD + 0.01, Tasks.taskText(t));
        for (let i = 1; i < xs.length; i++) assert.ok(xs[i] - xs[i - 1] >= VizLogic.GAP - 0.01, Tasks.taskText(t));
      }
    }
  });

  test('viele kleine Schritte: alles bleibt im Bild', () => {
    const t = { line: { start: 100, end: 900 }, rows: [] };
    const resolved = [];
    for (let i = 0; i < 16; i++) resolved.push({ row: i, j: { from: 100 + i * 50, to: 150 + i * 50, text: '+50' } });
    const L = VizLogic.lineLayout(t, 320, resolved);
    for (let v = 100; v <= 900; v += 50) assert.ok(L.x(v) >= VizLogic.PAD - 0.01 && L.x(v) <= 320 - VizLogic.PAD + 0.01, String(v));
    assert.ok(L.x(150) > L.x(100));
  });
});

describe('miniSvg: kleiner Begleiter auf dem Rechenstrich', () => {
  test('Einhorn und Fahrzeug werden verkleinert, Klassen bleiben erhalten', () => {
    const pony = VizLogic.miniSvg('<svg class="pony" viewBox="0 0 1 1"><g/></svg>');
    const car = VizLogic.miniSvg('<svg class="pony vehicle" viewBox="0 0 1 1"><g/></svg>');
    for (const s of [pony, car]) {
      assert.match(s, /^<svg x="-26" y="-50" width="52" height="48" class="pony mini/);
      assert.equal((s.match(/class=/g) || []).length, 1, 'nur ein class-Attribut');
    }
    assert.match(car, /class="pony mini vehicle"/);
  });
});
