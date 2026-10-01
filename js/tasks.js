/*
 * Aufgaben-Generator für halbschriftliches Rechnen im Zahlenraum bis 100 oder bis 1000.
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
 *
 * Grundsatz: Jeder richtige Schritt, der zum Rechenweg passt, wird angenommen – auch wenn er
 * anders ist als die Musterlösung (z. B. 59 + 19 als 60 + 19 − 1 oder als 59 + 20 − 1). Jede
 * spätere Zeile wird gegen die Zahlen geprüft, die das Kind tatsächlich eingetragen hat.
 * Darum hängen viele Prüfungen von den schon gesicherten Werten ab (check(v, vals),
 * expected(vals)), und bei "Alles selbst" verlängert das Kind die Rechnung oft selbst:
 *   task.nextRow(vals) – die nächste Zeile passend zu den bisherigen Eingaben
 *   task.more(vals)    – true, solange nach dem Ergebnis noch eine Zeile kommt (Probe)
 * Sprünge auf dem Rechenstrich (row.jump) dürfen dann Funktionen der Werte sein.
 */
(function (root) {
  'use strict';

  var MAX = 100;
  var KERN = [1, 2, 5, 10]; // Kernaufgaben beim Einmaleins

  // ---------- kleine Helfer ----------
  function rnd(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function chance(p) { return Math.random() < p; }
  function has(arr, v) { return arr.indexOf(v) >= 0; }
  function tens(n) { return Math.floor(n / 10) * 10; }
  function hund(n) { return Math.floor(n / 100) * 100; }
  function ones(n) { return n % 10; }
  function zDigit(n) { return Math.floor(n / 10) % 10; }
  function sum(xs) { return xs.reduce(function (s, x) { return s + x; }, 0); }

  /** Stellenwerte einer Zahl: 346 -> [300, 40, 6] (Nullen fallen weg) */
  function placeParts(n) {
    return [1000, 100, 10, 1].map(function (p) { return (Math.floor(n / p) % 10) * p; })
      .filter(function (x) { return x > 0; });
  }
  /** Stelle einer reinen Stellenzahl: 300 -> 100, 40 -> 10, 6 -> 1, sonst 0 */
  function placeOf(v) {
    var ps = [100, 10, 1];
    for (var i = 0; i < ps.length; i++) if (v % ps[i] === 0 && v / ps[i] >= 1 && v / ps[i] <= 9) return ps[i];
    return 0;
  }
  var PLACE = { 100: 'Hunderter', 10: 'Zehner', 1: 'Einer' };
  function placeName(v) { return PLACE[placeOf(v)] || 'Zahl'; }
  /** "Hunderter, Zehner und Einer" */
  function andList(xs) { return xs.length > 1 ? xs.slice(0, -1).join(', ') + ' und ' + xs[xs.length - 1] : xs.join(''); }

  /** Übergang an irgendeiner Stelle (Zehner- oder Hunderterübergang) */
  function carries(a, b) { return ones(a) + ones(b) >= 10 || (a % 100) + (b % 100) >= 100; }
  function borrows(a, b) { return ones(a) < ones(b) || (a % 100) < (b % 100); }

  /**
   * Ist g eine glatte Hilfszahl für v? Eine Zehnerzahl höchstens 5 entfernt,
   * bis 1000 auch eine Hunderterzahl höchstens 10 entfernt.
   */
  function isGlatt(g, v, max) {
    if (!(g > 0) || g % 10 !== 0 || g === v) return false;
    var d = Math.abs(g - v);
    return d <= 5 || (max === 1000 && g % 100 === 0 && d <= 10);
  }
  /** nächste glatte Zahl (für die Musterlösung) */
  function nearestGlatt(v) { return ones(v) >= 5 ? tens(v) + 10 : tens(v); }

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
  // Eingabefeld, dessen Lösung sich aus den schon gesicherten Werten ergibt
  function IE(id, answer, exp, deps) {
    return IC(id, answer, function (v, vals) { return v === exp(vals); }, exp, deps);
  }
  // Zahl, die im Profi-Modus selbst eingetragen wird
  function NP(profi, id, v) { return profi ? I(id, v) : N(v); }
  function RP(profi, id, v) { return profi ? R(id) : N(v); }

  function row(tokens, opts) {
    opts = opts || {};
    var r = { tokens: tokens, label: opts.label || '', hint: opts.hint || '', jump: opts.jump || null };
    if (opts.fixedOrder) r.fixedOrder = true;
    if (opts.advice) r.advice = opts.advice;
    return r;
  }

  /** Rechenzeichen zwischen die Tokens: [a, b, c] -> [a, op, b, op, c] */
  function joined(toks, op) {
    var out = [];
    toks.forEach(function (t, i) { if (i) out.push(T(op)); out.push(t); });
    return out;
  }

  /** erste freie Nummer: k, für das prefix + k noch nicht in vals steht */
  function nextIndex(vals, prefix) { var k = 1; while ((prefix + k) in vals) k++; return k; }

  // ---------- Stufe "Alles selbst" ----------
  var CALC = {
    '+': function (xs) { return xs.reduce(function (s, x) { return s + x; }, 0); },
    '·': function (xs) { return xs.reduce(function (s, x) { return s * x; }, 1); },
    '−': function (xs) { return xs[0] - xs[1]; }
  };
  function valOf(x, vals) { return x.exp ? x.exp(vals) : x.v; }

  /**
   * Felder in beliebiger Reihenfolge: jedes Feld nimmt einen der noch freien Werte.
   * xs: [{ id, v (Musterlösung), exp(vals)? }]. Nur schon richtige Felder werden abgezogen –
   * so bleibt ein richtiges Feld richtig, auch wenn davor eins falsch ist.
   */
  function freeFields(xs) {
    var ids = xs.map(function (x) { return x.id; });
    return xs.map(function (x, i) {
      var prev = ids.slice(0, i);
      var remaining = function (vals) {
        var rest = xs.map(function (y) { return valOf(y, vals); });
        prev.forEach(function (p) { var k = rest.indexOf(vals[p]); if (k >= 0) rest.splice(k, 1); });
        return rest;
      };
      return IC(x.id, x.v, function (v, vals) { return remaining(vals).indexOf(v) >= 0; },
        function (vals) { return remaining(vals)[0]; });
    });
  }

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
    var fields = free ? freeFields(xs) : xs.map(function (x) {
      return IC(x.id, x.v, function (v, vals) { return v === valOf(x, vals); }, function (vals) { return valOf(x, vals); });
    });
    var calc = function (vals) { return CALC[op](ids.map(function (id) { return vals[id]; })); };
    var resV = CALC[op](xs.map(function (x) { return x.v; }));
    var tokens = joined(fields, op);
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
    for (var i = 0; i < 20000; i++) {
      var r = fn();
      if (r) return r;
    }
    throw new Error('Keine passende Aufgabe gefunden');
  }

  // ---------- Zahlen ----------
  /**
   * Zahl einer Form: 'ze' (47), 'hze' (346), 'hz' (460) – ohne Null bei den Zehnern,
   * Einer meist ab 3 (mit 1 oder 2 Einern sind Aufgaben oft zu leicht).
   */
  function shaped(shape) {
    var n = shape === 'ze' ? rnd(11, 99) : shape === 'hze' ? rnd(101, 999) : rnd(11, 99) * 10;
    if (shape !== 'hz' && ones(n) === 0) return 0;
    if (n >= 100 && zDigit(n) === 0) return 0;
    if (shape !== 'hz' && ones(n) <= 2 && chance(0.5)) return 0;
    return n;
  }
  // bis 1000: 328 + 54, 346 + 228, 460 + 390 (und entsprechend bei Minus)
  var SHAPES_1000 = [['hze', 'ze'], ['hze', 'hze'], ['hz', 'hz']];

  function addNumbers(opt, extra) {
    return attempt(function () {
      var sh = opt.max === 1000 ? pick(SHAPES_1000) : ['ze', 'ze'];
      var a = shaped(sh[0]), b = shaped(sh[1]);
      if (!a || !b || a + b > opt.max) return null;
      if (!crossingOk(carries(a, b), opt.crossing)) return null;
      if (extra && !extra(a, b)) return null;
      return { a: a, b: b };
    });
  }

  function subNumbers(opt, extra) {
    return attempt(function () {
      var a, b;
      if (opt.max === 1000) {
        var sh = pick(SHAPES_1000);
        a = shaped(sh[0]); b = shaped(sh[1]);
        if (!a || !b || a - b < 10) return null;
      } else {
        a = rnd(21, 99); b = rnd(11, a - 2);
        if (ones(b) === 0 || (ones(b) <= 2 && chance(0.5))) return null;
      }
      if (!crossingOk(borrows(a, b), opt.crossing)) return null;
      if (extra && !extra(a, b)) return null;
      return { a: a, b: b };
    });
  }

  /** Zahl knapp unter einer glatten Zahl: 19 … 89, bis 1000 auch 99, 198, 299, 348 */
  function nearlyGlatt(max) {
    if (max === 1000) {
      var k = Math.random();
      if (k < 0.35) return rnd(1, 9) * 10 + rnd(8, 9);
      if (k < 0.7) return rnd(0, 4) * 100 + rnd(98, 99);
      return rnd(1, 7) * 100 + rnd(1, 8) * 10 + rnd(8, 9);
    }
    return rnd(1, 8) * 10 + rnd(8, 9);
  }

  // ---------- Plus: stellenweise ----------
  /** Stellen beider Zahlen: gemeinsame (Zehner + Zehner) und einzelne (die 300 bei 328 + 54) */
  function placeSplit(a, b) {
    var shared = [], lonely = [];
    [100, 10, 1].forEach(function (p) {
      var x = (Math.floor(a / p) % 10) * p, y = (Math.floor(b / p) % 10) * p;
      if (x && y) shared.push({ p: p, x: x, y: y });
      else if (x || y) lonely.push({ p: p, v: x || y });
    });
    return { shared: shared, lonely: lonely };
  }

  function addStellenweise(opt) {
    var n = addNumbers(opt), a = n.a, b = n.b, lvl = opt.level;
    var sp = placeSplit(a, b), shared = sp.shared, lonely = sp.lonely;
    var rows = [];
    shared.forEach(function (s, i) {
      var k = i + 1, name = PLACE[s.p];
      if (lvl === 'selbst') { rows.push(placeRowSelbst(shared, i)); return; }
      var hint = lvl === 'zerlegen'
        ? 'Nimm von beiden Zahlen nur die ' + name + ': ' + a + ' hat ' + s.x + ', ' + b + ' hat ' + s.y + '.'
        : (s.p === 1 ? 'Jetzt die Einer: ' + s.x + ' + ' + s.y + '.'
          : 'Rechne die ' + name + ': ' + s.x + ' + ' + s.y + '. Denk an ' + s.x / s.p + ' + ' + s.y / s.p + ' = ' + (s.x + s.y) / s.p + '!');
      if (lvl === 'zerlegen') {
        rows.push(stepRow('+', [{ id: 'sa' + k, v: s.x }, { id: 'sb' + k, v: s.y }], 'z' + k, { label: name, hint: hint }));
      } else {
        rows.push(row([N(s.x), T('+'), N(s.y), T('='), I('z' + k, s.x + s.y)], { label: name, hint: hint }));
      }
    });
    // Zusammen: Teilergebnisse und die Stellen, die nur eine Zahl hat – nach Stellen geordnet
    var items = [];
    [100, 10, 1].forEach(function (p) {
      shared.forEach(function (s, i) { if (s.p === p) items.push({ id: 'z' + (i + 1), v: s.x + s.y }); });
      lonely.forEach(function (l) { if (l.p === p) items.push({ v: l.v }); });
    });
    var extra = lonely.length ? ' Vergiss die ' + lonely.map(function (l) { return l.v; }).join(' und ') + ' nicht!' : '';
    if (lvl === 'selbst') {
      rows.push(stepRow('+', items.map(function (it, i) {
        return { id: 'su' + (i + 1), v: it.v, exp: it.id ? function (vals) { return vals[it.id]; } : null };
      }), 'res', { label: 'Zusammen', hint: 'Rechne deine Ergebnisse zusammen.' + extra }));
    } else {
      var toks = joined(items.map(function (it) { return it.id ? R(it.id) : N(it.v); }), '+');
      toks.push(T('='), I('res', a + b));
      rows.push(row(toks, {
        label: 'Zusammen',
        hint: 'Rechne alles zusammen: ' + items.map(function (it) { return it.v; }).join(' + ') + '.'
      }));
    }
    return { op: '+', strategy: 'stellenweise', a: a, b: b, answer: a + b, rows: rows };
  }

  /**
   * Stellenweise, alles selbst: [x] + [y] = [z] für eine Stelle, die noch nicht dran war.
   * Die Reihenfolge der Stellen und der beiden Zahlen ist egal.
   */
  function placeRowSelbst(shared, i) {
    var k = i + 1, xId = 'sx' + k, yId = 'sy' + k, zId = 'z' + k;
    function open(vals) {
      var used = [];
      for (var j = 1; j < k; j++) if (('sx' + j) in vals) used.push(placeOf(vals['sx' + j]));
      return shared.filter(function (s) { return !has(used, s.p); });
    }
    function slot(v, vals) { return open(vals).filter(function (s) { return s.x === v || s.y === v; })[0]; }
    function partner(v, vals) { var s = slot(v, vals); return s ? (s.x === v ? s.y : s.x) : undefined; }
    var canon = shared[i];
    var x = IC(xId, canon.x, function (v, vals) { return !!slot(v, vals); },
      function (vals) { return open(vals)[0].x; });
    var y = IC(yId, canon.y, function (v, vals) {
      return xId in vals ? v === partner(vals[xId], vals) : !!slot(v, vals);
    }, function (vals) { return xId in vals ? partner(vals[xId], vals) : open(vals)[0].y; });
    var z = IE(zId, canon.x + canon.y, function (vals) { return vals[xId] + vals[yId]; }, [xId, yId]);
    var names = andList(shared.map(function (s) { return PLACE[s.p]; }));
    var hint = k === 1
      ? 'Nimm von beiden Zahlen dieselbe Stelle, zum Beispiel die ' + PLACE[canon.p] + ': ' + canon.x + ' + ' + canon.y +
        '. Mit welcher Stelle du anfängst, darfst du selbst wählen.'
      : 'Jetzt eine Stelle, die du noch nicht gerechnet hast (' + names + '). Nimm von beiden Zahlen dieselbe Stelle.';
    return row([x, T('+'), y, T('='), z], { label: k + '. Stelle', hint: hint });
  }

  // ---------- Plus und Minus: schrittweise ----------
  /** Tipp beim Einer-Schritt über den Zehner (bzw. Zehner-Schritt über den Hunderter) */
  function crossTip(op, cur, step) {
    if (op === '+') {
      if (step < 10 && ones(cur) + step > 10) return ' Tipp: Erst bis ' + (tens(cur) + 10) + ', dann weiter.';
      if (placeOf(step) === 10 && (cur % 100) + step > 100) return ' Tipp: Erst bis ' + (hund(cur) + 100) + ', dann weiter.';
      return '';
    }
    if (step < 10 && ones(cur) !== 0 && ones(cur) < step) {
      return ' Tipp: Erst bis ' + tens(cur) + ', dann noch ' + (step - ones(cur)) + ' weiter.';
    }
    if (placeOf(step) === 10 && cur % 100 !== 0 && cur % 100 < step) {
      return ' Tipp: Erst bis ' + hund(cur) + ', dann noch ' + (step - cur % 100) + ' weiter.';
    }
    return '';
  }

  function schrittweise(op, opt) {
    var n = op === '+' ? addNumbers(opt) : subNumbers(opt), a = n.a, b = n.b;
    var answer = op === '+' ? a + b : a - b;
    var task = { op: op, strategy: 'schrittweise', a: a, b: b, answer: answer, line: { start: a, end: answer } };
    if (opt.level === 'selbst') {
      task.rows = [chainRow(op, a, b, 1, {})];
      task.nextRow = function (vals) { return chainRow(op, a, b, nextIndex(vals, 'y'), vals); };
      return task;
    }
    task.rows = givenSteps(op, a, b, opt.level === 'zerlegen');
    return task;
  }

  /**
   * Mit Hilfe / Zerlegung selbst: b in Stellen zerlegen, dann Schritt für Schritt.
   * Bei "Zerlegung selbst" darf die Reihenfolge der Stellen frei sein (erst die Einer geht auch);
   * die Schritte folgen dann der eigenen Zerlegung.
   */
  function givenSteps(op, a, b, own) {
    var parts = placeParts(b);
    var ids = parts.map(function (x, i) { return 'q' + (i + 1); });
    var names = parts.map(placeName);
    var split = own ? freeFields(parts.map(function (x, i) { return { id: ids[i], v: x }; })) : parts.map(N);
    var rows = [row([N(b), T('=')].concat(joined(split, '+')), {
      label: 'Zerlegen',
      hint: 'Zerlege ' + b + ' in ' + andList(names) + '.' + (own ? ' Die Reihenfolge darfst du selbst wählen.' : '')
    })];
    var cur = a, word = op === '+' ? 'dazu' : 'weg';
    parts.forEach(function (x, i) {
      var k = i + 1, id = k === parts.length ? 'res' : 's' + k;
      var startOf = function (vals) { return k === 1 ? a : vals['s' + (k - 1)]; };
      var stepOf = function (vals) { return own ? vals[ids[i]] : x; };
      var resOf = function (vals) { return op === '+' ? startOf(vals) + stepOf(vals) : startOf(vals) - stepOf(vals); };
      var next = op === '+' ? cur + x : cur - x;
      var hint = own
        ? 'Nimm die ' + k + '. Zahl aus deiner Zerlegung und rechne sie ' + word + '.'
        : (k === 1 ? 'Erst die ' : 'Jetzt die ') + names[i] + ' ' + word + ': ' + cur + ' ' + op + ' ' + x + '.' +
          (k === 1 && placeOf(x) === 10 ? ' Zähle in Zehnerschritten!' : '') + crossTip(op, cur, x);
      rows.push(row([k === 1 ? N(a) : R('s' + (k - 1)), T(op), own ? R(ids[i]) : N(x), T('='), IE(id, next, resOf)], {
        label: k + '. Schritt',
        jump: own ? function (vals) { return { from: startOf(vals), to: resOf(vals), text: op + stepOf(vals) }; }
          : { from: cur, to: next, text: op + x },
        hint: hint
      }));
      cur = next;
    });
    return rows;
  }

  /** Schritt "glatt"? Eine reine Stellenzahl (30, 200, 8) oder genau bis zu einer Zehnerzahl. */
  function niceStep(op, start, s) {
    return placeOf(s) > 0 || (op === '+' ? start + s : start - s) % 10 === 0;
  }

  /**
   * Schrittweise, alles selbst: Zeile k ist [Start] op [Schritt] = [Ergebnis].
   * Start ist das letzte Ergebnis (in der ersten Zeile a, bei Plus auch b). Jeder Schritt geht
   * auf das Ziel zu und nicht darüber hinaus; die erste Zeile darf nicht alles auf einmal rechnen.
   * Das Zwischenergebnis heißt immer 'res': erreicht es das Ziel, ist die Aufgabe gelöst,
   * sonst hängt das Kind die nächste Zeile an.
   */
  function chainRow(op, a, b, k, vals) {
    var target = op === '+' ? a + b : a - b;
    var first = k === 1;
    var starts = first ? (op === '+' && a !== b ? [a, b] : [a]) : [vals.res];
    var xId = 'x' + k, yId = 'y' + k;
    function rem(start) { return op === '+' ? target - start : start - target; }
    function stepOk(start, s) { return s > 0 && (s < rem(start) || (!first && s === rem(start))); }
    function suggest(start) { return placeParts(rem(start))[0]; }
    function apply(start, s) { return op === '+' ? start + s : start - s; }
    // Bei Plus dürfen Start und Schritt getauscht stehen: [30] + [47]
    function split(v) {
      var x = v[xId], y = v[yId];
      if (op === '+' && !has(starts, x) && has(starts, y)) return { start: y, step: x };
      return { start: x, step: y };
    }
    var s0 = starts[0], st0 = suggest(s0);
    var xTok, yTok;
    if (op === '+') {
      var single = function (v) { return has(starts, v) || starts.some(function (s) { return stepOk(s, v); }); };
      xTok = IC(xId, s0, single, function () { return s0; });
      yTok = IC(yId, st0, function (v, vv) {
        if (!(xId in vv)) return single(v);
        var x = vv[xId];
        return (has(starts, x) && stepOk(x, v)) || (has(starts, v) && stepOk(v, x));
      }, function (vv) {
        if (!(xId in vv)) return st0;
        var x = vv[xId];
        if (has(starts, x)) return suggest(x);
        return starts.filter(function (s) { return stepOk(s, x); })[0];
      });
    } else {
      xTok = IE(xId, s0, function () { return s0; });
      yTok = IC(yId, st0, function (v) { return stepOk(s0, v); }, function () { return st0; });
    }
    var resTok = IC('res', apply(s0, st0), function (v, vv) { var p = split(vv); return v === apply(p.start, p.step); },
      function (vv) { var p = split(vv); return apply(p.start, p.step); }, [xId, yId]);
    var word = op === '+' ? 'dazu' : 'weg';
    var hint = first
      ? 'Fang mit ' + a + ' an und rechne erst nur die ' + placeName(st0) + ' von ' + b + ' ' + word + ': ' +
        a + ' ' + op + ' ' + st0 + '.' + crossTip(op, a, st0)
      : 'Mach bei ' + s0 + ' weiter. Bis ' + target + (op === '+' ? ' fehlen noch ' + rem(s0) : ' musst du noch ' + rem(s0) + ' wegnehmen') +
        '. Zum Beispiel: ' + s0 + ' ' + op + ' ' + st0 + '.' + crossTip(op, s0, st0);
    return row([xTok, T(op), yTok, T('='), resTok], {
      label: k + '. Schritt', fixedOrder: op !== '+',
      jump: function (v) { var p = split(v); return { from: p.start, to: apply(p.start, p.step), text: op + p.step }; },
      hint: hint,
      advice: function (v) {
        var p = split(v);
        if (niceStep(op, p.start, p.step)) return null;
        var s = suggest(p.start);
        return 'Stimmt! Tipp: Mit glatten Schritten geht es leichter, z. B. ' + p.start + ' ' + op + ' ' + s + ' = ' + apply(p.start, s) + '. 💡';
      }
    });
  }

  function addSchrittweise(opt) { return schrittweise('+', opt); }
  function subSchrittweise(opt) { return schrittweise('−', opt); }

  // ---------- Plus und Minus: Hilfsaufgabe ----------
  function hilfsaufgabe(op, opt) {
    var max = opt.max;
    var n = attempt(function () {
      var a, b = nearlyGlatt(max);
      if (op === '+') a = max === 1000 && chance(0.9) ? shaped('hze') : shaped('ze');
      else a = max === 1000 ? shaped('hze') : rnd(21, 99);
      if (!a || ones(a) === 0) return null;
      var B = tens(b) + 10;
      if (op === '+' && a + B > max) return null;
      if (op === '−' && (B + 10 >= a || a - b < 15)) return null;
      if (!crossingOk(op === '+' ? carries(a, b) : borrows(a, b), opt.crossing)) return null;
      return { a: a, b: b };
    });
    var a = n.a, b = n.b, p = opt.profi;
    var B = tens(b) + 10, d = B - b;
    var answer = op === '+' ? a + b : a - b, s1 = op === '+' ? a + B : a - B;
    var task = { op: op, strategy: 'hilfsaufgabe', a: a, b: b, answer: answer, line: { start: a, end: answer } };
    if (opt.level === 'selbst') {
      task.rows = [hilfsFirstRow(op, a, b, max)];
      task.nextRow = function (vals) { return hilfsCorrection(op, a, b, vals); };
      return task;
    }
    var back = op === '+' ? '−' : '+';
    task.rows = [
      row([N(b), T('='), NP(p, 'B', B), T('−'), NP(p, 'd', d)], {
        label: 'Hilfszahl', hint: b + ' ist fast ' + B + '. Wie viel fehlt bis ' + B + '?'
      }),
      row([N(a), T(op), RP(p, 'B', B), T('='), I('s1', s1)], {
        label: 'Leichte Aufgabe', jump: { from: a, to: s1, text: op + B },
        hint: 'Rechne mit der glatten Zahl: ' + a + ' ' + op + ' ' + B + '.'
      }),
      row([R('s1'), T(back), RP(p, 'd', d), T('='), I('res', answer)], {
        label: 'Ausgleichen', jump: { from: s1, to: answer, text: back + d, back: true },
        hint: op === '+' ? 'Du hast ' + d + ' zu viel dazugerechnet. Nimm ' + d + ' wieder weg!'
          : 'Du hast ' + d + ' zu viel weggenommen. Gib ' + d + ' wieder dazu!'
      })
    ];
    return task;
  }

  /**
   * Hilfsaufgabe, alles selbst – erste Zeile: [x] op [y] = [s1]. Eine Zahl (oder beide) wird
   * glatt gemacht. Bei Plus darf jeder Summand gerundet werden (60 + 19 oder 59 + 20),
   * bei Minus der Minuend oder der Subtrahend (82 − 40, 80 − 39), auf- oder abgerundet.
   */
  function hilfsFirstRow(op, a, b, max) {
    var B = tens(b) + 10;
    function kind(v, orig) { return v === orig ? 0 : isGlatt(v, orig, max) ? 1 : -1; }
    function okAs(x, y, oa, ob) { var u = kind(x, oa), w = kind(y, ob); return u >= 0 && w >= 0 && u + w >= 1; }
    function pairOk(x, y) {
      if (op === '+') return (okAs(x, y, a, b) || okAs(x, y, b, a)) && x + y !== a + b;
      return okAs(x, y, a, b) && x >= y && x - y !== a - b;
    }
    function firstOk(v) {
      if (op === '+') return v === a || v === b || isGlatt(v, a, max) || isGlatt(v, b, max);
      return v === a || isGlatt(v, a, max);
    }
    function secondOk(v) { return op === '+' ? firstOk(v) : v === b || isGlatt(v, b, max); }
    function partner(x) {
      if (op === '−') return x === a ? B : b;
      if (x === a) return B;
      if (x === b) return nearestGlatt(a) === a ? tens(a) + 10 : nearestGlatt(a);
      return kind(x, a) === 1 ? b : a;
    }
    var calc = function (vals) { return op === '+' ? vals.xa + vals.xb : vals.xa - vals.xb; };
    return row([
      IC('xa', a, firstOk, function () { return a; }),
      T(op),
      IC('xb', B, function (v, vals) { return 'xa' in vals ? pairOk(vals.xa, v) : secondOk(v); },
        function (vals) { return 'xa' in vals ? partner(vals.xa) : B; }),
      T('='), IC('s1', op === '+' ? a + B : a - B, function (v, vals) { return v === calc(vals); }, calc, ['xa', 'xb'])
    ], {
      label: 'Leichte Aufgabe', fixedOrder: op === '−',
      jump: function (vals) {
        var x = vals.xa, y = vals.xb, from = x;
        // Plus: der Sprung startet bei der Zahl, die gleich geblieben ist, und springt um die glatte Zahl
        if (op === '+' && x !== a && x !== b && (y === a || y === b)) { from = y; y = x; }
        return { from: from, to: vals.s1, text: op + y };
      },
      hint: b + ' ist fast ' + B + '. Rechne erst mit der glatten Zahl: ' + a + ' ' + op + ' ' + B + '.' +
        (op === '+' ? ' Du darfst auch ' + a + ' glatt machen.' : '')
    });
  }

  /** Ausgleichen passend zur eigenen Hilfsaufgabe: [s1] + [d] = [res] oder [s1] − [d] = [res] */
  function hilfsCorrection(op, a, b, vals) {
    var target = op === '+' ? a + b : a - b, s1 = vals.s1, diff = target - s1, d = Math.abs(diff);
    var sign = diff > 0 ? '+' : '−';
    var hint;
    if (op === '+') {
      hint = diff < 0 ? 'Du hast ' + d + ' zu viel dazugerechnet. Nimm ' + d + ' wieder weg!'
        : 'Du hast ' + d + ' zu wenig dazugerechnet. Rechne noch ' + d + ' dazu!';
    } else if (vals.xa === a) {
      hint = diff > 0 ? 'Du hast ' + d + ' zu viel weggenommen. Gib ' + d + ' wieder dazu!'
        : 'Du hast ' + d + ' zu wenig weggenommen. Nimm noch ' + d + ' weg!';
    } else {
      hint = 'Du hast mit ' + vals.xa + ' statt mit ' + a + ' angefangen. Dein Ergebnis ist um ' + d + ' zu ' +
        (diff > 0 ? 'klein. Rechne ' + d + ' dazu!' : 'groß. Nimm ' + d + ' weg!');
    }
    return stepRow(sign, [{ id: 'ya', v: s1 }, { id: 'yb', v: d }], 'res', {
      label: 'Ausgleichen', hint: hint,
      jump: { from: s1, to: target, text: sign + d, back: true }
    });
  }

  function addHilfsaufgabe(opt) { return hilfsaufgabe('+', opt); }
  function subHilfsaufgabe(opt) { return hilfsaufgabe('−', opt); }

  // ---------- Plus und Minus: Vereinfachen ----------
  /**
   * Gegensinnig (Plus): 239 + 41 = 240 + 40, gleichsinnig (Minus): 73 − 29 = 74 − 30.
   * Angenommen wird jede Veränderung, bei der eine Zahl glatt wird und das Ergebnis gleich bleibt.
   */
  function vereinfachen(op, opt) {
    var max = opt.max;
    var n = attempt(function () {
      var a, b, nearA = op === '+' && chance(0.7);
      var near = nearlyGlatt(max);
      if (chance(0.2)) near = near - ones(near) + rnd(1, 2); // auch abrunden: 41 + 37 = 40 + 38
      if (op === '+') {
        var other = shaped(max === 1000 ? pick(['ze', 'hze']) : 'ze');
        if (!other) return null;
        a = nearA ? near : other; b = nearA ? other : near;
        if (a + b > max) return null;
      } else {
        b = near;
        a = max === 1000 ? shaped(pick(['hze', 'hze', 'ze'])) : rnd(21, 99);
        if (!a || a - b < 10) return null;
      }
      if (ones(a) === 0 || ones(b) === 0) return null;
      var G = nearestGlatt(near), k = G - near;
      if (!isGlatt(G, near, max)) return null;
      var x, y;
      if (op === '+') { x = nearA ? G : a - k; y = nearA ? b - k : G; } else { x = a + k; y = G; }
      if (x <= 0 || y <= 0 || x > max) return null;
      if (!crossingOk(op === '+' ? carries(a, b) : borrows(a, b), opt.crossing)) return null;
      return { a: a, b: b, x: x, y: y, k: k, near: near, nearA: nearA };
    });
    var a = n.a, b = n.b, x = n.x, y = n.y, k = n.k, kk = Math.abs(k), lvl = opt.level;
    var answer = op === '+' ? a + b : a - b;
    function pairOk(u, w) {
      if (!(u > 0 && w > 0)) return false;
      if (op === '+') {
        return u + w === a + b && u !== a && u !== b &&
          (isGlatt(u, a, max) || isGlatt(w, b, max) || isGlatt(u, b, max) || isGlatt(w, a, max));
      }
      return u - w === a - b && u !== a && (isGlatt(u, a, max) || isGlatt(w, b, max));
    }
    var otherOf = function (u) { return op === '+' ? a + b - u : u - (a - b); };
    var firstOf = function (w) { return op === '+' ? a + b - w : w + (a - b); };
    var fx = IC('vx', x, function (v) { return pairOk(v, otherOf(v)); }, function () { return x; });
    var fy = IC('vy', y, function (v, vals) {
      return 'vx' in vals ? v === otherOf(vals.vx) && pairOk(vals.vx, v) : pairOk(firstOf(v), v);
    }, function (vals) { return 'vx' in vals ? otherOf(vals.vx) : y; });
    var calc = function (vals) { return op === '+' ? vals.vx + vals.vy : vals.vx - vals.vy; };
    var G = n.near + k, hint;
    if (op === '+') {
      var other = n.nearA ? b : a;
      hint = k > 0 ? n.near + ' bekommt ' + kk + ' dazu und wird ' + G + '. Damit es gerecht bleibt, gibt ' + other + ' genau ' + kk + ' ab.'
        : n.near + ' gibt ' + kk + ' ab und wird ' + G + '. Dafür bekommt ' + other + ' genau ' + kk + ' dazu.';
    } else {
      var sg = k > 0 ? ' + ' : ' − ';
      hint = 'Verändere beide Zahlen um gleich viel: ' + b + sg + kk + ' = ' + y + ', also auch ' + a + sg + kk + ' = ' + x +
        '. Der Abstand bleibt gleich.';
    }
    var rows;
    if (lvl === 'selbst') {
      rows = [row([fx, T(op), fy, T('='), IC('res', answer, function (v, vals) { return v === calc(vals); }, calc, ['vx', 'vy'])], {
        label: 'Leichte Aufgabe', fixedOrder: op === '−', hint: hint
      })];
    } else if (lvl === 'zerlegen') {
      rows = [
        row([N(a), T(op), N(b), T('='), fx, T(op), fy], { label: 'Verändern', hint: hint }),
        row([R('vx'), T(op), R('vy'), T('='), IE('res', answer, calc)], {
          label: 'Leichte Aufgabe', hint: 'Jetzt ist es leicht: Rechne deine neue Aufgabe aus.'
        })
      ];
    } else {
      // Mit Hilfe: die glatte Zahl steht da, die andere rechnet das Kind aus
      var right = op === '+' && n.nearA ? [N(x), T('+'), I('vy', y)] : [I('vx', x), T(op), N(y)];
      rows = [
        row([N(a), T(op), N(b), T('=')].concat(right), { label: 'Verändern', hint: hint }),
        row([N(x), T(op), N(y), T('='), I('res', answer)], { label: 'Leichte Aufgabe', hint: 'Jetzt ist es leicht: ' + x + ' ' + op + ' ' + y + '.' })
      ];
    }
    return { op: op, strategy: 'vereinfachen', a: a, b: b, answer: answer, rows: rows };
  }
  function addVereinfachen(opt) { return vereinfachen('+', opt); }
  function subVereinfachen(opt) { return vereinfachen('−', opt); }

  // ---------- Minus: Ergänzen ----------
  /** nächster Halt beim Ergänzen: Zehner, Hunderter, Hunderter des Ziels, Zehner des Ziels, Ziel */
  function nextStop(cur, a) {
    if (cur % 10 && tens(cur) + 10 <= a) return tens(cur) + 10;
    if (cur % 100 && hund(cur) + 100 <= a) return hund(cur) + 100;
    if (hund(a) > cur) return hund(a);
    if (tens(a) > cur) return tens(a);
    return a;
  }
  /** Musterweg: höchstens 4 Sprünge (sonst Zehner und Einer am Ende in einem Sprung: 700 → 712) */
  function ergStops(b, a) {
    var stops = [b];
    while (stops[stops.length - 1] < a) stops.push(nextStop(stops[stops.length - 1], a));
    if (stops.length > 5) stops.splice(stops.indexOf(tens(a)), 1);
    return stops;
  }

  function subErgaenzen(opt) {
    // nur, wenn es geschickt ist: kleiner Abstand oder knapp unter einem Zehner/Hunderter
    var n = subNumbers(opt, function (a, b) {
      var d = a - b;
      if (d < (opt.max === 1000 ? 12 : 4)) return false;
      if (opt.max === 1000) return d <= 200 || (b % 100 >= 80 && d <= 400);
      return d <= 20 || (ones(b) >= 7 && d <= 50);
    });
    var a = n.a, b = n.b, d = a - b;
    var stops = ergStops(b, a);
    var task = { op: '−', strategy: 'ergaenzen', a: a, b: b, answer: d, line: { start: b, end: a } };
    if (opt.level === 'selbst') {
      task.rows = [ergJumpRow(a, b, stops, 1, {})];
      task.nextRow = function (vals) { return ergNext(a, b, stops, vals); };
      // nach dem Zusammenrechnen kommt noch die Probe (nur bei mehreren Sprüngen)
      task.more = function (vals) { return 'res' in vals && 't2' in vals && !('pa' in vals); };
      return task;
    }
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
    if (ids.length === 1) {
      rows.push(row([N(a), T('−'), N(b), T('='), I('res', d)], {
        label: 'Ergebnis', hint: 'Dein Sprung ist das Ergebnis: ' + a + ' − ' + b + '.'
      }));
    } else {
      rows.push(row(joined(ids.map(R), '+').concat([T('='), I('res', d)]), {
        label: 'Zusammen', hint: 'Rechne alle Sprünge zusammen.'
      }));
      rows.push(row([N(b), T('+'), R('res'), T('='), I('pa', a)], {
        label: 'Probe', hint: 'Probe mit der Umkehraufgabe: ' + b + ' + ' + d + ' muss wieder ' + a + ' ergeben.'
      }));
    }
    task.rows = rows;
    return task;
  }

  /** Ergänzen, alles selbst: [37] + [3] = [40] – jeder Sprung startet beim letzten Halt und endet höchstens beim Ziel */
  function ergJumpRow(a, b, stops, k, vals) {
    var start = k === 1 ? b : vals['t' + (k - 1)];
    var fId = 'f' + k, jId = 'j' + k, tId = 't' + k;
    var i = stops.indexOf(start);
    var next = i >= 0 && i + 1 < stops.length ? stops[i + 1] : nextStop(start, a);
    var hint = k === 1
      ? 'Fang bei der kleineren Zahl ' + b + ' an. ' + (next === a ? 'Wie viel fehlt bis ' + a + '?' :
        'Spring bis ' + next + (next % 10 === 0 && b % 10 !== 0 ? ', das ist der nächste Zehner.' : '.'))
      : 'Mach bei ' + start + ' weiter. ' + (next === a ? 'Spring bis zum Ziel ' + a + '.' : 'Spring zum Beispiel bis ' + next + '.');
    var startOf = function (vv) { return fId in vv ? vv[fId] : start; };
    return row([
      IE(fId, start, function () { return start; }),
      T('+'),
      IC(jId, next - start, function (v, vv) { return v > 0 && startOf(vv) + v <= a; },
        function (vv) { var s = startOf(vv); return (s === start ? next : nextStop(s, a)) - s; }),
      T('='),
      IE(tId, next, function (vv) { return vv[fId] + vv[jId]; }, [fId, jId])
    ], {
      label: k + '. Sprung', fixedOrder: true, hint: hint,
      jump: function (v) { return { from: v[fId], to: v[tId], text: '+' + v[jId] }; }
    });
  }

  function ergNext(a, b, stops, vals) {
    var k = nextIndex(vals, 't'), d = a - b;
    if (k === 1 || vals['t' + (k - 1)] < a) return ergJumpRow(a, b, stops, k, vals);
    if (!('res' in vals)) {
      if (k === 2) {
        // ein einziger Sprung: das Ergebnis als Minusaufgabe hinschreiben
        return stepRow('−', [{ id: 'ea', v: a }, { id: 'eb', v: b }], 'res', {
          label: 'Ergebnis', hint: 'Dein Sprung ist das Ergebnis. Schreib die Minusaufgabe: ' + a + ' − ' + b + '.'
        });
      }
      var jumps = [];
      for (var i = 1; i < k; i++) jumps.push(i);
      return stepRow('+', jumps.map(function (j) {
        return { id: 'u' + j, v: vals['j' + j], exp: function (v) { return v['j' + j]; } };
      }), 'res', { label: 'Zusammen', hint: 'Rechne alle Sprünge zusammen. Das ist das Ergebnis von ' + a + ' − ' + b + '.' });
    }
    // Probe mit der Umkehraufgabe: 37 + 45 = 82
    return stepRow('+', [{ id: 'pb', v: b }, { id: 'pr', v: d, exp: function (v) { return v.res; } }], 'pa', {
      label: 'Probe', hint: 'Probe mit der Umkehraufgabe: ' + b + ' + ' + d + ' muss wieder ' + a + ' ergeben.'
    });
  }

  // ---------- Mal: Zerlegen ----------
  /** kleiner Faktor: meist 3 bis 9, selten 2 */
  function smallFactor() { return chance(0.03) ? 2 : rnd(3, 9); }

  function mulNumbers(opt) {
    return attempt(function () {
      // erst den kleinen Faktor, dann den großen passend dazu – sonst käme · 2 viel zu oft
      var s = smallFactor(), big, top = Math.floor(opt.max / s);
      if (opt.max === 1000 && chance(0.3)) big = rnd(11, Math.min(49, Math.floor(top / 10))) * 10;   // 3 · 240
      else big = rnd(11, Math.min(opt.max === 1000 ? 99 : 49, top));                                // 7 · 48
      if (!(big >= 11)) return null;
      if (big < 100 && ones(big) === 0) return null;
      if (big >= 100 && zDigit(big) === 0) return null;
      if (big < 100 && ones(big) <= 2 && chance(0.85)) return null;            // Einer meist ab 3
      if (big === 11 && chance(0.9)) return null;
      if (s * big > opt.max) return null;
      if (opt.max === 1000 && s * big <= 100 && chance(0.7)) return null;    // bis 1000 meist über 100
      var bigFirst = opt.max === 1000 ? chance(0.4) : chance(0.15);           // 64 · 3 und 6 · 13
      return bigFirst ? { a: big, b: s, small: s, big: big } : { a: s, b: big, small: s, big: big };
    });
  }

  function mulZerlegen(opt) {
    var n = mulNumbers(opt), a = n.a, b = n.b, s = n.small, big = n.big, p = opt.profi;
    var parts = placeParts(big), bigFirst = a === big;
    var task = { op: '·', strategy: 'zerlegen', a: a, b: b, answer: a * b };
    if (opt.level === 'selbst') {
      task.viz = { type: 'malkreuz', a: s, parts: parts, dyn: function (vals) { return malResolve(a, b, vals); } };
      task.rows = [malPartRow(a, b, s, parts, 1, {})];
      task.nextRow = function (vals) { return malNext(a, b, s, vals); };
      return task;
    }
    var ids = ['m1', 'm2'];
    var splitRow;
    if (p) {
      // Zerlegung frei: zwei Teile, die zusammen die Zahl ergeben
      splitRow = row([N(big), T('='), IC('m1', parts[0], function (v) { return v > 0 && v < big; }),
        T('+'), IE('m2', parts[1], function (vals) { return big - vals.m1; }, ['m1'])], {
        label: 'Zerlegen',
        hint: 'Zerlege ' + big + ' in ' + andList(parts.map(placeName)) + '. Die Reihenfolge darfst du selbst wählen.',
        advice: function (vals) {
          if (placeOf(vals.m1) && placeOf(vals.m2)) return null;
          return 'Stimmt! Tipp fürs nächste Mal: ' + parts.join(' + ') + ' ist leichter – ' + andList(parts.map(placeName)) + '. 💡';
        }
      });
    } else {
      splitRow = row([N(big), T('='), N(parts[0]), T('+'), N(parts[1])], {
        label: 'Zerlegen', hint: 'Zerlege ' + big + ' in ' + andList(parts.map(placeName)) + '.'
      });
    }
    var rows = [splitRow];
    parts.forEach(function (x, i) {
      var place = placeOf(x), fac = RP(p, ids[i], x);
      var exp = function (vals) { return s * (p ? vals[ids[i]] : x); };
      var left = bigFirst ? [fac, T('·'), N(s)] : [N(s), T('·'), fac];
      rows.push(row(left.concat([T('='), IE('p' + (i + 1), s * x, exp)]), {
        label: (i + 1) + '. Teil',
        hint: p ? 'Rechne ' + s + ' mal die ' + (i + 1) + '. Zahl deiner Zerlegung.' : timesHint(s, x, bigFirst)
      }));
    });
    rows.push(row([R('p1'), T('+'), R('p2'), T('='), I('res', a * b)], {
      label: 'Zusammen', hint: 'Rechne beide Teilergebnisse zusammen: ' + s * parts[0] + ' + ' + s * parts[1] + '.'
    }));
    task.rows = rows;
    task.viz = { type: 'malkreuz', a: s, parts: parts, cells: ['p1', 'p2'], partIds: p ? ids : null };
    return task;
  }

  /** Malaufgabe als Text in der Reihenfolge der Aufgabe: 4 · 20 oder 20 · 4 */
  function times(s, x, bigFirst) { return bigFirst ? x + ' · ' + s : s + ' · ' + x; }
  /** Tipp zu s · x mit einer Stellenzahl x: 4 · 20 -> "Denk an 4 · 2 = 8 …" */
  function timesHint(s, x, bigFirst) {
    var place = placeOf(x), digit = x / place;
    if (place <= 1) return 'Das ist eine Einmaleins-Aufgabe: ' + times(s, x, bigFirst) + '.';
    if (digit === 1) return 'Mal ' + place + ' ist leicht: ' + times(s, x, bigFirst) + ' = ' + s * x + '.';
    return 'Denk an ' + times(s, digit, bigFirst) + ' = ' + s * digit + '. Dann ist ' + times(s, x, bigFirst) + ' ' +
      (place === 10 ? 'zehnmal' : 'hundertmal') + ' so viel.';
  }

  /**
   * Mal Zerlegen, alles selbst: aus der ersten Zeile ergibt sich, welcher Faktor bleibt (K)
   * und welcher zerlegt wird (F). 4 · 23 = 4 · 20 + 4 · 3, aber auch 7 · 48 = 5 · 48 + 2 · 48
   * oder 23 = 10 + 10 + 3. -> { K, F, parts, prods, done } oder null (noch nichts gerechnet)
   */
  function malResolve(a, b, vals) {
    if (!('mp1' in vals)) return null;
    var x = vals.mx1, y = vals.my1, K, F;
    var other = function (f) { return f === a ? b : a; };
    if ((x === a || x === b) && y > 0 && y < other(x)) { K = x; F = other(x); } else { K = y; F = other(y); }
    var parts = [], prods = [];
    for (var k = 1; ('mp' + k) in vals; k++) {
      parts.push(vals['mx' + k] === K ? vals['my' + k] : vals['mx' + k]);
      prods.push(vals['mp' + k]);
    }
    return { K: K, F: F, parts: parts, prods: prods, done: sum(parts) === F };
  }

  /** k-te Malaufgabe: [K] · [Teil] = [Produkt] – ein Faktor bleibt, der andere wird Stück für Stück aufgebraucht */
  function malPartRow(a, b, s, canonParts, k, vals) {
    var info = malResolve(a, b, vals);
    var xId = 'mx' + k, yId = 'my' + k, pId = 'mp' + k;
    var big = Math.max(a, b);
    var other = function (f) { return f === a ? b : a; };
    var K = info ? info.K : s, left = info ? info.F - sum(info.parts) : big;
    var sug = info ? placeParts(left)[0] : canonParts[0];
    var pairOk = k === 1
      // erste Zeile: ein Faktor bleibt, vom anderen ein echter Teil
      ? function (x, y) { return ((x === a || x === b) && y > 0 && y < other(x)) || ((y === a || y === b) && x > 0 && x < other(y)); }
      : function (x, y) { return (x === K && y > 0 && y <= left) || (y === K && x > 0 && x <= left); };
    var single = k === 1
      ? function (v) { return (v > 0 && v < big) || v === a || v === b; }
      : function (v) { return v === K || (v > 0 && v <= left); };
    var x0 = a !== s ? sug : K, y0 = a !== s ? K : sug;
    var xTok = IC(xId, x0, single, function () { return x0; });
    var yTok = IC(yId, y0, function (v, vv) { return xId in vv ? pairOk(vv[xId], v) : single(v); },
      function (vv) {
        if (!(xId in vv)) return y0;
        var x = vv[xId];
        if (k > 1) return x === K ? Math.min(sug, left) : K;
        if (x === s) return placeParts(big)[0];
        if (x === big) return s > 5 ? 5 : Math.max(1, Math.floor(s / 2)); // den kleinen Faktor zerlegen
        return s;
      });
    var pTok = IE(pId, x0 * y0, function (v) { return v[xId] * v[yId]; }, [xId, yId]);
    var hint = k === 1
      ? 'Zerlege ' + big + ' in ' + canonParts.join(' + ') + '. Fang an mit ' + times(s, canonParts[0], a !== s) + '. ' +
        timesHint(s, canonParts[0], a !== s)
      : 'Von ' + info.F + ' fehlen noch ' + left + '. Rechne zum Beispiel ' + times(K, sug, a !== s && K === s) + '.';
    return row([xTok, T('·'), yTok, T('='), pTok], { label: k + '. Malaufgabe', hint: hint });
  }

  function malNext(a, b, s, vals) {
    var info = malResolve(a, b, vals);
    if (!info.done) return malPartRow(a, b, s, null, info.parts.length + 1, vals);
    return stepRow('+', info.prods.map(function (pr, i) {
      return { id: 'ms' + (i + 1), v: pr, exp: function (v) { return v['mp' + (i + 1)]; } };
    }), 'res', { label: 'Zusammen', hint: 'Rechne deine Teilergebnisse zusammen.' });
  }

  // ---------- Mal: Kernaufgaben ----------
  /** f = k1 + k2 oder f = k1 − k2 mit Kernaufgaben k1, k2 (1, 2, 5, 10) -> { op, k2 } oder null */
  function kernSplit(f, k1) {
    if (!has(KERN, k1) || k1 === f) return null;
    if (k1 < f && has(KERN, f - k1)) return { op: '+', k2: f - k1 };
    if (k1 > f && has(KERN, k1 - f)) return { op: '−', k2: k1 - f };
    return null;
  }
  /** erste Zeile [x] · [y]: welcher Faktor bleibt, welcher wird zerlegt? */
  function kernResolve(a, b, x, y) {
    var tries = [[x, y], [y, x]];
    for (var i = 0; i < 2; i++) {
      var kept = tries[i][0], k1 = tries[i][1];
      if (kept !== a && kept !== b) continue;
      var f = kept === a ? b : a;
      var sp = kernSplit(f, k1);
      if (sp) return { kept: kept, f: f, k1: k1, op: sp.op, k2: sp.k2 };
    }
    return null;
  }
  // Musterzerlegung: 6 = 5 + 1, 7 = 5 + 2, 8 = 10 − 2, 9 = 10 − 1 (3 · ist keine Kernaufgabe)
  var KERN_CANON = { 6: [5, '+', 1], 7: [5, '+', 2], 8: [10, '−', 2], 9: [10, '−', 1] };

  function mulKernaufgaben(opt) {
    var p = opt.profi;
    var n = attempt(function () {
      var a = rnd(6, 9), b = rnd(3, 9);
      if (b === 5 && chance(0.6)) return null; // · 5 ist selbst schon eine Kernaufgabe
      return { a: a, b: b };
    });
    var a = n.a, b = n.b, c = KERN_CANON[a], k1 = c[0], op = c[1], k2 = c[2];
    var minus = op === '−';
    var viz = minus ? { type: 'punktefeld', rows: 10, cols: b, split: a, minus: true }
      : { type: 'punktefeld', rows: a, cols: b, split: k1 };
    var task = { op: '·', strategy: 'kernaufgaben', a: a, b: b, answer: a * b, viz: viz };
    if (opt.level === 'selbst') {
      // das Punktefeld folgt der Zerlegung des Kindes
      viz.dyn = function (vals) {
        if (!('p1' in vals)) return null;
        var r = kernResolve(a, b, vals.kx1, vals.ky1);
        return r.op === '−' ? { rows: r.k1, cols: r.kept, split: r.f, minus: true }
          : { rows: r.f, cols: r.kept, split: r.k1, minus: false };
      };
      task.rows = [kernFirstRow(a, b, k1)];
      task.nextRow = function (vals) { return kernNext(a, b, vals); };
      return task;
    }
    if (p && !minus) viz.dyn = function (vals) { return 'k1' in vals ? { rows: a, cols: b, split: vals.k1, minus: false } : null; };
    var splitToks = p && !minus ? freeFields([{ id: 'k1', v: k1 }, { id: 'k2', v: k2 }]) : [NP(p, 'k1', k1), NP(p, 'k2', k2)];
    var k1Of = function (vals) { return p ? vals.k1 : k1; };
    var k2Of = function (vals) { return p ? vals.k2 : k2; };
    task.rows = [
      row([N(a), T('='), splitToks[0], T(op), splitToks[1]], {
        label: 'Zerlegen',
        hint: minus ? a + ' ist fast 10. ' + a + ' = 10 − ' + k2 + '.' : 'Nimm die Kernaufgabe mit 5: ' + a + ' = 5 + ' + k2 + '.'
      }),
      row([RP(p, 'k1', k1), T('·'), N(b), T('='), IE('p1', k1 * b, function (vals) { return k1Of(vals) * b; })], {
        label: 'Kernaufgabe',
        hint: k1 === 10 ? 'Mal 10 ist leicht: 10 · ' + b + '.'
          : '5 mal ist die Hälfte von 10 mal: 10 · ' + b + ' = ' + 10 * b + ', die Hälfte davon.'
      }),
      row([RP(p, 'k2', k2), T('·'), N(b), T('='), IE('p2', k2 * b, function (vals) { return k2Of(vals) * b; })], {
        label: minus ? 'Zu viel' : 'Dazu',
        hint: minus ? k2 + ' · ' + b + ' – so viel ist zu viel.'
          : 'Noch ' + k2 + ' · ' + b + ' dazu.' + (k2 === 2 ? ' Das ist das Doppelte von ' + b + '.' : '')
      }),
      row([R('p1'), T(op), R('p2'), T('='), I('res', a * b)], {
        label: minus ? 'Abziehen' : 'Zusammen',
        hint: minus ? 'Nimm das Zuviel weg: ' + k1 * b + ' − ' + k2 * b + '.' : 'Rechne zusammen: ' + k1 * b + ' + ' + k2 * b + '.'
      })
    ];
    return task;
  }

  /** Kernaufgaben, alles selbst – erste Zeile: eine Kernaufgabe mit einem der beiden Faktoren */
  function kernFirstRow(a, b, k1) {
    var single = function (v) { return v === a || v === b || has(KERN, v); };
    var calc = function (vals) { return vals.kx1 * vals.ky1; };
    return row([
      IC('kx1', k1, single, function () { return k1; }),
      T('·'),
      IC('ky1', b, function (v, vals) { return 'kx1' in vals ? !!kernResolve(a, b, vals.kx1, v) : single(v); },
        function (vals) {
          if (!('kx1' in vals)) return b;
          var x = vals.kx1;
          var asK = [b, a].filter(function (f) { return kernResolve(a, b, x, f); })[0];
          if (has(KERN, x) && asK !== undefined) return asK;
          var asKept = [5, 10, 2, 1].filter(function (k) { return kernResolve(a, b, x, k); })[0];
          return asKept !== undefined ? asKept : b;
        }),
      T('='), IC('p1', k1 * b, function (v, vals) { return v === calc(vals); }, calc, ['kx1', 'ky1'])
    ], {
      label: 'Kernaufgabe',
      hint: k1 === 10 ? a + ' ist fast 10. Rechne erst 10 · ' + b + '.'
        : 'Nimm erst 5 · ' + b + ' – das ist die Hälfte von 10 · ' + b + '. Du darfst auch die andere Zahl zerlegen.'
    });
  }

  function kernNext(a, b, vals) {
    var r = kernResolve(a, b, vals.kx1, vals.ky1);
    if (!('p2' in vals)) {
      return stepRow('·', [{ id: 'kx2', v: r.k2 }, { id: 'ky2', v: r.kept }], 'p2', {
        label: r.op === '−' ? 'Zu viel' : 'Dazu',
        hint: r.op === '−' ? r.k1 + ' ist ' + r.k2 + ' mehr als ' + r.f + '. Wie viel ist ' + r.k2 + ' · ' + r.kept + '?'
          : r.f + ' = ' + r.k1 + ' + ' + r.k2 + '. Rechne noch ' + r.k2 + ' · ' + r.kept + '.'
      });
    }
    return stepRow(r.op, [{ id: 'sa', v: vals.p1 }, { id: 'sb', v: vals.p2 }], 'res', {
      label: r.op === '−' ? 'Abziehen' : 'Zusammen',
      hint: r.op === '−' ? 'Nimm das Zuviel weg: Ergebnis der Kernaufgabe minus Zuviel.' : 'Rechne deine beiden Teilergebnisse zusammen.'
    });
  }

  // ---------- Mal: Hilfsaufgabe ----------
  function mulHilfsNumbers(opt) {
    return attempt(function () {
      var f, s;
      if (opt.max === 1000) {
        var k = Math.random();
        if (k < 0.3) { f = 9; s = rnd(12, 99); if (ones(s) >= 8 || ones(s) <= 1) return null; }    // 9 · 15
        else if (k < 0.75) { s = rnd(3, 9); f = rnd(1, 9) * 10 + rnd(8, 9); }                        // 6 · 39
        else { s = rnd(3, 9); f = rnd(0, 2) * 100 + rnd(98, 99); }                                     // 5 · 99
      } else {
        s = chance(0.1) ? 2 : rnd(3, 5); f = rnd(1, 4) * 10 + rnd(8, 9);                               // 3 · 29
      }
      var G = tens(f) + 10;
      if (s * G > opt.max || s === f) return null;
      var fFirst = f === 9 ? chance(0.7) : chance(0.3);
      return { a: fFirst ? f : s, b: fFirst ? s : f, f: f, kept: s, G: G };
    });
  }

  function mulHilfsaufgabe(opt) {
    var n = mulHilfsNumbers(opt), a = n.a, b = n.b, f = n.f, kept = n.kept, G = n.G, d = G - f, p = opt.profi, max = opt.max;
    var task = { op: '·', strategy: 'hilfsaufgabe', a: a, b: b, answer: a * b };
    if (opt.level === 'selbst') {
      task.rows = [mhFirstRow(a, b, f, kept, G, max)];
      task.nextRow = function (vals) { return mhNext(a, b, max, vals); };
      return task;
    }
    var gTok = RP(p, 'G', G), zu = d * kept;
    var rows = [
      row([N(f), T('='), p ? IC('G', G, function (v) { return v > f && isGlatt(v, f, max); }) : N(G), T('−'),
        p ? IE('d', d, function (vals) { return vals.G - f; }, ['G']) : N(d)], {
        label: 'Hilfszahl', hint: f + ' ist fast ' + G + '. Wie viel fehlt bis ' + G + '?'
      }),
      row((a === f ? [gTok, T('·'), N(kept)] : [N(kept), T('·'), gTok]).concat([T('='), I('s1', G * kept)]), {
        label: 'Hilfsaufgabe', hint: 'Rechne erst mit der glatten Zahl: ' + times(kept, G, a === f) + '.'
      })
    ];
    if (d >= 2) {
      rows.push(row([RP(p, 'd', d), T('·'), N(kept), T('='), I('z', zu)], {
        label: 'Zu viel', hint: G + ' ist ' + d + ' mehr als ' + f + '. Das sind ' + d + ' · ' + kept + ' zu viel.'
      }));
    }
    rows.push(row([R('s1'), T('−'), d >= 2 ? R('z') : N(kept), T('='), I('res', a * b)], {
      label: 'Ausgleichen',
      hint: 'Du hast ' + d + ' · ' + kept + ' = ' + zu + ' zu viel gerechnet. Nimm ' + zu + ' wieder weg!'
    }));
    task.rows = rows;
    return task;
  }

  /** erste Zeile [x] · [y]: welcher Faktor bleibt, welcher wird glatt? -> { kept, f, G, d } */
  function mhResolve(a, b, x, y, max) {
    var tries = [[x, y], [y, x]];
    for (var i = 0; i < 2; i++) {
      var kept = tries[i][0], G = tries[i][1];
      if (kept !== a && kept !== b) continue;
      var f = kept === a ? b : a;
      if (isGlatt(G, f, max)) return { kept: kept, f: f, G: G, d: G - f };
    }
    return null;
  }

  /** Mal mit Hilfsaufgabe, alles selbst – erste Zeile: ein Faktor wird glatt (9 → 10, 39 → 40, 41 → 40) */
  function mhFirstRow(a, b, f, kept, G, max) {
    var single = function (v) { return v === a || v === b || isGlatt(v, a, max) || isGlatt(v, b, max); };
    var calc = function (vals) { return vals.hx * vals.hy; };
    var x0 = a === f ? G : kept, y0 = a === f ? kept : G;
    return row([
      IC('hx', x0, single, function () { return x0; }),
      T('·'),
      IC('hy', y0, function (v, vals) { return 'hx' in vals ? !!mhResolve(a, b, vals.hx, v, max) : single(v); },
        function (vals) {
          if (!('hx' in vals)) return y0;
          var x = vals.hx;
          if (x === a || x === b) {
            var o = x === a ? b : a;
            var g = [tens(o) + 10, tens(o), hund(o) + 100, hund(o)].filter(function (c) { return isGlatt(c, o, max); })[0];
            if (g) return g;
          }
          // x ist eine glatte Zahl: zuerst der Faktor der Musterlösung (bei 9 · 12 und 10 ginge auch 12 → 10)
          return [kept, f].filter(function (c) { return mhResolve(a, b, x, c, max); })[0] || y0;
        }),
      T('='), IC('s1', G * kept, function (v, vals) { return v === calc(vals); }, calc, ['hx', 'hy'])
    ], {
      label: 'Hilfsaufgabe',
      hint: f + ' ist fast ' + G + '. Rechne erst mit der glatten Zahl: ' + times(kept, G, a === f) + '.' +
        ' Du darfst auch die andere Zahl glatt machen, wenn sie fast glatt ist.'
    });
  }

  function mhNext(a, b, max, vals) {
    var r = mhResolve(a, b, vals.hx, vals.hy, max), d = Math.abs(r.d);
    var sign = r.d > 0 ? '−' : '+';
    if (d >= 2 && !('hz' in vals)) {
      return stepRow('·', [{ id: 'hd', v: d }, { id: 'hk', v: r.kept }], 'hz', {
        label: r.d > 0 ? 'Zu viel' : 'Zu wenig',
        hint: r.G + ' ist ' + d + (r.d > 0 ? ' mehr' : ' weniger') + ' als ' + r.f + '. Das sind ' + d + ' · ' + r.kept +
          (r.d > 0 ? ' zu viel.' : ' zu wenig.')
      });
    }
    var z = d >= 2 ? vals.hz : r.kept;
    return stepRow(sign, [{ id: 'ha', v: vals.s1 }, { id: 'hb', v: z }], 'res', {
      label: 'Ausgleichen',
      hint: r.d > 0 ? 'Du hast ' + d + ' · ' + r.kept + ' = ' + z + ' zu viel gerechnet. Nimm ' + z + ' wieder weg!'
        : 'Du hast ' + d + ' · ' + r.kept + ' = ' + z + ' zu wenig gerechnet. Rechne ' + z + ' dazu!'
    });
  }

  // ---------- Geteilt ----------
  // Ein Teil ist leicht zu teilen, wenn das Ergebnis eine Zehner- oder Hunderterzahl ist (60 : 6 = 10)
  // oder aus dem Einmaleins kommt (24 : 6 = 4, auch mit Rest: 27 : 6 = 4 R 3).
  function easyPart(part, d) {
    var qq = Math.floor(part / d);
    return (part % d === 0 && qq % 10 === 0) || qq <= 10;
  }
  function isEasySplit(p1, p2, d) { return easyPart(p1, d) && easyPart(p2, d); }

  function divNumbers(opt, withRest) {
    return attempt(function () {
      // erst den Teiler, dann das Ergebnis passend dazu – sonst käme : 2 viel zu oft
      var d = chance(0.06) ? 2 : rnd(3, 9), q, top = Math.floor(opt.max / d);
      if (opt.max === 1000 && top > 101 && chance(0.55)) q = rnd(101, Math.min(250, top));
      else q = rnd(11, Math.min(opt.max === 1000 ? 99 : 49, top));
      if (!(q >= 11)) return null;
      if (ones(q) === 0) return null;
      if (q > 100 && zDigit(q) === 0 && chance(0.5)) return null;
      var r = withRest ? rnd(1, d - 1) : 0;
      var D = q * d + r;
      if (D > opt.max) return null;
      if (opt.max === 1000 && D <= 100 && chance(0.7)) return null;
      return { d: d, q: q, r: r };
    });
  }

  function divZerlegen(opt) {
    var withRest = !!opt.rest, p = opt.profi;
    var n = divNumbers(opt, withRest);
    var d = n.d, q = n.q, r = n.r, D = q * d + r;
    // Musterzerlegung nach den Stellen des Ergebnisses: 852 : 4 -> 800 + 40 + 12
    var qParts = placeParts(q), parts = qParts.map(function (x) { return x * d; });
    var task = { op: ':', strategy: 'zerlegen', a: D, b: d, answer: q, rest: r };
    if (opt.level === 'selbst') return divSelbst(task, D, d, q, r);
    var nParts = parts.length;
    var shown = parts.slice();
    shown[nParts - 1] += r;           // der Rest steckt im letzten Teil: 27 : 6 = 4 R 3
    var ids = shown.map(function (x, i) { return 'p' + (i + 1); });
    var partOf = function (vals, i) { return p ? vals[ids[i]] : shown[i]; };
    var splitToks;
    if (p) {
      // Teilzahlen frei wählbar: aus der Reihe von d; der letzte Teil ist, was übrig bleibt
      splitToks = ids.map(function (id, i) {
        var prev = ids.slice(0, i);
        var used = function (vals) { return sum(prev.map(function (x) { return vals[x]; })); };
        if (i === nParts - 1) return IE(id, shown[i], function (vals) { return D - used(vals); }, prev);
        return IC(id, shown[i], function (v, vals) { return v > 0 && v % d === 0 && used(vals) + v < D; }, null, prev);
      });
    } else {
      splitToks = shown.map(N);
    }
    var splitRow = row([N(D), T('=')].concat(joined(splitToks, '+')), {
      label: 'Zerlegen',
      hint: p ? 'Suche leichte Zahlen aus der ' + d + 'er-Reihe, z. B. ' + shown.slice(0, -1).join(' und ') + '. Dann: Was bleibt übrig?'
        : 'Wir zerlegen ' + D + ' in leichte Zahlen.'
    });
    if (p) {
      // Richtige, aber umständliche Zerlegung: annehmen und freundlich einen leichteren Weg zeigen
      splitRow.advice = function (vals) {
        if (ids.every(function (id) { return easyPart(vals[id], d); })) return null;
        return 'Stimmt! Tipp fürs nächste Mal: ' + shown.join(' + ') + ' ist leichter, denn ' +
          shown[0] + ' : ' + d + ' = ' + qParts[0] + ' weißt du sofort. 💡';
      };
    }
    var rows = [splitRow];
    shown.forEach(function (x, i) {
      var last = i === nParts - 1, place = placeOf(qParts[i]);
      var toks = [RP(p, ids[i], x), T(':'), N(d), T('='),
        IE('q' + (i + 1), Math.floor(x / d), function (vals) { return Math.floor(partOf(vals, i) / d); })];
      if (last && withRest) toks.push(T('R'), IE('r', r, function (vals) { return partOf(vals, i) % d; }));
      rows.push(row(toks, {
        label: (i + 1) + '. Teil',
        hint: (p ? 'Wie oft passt ' + d + ' in die ' + (i + 1) + '. Zahl?'
          : 'Denk an das Einmaleins: Wie oft passt ' + d + ' in ' + x + '?' +
            (place > 1 ? ' (' + qParts[i] / place + ' · ' + d + ' = ' + parts[i] / place + ', also ' + qParts[i] + ' · ' + d + ' = ' + parts[i] + ')' : '')) +
          (last && withRest ? ' Was übrig bleibt, ist der Rest.' : '')
      }));
    });
    rows.push(resultRow(D, d, q, r));
    rows.push(row([R('res'), T('·'), N(d)].concat(withRest ? [T('+'), R('rf')] : [], [T('='), I('pD', D)]), {
      label: 'Probe',
      hint: 'Probe mit der Umkehraufgabe: Ergebnis mal ' + d + (withRest ? ', dazu der Rest' : '') + '. Kommt wieder ' + D + ' heraus?'
    }));
    task.rows = rows;
    task.viz = {
      type: 'baum', D: D, d: d, parts: p ? ids : shown, quots: ids.map(function (x, i) { return 'q' + (i + 1); }),
      rests: shown.map(function (x, i) { return withRest && i === nParts - 1 ? 'r' : null; })
    };
    return task;
  }

  /** Ergebniszeile wie im Heft: 52 : 4 = [13] (R [1]) */
  function resultRow(D, d, q, r) {
    var toks = [N(D), T(':'), N(d), T('='), I('res', q)];
    if (r) toks.push(T('R'), I('rf', r));
    return row(toks, {
      label: 'Ergebnis',
      hint: 'Rechne deine Teilergebnisse zusammen' + (r ? ' und schreib den Rest dahinter.' : '.')
    });
  }

  /**
   * Geteilt, alles selbst: [40] : [4] = [10], [12] : [4] = [3] – das Kind nimmt Zahlen aus der
   * Reihe, so viele es will, bis weniger als der Teiler übrig ist: das ist der Rest.
   * Dann die Ergebniszeile 52 : 4 = [13] (R [1]) und die Probe [13] · [4] (+ [1]) = [52].
   */
  function divSelbst(task, D, d, q, r) {
    task.viz = { type: 'baum', D: D, d: d, dyn: true };
    task.rows = [divPartRow(D, d, 1, {})];
    task.nextRow = function (vals) {
      if ('res' in vals) return divProbeRow(D, d, q, r);
      return D - divUsed(vals) >= d ? divPartRow(D, d, nextIndex(vals, 'p'), vals) : resultRow(D, d, q, r);
    };
    task.more = function (vals) { return 'res' in vals && !('pD' in vals); };
    return task;
  }
  function divUsed(vals) { var s = 0; for (var k = 1; ('p' + k) in vals; k++) s += vals['p' + k]; return s; }

  function divPartRow(D, d, k, vals) {
    var left = D - divUsed(vals);
    var sug = placeParts(Math.floor(left / d))[0] * d;
    var pId = 'p' + k, dId = 'd' + k, qId = 'q' + k;
    var partOk = function (v) { return v > 0 && v % d === 0 && v <= left && (k > 1 || v < D); };
    var hint = k === 1
      ? 'Nimm zuerst eine leichte Zahl aus der ' + d + 'er-Reihe, die in ' + D + ' steckt, z. B. ' + sug + ', und teile sie durch ' + d + '.'
      : 'Von ' + D + ' sind noch ' + left + ' übrig. Nimm wieder eine Zahl aus der ' + d + 'er-Reihe, z. B. ' + sug + '.' +
        (left % d ? ' Was am Ende nicht mehr passt, ist der Rest.' : '');
    return row([
      IC(pId, sug, partOk, function () { return sug; }), T(':'), I(dId, d),
      T('='), IE(qId, sug / d, function (v) { return v[pId] / d; }, [pId, dId])
    ], {
      label: k + '. Teil', hint: hint,
      advice: function (v) {
        if (easyPart(v[pId], d)) return null;
        return 'Stimmt! Tipp fürs nächste Mal: ' + sug + ' ist leichter, denn ' + sug + ' : ' + d + ' = ' + sug / d + ' weißt du sofort. 💡';
      }
    });
  }

  function divProbeRow(D, d, q, r) {
    var xs = freeFields([{ id: 'px', v: q }, { id: 'py', v: d }]);
    var toks = [xs[0], T('·'), xs[1]], ids = ['px', 'py'];
    if (r) { toks.push(T('+'), I('pr', r)); ids.push('pr'); }
    var calc = function (vals) { return vals.px * vals.py + (r ? vals.pr : 0); };
    toks.push(T('='), IC('pD', D, function (v, vals) { return v === calc(vals); }, calc, ids));
    return row(toks, {
      label: 'Probe',
      hint: 'Probe mit der Umkehraufgabe: ' + q + ' · ' + d + (r ? ' + ' + r : '') + ' muss wieder ' + D + ' ergeben.'
    });
  }

  // ---------- Verzeichnis ----------
  var STRATEGIES = {
    '+': [
      { key: 'stellenweise', name: 'Stellenweise', desc: 'Hunderter, Zehner und Einer getrennt rechnen', group: 'weg', gen: addStellenweise },
      { key: 'schrittweise', name: 'Schrittweise', desc: 'Erst die Hunderter, dann die Zehner, dann die Einer dazu', group: 'weg', gen: addSchrittweise },
      { key: 'hilfsaufgabe', name: 'Hilfsaufgabe', desc: 'Mit der glatten Zahl rechnen und ausgleichen', group: 'weg', gen: addHilfsaufgabe },
      { key: 'vereinfachen', name: 'Vereinfachen', desc: 'Eine Zahl gibt der anderen etwas ab: 239 + 41 = 240 + 40', group: 'weg', gen: addVereinfachen }
    ],
    '−': [
      { key: 'schrittweise', name: 'Schrittweise', desc: 'Erst die Hunderter, dann die Zehner, dann die Einer weg', group: 'weg', gen: subSchrittweise },
      { key: 'ergaenzen', name: 'Ergänzen', desc: 'Von der kleinen zur großen Zahl springen', group: 'weg', gen: subErgaenzen },
      { key: 'hilfsaufgabe', name: 'Hilfsaufgabe', desc: 'Mit der glatten Zahl rechnen und ausgleichen', group: 'weg', gen: subHilfsaufgabe },
      { key: 'vereinfachen', name: 'Vereinfachen', desc: 'Beide Zahlen gleich verändern: 73 − 29 = 74 − 30', group: 'weg', gen: subVereinfachen }
    ],
    '·': [
      { key: 'zerlegen', name: 'Zerlegen', desc: 'Zerlegen, einzeln malnehmen, zusammenrechnen', group: 'weg', gen: mulZerlegen },
      { key: 'kernaufgaben', name: 'Kernaufgaben', desc: 'Schwere Einmaleins-Aufgaben mit 1 ·, 2 ·, 5 · und 10 ·', group: 'weg', gen: mulKernaufgaben },
      { key: 'hilfsaufgabe', name: 'Hilfsaufgabe', desc: 'Mit der glatten Zahl rechnen: 9 · 15 = 10 · 15 − 15', group: 'weg', gen: mulHilfsaufgabe }
    ],
    ':': [
      { key: 'zerlegen', name: 'Zerlegen', desc: 'In leichte Teile zerlegen, Probe mit der Malaufgabe', group: 'weg', gen: divZerlegen }
    ]
  };

  var OPS = ['+', '−', '·', ':'];

  // Gruppen für die Auswahl: Rechenwege (halbschriftlich), Knobeln, schriftliche Verfahren
  var GROUPS = [
    { key: 'weg', name: 'Rechenwege' },
    { key: 'knobeln', name: 'Knobeln' },
    { key: 'schriftlich', name: 'Schriftlich' }
  ];

  /**
   * Neue Aufgabenart anmelden (z. B. aus js/formats/*.js).
   * def: { key, name, desc, group: 'weg'|'knobeln'|'schriftlich', gen(opt) -> task }
   * Eine Aufgabe darf task.layout setzen (eigene Darstellung) und task.nextRow(vals)
   * anbieten (das Kind verlängert die Rechnung selbst).
   */
  function register(op, def) {
    var list = STRATEGIES[op];
    if (!list) throw new Error('Unbekannte Rechenart ' + op);
    if (list.some(function (s) { return s.key === def.key; })) throw new Error('Doppelter Schlüssel ' + def.key);
    list.push(Object.assign({ group: 'weg' }, def));
  }

  var LEVELS = [
    { key: 'hilfe', name: 'Mit Hilfe', desc: 'Zerlegung und Zwischenschritte sind vorgegeben.' },
    { key: 'zerlegen', name: 'Zerlegung selbst', desc: 'Die Zerlegung trägst du selbst ein.' },
    { key: 'selbst', name: 'Alles selbst', desc: 'Jeden Rechenschritt schreibst du selbst auf.' }
  ];

  /**
   * opt: { op: '+'|'−'|'·'|':'|'mix', strategy: key|'mix', crossing: 'ohne'|'mit'|'egal',
   *        level: 'hilfe'|'zerlegen'|'selbst' (alt: profi: bool = 'zerlegen'), rest: bool,
   *        max: 100|1000 (Zahlenraum) }
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
      // "Alle Wege"/"Gemischt": nur halbschriftliche Rechenwege; ohne Übergang braucht man
      // bei Plus und Minus keine Hilfsaufgabe und kein Vereinfachen
      var wege = list.filter(function (x) { return x.group === 'weg'; });
      var pool = opt.crossing === 'ohne' && (op === '+' || op === '−')
        ? wege.filter(function (x) { return x.key !== 'hilfsaufgabe' && x.key !== 'vereinfachen'; }) : wege;
      s = pick(pool.length ? pool : wege);
    }
    var max = opt.max === 1000 ? 1000 : 100;
    var level = opt.level || (opt.profi ? 'zerlegen' : 'hilfe');
    var task = s.gen({ crossing: opt.crossing || 'egal', level: level, profi: level === 'zerlegen', rest: !!opt.rest, max: max });
    task.strategyName = s.name;
    task.strategyDesc = s.desc;
    task.level = level;
    task.profi = level !== 'hilfe';
    task.max = max;
    task.group = s.group;
    return task;
  }

  /** Text der Aufgabe, z. B. "47 + 38"; mit task.terms auch mehr Zahlen: "235 + 123 + 418" */
  function taskText(task) { return (task.terms || [task.a, task.b]).join(' ' + task.op + ' '); }

  var api = {
    generate: generate, taskText: taskText, isEasySplit: isEasySplit, isGlatt: isGlatt, placeParts: placeParts,
    LEVELS: LEVELS, GROUPS: GROUPS, register: register, STRATEGIES: STRATEGIES, OPS: OPS, MAX: MAX
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RR = Object.assign(root.RR || {}, { Tasks: api });
})(typeof window !== 'undefined' ? window : this);
