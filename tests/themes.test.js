// Welten (Themes): Einhorn-Ranch und Turbo-Werkstatt (js/themes.js).
'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const Themes = require('../js/themes.js');
const Settings = require('../js/settings.js');
const UI = require('../js/ui-logic.js');

describe('Welten', () => {
  test('zwei Welten in fester Reihenfolge', () => {
    assert.deepEqual(Themes.THEMES.map((t) => t.key), ['ranch', 'werkstatt']);
  });
  for (const t of Themes.THEMES) {
    test(`${t.key}: alles Nötige ist da`, () => {
      for (const k of ['name', 'title', 'icon', 'welcome', 'doneHint']) assert.equal(typeof t[k], 'string', k);
      assert.equal(t.companions.length, 6);
      assert.ok(t.companions.includes(t.defaultCompanion));
      for (const k of ['rowOk', 'perfect', 'solved', 'oops', 'poke', 'confetti', 'colors', 'decor']) {
        assert.ok(Array.isArray(t[k] || t.texts[k]) && (t[k] || t.texts[k]).length >= 3, k);
      }
      assert.ok(['gallop', 'engine'].includes(t.sound));
      assert.match(t.paradeBanner(5), /5/);
    });
  }
  test('Werkstatt: keine Einhorn- oder Pferdewörter', () => {
    const w = JSON.stringify(Themes.byKey('werkstatt').texts) + Themes.byKey('werkstatt').welcome + Themes.byKey('werkstatt').doneHint;
    assert.doesNotMatch(w, /🦄|🐴|🐎|Wieher|Galopp|Einhorn|Regenbogen|Möhren|Pony/);
  });
  test('Werkstatt: auch Knöpfe, Begrüßung und Tab-Symbol ohne Einhorn oder Pferd', () => {
    const w = Themes.byKey('werkstatt');
    for (const k of ['startLabel', 'takeLabel', 'hello', 'favicon']) {
      assert.equal(typeof w[k], 'string', k);
      assert.doesNotMatch(w[k], /🦄|🐴|🐎|🏇|🌈|💖|Einhorn|Pferd/, k);
    }
  });
  test('Welt-Knopf zeigt die Hauptfigur der anderen Welt und sagt, wohin es geht', () => {
    assert.deepEqual(Themes.switchButton('werkstatt'), { icon: '🦄', label: 'Zur Einhorn-Ranch wechseln' });
    assert.deepEqual(Themes.switchButton('ranch'), { icon: '🏎️', label: 'Zur Turbo-Werkstatt wechseln' });
  });
  test('Ranch: eigene Knopftexte', () => {
    const r = Themes.byKey('ranch');
    assert.match(r.startLabel, /Los geht/);
    assert.match(r.hello, /🌈/);
    assert.match(r.favicon, /^<svg/);
  });
  test('Werkstatt: Fahrzeuge als Begleiter', () => {
    assert.deepEqual(Themes.byKey('werkstatt').companions, ['v-bruno', 'v-flitz', 'v-funke', 'v-kalle', 'v-rumms', 'v-turbomax']);
  });
  test('Ermutigungen beschämen nie', () => {
    for (const t of Themes.THEMES) assert.doesNotMatch(t.texts.oops.join(' '), /falsch|dumm|schlecht|kaputt|Unfall|Crash/i);
  });
  test('byKey: Unbekanntes wird zur Ranch, next wechselt reihum', () => {
    assert.equal(Themes.byKey('xyz').key, 'ranch');
    assert.equal(Themes.next('ranch'), 'werkstatt');
    assert.equal(Themes.next('werkstatt'), 'ranch');
    assert.equal(Themes.themeOfCompanion('v-rumms'), 'werkstatt');
    assert.equal(Themes.themeOfCompanion('luna'), 'ranch');
  });
});

describe('Welt wechseln', () => {
  const base = () => ({ theme: 'ranch', companion: 'nebula', companions: { ranch: 'nebula' }, progress: { stars: 30 } });
  test('Begleiter je Welt merken', () => {
    const s1 = Themes.switchTheme(base(), 'werkstatt');
    assert.equal(s1.theme, 'werkstatt');
    assert.equal(s1.companion, 'v-bruno', 'Standard-Begleiter der neuen Welt');
    assert.equal(s1.companions.ranch, 'nebula');
    const s2 = Themes.switchTheme(Object.assign(s1, { companion: 'v-funke' }), 'ranch');
    assert.equal(s2.companion, 'nebula');
    assert.equal(s2.companions.werkstatt, 'v-funke');
  });
  test('verändert den alten Zustand nicht', () => {
    const s = base();
    Themes.switchTheme(s, 'werkstatt');
    assert.deepEqual(s, base());
  });
});

describe('Speicherstand', () => {
  test('neu: Ranch mit Luna', () => {
    const s = Settings.defaults();
    assert.equal(s.theme, 'ranch');
    assert.deepEqual(s.companions, { ranch: 'luna', werkstatt: 'v-bruno' });
  });
  test('alter Stand ohne Welt: Begleiter landet in der richtigen Welt', () => {
    const s = Settings.fromSaved({ companion: 'wolke' });
    assert.equal(s.theme, 'ranch');
    assert.equal(s.companions.ranch, 'wolke');
    const v = Settings.fromSaved({ companion: 'v-kalle', theme: 'werkstatt' });
    assert.equal(v.companions.werkstatt, 'v-kalle');
    assert.equal(v.companion, 'v-kalle');
  });
  test('unbekannte Welt wird Ranch, Begleiter passt zur Welt', () => {
    const s = Settings.fromSaved({ theme: 'mond', companion: 'v-kalle' });
    assert.equal(s.theme, 'ranch');
    assert.equal(s.companion, 'luna');
  });
});

describe('Texte je Welt', () => {
  const W = Themes.byKey('werkstatt').texts;
  test('Ermutigung nach dem ersten Fehler kommt aus der Welt', () => {
    const row = { hint: 'x', tokens: [] };
    const txt = UI.wrongText(row, { fields: [] }, 1, (l) => l[0], W);
    assert.equal(txt, W.oops[0]);
  });
  test('Lob nach einer richtigen Zeile kommt aus der Welt', () => {
    const txt = UI.rowDoneText({}, null, {}, (l) => l[0], W);
    assert.equal(txt, W.rowOk[0]);
  });
  test('ohne Welt: wie bisher', () => {
    assert.equal(UI.wrongText({ hint: 'x', tokens: [] }, { fields: [] }, 1, (l) => l[0]), UI.TEXTS.oops[0]);
  });
});
