// Inhalte der Anschauungen ohne DOM: Malkreuz, Zerlegungsbaum, Punktefeld, Rechenstrich (js/viz-logic.js).
'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const VizLogic = require('../js/viz-logic.js');
const Tasks = require('../js/tasks.js');

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
    assert.deepEqual(VizLogic.malkreuz(v, {}), { h0: null, h1: null, c0: undefined, c1: undefined, sum: '= ?' });
    assert.deepEqual(VizLogic.malkreuz(v, { p1: 80 }), { h0: 20, h1: null, c0: 80, c1: undefined, sum: '= ?' });
    assert.deepEqual(VizLogic.malkreuz(v, { p1: 80, p2: 12, res: 92 }), { h0: 20, h1: 3, c0: 80, c1: 12, sum: '= 92' });
  });

  test('"Mit Hilfe": die Zerlegung steht von Anfang an da', () => {
    const v = { type: 'malkreuz', a: 4, parts: [20, 3], cells: ['p1', 'p2'], partIds: null };
    const m = VizLogic.malkreuz(v, {});
    assert.equal(m.h0, 20);
    assert.equal(m.h1, 3);
    assert.equal(show(m.c0), '?');
  });

  test('"Zerlegung selbst": die Zerlegung zeigt, was das Kind eingetragen hat', () => {
    const v = { type: 'malkreuz', a: 4, parts: [20, 3], cells: ['p1', 'p2'], partIds: ['bt', 'bo'] };
    assert.equal(show(VizLogic.malkreuz(v, {}).h0), '?');
    const m = VizLogic.malkreuz(v, { bt: 20, bo: 3 });
    assert.deepEqual([m.h0, m.h1], [20, 3]);
  });

  test('passt zu den echten Aufgaben aller Stufen', () => {
    for (const level of ['hilfe', 'zerlegen', 'selbst']) {
      const t = Tasks.generate({ op: '·', strategy: 'zerlegen', level });
      const before = VizLogic.malkreuz(t.viz, {});
      assert.equal(show(before.h0) === '?', level !== 'hilfe', level + ': Zerlegung am Anfang ' + (level === 'hilfe' ? 'sichtbar' : 'verborgen'));
    }
  });
});

describe('Zerlegungsbaum', () => {
  const task = { rest: 0, viz: { type: 'baum', D: 84, d: 6, parts: [60, 24], quots: ['q1', 'q2'] } };

  test('vorgegebene Teile, Ergebnisse erst nach dem Rechnen', () => {
    assert.deepEqual(VizLogic.baum(task, {}), { a: '60 : 6 = ?', b: '24 : 6 = ?', s: '' });
    assert.deepEqual(VizLogic.baum(task, { q1: 10, q2: 4, res: 14 }), { a: '60 : 6 = 10', b: '24 : 6 = 4', s: 'zusammen: 14' });
  });

  test('selbst zerlegte Teile kommen aus den Eingaben', () => {
    const t = { rest: 0, viz: { type: 'baum', D: 84, d: 6, parts: ['p1', 'p2'], quots: ['q1', 'q2'] } };
    assert.deepEqual(VizLogic.baum(t, {}), { a: '? : 6 = ?', b: '? : 6 = ?', s: '' });
    assert.equal(VizLogic.baum(t, { p1: 60, p2: 24 }).b, '24 : 6 = ?');
  });

  test('mit Rest', () => {
    const t = { rest: 3, viz: { type: 'baum', D: 87, d: 6, parts: [60, 27], quots: ['q1', 'q2'] } };
    assert.equal(VizLogic.baum(t, { q1: 10, q2: 4 }).b, '27 : 6 = 4', 'Rest erst, wenn er eingetragen ist');
    const done = VizLogic.baum(t, { q1: 10, q2: 4, r: 3, res: 14 });
    assert.equal(done.b, '27 : 6 = 4 R 3');
    assert.equal(done.s, 'zusammen: 14 R 3');
  });
});

describe('Punktefeld', () => {
  test('Plus-Kernaufgabe: Teilergebnisse neben den Reihen', () => {
    const v = { type: 'punktefeld', rows: 7, cols: 8, split: 5 };
    assert.deepEqual(VizLogic.punktefeld(v, {}), [null, null], 'nichts ändern');
    assert.deepEqual(VizLogic.punktefeld(v, { p1: 40 }), [40, null]);
    assert.deepEqual(VizLogic.punktefeld(v, { p1: 40, p2: 16 }), [40, 16]);
  });
  test('Minus-Kernaufgabe: 10 Reihen, die letzten sind zu viel', () => {
    const v = { type: 'punktefeld', rows: 10, cols: 6, split: 9, minus: true };
    assert.deepEqual(VizLogic.punktefeld(v, { p1: 60, p2: 6 }), ['10 · 6', '− 6']);
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
