/*
 * Knobeln: Welcher Weg passt? Zu einer Aufgabe, die zu einem Rechenweg besonders gut passt
 * (328 + 99 -> Hilfsaufgabe, 702 − 698 -> Ergänzen, 239 + 41 -> Vereinfachen, 346 + 228 -> Schrittweise),
 * wählt das Kind erst den Weg (Auswahlfeld, alle sinnvollen Wege zählen) und rechnet dann damit.
 * Nach der Wahl kommen die Zeilen des echten Rechenwegs aus js/tasks.js (Tasks.build) für genau diese
 * Zahlen und die eingestellte Stufe – bei "Alles selbst" mit allen richtigen anderen Schritten.
 * task.nextRow(vals) hängt sie eine nach der anderen an, task.more(vals) reicht die Probe durch.
 * Info-Zeilen ohne Eingabefeld (z. B. "99 = 100 − 1" bei "Mit Hilfe") fallen weg; die Tipps erklären es.
 * Ohne Anschauung: Der Rechenstrich des Wegs (task.line) wird nicht gezeigt, weil die Darstellung
 * beim Anzeigen der Aufgabe entsteht und der Weg da noch nicht feststeht (layout 'weg').
 * Angeboten werden nur Rechenwege, die es in Tasks.STRATEGIES gibt und die Tasks.build kennt.
 * Reines Modul ohne DOM – getestet in tests/welcherweg.test.js.
 */
(function (root) {
  'use strict';

  var node = typeof module !== 'undefined' && module.exports;
  var Tasks = node ? require('../tasks.js') : root.RR.Tasks;

  function rndInt(rnd, a, b) { return a + Math.floor(rnd() * (b - a + 1)); }

  var NAMES = { stellenweise: 'Stellenweise', schrittweise: 'Schrittweise', hilfsaufgabe: 'Hilfsaufgabe', ergaenzen: 'Ergänzen', vereinfachen: 'Vereinfachen' };

  function calc(a, op, b) { return op === '+' ? a + b : a - b; }
  function ceilTo(x, u) { return Math.ceil(x / u) * u; }

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

  // Die Zahl, die glatt gemacht wird: [Zahl, { X, d }, 'a' | 'b'] – erst die, die fast glatt ist (397 vor 148)
  function roundPick(a, b, max, op) {
    var c = op === '+' ? complement(a, b) : null;
    if (c) return c === 'a' ? [a, ten(a), 'a'] : [b, ten(b), 'b'];
    if (near(b, max)) return [b, near(b, max), 'b'];
    if (op === '+' && near(a, max)) return [a, near(a, max), 'a'];
    if (ten(b) || op === '−') return [b, ten(b), 'b'];
    return [a, ten(a), 'a'];
  }

  /** Angebotene Wege: Rechenwege der Rechenart, die es gibt und die es zu festen Zahlen gibt. */
  function offeredKeys(op) {
    return Tasks.STRATEGIES[op].filter(function (s) { return s.group === 'weg' && Tasks.canBuild(op, s.key); })
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
    return 'Keine Zahl ist fast glatt. Dann rechnest du am besten Schritt für Schritt' + (op === '+' ? ' oder Stelle für Stelle.' : '.');
  }
  function advice(key, a, op, b, max) {
    if (key === 'ergaenzen') return 'Genau! Spring einfach von ' + b + ' bis ' + a + '. Das ist nicht weit!';
    if (key === 'stellenweise') return 'Genau! Keine Zahl ist fast glatt. Also rechnest du Stelle für Stelle.';
    if (key === 'schrittweise') return 'Genau! Keine Zahl ist fast glatt. Also rechnest du Schritt für Schritt.';
    // Hilfsaufgabe und Vereinfachen gibt es nur, wenn eine Zahl fast glatt ist
    var r = roundPick(a, b, max, op);
    return key === 'hilfsaufgabe'
      ? 'Genau! ' + r[0] + ' ist fast ' + r[1].X + '. Rechne mit der glatten Zahl und gleiche dann aus.'
      : 'Genau! Mach aus ' + r[0] + ' die glatte Zahl ' + r[1].X + ' und verändere die andere Zahl passend.';
  }

  /** Rechenweg key zu diesen Zahlen in Stufe level (welche Zahl glatt wird, wie beim Tipp) */
  function wayTask(key, a, op, b, max, level) {
    return Tasks.build(op, key, a, b, { level: level, max: max, round: roundPick(a, b, max, op)[2] });
  }
  function hasInput(row) { return row.tokens.some(function (t) { return t.t === 'in' || t.t === 'choice'; }); }

  /**
   * Aufgabe zu festen Zahlen.
   * opt: { max, level: 'hilfe' | 'zerlegen' | 'selbst', offered: angebotene Wege (Standard: offeredKeys) }
   */
  function build(a, op, b, opt) {
    opt = opt || {};
    var max = opt.max === 1000 ? 1000 : 100, level = opt.level || 'hilfe';
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
          check: function (v) { return ok.indexOf(v) >= 0; },
          why: function (v) {
            return nameOf(op, offered[v]) + ' geht, ist hier aber nicht besonders geschickt. ' + choiceHint(c.canonical, a, op, b, max);
          }
        }],
        hint: choiceHint(c.canonical, a, op, b, max),
        advice: function (vals) { return advice(offered[vals.weg], a, op, b, max); }
      }]
    };
    // nach der Wahl: die Zeilen des gewählten Wegs, eine nach der anderen
    var way = null, wayKey = null, used = 0;
    function wayRows(vals) {
      if (!way || wayKey !== vals.weg) { way = wayTask(offered[vals.weg], a, op, b, max, level); wayKey = vals.weg; used = 0; }
      return way;
    }
    task.nextRow = function (vals) {
      var w = wayRows(vals);
      for (var guard = 0; guard < 50; guard++) {
        var r;
        if (used < w.rows.length) r = w.rows[used++];
        else { r = w.nextRow(vals); w.rows.push(r); used++; }
        if (hasInput(r)) return r;   // Info-Zeilen überspringen
      }
      throw new Error('Kein Rechenschritt mehr');
    };
    // nach dem Ergebnis noch eine Zeile? Eine feste Zeile des Wegs (Probe beim Ergänzen) oder eine,
    // die der Weg selbst noch anhängt (alles selbst)
    task.more = function (vals) {
      if (!way) return false;
      for (var i = used; i < way.rows.length; i++) if (hasInput(way.rows[i])) return true;
      return typeof way.more === 'function' && way.more(vals);
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
      return ['hilfe', 'zerlegen'].every(function (level) {
        return wayTask(k, a, op, b, max, level).rows.every(function (r) {
          return r.tokens.every(function (t) {
            var v = t.t === 'num' ? t.v : t.t === 'in' ? t.answer : 0;
            return v >= 0 && v <= max;
          });
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
      if (fits(n[0], op, n[1], max, offered, type)) return build(n[0], op, n[1], { max: max, offered: offered, level: opt.level });
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
