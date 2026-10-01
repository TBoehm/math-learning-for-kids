// Schriftliches Addieren und Subtrahieren (js/formats/schriftlich.js) – testgetrieben.
'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const Tasks = require('../js/tasks.js');
const Check = require('../js/check.js');
const UI = require('../js/ui-logic.js');
const Settings = require('../js/settings.js');

const I = (id, answer, extra) => Object.assign({ t: 'in', id, answer, check: (x) => x === answer }, extra || {});

describe('Gerüst: leere Felder, die etwas bedeuten (z. B. kein Übertrag)', () => {
  test('ein leeres Feld mit blank zählt als dieser Wert', () => {
    const row = { tokens: [I('d', 4), I('u', 0, { blank: 0 })] };
    const r = Check.checkRow(row, { d: '4', u: '' }, {});
    assert.equal(r.complete, true);
    assert.equal(r.correct, true);
    assert.deepEqual(r.vals, { d: 4, u: 0 });
  });
  test('leer gelassen, obwohl etwas hingehört: falsch', () => {
    const row = { tokens: [I('d', 2), I('u', 1, { blank: 0 })] };
    const r = Check.checkRow(row, { d: '2', u: '' }, {});
    assert.equal(r.complete, true);
    assert.deepEqual(r.fields.map((f) => f.status), ['correct', 'wrong']);
  });
  test('0 eintragen geht auch', () => {
    const row = { tokens: [I('u', 0, { blank: 0 })] };
    assert.equal(Check.checkRow(row, { u: '0' }, {}).correct, true);
  });
  test('blank als Funktion: Wert aus den schon richtigen Feldern (Gesamtergebnis aus Ziffern)', () => {
    const sum = { t: 'in', id: 'res', answer: 42, check: (v) => v === 42, deps: ['z'], silent: true,
      blank: (vals) => (vals.z === undefined ? -1 : vals.z * 10 + vals.e) };
    const row = { tokens: [I('z', 4), sum] };
    assert.equal(Check.checkRow(row, { z: '4', res: '' }, { e: 2 }).correct, true);
    const bad = Check.checkRow(row, { z: '5', res: '' }, { e: 2 });
    assert.deepEqual(bad.fields.map((f) => f.status), ['wrong', 'pending']);
    const empty = Check.checkRow(row, { z: '', res: '' }, { e: 2 });
    assert.equal(empty.complete, false);
  });
  test('Lösungstext: versteckte Felder und "leer lassen" werden nicht genannt', () => {
    const sum = { t: 'in', id: 'res', answer: 42, check: (v) => v === 42, deps: ['z'], silent: true, blank: () => -1 };
    const row = { tokens: [I('z', 4), I('u', 0, { blank: 0 }), sum] };
    const r = Check.checkRow(row, { z: '5', u: '1', res: '' }, { e: 2 });
    assert.equal(Check.solutionText(row, r), '4');
    const r2 = Check.checkRow(row, { z: '4', u: '1', res: '' }, { e: 2 });
    assert.equal(Check.solutionText(row, r2), '');
  });
  test('ohne nennbare Lösung: nur der Tipp', () => {
    const row = { hint: 'Kein Übertrag.', tokens: [I('z', 4), I('u', 0, { blank: 0 })] };
    const r = Check.checkRow(row, { z: '4', u: '1' }, {});
    assert.equal(UI.wrongText(row, r, 3), 'Kein Übertrag.');
  });
});

