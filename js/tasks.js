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
  function IC(id, answer, check, expected) {
    return { t: 'in', id: id, answer: answer, check: check, expected: expected };
  }
  // Zahl, die im Profi-Modus selbst eingetragen wird
  function NP(profi, id, v) { return profi ? I(id, v) : N(v); }
  function RP(profi, id, v) { return profi ? R(id) : N(v); }

  function row(tokens, opts) {
    opts = opts || {};
    return { tokens: tokens, label: opts.label || '', hint: opts.hint || '', jump: opts.jump || null };
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
          hint: 'Zähle beide Ergebnisse zusammen: ' + (at + bt) + ' + ' + (ao + bo) + '.'
        })
      ]
    };
  }

  function addSchrittweise(opt) {
    var n = addNumbers(opt), a = n.a, b = n.b, p = opt.profi;
    var bt = tens(b), bo = ones(b);
    return {
      op: '+', strategy: 'schrittweise', a: a, b: b, answer: a + b,
      line: { start: a },
      rows: [
        row([N(b), T('='), NP(p, 'bt', bt), T('+'), NP(p, 'bo', bo)], {
          label: 'Zerlegen',
          hint: 'Zerlege ' + b + ' in Zehner und Einer.'
        }),
        row([N(a), T('+'), RP(p, 'bt', bt), T('='), I('s1', a + bt)], {
          label: '1. Schritt', jump: { from: a, to: a + bt, text: '+' + bt },
          hint: 'Erst die Zehner dazu: ' + a + ' + ' + bt + '. Zähle in Zehnerschritten weiter!'
        }),
        row([R('s1'), T('+'), RP(p, 'bo', bo), T('='), I('res', a + b)], {
          label: '2. Schritt', jump: { from: a + bt, to: a + b, text: '+' + bo },
          hint: 'Jetzt die Einer dazu: ' + (a + bt) + ' + ' + bo + '.' +
                (ones(a) + bo >= 10 ? ' Tipp: Erst bis ' + (tens(a + bt) + 10) + ', dann weiter.' : '')
        })
      ]
    };
  }

  function addHilfsaufgabe(opt) {
    var n = addNumbers({ crossing: 'egal' }, function (a, b) {
      return ones(b) >= 8 && a + tens(b) + 10 <= MAX;
    });
    var a = n.a, b = n.b, p = opt.profi;
    var B = tens(b) + 10, d = B - b;
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
          hint: 'Du hast ' + d + ' zu viel dazugetan. Nimm ' + d + ' wieder weg!'
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
    return {
      op: '−', strategy: 'schrittweise', a: a, b: b, answer: a - b,
      line: { start: a },
      rows: [
        row([N(b), T('='), NP(p, 'bt', bt), T('+'), NP(p, 'bo', bo)], {
          label: 'Zerlegen', hint: 'Zerlege ' + b + ' in Zehner und Einer.'
        }),
        row([N(a), T('−'), RP(p, 'bt', bt), T('='), I('s1', a - bt)], {
          label: '1. Schritt', jump: { from: a, to: a - bt, text: '−' + bt },
          hint: 'Erst die Zehner weg: ' + a + ' − ' + bt + '. Zähle in Zehnerschritten rückwärts!'
        }),
        row([R('s1'), T('−'), RP(p, 'bo', bo), T('='), I('res', a - b)], {
          label: '2. Schritt', jump: { from: a - bt, to: a - b, text: '−' + bo },
          hint: 'Jetzt die Einer weg: ' + (a - bt) + ' − ' + bo + '.' +
                (ones(a) < bo ? ' Tipp: Erst bis ' + tens(a - bt) + ', dann noch ' + (bo - ones(a)) + ' weiter.' : '')
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
    rows.push(row(sumTokens, { label: 'Zusammen', hint: 'Zähle alle Sprünge zusammen.' }));
    return {
      op: '−', strategy: 'ergaenzen', a: a, b: b, answer: a - b,
      line: { start: b }, rows: rows
    };
  }

  function subHilfsaufgabe(opt) {
    var n = subNumbers({ crossing: 'egal' }, function (a, b) {
      return ones(b) >= 8 && tens(b) + 10 < a;
    });
    var a = n.a, b = n.b, p = opt.profi;
    var B = tens(b) + 10, d = B - b;
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
    return {
      op: '·', strategy: 'zerlegen', a: a, b: b, answer: a * b,
      viz: { type: 'malkreuz', a: a, parts: [bt, bo], cells: ['p1', 'p2'], partIds: p ? ['bt', 'bo'] : null },
      rows: [
        row([N(b), T('='), NP(p, 'bt', bt), T('+'), NP(p, 'bo', bo)], {
          label: 'Zerlegen', hint: 'Zerlege ' + b + ' in Zehner und Einer.'
        }),
        row([N(a), T('·'), RP(p, 'bt', bt), T('='), I('p1', a * bt)], {
          label: 'Zehner mal', hint: 'Denk an ' + a + ' · ' + bt / 10 + ' = ' + a * bt / 10 + '. Dann ist ' + a + ' · ' + bt + ' zehnmal so viel.'
        }),
        row([N(a), T('·'), RP(p, 'bo', bo), T('='), I('p2', a * bo)], {
          label: 'Einer mal', hint: 'Das ist eine Einmaleins-Aufgabe: ' + a + ' · ' + bo + '.'
        }),
        row([R('p1'), T('+'), R('p2'), T('='), I('res', a * b)], {
          label: 'Zusammen', hint: 'Zähle beide Teilergebnisse zusammen: ' + a * bt + ' + ' + a * bo + '.'
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
          label: 'Zusammen', hint: 'Zähle zusammen: ' + 5 * b + ' + ' + rest * b + '.'
        })
      ]
    };
  }

  // ---------- Geteilt ----------
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
    var splitRow;
    if (p) {
      // Erste Teilzahl frei wählbar: muss durch d teilbar und kleiner als D sein.
      var p1In = IC('p1', p1, function (v) { return v > 0 && v < D && v % d === 0 && v >= d; });
      var p2In = IC('p2', p2, function (v, vals) { return v === D - vals.p1; },
        function (vals) { return D - vals.p1; });
      splitRow = row([N(D), T('='), p1In, T('+'), p2In], {
        label: 'Zerlegen',
        hint: 'Suche eine leichte Zahl aus der ' + d + 'er-Reihe, z. B. ' + p1 + ' (' + tens(q) + ' · ' + d + '). Dann: Was bleibt übrig?'
      });
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
        row(row3, { label: 'Zusammen', hint: 'Zähle die beiden Ergebnisse zusammen.' })
      ]
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

  /**
   * opt: { op: '+'|'−'|'·'|':'|'mix', strategy: key|'mix', crossing: 'ohne'|'mit'|'egal',
   *        profi: bool, rest: bool }
   */
  function generate(opt) {
    opt = opt || {};
    var op = opt.op && opt.op !== 'mix' ? opt.op : pick(OPS);
    var list = STRATEGIES[op];
    var s = null;
    if (opt.op !== 'mix' && opt.strategy && opt.strategy !== 'mix') {
      s = list.filter(function (x) { return x.key === opt.strategy; })[0];
    }
    if (!s) s = pick(list);
    var task = s.gen({ crossing: opt.crossing || 'egal', profi: !!opt.profi, rest: !!opt.rest });
    task.strategyName = s.name;
    task.strategyDesc = s.desc;
    task.profi = !!opt.profi;
    return task;
  }

  /** Text der Aufgabe, z. B. "47 + 38" */
  function taskText(task) { return task.a + ' ' + task.op + ' ' + task.b; }

  var api = { generate: generate, taskText: taskText, STRATEGIES: STRATEGIES, OPS: OPS, MAX: MAX };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RR = Object.assign(root.RR || {}, { Tasks: api });
})(typeof window !== 'undefined' ? window : this);
