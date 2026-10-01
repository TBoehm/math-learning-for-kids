/*
 * Beste deutsche Stimme für "Vorlesen" finden (Web Speech API).
 * Viele Geräte haben kostenlos sehr gute Stimmen – sie werden nur nicht automatisch genommen:
 *   Edge:        "Microsoft Katja Online (Natural)" (neuronal)
 *   Chrome:      "Google Deutsch"
 *   iPad/Mac:    "Anna (Premium)", "… (Erweitert)"
 *   Android:     "de-de-x-…-network"
 * Reine Funktionen – getestet in tests/voice.test.js.
 */
(function (root) {
  'use strict';

  function lang(v) { return String(v && v.lang || '').replace('_', '-').toLowerCase(); }
  function isGerman(v) { return /^de(-|$)/.test(lang(v)); }

  // Qualität grob nach Name einschätzen
  function quality(v) {
    var n = v.name || '';
    if (/natural|neural|online/i.test(n)) return 100;          // neuronale Stimmen (Edge)
    if (/premium|enhanced|erweitert|siri/i.test(n)) return 90; // Apple, heruntergeladene Qualität
    if (/google/i.test(n)) return 60;                          // Chrome-Netzwerkstimme
    if (/network/i.test(n)) return 55;                         // Android-Netzwerkstimme
    if (/espeak/i.test(n)) return -50;                         // klingt sehr robotisch
    if (/hedda|stefan/i.test(n)) return -10;                   // alte Windows-Stimmen
    if (/^(anna|helena|markus|petra|yannick|viktor|martin)\b/i.test(n)) return 30; // Apple-Standard
    return 0;
  }
  function score(v) { return quality(v) + (lang(v) === 'de-de' ? 5 : 0); }

  /** Deutsche Stimmen, beste zuerst (bei Gleichstand in der Reihenfolge des Browsers). */
  function germanVoices(voices) {
    return (voices || [])
      .map(function (v, i) { return { v: v, i: i }; })
      .filter(function (x) { return isGerman(x.v); })
      .sort(function (a, b) { return score(b.v) - score(a.v) || a.i - b.i; })
      .map(function (x) { return x.v; });
  }

  /** Gewählte Stimme (falls vorhanden), sonst die beste deutsche, sonst null. */
  function pick(voices, preferredName) {
    var list = germanVoices(voices);
    if (preferredName) {
      var chosen = list.filter(function (v) { return v.name === preferredName; })[0];
      if (chosen) return chosen;
    }
    return list[0] || null;
  }

  /** Tempo und Tonhöhe: gute Stimmen natürlich lassen, einfache etwas langsamer. */
  function prosody(v) {
    if (!v) return { rate: 0.95, pitch: 1 };
    if (quality(v) >= 90) return { rate: 1, pitch: 1 };
    return { rate: 0.9, pitch: 1.05 };
  }

  /** Kurzer Name für die Auswahlliste, z. B. "Katja (sehr natürlich)". */
  function label(v) {
    var name = String(v.name || '')
      .replace(/^Microsoft\s+/i, '')
      .replace(/\s+-\s+German.*$/i, '')
      .replace(/\s+Online\s*\(Natural\)/i, '')
      .trim();
    var q = quality(v);
    return name + (q >= 90 ? ' (sehr natürlich)' : q >= 55 ? ' (gut)' : '');
  }

  var api = { germanVoices: germanVoices, pick: pick, prosody: prosody, label: label };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RR = Object.assign(root.RR || {}, { Voice: api });
})(typeof window !== 'undefined' ? window : this);
