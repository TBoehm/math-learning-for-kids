// Vorlesen: Text für die Sprachausgabe aufbereiten (js/speech.js).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { toSpeech } = require('../js/speech.js');

test('Doppelpunkt nach "Tipp" bleibt ein Doppelpunkt', () => {
  assert.equal(toSpeech('Tipp: Rechne mit der glatten Zahl: 45 − 30.'), 'Tipp: Rechne mit der glatten Zahl: 45 minus 30.');
});
test('Rechenzeichen werden ausgesprochen', () => {
  assert.equal(toSpeech('84 : 6 = 14'), '84 geteilt durch 6 gleich 14');
  assert.equal(toSpeech('4 · 23'), '4 mal 23');
  assert.equal(toSpeech('47 + 38'), '47 plus 38');
  assert.equal(toSpeech('87 : 6 = 14 R 3'), '87 geteilt durch 6 gleich 14 Rest 3');
});
test('Emojis werden nicht vorgelesen', () => {
  assert.equal(toSpeech('Super! 🦄✨'), 'Super!');
});
