/* Kleine Klänge mit der Web-Audio-API – ganz ohne Sounddateien. */
(function (root) {
  'use strict';

  var ctx = null;
  var enabled = true;

  function ac() {
    if (!ctx) {
      var AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, start, dur, type, gain, slideTo) {
    var c = ac();
    if (!c || !enabled) return;
    var t0 = c.currentTime + start;
    var o = c.createOscillator(), g = c.createGain();
    o.type = type || 'triangle';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain || 0.18, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(c.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  var notes = { C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880, B5: 987.77, C6: 1046.5, E6: 1318.5, G6: 1568 };

  var api = {
    setEnabled: function (on) { enabled = !!on; },
    tap: function () { tone(880, 0, 0.06, 'sine', 0.06); },
    step: function () {
      tone(notes.E5, 0, 0.12); tone(notes.G5, 0.08, 0.16);
    },
    hop: function () { tone(420, 0, 0.18, 'sine', 0.12, 900); },
    wrong: function () {
      tone(330, 0, 0.16, 'sine', 0.14); tone(262, 0.14, 0.24, 'sine', 0.14);
    },
    win: function () {
      [notes.C5, notes.E5, notes.G5, notes.C6, notes.E6].forEach(function (f, i) { tone(f, i * 0.09, 0.3, 'triangle', 0.16); });
      tone(notes.G6, 0.5, 0.5, 'sine', 0.08);
    },
    fanfare: function () {
      var seq = [notes.G5, notes.G5, notes.G5, notes.C6, notes.G5, notes.C6, notes.E6];
      var times = [0, 0.12, 0.24, 0.4, 0.62, 0.74, 0.9];
      seq.forEach(function (f, i) { tone(f, times[i], 0.22, 'square', 0.07); tone(f / 2, times[i], 0.22, 'triangle', 0.08); });
    },
    // Hufgetrappel
    gallop: function (count) {
      for (var i = 0; i < (count || 8); i++) {
        var t = i * 0.16;
        tone(180, t, 0.05, 'square', 0.05, 120);
        tone(240, t + 0.06, 0.05, 'square', 0.04, 150);
      }
    }
  };
  root.RR = Object.assign(root.RR || {}, { Sound: api });
})(window);
