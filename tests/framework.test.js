// Erweiterungs-Gerüst: neue Aufgabenarten, Gruppen, Zahlenraum, Auswahlfelder, selbst verlängerte Rechnungen.
'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const Tasks = require('../js/tasks.js');
const Check = require('../js/check.js');
const UI = require('../js/ui-logic.js');
const Settings = require('../js/settings.js');

const I = (id, answer) => ({ t: 'in', id, answer, check: (v) => v === answer });
const C = (id, options, answer) => ({ t: 'choice', id, options, answer, check: (v) => v === answer });

describe('Aufgabenarten registrieren', () => {
  let seenOpt = null;
  Tasks.register('+', {
    key: 'testknobel', name: 'Test-Knobelei', desc: 'nur für Tests', group: 'knobeln',
    gen(opt) { seenOpt = opt; return { op: '+', strategy: 'testknobel', a: 1, b: 2, answer: 3, layout: 'wall', rows: [{ tokens: [I('res', 3)], label: '', hint: '' }] }; }
  });

  test('neue Aufgabenart ist in der Liste, mit Gruppe', () => {
    const s = Tasks.STRATEGIES['+'].find((x) => x.key === 'testknobel');
    assert.equal(s.group, 'knobeln');
    assert.ok(Tasks.STRATEGIES['+'].filter((x) => x.key !== 'testknobel').every((x) => x.group === 'weg'));
  });
  test('Gruppen in fester Reihenfolge', () => {
    assert.deepEqual(Tasks.GROUPS.map((g) => g.key), ['weg', 'knobeln', 'schriftlich']);
  });
  test('gezielt gewählt: wird erzeugt, bekommt Zahlenraum und Stufe', () => {
    const t = Tasks.generate({ op: '+', strategy: 'testknobel', max: 1000, level: 'selbst' });
    assert.equal(t.strategy, 'testknobel');
    assert.equal(t.layout, 'wall');
    assert.equal(seenOpt.max, 1000);
    assert.equal(seenOpt.level, 'selbst');
    assert.equal(t.max, 1000);
  });
  test('Zahlenraum: Standard 100, nur 100 oder 1000', () => {
    Tasks.generate({ op: '+', strategy: 'testknobel' });
    assert.equal(seenOpt.max, 100);
    Tasks.generate({ op: '+', strategy: 'testknobel', max: 5000 });
    assert.equal(seenOpt.max, 100);
  });
  test('"Alle Wege" und "Gemischt" nehmen nur Rechenwege, keine Knobeleien', () => {
    for (let i = 0; i < 300; i++) {
      assert.notEqual(Tasks.generate({ op: '+', strategy: 'mix' }).strategy, 'testknobel');
      assert.notEqual(Tasks.generate({ op: 'mix' }).strategy, 'testknobel');
    }
  });
  test('Doppelte Schlüssel sind ein Fehler', () => {
    assert.throws(() => Tasks.register('+', { key: 'testknobel', name: 'x', gen() {} }));
  });
});

describe('Auswahlfelder (z. B. "Welche Zeile ist falsch?")', () => {
  const row = { tokens: [C('wahl', ['Zeile 1', 'Zeile 2', 'Zeile 3'], 1), I('fix', 77)] };
  test('richtige Wahl', () => {
    const r = Check.checkRow(row, { wahl: '1', fix: '77' }, {});
    assert.deepEqual(r.fields.map((f) => f.status), ['correct', 'correct']);
    assert.deepEqual(r.vals, { wahl: 1, fix: 77 });
  });
  test('falsche Wahl', () => {
    assert.equal(Check.checkRow(row, { wahl: '2', fix: '77' }, {}).fields[0].status, 'wrong');
  });
  test('noch nichts gewählt', () => {
    assert.equal(Check.checkRow(row, { wahl: '', fix: '77' }, {}).fields[0].status, 'empty');
  });
  test('zählt für "gelöst" und bekommt eine Beschriftung', () => {
    const task = { answer: 77, rows: [{ tokens: [C('wahl', ['a', 'b'], 0), I('res', 77)] }] };
    assert.equal(Check.isSolved(task, { res: 77 }), false);
    assert.equal(Check.isSolved(task, { wahl: 0, res: 77 }), true);
    assert.equal(UI.cellLabels({ label: 'Fehler', tokens: task.rows[0].tokens }).length, 2);
  });
});

describe('Zahlen bis 1000: vier Ziffern', () => {
  test('parseNumber', () => {
    assert.equal(Check.parseNumber('1000'), 1000);
    assert.equal(Check.parseNumber('999'), 999);
    assert.ok(Number.isNaN(Check.parseNumber('12345')));
  });
  test('Eingabe und Zahlenfeld', () => {
    assert.equal(UI.sanitize('12345'), '1234');
    assert.equal(UI.applyKey('100', false, '0'), '1000');
    assert.equal(UI.applyKey('1000', false, '7'), '1000');
  });
});

describe('Rechnungen, die das Kind selbst verlängert ("Rechne auf deinem Weg")', () => {
  const row = (id, ans) => ({ tokens: [I(id, ans)], label: '', hint: '' });
  test('nach einer richtigen Zeile: fertig, nächste Zeile, neue Zeile anhängen oder hängen geblieben', () => {
    const fixed = { answer: 5, rows: [row('a', 1), row('res', 5)] };
    assert.equal(UI.afterCorrect(fixed, { a: 1 }, 0), 'next');
    assert.equal(UI.afterCorrect(fixed, { a: 1, res: 5 }, 1), 'finish');
    const open = { answer: 5, rows: [row('a', 1)], nextRow: () => row('res', 5) };
    assert.equal(UI.afterCorrect(open, { a: 1 }, 0), 'append');
    const stuck = { answer: 5, rows: [row('a', 1)] };
    assert.equal(UI.afterCorrect(stuck, { a: 1 }, 0), 'stuck');
  });
});

describe('Einstellung Zahlenraum', () => {
  test('Standard ist bis 1000 (Stoff der 3. Klasse)', () => {
    assert.equal(Settings.defaults().settings.range, 1000);
  });
  test('gespeicherte Werte werden zu Zahlen, Unsinn wird 1000', () => {
    assert.equal(Settings.fromSaved({ settings: { range: '100' } }).settings.range, 100);
    assert.equal(Settings.fromSaved({ settings: { range: 100 } }).settings.range, 100);
    assert.equal(Settings.fromSaved({ settings: { range: 'x' } }).settings.range, 1000);
    assert.equal(Settings.fromSaved({ settings: {} }).settings.range, 1000);
  });
  test('Wechsel des Zahlenraums verlangt eine neue Aufgabe', () => {
    const s = Settings.defaults().settings;
    assert.notEqual(Settings.taskKey(s), Settings.taskKey(Object.assign({}, s, { range: 100 })));
  });
  test('Rechenweg-Auswahl kennt die Gruppen', () => {
    assert.ok(Settings.strategyChoices('+').every((s) => typeof s.group === 'string'));
  });
});
