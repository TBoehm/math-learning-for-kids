/*
 * Knobeln: Welcher Weg passt? Zu einer Aufgabe, die zu einem Rechenweg besonders gut passt
 * (328 + 99 -> Hilfsaufgabe, 702 − 698 -> Ergänzen, 239 + 41 -> Vereinfachen, 346 + 228 -> Schrittweise),
 * wählt das Kind erst den Weg (Auswahlfeld, alle sinnvollen Wege zählen) und rechnet dann damit:
 * die Zeilen des gewählten Wegs hängt task.nextRow(vals) eine nach der anderen an.
 * Angeboten werden nur Rechenwege, die es in Tasks.STRATEGIES gibt (z. B. "Vereinfachen" erst, wenn er angemeldet ist).
 * Reines Modul ohne DOM – getestet in tests/welcherweg.test.js.
 */
(function (root) {
  'use strict';

  var node = typeof module !== 'undefined' && module.exports;
  var Tasks = node ? require('../tasks.js') : root.RR.Tasks;

  var T = function (v) { return { t: 'txt', v: v }; };
  var N = function (v) { return { t: 'num', v: v }; };
  var R = function (id) { return { t: 'ref', id: id }; };
  function I(id, answer) { return { t: 'in', id: id, answer: answer, check: function (v) { return v === answer; } }; }
  function rndInt(rnd, a, b) { return a + Math.floor(rnd() * (b - a + 1)); }
  function row(tokens, label, hint) { return { tokens: tokens, label: label, hint: hint }; }

  var NAMES = { stellenweise: 'Stellenweise', schrittweise: 'Schrittweise', hilfsaufgabe: 'Hilfsaufgabe', ergaenzen: 'Ergänzen', vereinfachen: 'Vereinfachen' };
  var PLACES = [[100, 'Hunderter'], [10, 'Zehner'], [1, 'Einer']];

  function calc(a, op, b) { return op === '+' ? a + b : a - b; }
  function ceilTo(x, u) { return Math.ceil(x / u) * u; }
  function place(x, u) { return Math.floor(x % (u * 10) / u) * u; }

  /** Fast eine glatte Zahl? Bis 1000: fast ein Hunderter (397, 698) oder zweistellig fast ein Zehner (39); bis 100: fast ein Zehner. */
  function near(x, max) {
    if (max === 1000 && x >= 100) return x % 100 >= 97 ? { X: ceilTo(x, 100), d: ceilTo(x, 100) - x } : null;
    return ten(x);
  }
  function ten(x) { return x % 10 >= 8 ? { X: ceilTo(x, 10), d: ceilTo(x, 10) - x } : null; }
  // Einer ergänzen sich zu 10, und eine Zahl ist fast ein Zehner: 239 + 41 -> 240 + 40
  function complement(a, b) {
    if (ten(a) && b % 10 === ten(a).d) return 'a';
    if (ten(b) && a % 10 === ten(b).d) return 'b';
    return null;
  }

  /** Welche Wege sind geschickt? -> { accepted: [Schlüssel], canonical: Schlüssel } (nur angebotene Wege) */
  function classify(a, op, b, max, offered) {
    var list;
    if (op === '+') {
      if (complement(a, b)) list = ['vereinfachen', 'hilfsaufgabe'];
      else if (near(b, max) || near(a, max)) list = ['hilfsaufgabe', 'vereinfachen'];
      else list = ['schrittweise', 'stellenweise'];
    } else if (a - b <= (max === 1000 ? 12 : 9)) {
      list = ['ergaenzen'].concat(near(b, max) ? ['hilfsaufgabe', 'vereinfachen'] : []);
    } else {
      list = near(b, max) ? ['hilfsaufgabe', 'vereinfachen'] : ['schrittweise'];
    }
    var accepted = list.filter(function (k) { return offered.indexOf(k) >= 0; });
    return { accepted: accepted, canonical: accepted[0] };
  }

  // Die Zahl, die glatt gemacht wird: [Zahl, { X, d }, 'a' | 'b']
  function roundPick(a, b, max, op) {
    var c = op === '+' ? complement(a, b) : null;
    if (c) return c === 'a' ? [a, ten(a), 'a'] : [b, ten(b), 'b'];
    if (near(b, max) || ten(b)) return [b, near(b, max) || ten(b), 'b'];
    return [a, near(a, max) || ten(a), 'a'];
  }

  // ---------- Rechenwege für feste Zahlen (Schritte vorgegeben, Ergebnisse eintragen) ----------
  function stellenweise(a, b) {
    var rows = [], sum = [];
    PLACES.forEach(function (p) {
      var x = place(a, p[0]), y = place(b, p[0]);
      if (x && y) {
        var id = 'p' + p[0];
        rows.push(row([N(x), T('+'), N(y), T('='), I(id, x + y)], p[1], 'Nimm nur die ' + p[1] + ': ' + x + ' + ' + y + '.'));
        sum.push(R(id));
      } else if (x || y) sum.push(N(x + y));
    });
    var tokens = [];
    sum.forEach(function (s, k) { if (k) tokens.push(T('+')); tokens.push(s); });
    tokens.push(T('='), I('res', a + b));
    rows.push(row(tokens, 'Zusammen', 'Rechne deine Ergebnisse zusammen.'));
    return rows;
  }

  function schrittweise(op) {
    return function (a, b) {
      var parts = PLACES.map(function (p) { return [place(b, p[0]), p[1]]; }).filter(function (p) { return p[0]; });
      var cur = a, rows = [];
      parts.forEach(function (p, k) {
        var next = calc(cur, op, p[0]), id = k === parts.length - 1 ? 'res' : 's' + k;
        rows.push(row([k ? R('s' + (k - 1)) : N(a), T(op), N(p[0]), T('='), I(id, next)],
          p[1] + (op === '+' ? ' dazu' : ' weg'), 'Rechne ' + cur + ' ' + op + ' ' + p[0] + '.'));
        cur = next;
      });
      return rows;
    };
  }

  function hilfsaufgabe(op) {
    return function (a, b, max) {
      var r = roundPick(a, b, max, op), x = r[0], X = r[1].X, d = r[1].d;
      var A = r[2] === 'a' ? X : a, B = r[2] === 'a' ? b : X;
      var s1 = calc(A, op, B);
      var back = op === '+' ? '−' : '+';
      return [
        row([N(A), T(op), N(B), T('='), I('s1', s1)], 'Leichte Aufgabe',
          x + ' ist fast ' + X + '. Rechne erst ' + A + ' ' + op + ' ' + B + '.'),
        row([R('s1'), T(back), N(d), T('='), I('res', calc(a, op, b))], 'Ausgleichen',
          op === '+' ? 'Du hast ' + d + ' zu viel dazugerechnet. Nimm ' + d + ' wieder weg.'
            : 'Du hast ' + d + ' zu viel weggenommen. Gib ' + d + ' wieder dazu.')
      ];
    };
  }

  function vereinfachen(op) {
    return function (a, b, max) {
      var r = roundPick(a, b, max, op), d = r[1].d;
      // Plus: was eine Zahl mehr bekommt, gibt die andere ab. Minus: beide gleich viel größer.
      var opA = op === '+' && r[2] === 'b' ? '−' : '+';
      var opB = op === '+' && r[2] === 'a' ? '−' : '+';
      var A = calc(a, opA, d), B = calc(b, opB, d);
      return [
        row([N(a), T(opA), N(d), T('='), I('v1', A)], '1. Zahl',
          op === '+' ? (r[2] === 'a' ? 'Mach ' + a + ' zur glatten Zahl: ' + a + ' + ' + d + '.' : 'Gib ' + d + ' von ' + a + ' ab: ' + a + ' − ' + d + '.')
            : 'Mach ' + b + ' zur glatten Zahl. Dafür tust du zu beiden Zahlen ' + d + ' dazu: ' + a + ' + ' + d + '.'),
        row([N(b), T(opB), N(d), T('='), I('v2', B)], '2. Zahl',
          op === '+' && r[2] === 'a' ? 'Was ' + a + ' bekommen hat, gibt ' + b + ' ab: ' + b + ' − ' + d + '.'
            : 'Jetzt ' + b + ' + ' + d + '.'),
        row([R('v1'), T(op), R('v2'), T('='), I('res', calc(a, op, b))], 'Leichte Aufgabe',
          'Jetzt ist es leicht: ' + A + ' ' + op + ' ' + B + '.')
      ];
    };
  }

  function ergaenzen(a, b) {
    var stops = [b], cur = b;
    if (cur % 10 && ceilTo(cur, 10) <= a) stops.push(cur = ceilTo(cur, 10));
    if (cur % 100 && ceilTo(cur, 100) <= a) stops.push(cur = ceilTo(cur, 100));
    if (Math.floor(a / 100) * 100 > cur) stops.push(cur = Math.floor(a / 100) * 100);
    if (Math.floor(a / 10) * 10 > cur) stops.push(cur = Math.floor(a / 10) * 10);
    if (a > cur) stops.push(a);
    var rows = [], sum = [], single = stops.length === 2;
    for (var k = 1; k < stops.length; k++) {
      var from = stops[k - 1], to = stops[k], id = single ? 'res' : 'j' + k;
      rows.push(row([N(from), T('+'), I(id, to - from), T('='), N(to)], 'Bis ' + to,
        'Wie viel fehlt von ' + from + ' bis ' + to + '?'));
      if (sum.length) sum.push(T('+'));
      sum.push(R(id));
    }
    if (!single) rows.push(row(sum.concat([T('='), I('res', a - b)]), 'Zusammen', 'Rechne alle Sprünge zusammen.'));
    return rows;
  }

  var PLANS = {
    '+': { stellenweise: stellenweise, schrittweise: schrittweise('+'), hilfsaufgabe: hilfsaufgabe('+'), vereinfachen: vereinfachen('+') },
    '−': { schrittweise: schrittweise('−'), ergaenzen: ergaenzen, hilfsaufgabe: hilfsaufgabe('−'), vereinfachen: vereinfachen('−') }
  };

  /** Angebotene Wege: Rechenwege der Rechenart, die es gibt und für die es hier einen Plan gibt. */
  function offeredKeys(op) {
    return Tasks.STRATEGIES[op].filter(function (s) { return s.group === 'weg' && PLANS[op][s.key]; })
      .map(function (s) { return s.key; });
  }
  function nameOf(op, key) {
    var s = Tasks.STRATEGIES[op].filter(function (x) { return x.key === key; })[0];
    return s ? s.name : NAMES[key];
  }

  function choiceHint(c, a, op, b, max) {
    if (c === 'hilfsaufgabe') return 'Schau dir ' + roundPick(a, b, max, op)[0] + ' genau an. Ist das fast eine glatte Zahl?';
    if (c === 'vereinfachen') return 'Schau dir die Einer an: ' + a % 10 + ' und ' + b % 10 + ' ergeben zusammen 10!';
    if (c === 'ergaenzen') return 'Die Zahlen liegen ganz nah beieinander. Wie weit ist es von ' + b + ' bis ' + a + '?';
    return 'Keine Zahl ist fast eine glatte Zahl. Dann rechne Schritt für Schritt' + (op === '+' ? ' oder Stelle für Stelle.' : '.');
  }
  function advice(key, a, op, b, max) {
    if (key === 'ergaenzen') return 'Genau! Spring einfach von ' + b + ' bis ' + a + '. Das ist nicht weit!';
    if (key === 'stellenweise') return 'Genau! Keine Zahl ist fast glatt – rechne Stelle für Stelle.';
    if (key === 'schrittweise') return 'Genau! Keine Zahl ist fast glatt – rechne Schritt für Schritt.';
    // Hilfsaufgabe und Vereinfachen gibt es nur, wenn eine Zahl fast glatt ist
    var r = roundPick(a, b, max, op);
    return key === 'hilfsaufgabe'
      ? 'Genau! ' + r[0] + ' ist fast ' + r[1].X + '. Rechne mit der glatten Zahl und gleiche dann aus.'
      : 'Genau! Mach aus ' + r[0] + ' die glatte Zahl ' + r[1].X + ' und verändere die andere Zahl passend.';
  }

  /** Aufgabe zu festen Zahlen. opt: { max, offered: angebotene Wege (Standard: offeredKeys) } */
  function build(a, op, b, opt) {
    opt = opt || {};
    var max = opt.max === 1000 ? 1000 : 100;
    var offered = opt.offered || offeredKeys(op);
    var c = classify(a, op, b, max, offered);
    var ok = c.accepted.map(function (k) { return offered.indexOf(k); });
    var task = {
      op: op, strategy: 'welcherweg', a: a, b: b, answer: calc(a, op, b),
      // layout 'weg' ohne eigene Darstellung: nur die Klasse layout-weg an #rows (css/formats.css)
      offered: offered, accepted: c.accepted, canonical: c.canonical, layout: 'weg',
      intro: 'welcher Rechenweg passt hier am besten? Schau dir die Zahlen genau an! 🧐',
      rows: [{
        label: 'Welcher Rechenweg ist hier besonders geschickt?',
        tokens: [{
          t: 'choice', id: 'weg', answer: offered.indexOf(c.canonical),
          options: offered.map(function (k) { return nameOf(op, k); }),
          check: function (v) { return ok.indexOf(v) >= 0; }
        }],
        hint: choiceHint(c.canonical, a, op, b, max),
        advice: function (vals) { return advice(offered[vals.weg], a, op, b, max); }
      }]
    };
    var plan = null;
    // nach der Wahl: die Zeilen des gewählten Wegs, eine nach der anderen
    task.nextRow = function (vals) {
      if (!plan) plan = PLANS[op][offered[vals.weg]](a, b, max);
      return plan[task.rows.length - 1];
    };
    return task;
  }

  // ---------- Zufallszahlen passend zum Weg ----------
  function digits(rnd, h, tMax, eMax) {
    return (h ? rndInt(rnd, 1, h) * 100 : 0) + rndInt(rnd, 1, tMax) * 10 + rndInt(rnd, 1, eMax);
  }
  function numbersFor(type, op, max, rnd) {
    var big = max === 1000, a, b, B;
    if (op === '+') {
      if (type === 'hilfsaufgabe') {
        a = big ? digits(rnd, 7, 8, 7) : digits(rnd, 0, 7, 7);
        b = big && rnd() < 0.5 ? rndInt(rnd, 1, 5) * 100 - rndInt(rnd, 1, 2) : rndInt(rnd, big ? 2 : 1, 7) * 10 + rndInt(rnd, 8, 9);
      } else if (type === 'vereinfachen') {
        a = (big ? rndInt(rnd, 1, 7) * 100 : 0) + rndInt(rnd, 1, big ? 8 : 6) * 10 + rndInt(rnd, 8, 9);
        b = (big && rnd() < 0.5 ? rndInt(rnd, 1, 2) * 100 : 0) + rndInt(rnd, 1, 7) * 10 + (10 - a % 10);
      } else {
        a = big ? digits(rnd, 5, 8, 7) : digits(rnd, 0, 7, 7);
        b = big ? digits(rnd, 4, 8, 7) : digits(rnd, 0, 7, 7);
      }
    } else if (type === 'ergaenzen') {
      B = big ? (rnd() < 0.7 ? rndInt(rnd, 2, 9) * 100 : rndInt(rnd, 12, 98) * 10) : rndInt(rnd, 3, 9) * 10;
      a = B + rndInt(rnd, 1, big ? 6 : 4);
      b = B - rndInt(rnd, 1, big ? 6 : 4);
    } else if (type === 'hilfsaufgabe') {
      b = big && rnd() < 0.5 ? rndInt(rnd, 1, 6) * 100 - rndInt(rnd, 1, 3) : rndInt(rnd, 1, big ? 9 : 5) * 10 + rndInt(rnd, 8, 9);
      a = rndInt(rnd, b + (big ? 100 : 20), max - 3);
    } else {
      a = big ? digits(rnd, 9, 9, 9) : digits(rnd, 0, 9, 9);
      b = big ? digits(rnd, 6, 8, 7) : digits(rnd, 0, 6, 7);
    }
    return [a, b];
  }

  function fits(a, op, b, max, offered, type) {
    if (a % 10 === 0 || b % 10 === 0 || b < 11 || calc(a, op, b) < 1 || calc(a, op, b) > max) return false;
    if (op === '−' && type === 'schrittweise' && a - b < (max === 1000 ? 100 : 25)) return false;
    var c = classify(a, op, b, max, offered);
    if (c.canonical !== type) return false;
    // jeder sinnvolle Weg bleibt im Zahlenraum
    return c.accepted.every(function (k) {
      return PLANS[op][k](a, b, max).every(function (r) {
        return r.tokens.every(function (t) {
          var v = t.t === 'num' ? t.v : t.t === 'in' ? t.answer : 0;
          return v >= 0 && v <= max;
        });
      });
    });
  }

  function gen(opt, op) {
    opt = opt || {};
    var rnd = opt.rnd || Math.random, max = opt.max === 1000 ? 1000 : 100;
    var offered = opt.offered || offeredKeys(op);
    var types = op === '+' ? ['hilfsaufgabe', 'schrittweise'].concat(offered.indexOf('vereinfachen') >= 0 ? ['vereinfachen'] : [])
      : ['ergaenzen', 'hilfsaufgabe', 'schrittweise'];
    var type = types[Math.floor(rnd() * types.length)];
    for (var i = 0; i < 5000; i++) {
      var n = numbersFor(type, op, max, rnd);
      if (fits(n[0], op, n[1], max, offered, type)) return build(n[0], op, n[1], { max: max, offered: offered });
    }
    throw new Error('Keine passende Aufgabe für ' + type);
  }

  ['+', '−'].forEach(function (op) {
    Tasks.register(op, {
      key: 'welcherweg', name: 'Welcher Weg?', group: 'knobeln',
      desc: 'Den geschicktesten Rechenweg finden und damit rechnen',
      gen: function (opt) { return gen(opt, op); }
    });
  });

  var api = { classify: classify, offeredKeys: offeredKeys, build: build, gen: gen, near: near };
  if (node) module.exports = api;
  else root.RR.Formats = Object.assign(root.RR.Formats || {}, { welcherweg: api });
})(typeof window !== 'undefined' ? window : this);