describe('Gerüst: Aufgabentext, Einleitung, Reihenfolge der Gruppen', () => {
  test('Aufgabentext mit drei Zahlen', () => {
    assert.equal(Tasks.taskText({ op: '+', a: 235, b: 123, terms: [235, 123, 418] }), '235 + 123 + 418');
    assert.equal(Tasks.taskText({ op: '−', a: 503, b: 278 }), '503 − 278');
  });
  test('eigene Einleitung einer Aufgabenart', () => {
    assert.equal(UI.introText({ strategy: 'neu', intro: 'rechne schriftlich.', level: 'hilfe' }, ''), 'Rechne schriftlich.');
    assert.equal(UI.introText({ strategy: 'neu', intro: 'rechne schriftlich.', level: 'hilfe' }, 'Mia'), 'Mia, rechne schriftlich.');
  });
  test('Auswahl der Rechenwege in der Reihenfolge der Gruppen', () => {
    require('../js/formats/schriftlich.js');
    Tasks.register('+', { key: 'testmauer', name: 'Mauer', group: 'knobeln', gen() { return null; } });
    const groups = Settings.strategyChoices('+').map((s) => s.group);
    const order = Tasks.GROUPS.map((g) => g.key);
    const idx = groups.map((g) => order.indexOf(g));
    assert.deepEqual(idx, idx.slice().sort((x, y) => x - y));
    assert.deepEqual([...new Set(groups)], ['weg', 'knobeln', 'schriftlich']);
  });
});

// ---------------------------------------------------------------------------
const S = require('../js/formats/schriftlich.js');

const inputsOf = (row) => row.tokens.filter((t) => t.t === 'in');
const ids = (row) => inputsOf(row).map((t) => t.id);
const answers = (row) => inputsOf(row).map((t) => t.answer);
// Musterlösung einer Zeile: Felder, die leer bleiben dürfen, bleiben leer; versteckte Felder sind leer
const blankOk = (t) => typeof t.blank === 'number' && t.answer === t.blank;
function canonical(row, zeros) {
  const raw = {};
  inputsOf(row).forEach((t) => { raw[t.id] = t.silent ? '' : blankOk(t) && !zeros ? '' : String(t.answer); });
  return raw;
}
function solve(task, zeros) {
  let vals = {};
  task.rows.forEach((row, i) => {
    const r = Check.checkRow(row, canonical(row, zeros), vals);
    assert.equal(r.correct, true, Tasks.taskText(task) + ' Zeile ' + i + ' (' + row.label + '): ' + JSON.stringify(r.fields));
    vals = r.vals;
  });
  assert.equal(Check.isSolved(task, vals), true, Tasks.taskText(task) + ' gelöst');
  assert.equal(vals.res, task.answer);
  return vals;
}
// Jede falsche Eingabe in einem Feld wird abgelehnt
function rejectsWrong(task) {
  let vals = {};
  task.rows.forEach((row, i) => {
    const raw = canonical(row);
    inputsOf(row).filter((t) => !t.silent).forEach((t) => {
      const wrong = Object.assign({}, raw, { [t.id]: String(t.answer + 1) });
      assert.equal(Check.checkRow(row, wrong, vals).correct, false, Tasks.taskText(task) + ' Zeile ' + i + ' ' + t.id + ' nimmt ' + (t.answer + 1));
      if (blankOk(t)) return;
      // auch leer lassen ist falsch, wenn etwas hingehört
      const empty = Object.assign({}, raw, { [t.id]: '' });
      assert.equal(Check.checkRow(row, empty, vals).correct, false, Tasks.taskText(task) + ' Zeile ' + i + ' ' + t.id + ' leer');
    });
    vals = Check.checkRow(row, raw, vals).vals;
  });
}
const step = (task, label) => task.rows.find((r) => r.label === label);

