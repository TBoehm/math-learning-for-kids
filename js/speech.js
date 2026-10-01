/* Text der Sprechblase für die Sprachausgabe aufbereiten – getestet in tests/speech.test.js. */
(function (root) {
  'use strict';

  function toSpeech(text) {
    return String(text)
      .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu, '')
      .replace(/(\d)\s*:\s*(\d)/g, '$1 geteilt durch $2')
      .replace(/(\d) R (\d)/g, '$1 Rest $2')
      .replace(/\s*·\s*/g, ' mal ')
      .replace(/\s*[−–]\s*(?=\d)/g, ' minus ')
      .replace(/\s*\+\s*/g, ' plus ')
      .replace(/\s*=\s*/g, ' gleich ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  var api = { toSpeech: toSpeech };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RR = Object.assign(root.RR || {}, { Speech: api });
})(typeof window !== 'undefined' ? window : this);
