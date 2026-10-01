// Fahrzeug-Begleiter für die Turbo-Rechenwerkstatt (js/vehicles.js).
'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const V = require('../js/vehicles.js');

const EXPECTED = [
  ['v-bruno', 'Bruno', 'Bagger', 0],
  ['v-flitz', 'Flitz', 'Rennauto', 0],
  ['v-funke', 'Funke', 'Feuerwehrauto', 10],
  ['v-kalle', 'Kalle', 'Kipplaster', 25],
  ['v-rumms', 'Rumms', 'Monstertruck', 50],
  ['v-turbomax', 'Turbo-Max', 'Helden-Auto', 100]
];

const ids = (s) => [...s.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
const hasClass = (s, cls) => new RegExp('class="[^"]*\\b' + cls + '\\b').test(s);

describe('Fahrzeug-Liste', () => {
  test('sechs Fahrzeuge in fester Reihenfolge mit Namen, Art und Sternen', () => {
    assert.deepEqual(V.COMPANIONS.map((c) => [c.key, c.name, c.kind, c.stars]), EXPECTED);
  });
  test('Schlüssel sind eindeutig', () => {
    const keys = V.COMPANIONS.map((c) => c.key);
    assert.equal(new Set(keys).size, keys.length);
  });
  test('Sterne steigen nicht ab', () => {
    const stars = V.COMPANIONS.map((c) => c.stars);
    assert.deepEqual(stars, [...stars].sort((a, b) => a - b));
  });
  test('byKey findet ein Fahrzeug, Unbekanntes fällt auf das erste zurück', () => {
    assert.equal(V.byKey('v-funke').name, 'Funke');
    assert.equal(V.byKey('gibtsnicht'), V.COMPANIONS[0]);
  });
});

describe('Fahrzeug-SVG', () => {
  test('jedes SVG beginnt mit <svg class="pony vehicle" und hat die feste viewBox', () => {
    V.COMPANIONS.forEach((c) => {
      const s = V.svg(c.key);
      assert.equal(typeof s, 'string');
      assert.ok(s.startsWith('<svg class="pony vehicle"'), c.key);
      assert.match(s, /^<svg [^>]*viewBox="-6 -22 232 210"/);
      assert.match(s, /^<svg [^>]*role="img"/);
      assert.ok(s.endsWith('</svg>'), c.key);
    });
  });
  test('aria-label nennt Art und Name', () => {
    V.COMPANIONS.forEach((c) => {
      assert.match(V.svg(c.key), new RegExp('^<svg [^>]*aria-label="' + c.kind + ' ' + c.name + '"'));
    });
  });
  test('gemeinsame Klassen für die Animationen sind vorhanden', () => {
    V.COMPANIONS.forEach((c) => {
      const s = V.svg(c.key);
      ['pony-shadow', 'pony-all', 'v-wheel', 'v-eye', 'v-puff'].forEach((cls) => {
        assert.ok(hasClass(s, cls), c.key + ' ' + cls);
      });
    });
  });
  test('fahrzeugtypische Teile: Arm, Blaulicht, Kippmulde, Umhang', () => {
    assert.ok(hasClass(V.svg('v-bruno'), 'v-arm'));
    assert.ok(hasClass(V.svg('v-funke'), 'v-light'));
    assert.ok(hasClass(V.svg('v-kalle'), 'v-tipper'));
    assert.ok(hasClass(V.svg('v-turbomax'), 'v-cape'));
    assert.ok(!hasClass(V.svg('v-flitz'), 'v-cape'));
  });
  test('Verlaufs-IDs sind innerhalb eines SVG und über zwei Aufrufe hinweg eindeutig', () => {
    const a = ids(V.svg('v-flitz'));
    const b = ids(V.svg('v-flitz'));
    assert.ok(a.length > 0);
    assert.equal(new Set(a).size, a.length, 'IDs innerhalb eines SVG doppelt');
    a.forEach((id) => assert.ok(!b.includes(id), 'ID doppelt: ' + id));
  });
  test('alle url(#…)-Verweise zeigen auf eine ID im selben SVG', () => {
    V.COMPANIONS.forEach((c) => {
      const s = V.svg(c.key);
      const own = new Set(ids(s));
      [...s.matchAll(/url\(#([^)]+)\)/g)].forEach((m) => assert.ok(own.has(m[1]), c.key + ' ' + m[1]));
    });
  });
  test('unbekannter Schlüssel liefert das erste Fahrzeug', () => {
    assert.match(V.svg('quatsch'), /aria-label="Bagger Bruno"/);
    assert.match(V.svg(), /aria-label="Bagger Bruno"/);
  });
});