describe('Schriftlich addieren: Rechnung Stelle für Stelle', () => {
  test('ohne Übertrag: 235 + 123', () => {
    const p = S.addPlan([235, 123]);
    assert.deepEqual(p.cols.map((c) => [c.sum, c.digit, c.carryOut]), [[8, 8, 0], [5, 5, 0], [3, 3, 0]]);
    assert.deepEqual(p.result, [8, 5, 3]);
  });
  test('mit Übertrag: 438 + 254', () => {
    const p = S.addPlan([438, 254]);
    assert.deepEqual(p.cols.map((c) => [c.carryIn, c.sum, c.digit, c.carryOut]), [[0, 12, 2, 1], [1, 9, 9, 0], [0, 6, 6, 0]]);
  });
  test('zwei Überträge: 567 + 389', () => {
    const p = S.addPlan([567, 389]);
    assert.deepEqual(p.cols.map((c) => [c.sum, c.digit, c.carryOut]), [[16, 6, 1], [15, 5, 1], [9, 9, 0]]);
    assert.deepEqual(p.result, [6, 5, 9]);
  });
  test('Übertrag bis zu den Tausendern: 567 + 433 = 1000', () => {
    const p = S.addPlan([567, 433]);
    assert.deepEqual(p.result, [0, 0, 0, 1]);
    assert.equal(p.cols[2].carryOut, 1);
  });
  test('drei Zahlen: Übertrag kann 2 sein (99 + 99 + 99)', () => {
    const p = S.addPlan([99, 99, 99]);
    assert.deepEqual(p.cols.map((c) => [c.sum, c.digit, c.carryOut]), [[27, 7, 2], [29, 9, 2]]);
    assert.deepEqual(p.result, [7, 9, 2]);
  });
  test('verschieden lange Zahlen stehen stellengerecht: 438 + 54', () => {
    const p = S.addPlan([438, 54]);
    assert.deepEqual(p.cols[2].digits, [4, null]);
    assert.deepEqual(p.result, [2, 9, 4]);
  });
});

describe('Schriftlich subtrahieren: Abziehen mit Entbündeln', () => {
  test('ohne Entbündeln: 587 − 253', () => {
    const p = S.subPlan(587, 253);
    assert.ok(p.cols.every((c) => c.changes.length === 0));
    assert.deepEqual(p.result, [4, 3, 3]);
  });
  test('zweimal entbündeln: 532 − 278', () => {
    const p = S.subPlan(532, 278);
    assert.deepEqual(p.cols[0].changes, [{ col: 1, v: 2, kind: 'L' }, { col: 0, v: 12, kind: 'B' }]);
    assert.deepEqual(p.cols[1].changes, [{ col: 2, v: 4, kind: 'L' }, { col: 1, v: 12, kind: 'B' }]);
    assert.deepEqual(p.cols.map((c) => [c.top, c.bottom, c.digit]), [[12, 8, 4], [12, 7, 5], [4, 2, 2]]);
  });
  test('Null in der Mitte: 503 − 278 (aus 5 wird 4, aus 0 wird 9, aus 3 wird 13)', () => {
    const p = S.subPlan(503, 278);
    assert.deepEqual(p.cols[0].changes, [{ col: 2, v: 4, kind: 'L' }, { col: 1, v: 9, kind: 'L' }, { col: 0, v: 13, kind: 'B' }]);
    assert.deepEqual(p.cols[1].changes, []);
    assert.deepEqual(p.result, [5, 2, 2]);
  });
  test('zwei Nullen: 600 − 1', () => {
    const p = S.subPlan(600, 1);
    assert.deepEqual(p.cols[0].changes.map((c) => [c.col, c.v]), [[2, 5], [1, 9], [0, 10]]);
    assert.deepEqual(p.result, [9, 9, 5]);
  });
  test('kürzere Zahl unten: 438 − 54', () => {
    const p = S.subPlan(438, 54);
    assert.equal(p.cols[2].bottom, null);
    assert.deepEqual(p.result, [4, 8, 3]);
  });
  test('Ergebnis mit weniger Stellen: 532 − 478 = 54', () => {
    assert.deepEqual(S.subPlan(532, 478).result, [4, 5, 0]);
  });
});

describe('Schriftlich subtrahieren: Ergänzen mit Erweitern', () => {
  test('532 − 278: 8 + 4 = 12, 8 + 5 = 13, 3 + 2 = 5', () => {
    const p = S.ergPlan(532, 278);
    assert.deepEqual(p.cols.map((c) => [c.carryIn, c.need, c.target, c.digit, c.carryOut]),
      [[0, 8, 12, 4, 1], [1, 8, 13, 5, 1], [1, 3, 5, 2, 0]]);
  });
  test('503 − 278', () => {
    assert.deepEqual(S.ergPlan(503, 278).result, [5, 2, 2]);
  });
});

