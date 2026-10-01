// Auswahl der besten deutschen Stimme (js/voice.js).
'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const Voice = require('../js/voice.js');

const v = (name, lang, extra) => Object.assign({ name, lang, voiceURI: name, localService: true, default: false }, extra);

// typische Stimmen-Listen
const EDGE = [
  v('Microsoft Hedda - German (Germany)', 'de-DE'),
  v('Microsoft Katja Online (Natural) - German (Germany)', 'de-DE', { localService: false }),
  v('Microsoft Conrad Online (Natural) - German (Germany)', 'de-DE', { localService: false }),
  v('Microsoft Aria Online (Natural) - English (United States)', 'en-US', { localService: false })
];
const CHROME_WIN = [
  v('Microsoft Hedda - German (Germany)', 'de-DE', { default: true }),
  v('Microsoft Stefan - German (Germany)', 'de-DE'),
  v('Google Deutsch', 'de-DE', { localService: false }),
  v('Google US English', 'en-US', { localService: false })
];
const APPLE = [
  v('Anna', 'de-DE'),
  v('Helena', 'de-DE'),
  v('Anna (Premium)', 'de-DE'),
  v('Markus (Erweitert)', 'de-DE'),
  v('Samantha', 'en-US')
];
const LINUX = [v('eSpeak German', 'de'), v('English (America)+Max', 'en-US')];
const ANDROID = [v('Deutsch Deutschland', 'de-DE'), v('de-de-x-nfh-network', 'de-DE', { localService: false }), v('de-de-x-deb-local', 'de-DE')];

describe('germanVoices', () => {
  test('nur deutsche Stimmen, beste zuerst', () => {
    const list = Voice.germanVoices(EDGE).map((x) => x.name);
    assert.deepEqual(list.slice(0, 2).every((n) => /Natural/.test(n)), true);
    assert.equal(list[list.length - 1], 'Microsoft Hedda - German (Germany)');
    assert.ok(!list.some((n) => /English/.test(n)));
  });
  test('akzeptiert de, de-DE, de_DE, de-AT, de-CH', () => {
    const list = Voice.germanVoices([v('a', 'de'), v('b', 'de_DE'), v('c', 'de-AT'), v('d', 'de-CH'), v('e', 'en-GB'), v('f', 'nl-NL')]);
    assert.deepEqual(list.map((x) => x.name).sort(), ['a', 'b', 'c', 'd']);
  });
  test('de-DE vor de-AT/de-CH bei sonst gleicher Qualität', () => {
    const list = Voice.germanVoices([v('Petra', 'de-CH'), v('Anna', 'de-DE')]);
    assert.equal(list[0].name, 'Anna');
  });
});

describe('pick: automatisch die beste Stimme', () => {
  test('Edge: neuronale "Natural"-Stimme statt Hedda', () => {
    assert.match(Voice.pick(EDGE).name, /Katja Online \(Natural\)/);
  });
  test('Chrome unter Windows: Google Deutsch statt Hedda/Stefan', () => {
    assert.equal(Voice.pick(CHROME_WIN).name, 'Google Deutsch');
  });
  test('Apple: Premium/Erweitert vor Standard', () => {
    assert.match(Voice.pick(APPLE).name, /Premium|Erweitert/);
  });
  test('Android: Netzwerk-Stimme vor lokaler', () => {
    assert.equal(Voice.pick(ANDROID).name, 'de-de-x-nfh-network');
  });
  test('Linux: eSpeak, wenn sonst nichts da ist', () => {
    assert.equal(Voice.pick(LINUX).name, 'eSpeak German');
  });
  test('keine deutsche Stimme: null', () => {
    assert.equal(Voice.pick([v('Samantha', 'en-US')]), null);
    assert.equal(Voice.pick([]), null);
    assert.equal(Voice.pick(undefined), null);
  });
  test('gewählte Stimme hat Vorrang, wenn es sie gibt', () => {
    assert.equal(Voice.pick(EDGE, 'Microsoft Hedda - German (Germany)').name, 'Microsoft Hedda - German (Germany)');
  });
  test('gewählte, aber nicht (mehr) vorhandene Stimme: automatisch', () => {
    assert.match(Voice.pick(EDGE, 'Gibt es nicht').name, /Natural/);
  });
});

describe('prosody: Tempo und Tonhöhe', () => {
  test('neuronale Stimmen natürlich lassen', () => {
    assert.deepEqual(Voice.prosody(EDGE[1]), { rate: 1, pitch: 1 });
  });
  test('einfache Stimmen etwas langsamer, für Kinder gut verständlich', () => {
    const p = Voice.prosody(EDGE[0]);
    assert.ok(p.rate < 1 && p.rate >= 0.85);
    assert.ok(p.pitch >= 1 && p.pitch <= 1.1, 'keine Mickymaus-Stimme');
  });
  test('ohne Stimme: Standardwerte', () => {
    assert.deepEqual(Voice.prosody(null), { rate: 0.95, pitch: 1 });
  });
});

describe('label: Anzeige in der Auswahl', () => {
  test('kurzer Name mit Hinweis auf Qualität', () => {
    assert.equal(Voice.label(EDGE[1]), 'Katja (sehr natürlich)');
    assert.equal(Voice.label(CHROME_WIN[2]), 'Google Deutsch (gut)');
    assert.equal(Voice.label(EDGE[0]), 'Hedda');
    assert.equal(Voice.label(APPLE[2]), 'Anna (Premium) (sehr natürlich)');
  });
});
