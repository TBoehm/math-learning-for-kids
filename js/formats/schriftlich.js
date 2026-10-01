/*
 * Schriftliche Verfahren (Zahlenraum bis 1000, Klasse 3): schriftlich addieren und subtrahieren.
 * Reines Modul ohne DOM – getestet in tests/schriftlich.test.js. Die Darstellung als Rechenraster
 * übernimmt js/layouts/column.js (task.layout = 'column').
 *
 * Aufbau einer Aufgabe – jede Zeile (row) ist ein Rechenschritt, gelöst wird nacheinander:
 *   0. Überschlag:  [440] + [250] = [690]
 *   1. Einer, 2. Zehner, 3. Hunderter (4. Tausender bei 1000 − x) – von rechts nach links, je Spalte ein Schritt (row.col = Stelle).
 *   Danach normale Zeilen (ohne col, unter dem Raster):
 *   Vergleich: Überschlag 690  Ergebnis 692  [passt] [passt nicht]
 *   Probe (nur Minus): Umkehraufgabe [574] + [278] = [852], Reihenfolge der Zahlen egal
 * Die Felder eines Schritts tragen place: { line, col } = ihr Platz im Raster:
 *   line 'res'   Ergebnis-Ziffer         (id d0, d1, … – d0 = Einer)
 *        'carry' Übertrag in Spalte col  (id u1, u2, …)
 *        'n1'/'n2' neue Zahl über der oberen Zahl nach dem Umwechseln (Entbündeln):
 *              l<col> = nach dem Abgeben (1 weniger), b<col> = nach dem Bekommen (10 mehr)
 *        'hidden' das Gesamtergebnis 'res'
 * 'res' ist ein verstecktes Feld im letzten Spalten-Schritt: Es bleibt leer, sein Wert wird aus den schon
 * richtigen Ziffern zusammengesetzt (blank als Funktion, siehe js/check.js). So gilt die Rechnung als
 * richtig, wenn alle Ziffern stimmen – und vals.res === task.answer. Gelöst ist die Aufgabe erst nach Vergleich
 * (und Probe), weil Check.isSolved alle Felder braucht.
 * Felder mit blank: 0 dürfen leer bleiben, das heißt „kein Übertrag“, „nicht umgewechselt“ oder
 * „keine 0 ganz vorne“.
 *
 * Stufen: hilfe    – Überträge und umgewechselte Zahlen stehen schon da (erscheinen mit dem Schritt),
 *                    gerundete Zahlen im Überschlag sind vorgegeben
 *         zerlegen – Felder für Überträge / Umwechseln nur dort, wo sie gebraucht werden
 *         selbst   – Felder überall, wo etwas stehen könnte; das Kind entscheidet selbst
 */