describe('Aufgabe aufbauen: Zeilen in der Reihenfolge des Rechnens', () => {
  test('Plus, Alles selbst: Überschlag, Einer, Zehner, Hunderter', () => {
    const t = S.build('add', [438, 254], { level: 'selbst', max: 1000 });
    assert.equal(t.layout, 'column');
    assert.equal(t.answer, 692);
    assert.equal(Tasks.taskText(t), '438 + 254');
    assert.deepEqual(t.rows.map((r) => r.label), ['Überschlag', 'Einer', 'Zehner', 'Hunderter']);
    assert.deepEqual(ids(t.rows[1]), ['d0', 'u1']);
    assert.deepEqual(answers(t.rows[1]), [2, 1]);
    assert.deepEqual(ids(t.rows[2]), ['d1', 'u2']);
    assert.equal(t.rows[2].tokens.find((x) => x.id === 'u2').blank, 0, 'kein Übertrag: Feld darf leer bleiben');
    // Tausender-Feld darf leer bleiben, das Ergebnis setzt sich aus den Ziffern zusammen
    assert.deepEqual(ids(t.rows[3]), ['d2', 'd3', 'res']);
    assert.equal(t.rows[3].tokens.find((x) => x.id === 'd3').blank, 0);
    solve(t); solve(t, true); rejectsWrong(t);
  });
  test('jede Spalte hat ihren Platz im Raster', () => {
    const t = S.build('add', [438, 254], { level: 'selbst', max: 1000 });
    assert.equal(t.column.ncols, 4);
    assert.deepEqual(t.column.terms, [438, 254]);
    assert.deepEqual(t.rows.map((r) => r.col), [undefined, 0, 1, 2]);
    assert.deepEqual(t.rows[1].tokens.filter((x) => x.place).map((x) => [x.place.line, x.place.col]), [['res', 0], ['carry', 1]]);
    for (const row of t.rows) {
      for (const tok of row.tokens) {
        if (!tok.place || tok.place.line === 'hidden') continue;
        assert.ok(t.column.lines.includes(tok.place.line), tok.place.line);
        assert.ok(tok.place.col < t.column.ncols);
      }
    }
  });
  test('Mit Hilfe: Überträge stehen schon da, nur die Ziffern eintragen', () => {
    const t = S.build('add', [438, 254], { level: 'hilfe', max: 1000 });
    assert.deepEqual(ids(t.rows[1]), ['d0']);
    assert.deepEqual(t.rows[1].tokens.filter((x) => x.t === 'num').map((x) => [x.v, x.place.line, x.place.col]), [[1, 'carry', 1]]);
    assert.deepEqual(ids(t.rows[2]), ['d1']);
    assert.equal(t.column.ncols, 3, 'kein Tausender-Feld, wenn keins gebraucht wird');
    solve(t); rejectsWrong(t);
  });
  test('Zerlegung selbst: Übertrag-Felder nur, wo ein Übertrag entsteht', () => {
    const t = S.build('add', [438, 254], { level: 'zerlegen', max: 1000 });
    assert.deepEqual(ids(t.rows[1]), ['d0', 'u1']);
    assert.equal(t.rows[1].tokens.find((x) => x.id === 'u1').blank, undefined);
    assert.deepEqual(ids(t.rows[2]), ['d1']);
    solve(t); rejectsWrong(t);
  });
  test('567 + 433 = 1000: Hunderter 0, Tausender 1', () => {
    for (const level of ['hilfe', 'zerlegen', 'selbst']) {
      const t = S.build('add', [567, 433], { level, max: 1000 });
      assert.equal(t.answer, 1000);
      assert.equal(t.column.ncols, 4);
      const h = step(t, 'Hunderter');
      assert.deepEqual(ids(h).filter((x) => x !== 'res'), ['d2', 'd3']);
      assert.deepEqual(answers(h).slice(0, 2), [0, 1]);
      assert.equal(h.tokens.find((x) => x.id === 'd3').blank, undefined, 'die 1 muss hin');
      solve(t); rejectsWrong(t);
    }
  });
  test('drei Zahlen mit Übertrag 2', () => {
    const t = S.build('add', [199, 299, 399], { level: 'selbst', max: 1000 });
    assert.equal(t.answer, 897);
    assert.equal(Tasks.taskText(t), '199 + 299 + 399');
    assert.deepEqual(answers(step(t, 'Einer')), [7, 2]);
    assert.deepEqual(t.column.lines.filter((l) => /^t/.test(l)), ['t0', 't1', 't2']);
    solve(t); rejectsWrong(t);
  });
  test('zweistellig (Zahlenraum bis 100): Zehner und Einer', () => {
    const t = S.build('add', [47, 38], { level: 'selbst', max: 100 });
    assert.deepEqual(t.rows.map((r) => r.label), ['Überschlag', 'Einer', 'Zehner']);
    solve(t); rejectsWrong(t);
    const h = S.build('add', [47, 53], { level: 'hilfe', max: 100 });
    assert.deepEqual(answers(step(h, 'Zehner')), [0, 1, 100]);
    solve(h);
  });

  test('Minus mit Entbündeln, Zerlegung selbst: erst umwechseln, dann rechnen', () => {
    const t = S.build('sub', [532, 278], { level: 'zerlegen', max: 1000 });
    assert.deepEqual(t.rows.map((r) => r.label), ['Überschlag', 'Einer', 'Zehner', 'Hunderter']);
    assert.deepEqual(ids(t.rows[1]), ['l1', 'b0', 'd0']);
    assert.deepEqual(answers(t.rows[1]), [2, 12, 4]);
    assert.deepEqual(ids(t.rows[2]), ['l2', 'b1', 'd1']);
    assert.deepEqual(answers(t.rows[2]), [4, 12, 5]);
    assert.deepEqual(ids(t.rows[3]), ['d2', 'res']);
    const place = (id) => t.rows.flatMap((r) => r.tokens).find((x) => x.id === id).place;
    assert.deepEqual(place('l1'), { line: 'n1', col: 1 });
    assert.deepEqual(place('b1'), { line: 'n2', col: 1 }, 'zweites Umwechseln steht darüber');
    assert.deepEqual(place('b0'), { line: 'n1', col: 0 });
    assert.deepEqual(t.column.lines, ['head', 'n2', 'n1', 't0', 't1', 'res']);
    solve(t); rejectsWrong(t);
  });
  test('Minus, Alles selbst, Null in der Mitte (503 − 278): Kind entscheidet selbst, wo es umwechselt', () => {
    const t = S.build('sub', [503, 278], { level: 'selbst', max: 1000 });
    assert.deepEqual(ids(t.rows[1]), ['d0', 'l2', 'l1', 'b0']);
    assert.deepEqual(answers(t.rows[1]), [5, 4, 9, 13]);
    assert.deepEqual(ids(t.rows[2]), ['d1', 'b1']);
    assert.equal(t.rows[2].tokens.find((x) => x.id === 'b1').blank, 0);
    assert.deepEqual(ids(t.rows[3]), ['d2', 'res']);
    solve(t); solve(t, true); rejectsWrong(t);
  });
  test('Minus, Alles selbst, ohne Umwechseln bei den Einern: leere Felder überall möglich', () => {
    const t = S.build('sub', [528, 274], { level: 'selbst', max: 1000 });
    assert.deepEqual(ids(t.rows[1]), ['d0', 'l1', 'b0']);
    assert.ok(inputsOf(t.rows[1]).slice(1).every((x) => x.blank === 0 && x.answer === 0));
    assert.deepEqual(ids(t.rows[2]), ['d1', 'l2', 'b1']);
    assert.deepEqual(answers(t.rows[2]), [5, 4, 12]);
    solve(t); rejectsWrong(t);
  });
  test('Minus mit Hilfe: umgewechselte Zahlen stehen schon da', () => {
    const t = S.build('sub', [503, 278], { level: 'hilfe', max: 1000 });
    assert.deepEqual(ids(t.rows[1]), ['d0']);
    assert.deepEqual(t.rows[1].tokens.filter((x) => x.t === 'num').map((x) => [x.v, x.place.line, x.place.col]),
      [[4, 'n1', 2], [9, 'n1', 1], [13, 'n1', 0]]);
    assert.deepEqual(t.column.lines, ['head', 'n1', 't0', 't1', 'res']);
    solve(t); rejectsWrong(t);
  });
  test('Ergebnis mit weniger Stellen (532 − 478 = 54): vorne bleibt das Feld leer', () => {
    const t = S.build('sub', [532, 478], { level: 'zerlegen', max: 1000 });
    const h = step(t, 'Hunderter');
    assert.equal(h.tokens.find((x) => x.id === 'd2').blank, 0);
    solve(t); solve(t, true);
  });
  test('Minus durch Ergänzen: Übertrag wie beim Plus', () => {
    const t = S.build('erg', [532, 278], { level: 'zerlegen', max: 1000 });
    assert.deepEqual(ids(t.rows[1]), ['d0', 'u1']);
    assert.deepEqual(answers(t.rows[1]), [4, 1]);
    assert.deepEqual(ids(t.rows[3]), ['d2', 'res']);
    assert.deepEqual(t.column.lines, ['head', 't0', 't1', 'carry', 'res']);
    solve(t); rejectsWrong(t);
    const h = S.build('erg', [532, 278], { level: 'hilfe', max: 1000 });
    assert.deepEqual(ids(h.rows[1]), ['d0']);
    solve(h); rejectsWrong(h);
    const s = S.build('erg', [503, 278], { level: 'selbst', max: 1000 });
    solve(s); solve(s, true); rejectsWrong(s);
  });
});

