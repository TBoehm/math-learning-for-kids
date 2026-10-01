/*
 * Aufgaben-Generator für halbschriftliches Rechnen im Zahlenraum bis 100.
 *
 * Eine Aufgabe besteht aus Zeilen (rows). Jede Zeile ist eine kleine Gleichung
 * aus Tokens:
 *   { t: 'txt', v: '+' }            – Rechenzeichen oder Text
 *   { t: 'num', v: 47 }             – feste Zahl
 *   { t: 'in',  id, check, answer } – Eingabefeld; check(wert, werte) -> bool
 *   { t: 'ref', id }                – zeigt den (schon geprüften) Wert eines Feldes
 * Die Zeilen werden nacheinander gelöst. Zeilen ohne Eingabefeld sind Info-Zeilen.
 *
 * Stufen (wie viel Hilfe):
 *   hilfe    – Zerlegung und Zwischenschritte vorgegeben, nur Ergebnisse eintragen
 *   zerlegen – die Zerlegung trägt das Kind selbst ein
 *   selbst   – jeder Rechenschritt komplett selbst: [47] + [30] = [77], [77] + [8] = [85]
 */
(function (root) {
  'use strict';

  var MAX = 100;

  // ---------- kleine Helfer ----------
  function rnd(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function tens(n) { return Math.floor(n / 10) * 10; }
  function ones(n) { return n % 10; }

  var T = function (v) { return { t: 'txt', v: v }; };
  var N = function (v) { return { t: 'num', v: v }; };
  var R = function (id) { return { t: 'ref', id: id }; };
  // Eingabefeld mit fester Lösung
  function I(id, answer) {
    return { t: 'in', id: id, answer: answer, check: function (v) { return v === answer; } };
  }
  // Eingabefeld mit eigener Prüfung (z. B. frei wählbare Zerlegung).
  // expected(werte) liefert die passende Lösung zu den schon eingetragenen Werten.
  // deps: Felder derselben Zeile, die vorher stimmen müssen.
  function IC(id, answer, check, expected, deps) {
    return { t: 'in', id: id, answer: answer, check: check, expected: expected, deps: deps };
  }
  // Zahl, die im Profi-Modus selbst eingetragen wird
  function NP(profi, id, v) { return profi ? I(id, v) : N(v); }
  function RP(profi, id, v) { return profi ? R(id) : N(v); }

  function row(tokens, opts) {
    opts = opts || {};
    var r = { tokens: tokens, label: opts.label || '', hint: opts.hint || '', jump: opts.jump || null };
    if (opts.fixedOrder) r.fixedOrder = true;
    return r;
  }

  // ---------- Stufe "Alles selbst" ----------
  var CALC = {
    '+': function (xs) { return xs.reduce(function (s, x) { return s + x; }, 0); },
    '·': function (xs) { return xs.reduce(function (s, x) { return s * x; }, 1); },
    '−': function (xs) { return xs[0] - xs[1]; }
  };
  function valOf(x, vals) { return x.exp ? x.exp(vals) : x.v; }

  /**
   * Ein Rechenschritt, den das Kind komplett selbst einträgt: [x] op [y] = [z].
   * xs: Operanden { id, v (Musterlösung), exp(vals)? (hängt von früheren Zeilen ab) }
   * Bei + und · ist die Reihenfolge der Operanden egal (außer opts.fixedOrder).
   * Das Ergebnis wird aus den eingetragenen Operanden berechnet.
   */
  function stepRow(op, xs, resId, opts) {
    opts = opts || {};
    var ids = xs.map(function (x) { return x.id; });
    var free = (op === '+' || op === '·') && !opts.fixedOrder;
    var tokens = [];
    xs.forEach(function (x, i) {
      if (i) tokens.push(T(op));
      var prev = ids.slice(0, i);
      if (free) {
        // noch nicht verwendete Operanden (als Multimenge). Nur schon richtige Felder
        // werden abgezogen – so bleibt ein richtiges Feld richtig, auch wenn davor eins falsch ist.
        var remaining = function (vals) {
          var rest = xs.map(function (y) { return valOf(y, vals); });
          prev.forEach(function (p) { var k = rest.indexOf(vals[p]); if (k >= 0) rest.splice(k, 1); });
          return rest;
        };
        tokens.push(IC(x.id, x.v, function (v, vals) { return remaining(vals).indexOf(v) >= 0; },
          function (vals) { return remaining(vals)[0]; }));
      } else {
        tokens.push(IC(x.id, x.v, function (v, vals) { return v === valOf(x, vals); },
          function (vals) { return valOf(x, vals); }));
      }
    });
    var calc = function (vals) { return CALC[op](ids.map(function (id) { return vals[id]; })); };
    var resV = CALC[op](xs.map(function (x) { return x.v; }));
    tokens.push(T('='), IC(resId, resV, function (v, vals) { return v === calc(vals); }, calc, ids));
    return row(tokens, opts);
  }

  function crossingOk(crosses, mode) {
    if (mode === 'ohne') return !crosses;
    if (mode === 'mit') return crosses;
    return true;
  }

  // Wiederholt einen Zufallsversuch, bis er passt.
  function attempt(fn) {
    for (var i = 0; i < 5000; i++) {
      var r = fn();
      if (r) return r;
    }
    throw new Error('Keine passende Aufgabe gefunden');
  }

  // ---------- Plus ----------
  function addNumbers(opt, extra) {
    return attempt(function () {
      var a = rnd(11, 89), b = rnd(11, 89);
      if (ones(a) === 0 || ones(b) === 0) return null;
      if (a + b > MAX) return null;
      var crosses = ones(a) + ones(b) >= 10;
      if (!crossingOk(crosses, opt.crossing)) return null;
      if (extra && !extra(a, b)) return null;
      return { a: a, b: b };
    });
  }

  function addStellenweise(opt) {
    var n = addNumbers(opt), a = n.a, b = n.b, p = opt.profi;
    var at = tens(a), bt = tens(b), ao = ones(a), bo = ones(b);
    if (opt.level === 'selbst') {
      return {
        op: '+', strategy: 'stellenweise', a: a, b: b, answer: a + b,
        rows: [
          stepRow('+', [{ id: 'za', v: at }, { id: 'zb', v: bt }], 'z', {
            label: 'Zehner', hint: 'Nimm von beiden Zahlen nur die Zehner: ' + a + ' hat ' + at + ', ' + b + ' hat ' + bt + '.'
          }),
          stepRow('+', [{ id: 'ea', v: ao }, { id: 'eb', v: bo }], 'e', {
            label: 'Einer', hint: 'Jetzt nur die Einer: die letzte Ziffer von ' + a + ' und von ' + b + '.'
          }),
          stepRow('+', [{ id: 'sa', v: at + bt }, { id: 'sb', v: ao + bo }], 'res', {
            label: 'Zusammen', hint: 'Rechne deine beiden Ergebnisse zusammen: Zehner-Ergebnis + Einer-Ergebnis.'
          })
        ]
      };
    }
    return {
      op: '+', strategy: 'stellenweise', a: a, b: b, answer: a + b,
      rows: [
        row([NP(p, 'at', at), T('+'), NP(p, 'bt', bt), T('='), I('z', at + bt)], {
          label: 'Zehner',
          hint: p ? 'Nimm von beiden Zahlen nur die Zehner: ' + a + ' hat ' + at / 10 + ' Zehner, also ' + at + '.'
                  : 'Rechne erst die Zehner: ' + at + ' + ' + bt + '. Denk an ' + at / 10 + ' + ' + bt / 10 + ' = ' + (at + bt) / 10 + '!'
        }),
        row([NP(p, 'ao', ao), T('+'), NP(p, 'bo', bo), T('='), I('e', ao + bo)], {
          label: 'Einer',
          hint: p ? 'Jetzt nur die Einer: die letzte Ziffer von ' + a + ' und von ' + b + '.'
                  : 'Jetzt die Einer: ' + ao + ' + ' + bo + '.'
        }),
        row([R('z'), T('+'), R('e'), T('='), I('res', a + b)], {
          label: 'Zusammen',
          hint: 'Rechne beide Ergebnisse zusammen: ' + (at + bt) + ' + ' + (ao + bo) + '.'
        })
      ]
    };
  }

  function addSchrittweise(opt) {
    var n = addNumbers(opt), a = n.a, b = n.b, p = opt.profi;
    var bt = tens(b), bo = ones(b);
    var tip2 = ones(a) + bo > 10 ? ' Tipp: Erst bis ' + (tens(a + bt) + 10) + ', dann weiter.' : '';
    if (opt.level === 'selbst') {
      return {
        op: '+', strategy: 'schrittweise', a: a, b: b, answer: a + b,
        line: { start: a },
        rows: [
          stepRow('+', [{ id: 'xa', v: a }, { id: 'xb', v: bt }], 's1', {
            label: 'Zehner dazu', jump: { from: a, to: a + bt, text: '+' + bt },
            hint: 'Fang mit ' + a + ' an und rechne nur die Zehner von ' + b + ' dazu: ' + a + ' + ' + bt + '.'
          }),
          stepRow('+', [{ id: 'ya', v: a + bt }, { id: 'yb', v: bo }], 'res', {
            label: 'Einer dazu', jump: { from: a + bt, to: a + b, text: '+' + bo },
            hint: 'Nimm dein Ergebnis ' + (a + bt) + ' und rechne die Einer von ' + b + ' dazu.' + tip2
          })
        ]
      };
    }
    return {
      op: '+', strategy: 'schrittweise', a: a, b: b, answer: a + b,
      line: { start: a },
      rows: [
        row([N(b), T('='), NP(p, 'bt', bt), T('+'), NP(p, 'bo', bo)], {
          label: 'Zerlegen',
          hint: 'Zerlege ' + b + ' in Zehner und Einer – erst die Zehner, dann die Einer.'
        }),
        row([N(a), T('+'), RP(p, 'bt', bt), T('='), I('s1', a + bt)], {
          label: '1. Schritt', jump: { from: a, to: a + bt, text: '+' + bt },
          hint: 'Erst die Zehner dazu: ' + a + ' + ' + bt + '. Zähle in Zehnerschritten weiter!'
        }),
        row([R('s1'), T('+'), RP(p, 'bo', bo), T('='), I('res', a + b)], {
          label: '2. Schritt', jump: { from: a + bt, to: a + b, text: '+' + bo },
          hint: 'Jetzt die Einer dazu: ' + (a + bt) + ' + ' + bo + '.' + tip2
        })
      ]
    };
  }

  function addHilfsaufgabe(opt) {
    var n = addNumbers(opt, function (a, b) {
      return ones(b) >= 8 && a + tens(b) + 10 <= MAX;
    });
    var a = n.a, b = n.b, p = opt.profi;
    var B = tens(b) + 10, d = B - b;
    if (opt.level === 'selbst') {
      return {
        op: '+', strategy: 'hilfsaufgabe', a: a, b: b, answer: a + b,
        line: { start: a },
        rows: [
          stepRow('+', [{ id: 'xa', v: a }, { id: 'xb', v: B }], 's1', {
            label: 'Glatte Zahl dazu', jump: { from: a, to: a + B, text: '+' + B },
            hint: b + ' ist fast ' + B + '. Rechne erst mit der glatten Zahl: ' + a + ' + ' + B + '.'
          }),
          stepRow('−', [{ id: 'ya', v: a + B }, { id: 'yb', v: d }], 'res', {
            label: 'Ausgleichen', jump: { from: a + B, to: a + b, text: '−' + d, back: true },
            hint: 'Du hast ' + d + ' zu viel dazugerechnet. Nimm von ' + (a + B) + ' wieder ' + d + ' weg!'
          })
        ]
      };
    }
    return {
      op: '+', strategy: 'hilfsaufgabe', a: a, b: b, answer: a + b,
      line: { start: a },
      rows: [
        row([N(b), T('='), NP(p, 'B', B), T('−'), NP(p, 'd', d)], {
          label: 'Hilfszahl',
          hint: b + ' ist fast ' + B + '. Wie viel fehlt bis ' + B + '?'
        }),
        row([N(a), T('+'), RP(p, 'B', B), T('='), I('s1', a + B)], {
          label: 'Leichte Aufgabe', jump: { from: a, to: a + B, text: '+' + B },
          hint: 'Rechne mit der glatten Zahl: ' + a + ' + ' + B + '.'
        }),
        row([R('s1'), T('−'), RP(p, 'd', d), T('='), I('res', a + b)], {
          label: 'Ausgleichen', jump: { from: a + B, to: a + b, text: '−' + d, back: true },
          hint: 'Du hast ' + d + ' zu viel dazugerechnet. Nimm ' + d + ' wieder weg!'
        })
      ]
    };
  }

  // ---------- Minus ----------
  function subNumbers(opt, extra) {
    return attempt(function () {
      var a = rnd(21, 99), b = rnd(11, a - 2);
      if (ones(b) === 0 || b < 11) return null;
      var crosses = ones(a) < ones(b);
      if (!crossingOk(crosses, opt.crossing)) return null;
      if (extra && !extra(a, b)) return null;
      return { a: a, b: b };
    });
  }

  function subSchrittweise(opt) {
    var n = subNumbers(opt), a = n.a, b = n.b, p = opt.profi;
    var bt = tens(b), bo = ones(b);
    var tip2 = ones(a) !== 0 && ones(a) < bo ? ' Tipp: Erst bis ' + tens(a - bt) + ', dann noch ' + (bo - ones(a)) + ' weiter.' : '';
    if (opt.level === 'selbst') {
      return {
        op: '−', strategy: 'schrittweise', a: a, b: b, answer: a - b,
        line: { start: a },
        rows: [
          stepRow('−', [{ id: 'xa', v: a }, { id: 'xb', v: bt }], 's1', {
            label: 'Zehner weg', jump: { from: a, to: a - bt, text: '−' + bt },
            hint: 'Fang mit ' + a + ' an und nimm nur die Zehner von ' + b + ' weg: ' + a + ' − ' + bt + '.'
          }),
          stepRow('−', [{ id: 'ya', v: a - bt }, { id: 'yb', v: bo }], 'res', {
            label: 'Einer weg', jump: { from: a - bt, to: a - b, text: '−' + bo },
            hint: 'Nimm dein Ergebnis ' + (a - bt) + ' und nimm die Einer von ' + b + ' weg.' + tip2
          })
        ]
      };
    }
    return {
      op: '−', strategy: 'schrittweise', a: a, b: b, answer: a - b,
      line: { start: a },
      rows: [
        row([N(b), T('='), NP(p, 'bt', bt), T('+'), NP(p, 'bo', bo)], {
          label: 'Zerlegen', hint: 'Zerlege ' + b + ' in Zehner und Einer – erst die Zehner, dann die Einer.'
        }),
        row([N(a), T('−'), RP(p, 'bt', bt), T('='), I('s1', a - bt)], {
          label: '1. Schritt', jump: { from: a, to: a - bt, text: '−' + bt },
          hint: 'Erst die Zehner weg: ' + a + ' − ' + bt + '. Zähle in Zehnerschritten rückwärts!'
        }),
        row([R('s1'), T('−'), RP(p, 'bo', bo), T('='), I('res', a - b)], {
          label: '2. Schritt', jump: { from: a - bt, to: a - b, text: '−' + bo },
          hint: 'Jetzt die Einer weg: ' + (a - bt) + ' − ' + bo + '.' + tip2
        })
      ]
    };
  }

  function subErgaenzen(opt) {
    var n = subNumbers(opt, function (a, b) { return a - b <= 60; });
    var a = n.a, b = n.b;
    // Sprünge: bis zum nächsten Zehner, dann Zehner, dann Einer
    var stops = [b];
    var cur = b;
    var nextTen = tens(b) + 10;
    if (nextTen <= tens(a)) { cur = nextTen; stops.push(cur); }
    if (tens(a) > cur) { cur = tens(a); stops.push(cur); }
    if (a > cur) { stops.push(a); }
    var rows = [], ids = [];
    if (opt.level === 'selbst') return ergaenzenSelbst(a, b, stops);
    if (stops.length === 2) {
      rows.push(row([N(b), T('+'), I('res', a - b), T('='), N(a)], {
        label: 'Sprung', jump: { from: b, to: a, text: '+' + (a - b) },
        hint: 'Wie viel fehlt von ' + b + ' bis ' + a + '? Zähle die Einer weiter.'
      }));
      return { op: '−', strategy: 'ergaenzen', a: a, b: b, answer: a - b, line: { start: b }, rows: rows };
    }
    for (var i = 1; i < stops.length; i++) {
      var from = stops[i - 1], to = stops[i], id = 'j' + i;
      ids.push(id);
      var hint = to % 10 === 0 && from % 10 !== 0
        ? 'Wie viel fehlt von ' + from + ' bis zum nächsten Zehner ' + to + '?'
        : 'Wie viel fehlt von ' + from + ' bis ' + to + '?';
      rows.push(row([N(from), T('+'), I(id, to - from), T('='), N(to)], {
        label: i + '. Sprung', jump: { from: from, to: to, text: '+' + (to - from) }, hint: hint
      }));
    }
    var sumTokens = [];
    ids.forEach(function (id, k) { if (k) sumTokens.push(T('+')); sumTokens.push(R(id)); });
    sumTokens.push(T('='), I('res', a - b));
    rows.push(row(sumTokens, { label: 'Zusammen', hint: 'Rechne alle Sprünge zusammen.' }));
    return {
      op: '−', strategy: 'ergaenzen', a: a, b: b, answer: a - b,
      line: { start: b }, rows: rows
    };
  }

  function subHilfsaufgabe(opt) {
    var n = subNumbers(opt, function (a, b) {
      return ones(b) >= 8 && tens(b) + 10 < a;
    });
    var a = n.a, b = n.b, p = opt.profi;
    var B = tens(b) + 10, d = B - b;
    if (opt.level === 'selbst') {
      return {
        op: '−', strategy: 'hilfsaufgabe', a: a, b: b, answer: a - b,
        line: { start: a },
        rows: [
          stepRow('−', [{ id: 'xa', v: a }, { id: 'xb', v: B }], 's1', {
            label: 'Glatte Zahl weg', jump: { from: a, to: a - B, text: '−' + B },
            hint: b + ' ist fast ' + B + '. Rechne erst mit der glatten Zahl: ' + a + ' − ' + B + '.'
          }),
          stepRow('+', [{ id: 'ya', v: a - B }, { id: 'yb', v: d }], 'res', {
            label: 'Ausgleichen', jump: { from: a - B, to: a - b, text: '+' + d, back: true },
            hint: 'Du hast ' + d + ' zu viel weggenommen. Gib zu ' + (a - B) + ' wieder ' + d + ' dazu!'
          })
        ]
      };
    }
    return {
      op: '−', strategy: 'hilfsaufgabe', a: a, b: b, answer: a - b,
      line: { start: a },
      rows: [
        row([N(b), T('='), NP(p, 'B', B), T('−'), NP(p, 'd', d)], {
          label: 'Hilfszahl', hint: b + ' ist fast ' + B + '. Wie viel fehlt bis ' + B + '?'
        }),
        row([N(a), T('−'), RP(p, 'B', B), T('='), I('s1', a - B)], {
          label: 'Leichte Aufgabe', jump: { from: a, to: a - B, text: '−' + B },
          hint: 'Rechne mit der glatten Zahl: ' + a + ' − ' + B + '.'
        }),
        row([R('s1'), T('+'), RP(p, 'd', d), T('='), I('res', a - b)], {
          label: 'Ausgleichen', jump: { from: a - B, to: a - b, text: '+' + d, back: true },
          hint: 'Du hast ' + d + ' zu viel weggenommen. Gib ' + d + ' wieder dazu!'
        })
      ]
    };
  }

  // ---------- Mal ----------
  function mulZerlegen(opt) {
    var n = attempt(function () {
      var a = rnd(2, 9), b = rnd(11, 49);
      if (ones(b) === 0 || a * b > MAX) return null;
      return { a: a, b: b };
    });
    var a = n.a, b = n.b, p = opt.profi;
    var bt = tens(b), bo = ones(b);
    if (opt.level === 'selbst') {
      return {
        op: '·', strategy: 'zerlegen', a: a, b: b, answer: a * b,
        viz: { type: 'malkreuz', a: a, parts: [bt, bo], cells: ['p1', 'p2'], partsAfter: ['p1', 'p2'] },
        rows: [
          stepRow('·', [{ id: 'xa', v: a }, { id: 'xb', v: bt }], 'p1', {
            label: 'Zehner mal', hint: 'Nimm erst nur die Zehner von ' + b + ': ' + a + ' · ' + bt + '. Denk an ' + a + ' · ' + bt / 10 + ' = ' + a * bt / 10 + '.'
          }),
          stepRow('·', [{ id: 'ya', v: a }, { id: 'yb', v: bo }], 'p2', {
            label: 'Einer mal', hint: 'Jetzt die Einer von ' + b + ': eine Einmaleins-Aufgabe mit ' + a + '.'
          }),
          stepRow('+', [{ id: 'sa', v: a * bt }, { id: 'sb', v: a * bo }], 'res', {
            label: 'Zusammen', hint: 'Rechne deine beiden Teilergebnisse zusammen.'
          })
        ]
      };
    }
    return {
      op: '·', strategy: 'zerlegen', a: a, b: b, answer: a * b,
      viz: { type: 'malkreuz', a: a, parts: [bt, bo], cells: ['p1', 'p2'], partIds: p ? ['bt', 'bo'] : null },
      rows: [
        row([N(b), T('='), NP(p, 'bt', bt), T('+'), NP(p, 'bo', bo)], {
          label: 'Zerlegen', hint: 'Zerlege ' + b + ' in Zehner und Einer – erst die Zehner, dann die Einer.'
        }),
        row([N(a), T('·'), RP(p, 'bt', bt), T('='), I('p1', a * bt)], {
          label: 'Zehner mal', hint: 'Denk an ' + a + ' · ' + bt / 10 + ' = ' + a * bt / 10 + '. Dann ist ' + a + ' · ' + bt + ' zehnmal so viel.'
        }),
        row([N(a), T('·'), RP(p, 'bo', bo), T('='), I('p2', a * bo)], {
          label: 'Einer mal', hint: 'Das ist eine Einmaleins-Aufgabe: ' + a + ' · ' + bo + '.'
        }),
        row([R('p1'), T('+'), R('p2'), T('='), I('res', a * b)], {
          label: 'Zusammen', hint: 'Rechne beide Teilergebnisse zusammen: ' + a * bt + ' + ' + a * bo + '.'
        })
      ]
    };
  }

  function mulKernaufgaben(opt) {
    var p = opt.profi;
    var n = attempt(function () {
      var a = rnd(6, 9), b = rnd(3, 9);
      if (a * b > MAX) return null;
      return { a: a, b: b };
    });
    var a = n.a, b = n.b;
    var useTen = a === 9 || (a === 8 && Math.random() < 0.4);
    if (useTen) {
      var r = 10 - a;
      if (opt.level === 'selbst') {
        return {
          op: '·', strategy: 'kernaufgaben', a: a, b: b, answer: a * b,
          viz: { type: 'punktefeld', rows: 10, cols: b, split: a, minus: true },
          rows: [
            stepRow('·', [{ id: 'xa', v: 10 }, { id: 'xb', v: b }], 'p1', {
              label: '10er-Kernaufgabe', hint: a + ' ist fast 10. Rechne erst 10 · ' + b + '.'
            }),
            stepRow('·', [{ id: 'ya', v: r }, { id: 'yb', v: b }], 'p2', {
              label: 'Zu viel', hint: '10 ist ' + r + ' mehr als ' + a + '. Wie viel ist ' + r + ' · ' + b + '?'
            }),
            stepRow('−', [{ id: 'sa', v: 10 * b }, { id: 'sb', v: r * b }], 'res', {
              label: 'Abziehen', hint: 'Nimm das Zuviel weg: Ergebnis der Kernaufgabe minus Zuviel.'
            })
          ]
        };
      }
      return {
        op: '·', strategy: 'kernaufgaben', a: a, b: b, answer: a * b,
        viz: { type: 'punktefeld', rows: 10, cols: b, split: a, minus: true },
        rows: [
          row([N(a), T('='), NP(p, 'k', 10), T('−'), NP(p, 'r', r)], {
            label: 'Zerlegen', hint: a + ' ist fast 10. ' + a + ' = 10 − ' + r + '.'
          }),
          row([RP(p, 'k', 10), T('·'), N(b), T('='), I('p1', 10 * b)], {
            label: 'Kernaufgabe', hint: 'Mal 10 ist leicht: 10 · ' + b + '.'
          }),
          row([RP(p, 'r', r), T('·'), N(b), T('='), I('p2', r * b)], {
            label: 'Zu viel', hint: r + ' · ' + b + ' – so viel ist zu viel.'
          }),
          row([R('p1'), T('−'), R('p2'), T('='), I('res', a * b)], {
            label: 'Abziehen', hint: 'Nimm das Zuviel weg: ' + 10 * b + ' − ' + r * b + '.'
          })
        ]
      };
    }
    var rest = a - 5;
    if (opt.level === 'selbst') {
      return {
        op: '·', strategy: 'kernaufgaben', a: a, b: b, answer: a * b,
        viz: { type: 'punktefeld', rows: a, cols: b, split: 5 },
        rows: [
          stepRow('·', [{ id: 'xa', v: 5 }, { id: 'xb', v: b }], 'p1', {
            label: '5er-Kernaufgabe', hint: 'Nimm erst 5 · ' + b + ' – das ist die Hälfte von 10 · ' + b + '.'
          }),
          stepRow('·', [{ id: 'ya', v: rest }, { id: 'yb', v: b }], 'p2', {
            label: 'Rest', hint: a + ' = 5 + ' + rest + '. Rechne noch ' + rest + ' · ' + b + '.'
          }),
          stepRow('+', [{ id: 'sa', v: 5 * b }, { id: 'sb', v: rest * b }], 'res', {
            label: 'Zusammen', hint: 'Rechne deine beiden Teilergebnisse zusammen.'
          })
        ]
      };
    }
    return {
      op: '·', strategy: 'kernaufgaben', a: a, b: b, answer: a * b,
      viz: { type: 'punktefeld', rows: a, cols: b, split: 5 },
      rows: [
        row([N(a), T('='), NP(p, 'k', 5), T('+'), NP(p, 'r', rest)], {
          label: 'Zerlegen', hint: 'Nimm die Kernaufgabe mit 5: ' + a + ' = 5 + ' + rest + '.'
        }),
        row([RP(p, 'k', 5), T('·'), N(b), T('='), I('p1', 5 * b)], {
          label: 'Kernaufgabe', hint: '5 mal ist die Hälfte von 10 mal: 10 · ' + b + ' = ' + 10 * b + ', die Hälfte davon.'
        }),
        row([RP(p, 'r', rest), T('·'), N(b), T('='), I('p2', rest * b)], {
          label: 'Rest', hint: rest + ' · ' + b + '.'
        }),
        row([R('p1'), T('+'), R('p2'), T('='), I('res', a * b)], {
          label: 'Zusammen', hint: 'Rechne zusammen: ' + 5 * b + ' + ' + rest * b + '.'
        })
      ]
    };
  }

  // ---------- Geteilt ----------
  // Ein Teil ist leicht zu teilen, wenn das Ergebnis eine Zehnerzahl ist (60 : 6 = 10)
  // oder aus dem Einmaleins kommt (24 : 6 = 4, auch mit Rest: 27 : 6 = 4 R 3).
  function easyPart(part, d) {
    var qq = Math.floor(part / d);
    return (part % d === 0 && qq % 10 === 0) || qq <= 10;
  }
  function isEasySplit(p1, p2, d) { return easyPart(p1, d) && easyPart(p2, d); }

  function divZerlegen(opt) {
    var withRest = !!opt.rest, p = opt.profi;
    var n = attempt(function () {
      var d = rnd(2, 9), q = rnd(11, 49);
      if (ones(q) === 0) return null;
      var r = withRest ? rnd(1, d - 1) : 0;
      if (q * d + r > MAX) return null;
      return { d: d, q: q, r: r };
    });
    var d = n.d, q = n.q, r = n.r, D = q * d + r;
    var p1 = tens(q) * d, p2 = D - p1;
    var adviceFn = function (vals) {
      if (isEasySplit(vals.p1, vals.p2, d)) return null;
      return 'Stimmt! Tipp fürs nächste Mal: ' + p1 + ' + ' + p2 + ' ist leichter, denn ' +
        p1 + ' : ' + d + ' = ' + tens(q) + ' weißt du sofort. 💡';
    };
    if (opt.level === 'selbst') return divSelbst(D, d, q, r, p1, p2, withRest, adviceFn);
    var splitRow;
    if (p) {
      // Erste Teilzahl frei wählbar: muss durch d teilbar und kleiner als D sein.
      var p1In = IC('p1', p1, function (v) { return v > 0 && v < D && v % d === 0; });
      var p2In = IC('p2', p2, function (v, vals) { return v === D - vals.p1; },
        function (vals) { return D - vals.p1; }, ['p1']);
      splitRow = row([N(D), T('='), p1In, T('+'), p2In], {
        label: 'Zerlegen',
        hint: 'Suche eine leichte Zahl aus der ' + d + 'er-Reihe, z. B. ' + p1 + ' (' + tens(q) + ' · ' + d + '). Dann: Was bleibt übrig?'
      });
      // Richtige, aber umständliche Zerlegung: annehmen und freundlich einen leichteren Weg zeigen
      splitRow.advice = adviceFn;
    } else {
      splitRow = row([N(D), T('='), N(p1), T('+'), N(p2)], {
        label: 'Zerlegen', hint: 'Wir zerlegen ' + D + ' in zwei leichte Zahlen.'
      });
    }

    var q1Exp = function (vals) { return (p ? vals.p1 : p1) / d; };
    var q2Exp = function (vals) { return Math.floor((p ? vals.p2 : p2) / d); };
    var rExp = function (vals) { return (p ? vals.p2 : p2) % d; };
    var resExp = function (vals) { return vals.q1 + vals.q2; };
    var is = function (exp) { return function (v, vals) { return v === exp(vals); }; };

    var row2 = [RP(p, 'p2', p2), T(':'), N(d), T('='), IC('q2', q - tens(q), is(q2Exp), q2Exp)];
    if (withRest) row2.push(T('R'), IC('r', r, is(rExp), rExp));
    var row3 = [R('q1'), T('+'), R('q2'), T('='), IC('res', q, is(resExp), resExp)];
    if (withRest) row3.push(T('R'), R('r'));

    return {
      op: ':', strategy: 'zerlegen', a: D, b: d, answer: q, rest: r,
      viz: { type: 'baum', D: D, d: d, parts: p ? ['p1', 'p2'] : [p1, p2], quots: ['q1', 'q2'] },
      rows: [
        splitRow,
        row([RP(p, 'p1', p1), T(':'), N(d), T('='), IC('q1', tens(q), is(q1Exp), q1Exp)], {
          label: '1. Teil', hint: 'Denk an das Einmaleins: Wie oft passt ' + d + ' in ' + (p ? 'die erste Zahl' : p1) + '?' +
            (p ? '' : ' (' + tens(q) / 10 + ' · ' + d + ' = ' + p1 / 10 + ', also ' + tens(q) + ' · ' + d + ' = ' + p1 + ')')
        }),
        row(row2, {
          label: '2. Teil', hint: 'Wie oft passt ' + d + ' in ' + (p ? 'die zweite Zahl' : p2) + '?' +
            (withRest ? ' Was übrig bleibt, ist der Rest.' : '')
        }),
        row(row3, { label: 'Zusammen', hint: 'Rechne die beiden Ergebnisse zusammen.' })
      ]
    };
  }

  // Ergänzen, alles selbst: [37] + [3] = [40], [40] + [40] = [80], [80] + [2] = [82], Sprünge zusammen
  function ergaenzenSelbst(a, b, stops) {
    var rows = [], jumps = [];
    for (var i = 1; i < stops.length; i++) {
      var from = stops[i - 1], to = stops[i];
      var single = stops.length === 2;
      var label = single ? 'Sprung' : (from % 10 !== 0 && to % 10 === 0 ? 'Bis zum Zehner'
        : (to % 10 === 0 ? 'Zehnersprung' : 'Bis zum Ziel'));
      var hint = i === 1
        ? 'Fang bei der kleineren Zahl ' + from + ' an. ' + (single ? 'Wie viel fehlt bis ' + to + '?'
          : (to % 10 === 0 && from % 10 !== 0 ? 'Spring bis zum nächsten Zehner.' : 'Spring bis ' + to + '.'))
        : 'Mach bei ' + from + ' weiter. ' + (to % 10 === 0 ? 'Spring in Zehnern bis ' + to + '.' : 'Spring bis zum Ziel ' + to + '.');
      // Bei nur einem Sprung ist der Sprung selbst das Ergebnis
      var jumpId = single ? 'res' : 'j' + i;
      jumps.push({ id: 'u' + i, v: to - from });
      rows.push(stepRow('+', [{ id: 'f' + i, v: from }, { id: jumpId, v: to - from }], 't' + i, {
        label: label, fixedOrder: true, jump: { from: from, to: to, text: '+' + (to - from) }, hint: hint
      }));
    }
    if (jumps.length > 1) {
      rows.push(stepRow('+', jumps, 'res', { label: 'Zusammen', hint: 'Rechne alle Sprünge zusammen.' }));
    }
    return { op: '−', strategy: 'ergaenzen', a: a, b: b, answer: a - b, line: { start: b }, rows: rows };
  }

  // Geteilt, alles selbst: [60] : [6] = [10], [24] : [6] = [4], [10] + [4] = [14]
  function divSelbst(D, d, q, r, p1, p2, withRest, adviceFn) {
    var is = function (exp) { return function (v, vals) { return v === exp(vals); }; };
    var dIs = function (v) { return v === d; };
    var q1Exp = function (vals) { return vals.p1 / d; };
    var p2Exp = function (vals) { return D - vals.p1; };
    var q2Exp = function (vals) { return Math.floor(vals.p2 / d); };
    var rExp = function (vals) { return vals.p2 % d; };

    var row1 = row([
      IC('p1', p1, function (v) { return v > 0 && v < D && v % d === 0; }), T(':'), IC('d1', d, dIs),
      T('='), IC('q1', tens(q), is(q1Exp), q1Exp, ['p1', 'd1'])
    ], {
      label: '1. Teil',
      hint: 'Nimm zuerst eine leichte Zahl aus der ' + d + 'er-Reihe, die in ' + D + ' steckt, z. B. ' + p1 + ', und teile sie durch ' + d + '.'
    });
    var t2 = [IC('p2', p2, is(p2Exp), p2Exp), T(':'), IC('d2', d, dIs), T('='), IC('q2', q - tens(q), is(q2Exp), q2Exp, ['p2', 'd2'])];
    if (withRest) t2.push(T('R'), IC('r', r, is(rExp), rExp, ['p2', 'd2']));
    var row2 = row(t2, {
      label: '2. Teil',
      hint: 'Was bleibt von ' + D + ' übrig? Teile das auch durch ' + d + '.' + (withRest ? ' Was nicht mehr passt, ist der Rest.' : '')
    });
    row2.advice = adviceFn;
    var row3 = stepRow('+', [
      { id: 'sa', v: tens(q), exp: function (vals) { return vals.q1; } },
      { id: 'sb', v: q - tens(q), exp: function (vals) { return vals.q2; } }
    ], 'res', { label: 'Zusammen', hint: 'Rechne deine beiden Ergebnisse zusammen.' + (withRest ? ' Den Rest schreibst du dahinter.' : '') });
    if (withRest) {
      var restExp = function (vals) { return vals.r; };
      row3.tokens.push(T('R'), IC('r2', r, is(restExp), restExp));
    }
    return {
      op: ':', strategy: 'zerlegen', a: D, b: d, answer: q, rest: r,
      viz: { type: 'baum', D: D, d: d, parts: ['p1', 'p2'], quots: ['q1', 'q2'] },
      rows: [row1, row2, row3]
    };
  }

  // ---------- Verzeichnis ----------
  var STRATEGIES = {
    '+': [
      { key: 'stellenweise', name: 'Stellenweise', desc: 'Zehner + Zehner, Einer + Einer', gen: addStellenweise },
      { key: 'schrittweise', name: 'Schrittweise', desc: 'Erst die Zehner, dann die Einer dazu', gen: addSchrittweise },
      { key: 'hilfsaufgabe', name: 'Hilfsaufgabe', desc: 'Mit der glatten Zahl rechnen und ausgleichen', gen: addHilfsaufgabe }
    ],
    '−': [
      { key: 'schrittweise', name: 'Schrittweise', desc: 'Erst die Zehner, dann die Einer weg', gen: subSchrittweise },
      { key: 'ergaenzen', name: 'Ergänzen', desc: 'Von der kleinen zur großen Zahl springen', gen: subErgaenzen },
      { key: 'hilfsaufgabe', name: 'Hilfsaufgabe', desc: 'Mit der glatten Zahl rechnen und ausgleichen', gen: subHilfsaufgabe }
    ],
    '·': [
      { key: 'zerlegen', name: 'Zerlegen', desc: 'Zehner mal, Einer mal, zusammen', gen: mulZerlegen },
      { key: 'kernaufgaben', name: 'Kernaufgaben', desc: 'Schwere Einmaleins-Aufgaben mit 5 · und 10 ·', gen: mulKernaufgaben }
    ],
    ':': [
      { key: 'zerlegen', name: 'Zerlegen', desc: 'In zwei leichte Teile zerlegen', gen: divZerlegen }
    ]
  };

  var OPS = ['+', '−', '·', ':'];

  var LEVELS = [
    { key: 'hilfe', name: 'Mit Hilfe', desc: 'Zerlegung und Zwischenschritte sind vorgegeben.' },
    { key: 'zerlegen', name: 'Zerlegung selbst', desc: 'Die Zerlegung trägst du selbst ein.' },
    { key: 'selbst', name: 'Alles selbst', desc: 'Jeden Rechenschritt schreibst du selbst auf.' }
  ];

  /**
   * opt: { op: '+'|'−'|'·'|':'|'mix', strategy: key|'mix', crossing: 'ohne'|'mit'|'egal',
   *        level: 'hilfe'|'zerlegen'|'selbst' (alt: profi: bool = 'zerlegen'), rest: bool }
   */
  function generate(opt) {
    opt = opt || {};
    var op = opt.op && opt.op !== 'mix' ? opt.op : pick(OPS);
    var list = STRATEGIES[op];
    var s = null;
    if (opt.op !== 'mix' && opt.strategy && opt.strategy !== 'mix') {
      s = list.filter(function (x) { return x.key === opt.strategy; })[0];
    }
    if (!s) {
      var pool = opt.crossing === 'ohne'
        ? list.filter(function (x) { return x.key !== 'hilfsaufgabe'; }) : list;
      s = pick(pool.length ? pool : list);
    }
    var level = opt.level || (opt.profi ? 'zerlegen' : 'hilfe');
    var task = s.gen({ crossing: opt.crossing || 'egal', level: level, profi: level === 'zerlegen', rest: !!opt.rest });
    task.strategyName = s.name;
    task.strategyDesc = s.desc;
    task.level = level;
    task.profi = level !== 'hilfe';
    return task;
  }

  /** Text der Aufgabe, z. B. "47 + 38" */
  function taskText(task) { return task.a + ' ' + task.op + ' ' + task.b; }

  var api = { generate: generate, taskText: taskText, isEasySplit: isEasySplit, LEVELS: LEVELS, STRATEGIES: STRATEGIES, OPS: OPS, MAX: MAX };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RR = Object.assign(root.RR || {}, { Tasks: api });
})(typeof window !== 'undefined' ? window : this);