(function (root) {
  'use strict';

  var node = typeof module !== 'undefined' && module.exports;
  var Tasks = node ? require('../tasks.js') : root.RR.Tasks;

  var PLACE = ['Einer', 'Zehner', 'Hunderter', 'Tausender'];
  var PLACE_DAT = ['Einern', 'Zehnern', 'Hundertern', 'Tausendern'];
  var OP = { add: '+', sub: '−', erg: '−' };
  var KEY = { add: 'schriftlich', sub: 'schriftlich', erg: 'schriftlich-erg' };

  // ---------- Helfer ----------
  function rnd(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function len(n) { return String(n).length; }
  function digitAt(n, c) { return c < len(n) ? Math.floor(n / Math.pow(10, c)) % 10 : null; }
  function sum(xs) { return xs.reduce(function (s, x) { return s + x; }, 0); }
  function roundTo(x, m) { return Math.floor((x + m / 2) / m) * m; }
  function crossingOk(crosses, mode) {
    if (mode === 'ohne') return !crosses;
    if (mode === 'mit') return crosses;
    return true;
  }
  function attempt(fn) {
    for (var i = 0; i < 5000; i++) {
      var r = fn();
      if (r) return r;
    }
    throw new Error('Keine passende Aufgabe gefunden');
  }

  var T = function (v) { return { t: 'txt', v: v }; };
  var N = function (v, place) { return { t: 'num', v: v, place: place }; };
  var R = function (id) { return { t: 'ref', id: id }; };
  function I(id, answer, place, aria, blank) {
    var tok = { t: 'in', id: id, answer: answer, check: function (v) { return v === answer; }, place: place, aria: aria };
    if (blank !== undefined) tok.blank = blank;
    return tok;
  }

  // ---------- Rechnen Stelle für Stelle ----------
  /** Plus: je Spalte Ziffern (null = keine), Übertrag rein, Summe, Ziffer, Übertrag raus. */
  function addPlan(terms) {
    var n = Math.max.apply(null, terms.map(len)), cols = [], carry = 0;
    for (var c = 0; c < n; c++) {
      var ds = terms.map(function (t) { return digitAt(t, c); });
      var s = sum(ds.map(function (d) { return d || 0; })) + carry;
      cols.push({ c: c, digits: ds, carryIn: carry, sum: s, digit: s % 10, carryOut: Math.floor(s / 10) });
      carry = Math.floor(s / 10);
    }
    var result = cols.map(function (x) { return x.digit; });
    while (carry > 0) { result.push(carry % 10); carry = Math.floor(carry / 10); }
    return { n: n, cols: cols, result: result };
  }

  /**
   * Minus durch Abziehen mit Entbündeln. Geht es in einer Spalte nicht, wird 1 von links
   * umgewechselt (über Nullen hinweg: aus 503 wird 4 | 9 | 13).
   * changes: [{ col, v, kind: 'L' (gibt ab) | 'B' (bekommt 10) }], from: alte Werte dazu.
   * orig: Ziffer der oberen Zahl, before: vor dem Umwechseln in dieser Spalte, top: danach.
   */
  function subPlan(a, b) {
    var n = len(a), cur = [], cols = [];
    for (var i = 0; i < n; i++) cur.push(digitAt(a, i));
    for (var c = 0; c < n; c++) {
      var bottom = digitAt(b, c), bv = bottom || 0, before = cur[c], changes = [], from = [];
      if (cur[c] < bv) {
        var k = c + 1;
        while (cur[k] === 0) k++;
        from.push(cur[k]); cur[k]--; changes.push({ col: k, v: cur[k], kind: 'L' });
        for (var j = k - 1; j > c; j--) { from.push(cur[j]); cur[j] = 9; changes.push({ col: j, v: 9, kind: 'L' }); }
        from.push(cur[c]); cur[c] += 10; changes.push({ col: c, v: cur[c], kind: 'B' });
      }
      cols.push({ c: c, orig: digitAt(a, c), before: before, top: cur[c], bottom: bottom, changes: changes, from: from, digit: cur[c] - bv });
    }
    return { n: n, cols: cols, result: cols.map(function (x) { return x.digit; }) };
  }

  /** Minus durch Ergänzen mit Erweitern: von unten (+ Übertrag) bis oben ergänzen. */
  function ergPlan(a, b) {
    var n = len(a), cols = [], carry = 0;
    for (var c = 0; c < n; c++) {
      var top = digitAt(a, c), bottom = digitAt(b, c), need = (bottom || 0) + carry;
      var out = top < need ? 1 : 0, target = top + 10 * out;
      cols.push({ c: c, top: top, bottom: bottom, carryIn: carry, need: need, target: target, digit: target - need, carryOut: out });
      carry = out;
    }
    return { n: n, cols: cols, result: cols.map(function (x) { return x.digit; }) };
  }

  // ---------- Tipps ----------
  function writeText(c, digit, answer) {
    if (digit === 0 && c > 0 && answer < Math.pow(10, c)) return 'Eine 0 ganz vorne schreibst du nicht hin.';
    return 'Schreibe ' + digit + '.';
  }

  function addHint(col, n) {
    var c = col.c, P = PLACE[c] + ': ';
    var parts = col.digits.filter(function (d) { return d !== null; }).map(String);
    if (col.carryIn) parts.push(col.carryIn + ' (Übertrag)');
    if (parts.length === 1 && !col.carryIn) return P + 'Unten steht nichts. Schreibe die ' + col.digit + ' ab.';
    var s = P + parts.join(' + ') + ' = ' + col.sum + '. ';
    if (c === n - 1) {
      return s + (col.carryOut ? 'Schreibe ' + col.digit + ' und davor die ' + col.carryOut + ' bei den ' + PLACE_DAT[c + 1] + '.'
        : 'Schreibe ' + col.digit + '.');
    }
    return s + (col.carryOut ? 'Schreibe ' + col.digit + ', übertrage ' + col.carryOut + ' zu den ' + PLACE_DAT[c + 1] + '.'
      : 'Schreibe ' + col.digit + '. Kein Übertrag.');
  }

  function subHint(col, answer) {
    var c = col.c, P = PLACE[c] + ': ';
    if (col.bottom === null && !col.changes.length) {
      // 1000 − x: aus der 1 bei den Tausendern ist beim Umwechseln eine 0 geworden
      var gone = col.orig !== col.top && col.top === 0 ? ', und aus der ' + col.orig + ' ist eine 0 geworden' : '';
      if (col.digit === 0 && answer < Math.pow(10, c)) return P + 'Unten steht nichts' + gone + '. Eine 0 ganz vorne schreibst du nicht hin.';
      return P + 'Unten steht nichts' + gone + '. Schreibe die ' + col.top + ' ab.';
    }
    var bottom = col.bottom || 0, s = P;
    if (col.changes.length) {
      var k = col.changes[0].col;
      var aus = col.changes.map(function (ch, i) { return 'aus ' + col.from[i] + ' wird ' + ch.v; }).join(', ');
      if (k === c + 1) {
        s += col.before + ' − ' + bottom + ' geht nicht. Wechsle 1 ' + PLACE[k] + ' in 10 ' + PLACE[c] + ' um: ' + aus + '. ';
      } else {
        // über Nullen hinweg (503 − 278, 1000 − 374): Schritt für Schritt nach rechts umwechseln
        var empty = PLACE_DAT.slice(c + 1, k).join(' und ');
        var chain = [];
        for (var j = k - 1; j > c; j--) chain.push('1 ' + PLACE[j] + ' in 10 ' + PLACE[j - 1]);
        s += col.before + ' − ' + bottom + ' geht nicht, und bei den ' + empty + ' ist nichts. Wechsle 1 ' + PLACE[k] +
          ' in 10 ' + PLACE[k - 1] + ' um' + chain.map(function (x, i) { return (i === chain.length - 1 ? ' und davon ' : ', davon ') + x; }).join('') +
          ': ' + aus + '. ';
      }
    }
    return s + col.top + ' − ' + bottom + ' = ' + col.digit + '. ' + writeText(c, col.digit, answer);
  }

  function ergHint(col, n, answer) {
    var c = col.c, s = PLACE[c] + ': ';
    if (col.bottom === null) {
      if (!col.carryIn) return s + 'Unten steht nichts. ' + (col.digit === 0 && answer < Math.pow(10, c) ? writeText(c, 0, answer) : 'Schreibe die ' + col.top + ' ab.');
      s += 'Unten steht nichts, nur der Übertrag ' + col.carryIn + '. ';
    } else if (col.carryIn) {
      s += col.bottom + ' + ' + col.carryIn + ' (Übertrag) = ' + col.need + '. ';
    }
    if (col.carryOut) {
      s += col.need + ' + ? = ' + col.top + ' geht nicht, also bis ' + col.target + ': ' + col.need + ' + ' + col.digit + ' = ' + col.target + '. ';
      return s + 'Schreibe ' + col.digit + ', übertrage 1 zu den ' + PLACE_DAT[c + 1] + '.';
    }
    s += col.need + ' + ' + col.digit + ' = ' + col.top + '. ';
    var w = writeText(c, col.digit, answer);
    return s + (c < n - 1 && w.charAt(0) === 'S' ? 'Schreibe ' + col.digit + '. Kein Übertrag.' : w);
  }

  // ---------- Überschlag ----------
  function ueberschlagRow(kind, terms, level, max) {
    var op = OP[kind];
    var modes = max === 1000 ? [10, 100] : [10];
    var calc = function (xs) { return kind === 'add' ? sum(xs) : xs[0] - xs[1]; };
    var r10 = terms.map(function (x) { return roundTo(x, 10); });
    var tokens = [];
    if (level === 'hilfe') {
      r10.forEach(function (x, i) { if (i) tokens.push(T(op)); tokens.push(N(x)); });
      tokens.push(T('='), I('gs', calc(r10), undefined, 'Überschlag: Ergebnis'));
      return { label: 'Überschlag', tokens: tokens, hint: 'Rechne mit den gerundeten Zahlen: ' + r10.join(' ' + op + ' ') + '.' };
    }
    // Alle Zahlen gleich runden: wie die erste (auf Zehner oder auf Hunderter)
    var modesFor = function (g1) {
      var m = modes.filter(function (x) { return roundTo(terms[0], x) === g1; });
      return m.length ? m : modes;
    };
    var gids = terms.map(function (x, i) { return 'g' + (i + 1); });
    terms.forEach(function (x, i) {
      if (i) tokens.push(T(op));
      var tok = I(gids[i], r10[i], undefined, 'Überschlag: ' + (i + 1) + '. Zahl gerundet');
      if (i === 0) tok.check = function (v) { return modes.some(function (m) { return v === roundTo(x, m); }); };
      else {
        tok.check = function (v, vals) { return modesFor(vals.g1).some(function (m) { return v === roundTo(x, m); }); };
        tok.expected = function (vals) { return roundTo(x, modesFor(vals.g1)[0]); };
        tok.deps = ['g1'];
      }
      tokens.push(tok);
    });
    var exp = function (vals) { return calc(gids.map(function (g) { return vals[g]; })); };
    var gs = I('gs', calc(r10), undefined, 'Überschlag: Ergebnis');
    gs.check = function (v, vals) { return v === exp(vals); };
    gs.expected = exp;
    gs.deps = gids.slice();
    tokens.push(T('='), gs);
    var hint = 'Runde auf glatte Zehner: ' + terms.map(function (x, i) { return x + (x === r10[i] ? ' bleibt' : ' wird ' + r10[i]); }).join(', ') +
      '. Rechne dann ' + r10.join(' ' + op + ' ') + '.';
    return { label: 'Überschlag', tokens: tokens, hint: hint };
  }

  // ---------- Nach dem Rechnen: Vergleich und Probe ----------
  /** Überschlag und Ergebnis vergleichen. gs: fester Überschlag (Stufe hilfe) oder null (das Kind hat selbst gerundet). */
  function vergleichRow(answer, gs) {
    var choice = { t: 'choice', id: 'cmp', answer: 0, options: ['passt', 'passt nicht'], aria: 'Vergleich: passt das Ergebnis?',
      check: function (v) { return v === 0; } };
    return {
      label: 'Vergleich',
      tokens: [T('Überschlag'), R('gs'), T('Ergebnis'), R('res'), choice],
      hint: gs !== null
        ? 'Überschlag ' + gs + ' und Ergebnis ' + answer + ' liegen nah beieinander – das passt.'
        : 'Vergleiche dein Ergebnis ' + answer + ' mit deinem Überschlag: Sie sind ungefähr gleich groß – das passt.'
    };
  }

  /**
   * Probe bei Minus mit der Umkehraufgabe: Ergebnis + abgezogene Zahl = Ausgangszahl.
   * hilfe: Zahlen stehen da, nur die Summe; sonst beide Zahlen selbst (Reihenfolge egal), Summe aus den eingetragenen Zahlen.
   */
  function probeRow(a, b, answer, level) {
    var aria = 'Probe: Ergebnis', tokens;
    if (level === 'hilfe') {
      tokens = [N(answer), T('+'), N(b), T('='), I('pa', a, undefined, aria)];
    } else {
      var xs = Tasks.freeFields([{ id: 'px', v: answer }, { id: 'py', v: b }]);
      var calc = function (vals) { return vals.px + vals.py; };
      var pa = I('pa', a, undefined, aria);
      pa.check = function (v, vals) { return v === calc(vals); };
      pa.expected = calc;
      pa.deps = ['px', 'py'];
      tokens = [xs[0], T('+'), xs[1], T('='), pa];
    }
    return { label: 'Probe', tokens: tokens, hint: 'Probe mit der Umkehraufgabe: ' + answer + ' + ' + b + ' muss wieder ' + a + ' ergeben.' };
  }

  // ---------- Aufgabe aufbauen ----------
  /**
   * kind: 'add' | 'sub' (Abziehen mit Entbündeln) | 'erg' (Ergänzen)
   * terms: [a, b] oder (Plus) [a, b, c]; opt: { level, max }
   */
  function build(kind, terms, opt) {
    opt = opt || {};
    var level = opt.level || 'hilfe', max = opt.max === 100 ? 100 : 1000;
    var a = terms[0], b = terms[1];
    var answer = kind === 'add' ? sum(terms) : a - b;
    var plan = kind === 'add' ? addPlan(terms) : kind === 'sub' ? subPlan(a, b) : ergPlan(a, b);
    var n = plan.n;
    var ncols = kind === 'add' && (answer >= Math.pow(10, n) || level === 'selbst') ? n + 1 : n;
    var digitOf = function (c) { return Math.floor(answer / Math.pow(10, c)) % 10; };
    var digitTok = function (c) {
      var lead = c > 0 && answer < Math.pow(10, c); // 0 ganz vorne: darf leer bleiben
      return I('d' + c, digitOf(c), { line: 'res', col: c }, PLACE[c] + ': Ergebnis', lead ? 0 : undefined);
    };
    // Übertrag in Spalte c (Plus und Ergänzen)
    var carryTok = function (c, v) {
      var place = { line: 'carry', col: c }, aria = 'Übertrag zu den ' + PLACE_DAT[c];
      if (level === 'hilfe') return v ? N(v, place) : null;
      if (level === 'zerlegen') return v ? I('u' + c, v, place, aria) : null;
      return I('u' + c, v, place, aria, 0);
    };

    var steps = [];
    if (kind === 'add' || kind === 'erg') {
      plan.cols.forEach(function (col) {
        var c = col.c, toks = [digitTok(c)];
        if (c < n - 1) {
          var ct = carryTok(c + 1, col.carryOut);
          if (ct) toks.push(ct);
        } else if (ncols > n) toks.push(digitTok(n)); // Tausender (bzw. Hunderter bei Zahlen bis 100)
        steps.push({ col: c, tokens: toks, hint: kind === 'add' ? addHint(col, n) : ergHint(col, n, answer) });
      });
    } else {
      // Wer schreibt welches Umwechsel-Feld? (Spalte -> Schritt)
      var owner = { L: {}, B: {} }, used = { L: {}, B: {} };
      plan.cols.forEach(function (col) {
        col.changes.forEach(function (ch) { owner[ch.kind][ch.col] = col.c; used[ch.kind][ch.col] = ch.v; });
      });
      if (level === 'selbst') {
        for (var c = 0; c < n; c++) {
          if (c >= 1 && !(c in owner.L)) owner.L[c] = c - 1;
          if (c <= n - 2 && !(c in owner.B)) owner.B[c] = c;
        }
      }
      var hasL = function (c) { return c in owner.L; };
      var smallTok = function (kindLB, c) {
        var place = { line: kindLB === 'B' && hasL(c) ? 'n2' : 'n1', col: c };
        var v = used[kindLB][c];
        if (level === 'hilfe') return N(v, place);
        var aria = PLACE[c] + ': neue Zahl nach dem Umwechseln';
        // ganz vorne wird aus der 1 eine 0 (1000 − 374): die 0 darf man weglassen
        var lead = kindLB === 'L' && c === n - 1 && v === 0;
        var tok = I(kindLB.toLowerCase() + c, v || 0, place, aria, level === 'selbst' || lead ? 0 : undefined);
        if (lead) tok.lead = true; // fürs Raster: die alte Ziffer wird auch durchgestrichen, wenn das Feld leer bleibt
        return tok;
      };
      plan.cols.forEach(function (col) {
        var c = col.c, small = [];
        var ls = Object.keys(owner.L).map(Number).filter(function (k) { return owner.L[k] === c; }).sort(function (x, y) { return y - x; });
        ls.forEach(function (k) { small.push(smallTok('L', k)); });
        if (owner.B[c] === c) small.push(smallTok('B', c));
        var d = digitTok(c);
        steps.push({ col: c, tokens: level === 'selbst' ? [d].concat(small) : small.concat([d]), hint: subHint(col, answer) });
      });
    }

    // Gesamtergebnis: verstecktes Feld im letzten Schritt, Wert aus den Ziffern
    var last = steps[steps.length - 1];
    var dids = [];
    for (var k = 0; k < ncols; k++) dids.push('d' + k);
    last.tokens.push({
      t: 'in', id: 'res', answer: answer, silent: true, place: { line: 'hidden' },
      check: function (v) { return v === answer; },
      deps: last.tokens.filter(function (x) { return x.t === 'in'; }).map(function (x) { return x.id; }),
      blank: function (vals) {
        var s = 0;
        for (var i = 0; i < dids.length; i++) {
          if (vals[dids[i]] === undefined) return -1;
          s += vals[dids[i]] * Math.pow(10, i);
        }
        return s;
      }
    });

    var ueRow = ueberschlagRow(kind, terms, level, max);
    var rows = [ueRow].concat(steps.map(function (s) {
      return { label: PLACE[s.col], col: s.col, tokens: s.tokens, hint: s.hint };
    }));
    // nach den Spalten (normale Zeilen unter dem Raster): Vergleich mit dem Überschlag, bei Minus die Probe
    var gs = ueRow.tokens.filter(function (x) { return x.id === 'gs'; })[0].answer;
    rows.push(vergleichRow(answer, level === 'hilfe' ? gs : null));
    if (kind !== 'add') rows.push(probeRow(a, b, answer, level));

    // Zeilen des Rasters
    var lineUsed = {};
    rows.forEach(function (r) { r.tokens.forEach(function (x) { if (x.place) lineUsed[x.place.line] = true; }); });
    var termLines = terms.map(function (x, i) { return 't' + i; });
    var lines = kind === 'sub'
      ? ['head'].concat(lineUsed.n2 ? ['n2'] : [], lineUsed.n1 ? ['n1'] : [], termLines, ['res'])
      : ['head'].concat(termLines, lineUsed.carry ? ['carry'] : [], ['res']);

    var intro = {
      add: 'rechne schriftlich: erst der Überschlag, dann von rechts nach links – ' + PLACE.slice(0, n).join(', ') + '.',
      sub: 'rechne schriftlich mit Abziehen: erst der Überschlag, dann von rechts nach links. Geht es nicht, wechsle um!',
      erg: 'rechne schriftlich mit Ergänzen: erst der Überschlag, dann von rechts nach links. Ergänze von unten bis oben!'
    }[kind];

    return {
      op: OP[kind], strategy: KEY[kind], a: a, b: b, terms: terms.slice(), answer: answer,
      layout: 'column', intro: intro,
      column: { kind: kind, op: OP[kind], n: n, ncols: ncols, terms: terms.slice(), lines: lines },
      rows: rows
    };
  }

  // ---------- Zufällige Aufgaben ----------
  /** Gibt es einen Übertrag im Raster? Der Übertrag aus der höchsten Stelle zählt nicht (600 + 400 = 1000). */
  function hasCarry(terms) {
    var cols = addPlan(terms).cols;
    return cols.slice(0, -1).some(function (c) { return c.carryOut > 0; });
  }

  function genAdd(opt) {
    var three = Math.random() < 0.25, big = opt.max === 1000;
    return attempt(function () {
      var terms;
      if (big) {
        terms = three ? [rnd(100, 499), rnd(100, 399), rnd(10, 299)]
          : [rnd(100, 899), Math.random() < 0.2 ? rnd(10, 99) : rnd(100, 899)];
      } else {
        terms = three ? [rnd(10, 49), rnd(10, 39), rnd(10, 29)] : [rnd(10, 89), rnd(10, 89)];
      }
      if (sum(terms) > opt.max) return null;
      return crossingOk(hasCarry(terms), opt.crossing) ? terms : null;
    });
  }

  function genSub(opt) {
    var big = opt.max === 1000;
    // manchmal 1000 − x: umwechseln über mehrere Nullen (1000 − 374)
    var top = big && opt.crossing !== 'ohne' && Math.random() < 0.12;
    // manchmal eine Null in der Mitte, über die hinweg umgewechselt wird (503 − 278)
    var zero = big && !top && opt.crossing !== 'ohne' && Math.random() < 0.25;
    return attempt(function () {
      var a, b;
      if (top) {
        a = 1000;
        b = Math.random() < 0.2 ? rnd(10, 99) : rnd(100, 990);
      } else if (big) {
        a = zero ? rnd(2, 9) * 100 + rnd(0, 8) : rnd(200, 999);
        b = Math.random() < 0.2 ? rnd(10, 99) : rnd(100, a - 10);
        if (zero && b % 10 <= a % 10) return null;
        if (a - b < 10) return null;
      } else {
        a = rnd(20, 99);
        b = rnd(10, a - 1);
      }
      var borrows = subPlan(a, b).cols.some(function (c) { return c.changes.length > 0; });
      return crossingOk(borrows, opt.crossing) ? [a, b] : null;
    });
  }

  function register(op, def) {
    if (Tasks.STRATEGIES[op].some(function (s) { return s.key === def.key; })) return;
    Tasks.register(op, def);
  }
  register('+', {
    key: 'schriftlich', name: 'Schriftlich addieren', group: 'schriftlich',
    desc: 'Stellengerecht untereinander, von rechts nach links, mit Übertrag',
    gen: function (opt) { return build('add', genAdd(opt), opt); }
  });
  register('−', {
    key: 'schriftlich', name: 'Schriftlich subtrahieren', group: 'schriftlich',
    desc: 'Abziehen – geht es nicht, wird umgewechselt (entbündelt)',
    gen: function (opt) { return build('sub', genSub(opt), opt); }
  });
  register('−', {
    key: 'schriftlich-erg', name: 'Schriftlich subtrahieren (Ergänzen)', group: 'schriftlich',
    desc: 'Von unten bis oben ergänzen, mit Übertrag',
    gen: function (opt) { return build('erg', genSub(opt), opt); }
  });

  var api = { addPlan: addPlan, hasCarry: hasCarry, subPlan: subPlan, ergPlan: ergPlan, roundTo: roundTo, build: build, PLACE: PLACE };
  if (node) module.exports = api;
  else root.RR = Object.assign(root.RR || {}, { Schriftlich: api });
})(typeof window !== 'undefined' ? window : this);