describe('Überschlag', () => {
  test('runden', () => {
    assert.equal(S.roundTo(438, 10), 440);
    assert.equal(S.roundTo(435, 10), 440);
    assert.equal(S.roundTo(254, 10), 250);
    assert.equal(S.roundTo(254, 100), 300);
    assert.equal(S.roundTo(249, 100), 200);
  });
  test('Mit Hilfe: gerundete Zahlen stehen da, nur rechnen', () => {
    const t = S.build('add', [438, 254], { level: 'hilfe', max: 1000 });
    const u = t.rows[0];
    assert.deepEqual(u.tokens.filter((x) => x.t === 'num').map((x) => x.v), [440, 250]);
    assert.deepEqual(ids(u), ['gs']);
    assert.equal(u.tokens.find((x) => x.id === 'gs').answer, 690);
  });
  test('selbst runden: auf Zehner oder auf Hunderter, aber alle Zahlen gleich', () => {
    const u = S.build('add', [438, 254], { level: 'selbst', max: 1000 }).rows[0];
    assert.deepEqual(ids(u), ['g1', 'g2', 'gs']);
    const ok = (g1, g2, gs) => Check.checkRow(u, { g1, g2, gs }, {}).correct;
    assert.equal(ok('440', '250', '690'), true);
    assert.equal(ok('400', '300', '700'), true);
    assert.equal(ok('440', '300', '740'), false);
    assert.equal(ok('430', '250', '680'), false);
    assert.equal(ok('440', '250', '700'), false);
  });
  test('Minus: 532 − 278 ≈ 530 − 280 = 250', () => {
    const u = S.build('sub', [532, 278], { level: 'zerlegen', max: 1000 }).rows[0];
    assert.equal(Check.checkRow(u, { g1: '530', g2: '280', gs: '250' }, {}).correct, true);
    assert.equal(Check.checkRow(u, { g1: '500', g2: '300', gs: '200' }, {}).correct, true);
  });
  test('Tipp: wie wird gerundet?', () => {
    assert.equal(S.build('add', [470, 19], { level: 'selbst', max: 1000 }).rows[0].hint,
      'Runde auf glatte Zehner: 470 bleibt, 19 wird 20. Rechne dann 470 + 20.');
    assert.equal(S.build('sub', [532, 278], { level: 'hilfe', max: 1000 }).rows[0].hint,
      'Rechne mit den gerundeten Zahlen: 530 − 280.');
  });
  test('bis 100: nur auf Zehner runden', () => {
    const u = S.build('add', [47, 38], { level: 'selbst', max: 100 }).rows[0];
    assert.equal(Check.checkRow(u, { g1: '50', g2: '40', gs: '90' }, {}).correct, true);
    assert.equal(Check.checkRow(u, { g1: '0', g2: '0', gs: '0' }, {}).correct, false);
  });
});

