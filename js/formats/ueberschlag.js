/*
 * Knobeln: Überschlagen. Erst grob mit gerundeten Zahlen rechnen, dann genau, dann vergleichen.
 *   Zeile 1: Ü: [330] + [250] = [580]  (alle Zahlen auf Zehner oder alle auf Hunderter gerundet)
 *   dann je nach Variante:
 *     'selbst': genau rechnen, danach "Passt dein Ergebnis zum Überschlag?" (ja)
 *     'fremd':  ein anderes Kind hat ein Ergebnis – passt es zum Überschlag? (ja/nein), dann genau rechnen
 * Bei Mal wird nur die große Zahl gerundet: 7 · 48 -> Ü: 7 · [50] = [350].
 * Reines Modul ohne DOM – getestet in tests/ueberschlag.test.js.
 */
(function (root) {
  'use strict';

  var node = typeof module !== 'undefined' && module.exports;
  var Tasks = node ? require('../tasks.js') : root.RR.Tasks;

  var T = function (v) { return { t: 'txt', v: v }; };
  var N = function (v) { return { t: 'num', v: v }; };
  var R = function (id) { return { t: 'ref', id: id }; };
  function IC(id, answer, check, expected, deps) {
    return { t: 'in', id: id, answer: answer, check: check, expected: expected, deps: deps };
  }
  function rndInt(rnd, a, b) { return a + Math.floor(rnd() * (b - a + 1)); }

  var NAMES = ['Tim', 'Mia', 'Ben', 'Lina', 'Paul', 'Emma', 'Noah', 'Lea'];
  var OPTIONS = ['ja', 'nein'];

  /** Runden auf Zehner (u = 10) oder Hunderter (u = 100), ab 5 aufrunden. */
  function round(n, u) { return Math.floor((n + u / 2) / u) * u; }

  function calc(x, op, y) { return op === '+' ? x + y : op === '−' ? x - y : x * y; }

  /** Überschlag mit Rundung auf u; bei Mal bleibt der kleine Faktor, wie er ist. */
  function estimate(a, op, b, u) {
    return op === '·' ? a * round(b, u) : calc(round(a, u), op, round(b, u));
  }

  /** Erlaubte Rundungen: Zehner; Hunderter nur bis 1000 und wenn die gerundeten Zahlen dreistellig sind. */
  function units(a, op, b, max) {
    var big = op === '·' ? b >= 100 : a >= 100 && b >= 100;
    return max === 1000 && big ? [10, 100] : [10];
  }

  /** Ergebnis eines anderen Kindes "passt nicht": für jede erlaubte Rundung weit weg vom Überschlag. */
  function clearlyOff(x, a, op, b, max) {
    var exact = calc(a, op, b);
    return units(a, op, b, max).every(function (u) {
      var ue = estimate(a, op, b, u);
      return Math.abs(x - ue) >= 2 * Math.abs(exact - ue) + u;
    });
  }

  /** Ergebnis des anderen Kindes: mal richtig, mal mit einem groben Fehler. */
  function pickOther(a, op, b, max, rnd) {
    var exact = calc(a, op, b);
    if (rnd() < 0.5) return exact;
    var steps = max === 1000 ? [100, 200, 300] : [20, 30, 40];
    if (op === '·') steps = steps.concat([10 * a, 20 * a]);
    var cands = [];
    steps.forEach(function (d) {
      [exact + d, exact - d].forEach(function (x) {
        if (x > 0 && x <= max && x !== exact && clearlyOff(x, a, op, b, max)) cands.push(x);
      });
    });
    return cands.length ? cands[Math.floor(rnd() * cands.length)] : exact;
  }

  function choice(id, answer, opts) {
    return { t: 'choice', id: id, options: opts, answer: answer, check: function (v) { return v === answer; } };
  }

  /**
   * Aufgabe zu festen Zahlen.
   * opt: { max, rnd, variant: 'selbst' | 'fremd' (sonst Zufall), other: Ergebnis des anderen Kindes }
   */
  function build(a, op, b, opt) {
    opt = opt || {};
    var rnd = opt.rnd || Math.random, max = opt.max === 1000 ? 1000 : 100;
    var us = units(a, op, b, max), exact = calc(a, op, b);
    var mul = op === '·';
    var unitOfA = function (vals) {
      return us.filter(function (u) { return round(a, u) === vals.ra; })[0] || 10;
    };

    // ---- Zeile 1: Überschlag ----
    var rb, ra = null;
    if (mul) {
      rb = IC('rb', round(b, 10), function (v) { return us.some(function (u) { return v === round(b, u); }); });
    } else {
      ra = IC('ra', round(a, 10), function (v) { return us.some(function (u) { return v === round(a, u); }); });
      var rbExp = function (vals) { return round(b, unitOfA(vals)); };
      rb = IC('rb', round(b, 10), function (v, vals) {
        return us.some(function (u) { return vals.ra === round(a, u) && v === round(b, u); });
      }, rbExp, ['ra']);
    }
    var rsExp = function (vals) { return calc(mul ? a : vals.ra, op, vals.rb); };
    var rs = IC('rs', estimate(a, op, b, 10), function (v, vals) { return v === rsExp(vals); }, rsExp, mul ? ['rb'] : ['ra', 'rb']);
    var also = us.length > 1 ? ' (oder alle auf Hunderter)' : '';
    var ueRow = {
      label: 'Überschlag',
      tokens: mul ? [T('Ü:'), N(a), T('·'), rb, T('='), rs] : [T('Ü:'), ra, T(op), rb, T('='), rs],
      hint: mul
        ? 'Runde nur ' + b + ' auf Zehner' + also + '. Dann ist es eine leichte Malaufgabe: ' + a + ' · ' + round(b, 10) + '.'
        : 'Runde beide Zahlen auf Zehner' + also + '. Ab 5 rundest du auf: ' + a + ' wird zu ' + round(a, 10) + '.'
    };

    // ---- genau rechnen ----
    var exactRow = {
      label: 'Genau',
      tokens: [N(a), T(op), N(b), T('='), IC('res', exact, function (v) { return v === exact; })],
      hint: 'Jetzt rechne genau – mit deinem Lieblings-Rechenweg. Das Ergebnis liegt nah bei ' + estimate(a, op, b, 10) + '.'
    };

    var variant = opt.variant || (rnd() < 0.5 ? 'selbst' : 'fremd');
    var rows, other = null;
    // die Zeile vor der Ja/Nein-Frage: der Begleiter stellt die Frage
    var ask = function (r, q) { return Object.assign({}, r, { advice: function () { return 'Richtig! ' + q; } }); };
    if (variant === 'selbst') {
      rows = [ueRow, ask(exactRow, 'Passt dein Ergebnis zum Überschlag?'), {
        label: 'Passt dein Ergebnis zum Überschlag?',
        tokens: [R('res'), T('und Ü'), R('rs'), choice('passt', 0, OPTIONS)],
        hint: 'Liegt dein Ergebnis nah bei deinem Überschlag? Dann passt es.',
        advice: function () { return 'Super! Es passt – so kannst du dich immer selbst prüfen. 🔍'; }
      }];
    } else {
      other = opt.other !== undefined ? opt.other : pickOther(a, op, b, max, rnd);
      var ok = other === exact || !clearlyOff(other, a, op, b, max);
      var name = NAMES[Math.floor(rnd() * NAMES.length)];
      rows = [ask(ueRow, 'Passt das Ergebnis von ' + name + ' zum Überschlag?'), {
        label: 'Passt das zum Überschlag?',
        tokens: [T(name + ':'), N(a), T(op), N(b), T('='), N(other), choice('passt', ok ? 0 : 1, OPTIONS)],
        hint: 'Vergleiche ' + other + ' mit deinem Überschlag. Liegt es nah dran oder weit weg?',
        advice: function () {
          return ok ? 'Genau! ' + other + ' liegt nah beim Überschlag. Rechne nach, ob es auch genau stimmt.'
            : 'Genau! ' + other + ' ist viel zu weit weg vom Überschlag – da stimmt was nicht. Rechne du genau!';
        }
      }, exactRow];
    }
    return {
      op: op, strategy: 'ueberschlag', a: a, b: b, answer: exact, variant: variant, other: other, rows: rows,
      intro: 'überschlage zuerst: Runde die Zahlen und rechne grob. Dann rechne genau! 🎯'
    };
  }

  // ---------- Zufallszahlen ----------
  function numbers(op, max, rnd) {
    for (var i = 0; i < 5000; i++) {
      var a, b;
      if (op === '·') {
        a = rndInt(rnd, 2, 9);
        b = rndInt(rnd, 11, Math.floor(max / a));
        if (b % 10 === 0 || a * b > max) continue;
        if (units(a, op, b, max).some(function (u) { return estimate(a, op, b, u) > max; })) continue;
        return [a, b];
      }
      if (max === 1000) {
        if (op === '+') { a = rndInt(rnd, 101, 899); b = rndInt(rnd, 101, 899); if (a + b > 1000) continue; }
        else { a = rndInt(rnd, 201, 999); b = rndInt(rnd, 101, a - 50); }
      } else if (op === '+') { a = rndInt(rnd, 11, 89); b = rndInt(rnd, 11, 89); if (a + b > 100) continue; }
      else { a = rndInt(rnd, 31, 99); b = rndInt(rnd, 11, a - 10); }
      if (a % 10 === 0 || b % 10 === 0) continue;
      if (units(a, op, b, max).some(function (u) { return estimate(a, op, b, u) > max; })) continue;
      return [a, b];
    }
    throw new Error('Keine passende Überschlag-Aufgabe gefunden');
  }

  function gen(opt, op) {
    opt = opt || {};
    var rnd = opt.rnd || Math.random, max = opt.max === 1000 ? 1000 : 100;
    var n = numbers(op, max, rnd);
    return build(n[0], op, n[1], { max: max, rnd: rnd });
  }

  ['+', '−', '·'].forEach(function (op) {
    Tasks.register(op, {
      key: 'ueberschlag', name: 'Überschlagen', group: 'knobeln',
      desc: 'Erst grob mit runden Zahlen, dann genau rechnen und vergleichen',
      gen: function (opt) { return gen(opt, op); }
    });
  });

  var api = { round: round, estimate: estimate, units: units, clearlyOff: clearlyOff, build: build, gen: gen };
  if (node) module.exports = api;
  else root.RR.Formats = Object.assign(root.RR.Formats || {}, { ueberschlag: api });
})(typeof window !== 'undefined' ? window : this);