describe('Tipps je Spalte', () => {
  test('Plus mit Übertrag', () => {
    const t = S.build('add', [438, 254], { level: 'selbst', max: 1000 });
    assert.equal(step(t, 'Einer').hint, 'Einer: 8 + 4 = 12. Schreibe 2, übertrage 1 zu den Zehnern.');
    assert.equal(step(t, 'Zehner').hint, 'Zehner: 3 + 5 + 1 (Übertrag) = 9. Schreibe 9. Kein Übertrag.');
    assert.equal(step(t, 'Hunderter').hint, 'Hunderter: 4 + 2 = 6. Schreibe 6.');
  });
  test('Plus bis 1000', () => {
    const t = S.build('add', [567, 433], { level: 'selbst', max: 1000 });
    assert.equal(step(t, 'Hunderter').hint, 'Hunderter: 5 + 4 + 1 (Übertrag) = 10. Schreibe 0 und davor die 1 bei den Tausendern.');
  });
  test('Minus mit Entbündeln', () => {
    const t = S.build('sub', [532, 278], { level: 'selbst', max: 1000 });
    assert.equal(step(t, 'Einer').hint,
      'Einer: 2 − 8 geht nicht. Wechsle 1 Zehner in 10 Einer um: aus 3 wird 2, aus 2 wird 12. 12 − 8 = 4. Schreibe 4.');
    assert.equal(step(t, 'Zehner').hint,
      'Zehner: 2 − 7 geht nicht. Wechsle 1 Hunderter in 10 Zehner um: aus 5 wird 4, aus 2 wird 12. 12 − 7 = 5. Schreibe 5.');
    assert.equal(step(t, 'Hunderter').hint, 'Hunderter: 4 − 2 = 2. Schreibe 2.');
  });
  test('Minus mit Null in der Mitte', () => {
    const t = S.build('sub', [503, 278], { level: 'selbst', max: 1000 });
    assert.equal(step(t, 'Einer').hint,
      'Einer: 3 − 8 geht nicht, und bei den Zehnern ist nichts. Wechsle 1 Hunderter in 10 Zehner um und davon 1 Zehner in 10 Einer: ' +
      'aus 5 wird 4, aus 0 wird 9, aus 3 wird 13. 13 − 8 = 5. Schreibe 5.');
  });
  test('Minus: unten steht nichts, vorne keine 0', () => {
    assert.equal(step(S.build('sub', [438, 54], { level: 'selbst', max: 1000 }), 'Hunderter').hint,
      'Hunderter: Unten steht nichts. Schreibe die 3 ab.');
    assert.equal(step(S.build('sub', [532, 478], { level: 'selbst', max: 1000 }), 'Hunderter').hint,
      'Hunderter: 4 − 4 = 0. Eine 0 ganz vorne schreibst du nicht hin.');
  });
  test('Ergänzen', () => {
    const t = S.build('erg', [532, 278], { level: 'selbst', max: 1000 });
    assert.equal(step(t, 'Einer').hint, 'Einer: 8 + ? = 2 geht nicht, also bis 12: 8 + 4 = 12. Schreibe 4, übertrage 1 zu den Zehnern.');
    assert.equal(step(t, 'Zehner').hint, 'Zehner: 7 + 1 (Übertrag) = 8. 8 + ? = 3 geht nicht, also bis 13: 8 + 5 = 13. Schreibe 5, übertrage 1 zu den Hundertern.');
    assert.equal(step(t, 'Hunderter').hint, 'Hunderter: 2 + 1 (Übertrag) = 3. 3 + 2 = 5. Schreibe 2.');
  });
  test('dritter Fehler: Tipp ohne leeres "Die Lösung ist"', () => {
    const t = S.build('add', [438, 254], { level: 'selbst', max: 1000 });
    const row = step(t, 'Zehner');
    const r = Check.checkRow(row, { d1: '9', u2: '1' }, { d0: 2, u1: 1 });
    assert.equal(r.correct, false);
    assert.equal(UI.wrongText(row, r, 3), row.hint);
  });
});

describe('Erzeugen: Zahlenraum, Stufen, Übergänge', () => {
  const kinds = [['+', 'schriftlich', 'add'], ['−', 'schriftlich', 'sub'], ['−', 'schriftlich-erg', 'erg']];
  // gibt es einen Übertrag oder ein Umwechseln?
  const crosses = (t) => t.rows.some((r) => r.tokens.some((x) =>
    (x.t === 'in' && /^[lbu]\d/.test(x.id) && x.answer > 0) || (x.t === 'num' && x.place && x.place.line !== 'res')));
  test('angemeldet in der Gruppe "Schriftlich" mit eigener Darstellung', () => {
    for (const [op, key] of kinds) {
      const s = Tasks.STRATEGIES[op].find((x) => x.key === key);
      assert.equal(s.group, 'schriftlich');
      assert.match(s.name, /^Schriftlich/);
    }
  });
  for (const [op, key, kind] of kinds) {
    for (const max of [1000, 100]) {
      for (const level of ['hilfe', 'zerlegen', 'selbst']) {
        test(`${op} ${key} bis ${max}, ${level}: richtig, lösbar, im Zahlenraum`, () => {
          let three = 0;
          for (let i = 0; i < 250; i++) {
            const t = Tasks.generate({ op, strategy: key, level, max });
            assert.equal(t.layout, 'column');
            assert.equal(t.column.kind, kind);
            const terms = t.terms || [t.a, t.b];
            if (terms.length === 3) three++;
            const exact = op === '+' ? terms.reduce((x, y) => x + y) : t.a - t.b;
            assert.equal(t.answer, exact);
            assert.ok(t.answer <= max && t.answer > 0, Tasks.taskText(t));
            assert.ok(terms.every((x) => x >= 10 && x < max), Tasks.taskText(t));
            assert.equal(String(t.a).length, max === 1000 ? 3 : 2, Tasks.taskText(t));
            assert.match(UI.introText(t, ''), /^[A-ZÄÖÜ].+[.!?]/);
            solve(t);
            if (i < 40) rejectsWrong(t);
          }
          if (op === '+') assert.ok(three > 0, 'manchmal drei Zahlen');
        });
      }
    }
    test(`${op} ${key}: Übergang ohne / mit`, () => {
      for (let i = 0; i < 200; i++) {
        const without = Tasks.generate({ op, strategy: key, level: 'zerlegen', max: 1000, crossing: 'ohne' });
        assert.equal(crosses(without), false, Tasks.taskText(without));
        const withC = Tasks.generate({ op, strategy: key, level: 'zerlegen', max: 1000, crossing: 'mit' });
        assert.equal(crosses(withC), true, Tasks.taskText(withC));
      }
    });
  }
  test('Minus: manchmal eine Null in der Mitte', () => {
    let zero = 0;
    for (let i = 0; i < 400; i++) {
      const t = Tasks.generate({ op: '−', strategy: 'schriftlich', level: 'selbst', max: 1000, crossing: 'mit' });
      if (Math.floor(t.a / 10) % 10 === 0 && t.a % 10 < t.b % 10) zero++;
    }
    assert.ok(zero > 10, String(zero));
  });
  test('"Alle Wege" nimmt nie schriftliche Verfahren', () => {
    for (let i = 0; i < 300; i++) assert.notEqual(Tasks.generate({ op: '−', strategy: 'mix' }).group, 'schriftlich');
  });
});
