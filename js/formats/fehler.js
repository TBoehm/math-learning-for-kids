/*
 * Knobeln: Fehler finden. Ein anderes Kind hat eine Aufgabe halbschriftlich gerechnet – in genau einer
 * Zeile steckt ein typischer Fehler (Zehnerübergang vergessen, verzählt, Einer vergessen, Null vergessen,
 * Einmaleins-Fehler, falsches Rechenzeichen beim Ausgleichen). Die Rechnung stammt aus einem echten
 * Rechenweg (Tasks.STRATEGIES, Stufe "Mit Hilfe"); Folgezeilen rechnen mit der falschen Zahl weiter.
 *   Zeile 1: Welche Zeile ist falsch? (die Zeilen sind die Auswahl-Knöpfe)
 *   Zeile 2: die falsche Zeile verbessern – dann ist die Aufgabe fertig.
 * Oben steht keine eigene Rechenaufgabe, nur ein Titel (task.title).
 * Reines Modul ohne DOM – getestet in tests/fehler.test.js.
 */
(function (root) {
  'use strict';

  var node = typeof module !== 'undefined' && module.exports;
  var Tasks = node ? require('../tasks.js') : root.RR.Tasks;

  var T = function (v) { return { t: 'txt', v: v }; };
  var N = function (v) { return { t: 'num', v: v }; };
  function I(id, answer) { return { t: 'in', id: id, answer: answer, check: function (v) { return v === answer; } }; }

  var KIDS = ['Emil', 'Lotta', 'Finn', 'Mila', 'Jonas', 'Ida', 'Ole', 'Frieda'];
  var OPS = { '+': function (x, y) { return x + y; }, '−': function (x, y) { return x - y; },
    '·': function (x, y) { return x * y; }, ':': function (x, y) { return Math.floor(x / y); } };
  var FLIP = { '+': '−', '−': '+' };

  // ---------- Rechnung als Zeilen ----------
  /**
   * Zeilen einer Aufgabe (Stufe "Mit Hilfe") mit eingesetzten Zahlen.
   * Eine Zeile ist eine Liste von { v, num: true, id? (Eingabefeld), ref? (Verweis) } bzw. { v: Zeichen }.
   */
  function lines(task) {
    var values = {};
    task.rows.forEach(function (r) { r.tokens.forEach(function (t) { if (t.t === 'in') values[t.id] = t.answer; }); });
    return task.rows.map(function (r) {
      return r.tokens.map(function (t) {
        if (t.t === 'num') return { v: t.v, num: true };
        if (t.t === 'in') return { v: t.answer, num: true, id: t.id };
        if (t.t === 'ref') return { v: values[t.id], num: true, ref: t.id };
        return { v: t.v };
      });
    });
  }
  function text(items) { return items.map(function (x) { return x.v; }).join(' '); }

  function chain(items) {
    var v = items[0].v;
    for (var k = 1; k + 1 < items.length; k += 2) v = OPS[items[k].v](v, items[k + 1].v);
    return v;
  }
  function split(items) {
    var e = items.map(function (x) { return x.v; }).indexOf('=');
    var left = items.slice(0, e), right = items.slice(e + 1);
    var r = right.map(function (x) { return x.v; }).indexOf('R');
    return { left: left, right: r < 0 ? right : right.slice(0, r), rest: r < 0 ? null : right[r + 1] };
  }
  function hasOp(items, op) { return items.some(function (x) { return !x.num && x.v === op; }); }

  /** Stimmt die Zeile rechnerisch? (mit Rest: 27 : 6 = 4 R 3) */
  function lineOk(items) {
    var s = split(items);
    if (s.rest && hasOp(s.left, ':')) {
      var d = s.left[2].v, q = chain(s.right);
      return s.left[0].v === q * d + s.rest.v && s.rest.v < d;
    }
    if (hasOp(s.left, ':')) return s.left[0].v === chain(s.right) * s.left[2].v;
    return chain(s.left) === chain(s.right);
  }

  // ---------- Typische Fehler ----------
  /**
   * Mögliche Fehler: [{ line, item (Stelle in der Zeile), type, w (falsche Zahl), flip (falsches Rechenzeichen) }]
   * Nur Zeilen mit genau einem Ergebnis-Feld und ohne Rest.
   */
  function candidates(ls, key) {
    var out = [];
    ls.forEach(function (items, L) {
      var ins = items.filter(function (x) { return x.id; });
      if (ins.length !== 1 || hasOp(items, 'R')) return;
      var s = split(items), add = function (type, w, item, flip) {
        if (w >= 0 && w !== items[item].v) out.push({ line: L, item: item, type: type, w: w, flip: flip || null });
      };
      var last = L === ls.length - 1;
      // x op y = [r]
      if (s.left.length === 3 && s.right.length === 1 && s.right[0].id) {
        var x = s.left[0].v, op = s.left[1].v, y = s.left[2].v, r = s.right[0].v, ri = items.length - 1;
        if (op === '+' || op === '−') {
          if (op === '+' ? x % 10 + y % 10 >= 10 : x % 10 < y % 10) add('uebertrag', op === '+' ? r - 10 : r + 10, ri);
          if (y >= 10 && y % 10 === 0) {
            var u = y % 100 === 0 ? 100 : 10;
            add('verzaehlt', r - u, ri); add('verzaehlt', r + u, ri);
          }
          if (y >= 10 && y % 10 !== 0) add('einer', OPS[op](x, y - y % 10), ri);
          // Ausgleichen bei der Hilfsaufgabe, Zuviel abziehen bei der Kernaufgabe mit 10
          if (last && (key === 'hilfsaufgabe' || (key === 'kernaufgaben' && op === '−'))) {
            add('vorzeichen', OPS[FLIP[op]](x, y), ri, FLIP[op]);
          }
        } else if (op === '·') {
          if (y >= 10 && y % 10 === 0) add('null', x * y / 10, ri);
          else if (x >= 10 && x % 10 === 0) add('null', x * y / 10, ri);
          else if (x > 1 && y > 1) [r + x, r - x, r + y, r - y].forEach(function (w) { if (w > 0) add('einmaleins', w, ri); });
        } else if (op === ':') {
          if (r >= 10 && r % 10 === 0) add('null', r / 10, ri);
          else if (y > 1 && r > 1) [r + 1, r - 1].forEach(function (w) { if (w > 0) add('einmaleins', w, ri); });
        }
      }
      // Ergänzen: von [x] + [?] = [z]
      if (s.left.length === 3 && s.left[2].id && s.right.length === 1) {
        var from = s.left[0].v, to = s.right[0].v, j = s.left[2].v;
        if (to % 10 === 0 && from % 10 !== 0 && j < 10) add('verzaehlt', j + 1, 2);
        else if (j >= 10 && j % 10 === 0) { add('verzaehlt', j - 10, 2); add('verzaehlt', j + 10, 2); }
        else { add('verzaehlt', j + 1, 2); add('verzaehlt', j - 1, 2); }
      }
      // mehrere Zahlen zusammen: [a] + [b] + [c] = [r]
      if (s.left.length >= 5 && !hasOp(s.left, '−') && !hasOp(s.left, '·') && s.right.length === 1 && s.right[0].id) {
        var ones = 0;
        for (var k = 0; k < s.left.length; k += 2) ones += s.left[k].v % 10;
        if (ones >= 10) add('uebertrag', s.right[0].v - 10, items.length - 1);
      }
    });
    return out;
  }

  /** Fehler einbauen; Folgezeilen rechnen mit der falschen Zahl weiter. */
  function apply(ls, cand) {
    var shown = ls.map(function (items) { return items.map(function (x) { return Object.assign({}, x); }); });
    var changed = {};
    var bad = shown[cand.line];
    bad[cand.item].v = cand.w;
    if (cand.flip) bad[1].v = cand.flip;
    if (bad[cand.item].id) changed[bad[cand.item].id] = cand.w;
    for (var L = cand.line + 1; L < shown.length; L++) {
      var items = shown[L], touched = false;
      items.forEach(function (x) { if (x.ref && x.ref in changed) { x.v = changed[x.ref]; touched = true; } });
      if (!touched) continue;
      var s = split(items);
      if (s.right.length === 1 && s.right[0].id) {
        s.right[0].v = chain(s.left);
        changed[s.right[0].id] = s.right[0].v;
      }
    }
    return shown;
  }

  /** Genau eine Zeile falsch (beim falschen Rechenzeichen: rechnerisch richtig, aber anders als richtig). */
  function valid(ls, shown, cand, max) {
    return shown.every(function (items, L) {
      // auch die falschen Zahlen bleiben im Zahlenraum
      if (items.some(function (x) { return x.num && (x.v < 0 || x.v > max); })) return false;
      if (L !== cand.line) return lineOk(items);
      return cand.flip ? lineOk(items) && text(items) !== text(ls[L]) : !lineOk(items);
    });
  }

  var NAMES = {
    uebertrag: 'wurde beim Zehnerübergang falsch gerechnet',
    verzaehlt: 'hat sich jemand verzählt',
    einer: 'wurden die Einer vergessen',
    null: 'fehlt eine Null',
    einmaleins: 'steckt ein Einmaleins-Fehler',
    vorzeichen: 'steht das falsche Rechenzeichen'
  };

  function fixHint(cand, items, key) {
    var s = split(items), x = s.left[0].v, op = s.left[1].v, y = s.left[2].v;
    switch (cand.type) {
      case 'uebertrag': return 'Rechne ' + text(s.left) + ' noch einmal. Achtung, Zehnerübergang!';
      case 'verzaehlt': return cand.item === 2 ? 'Wie viel fehlt von ' + x + ' bis ' + s.right[0].v + '? Zähl noch mal genau.'
        : 'Rechne ' + x + ' ' + op + ' ' + y + ' noch einmal – zähl die Zehner genau.';
      case 'einer': return 'Hier wurden die Einer von ' + y + ' vergessen. Rechne ' + x + ' ' + op + ' ' + y + '.';
      case 'null': return op === '·' ? 'Denk an die Null: ' + x + ' · ' + y + ' ist zehnmal so viel wie ' +
        (y % 10 === 0 ? x + ' · ' + y / 10 : x / 10 + ' · ' + y) + '.'
        : 'Denk an die Null: Wie oft passt ' + y + ' in ' + x + '?';
      case 'einmaleins': return 'Das ist eine Einmaleins-Aufgabe. Rechne ' + x + ' ' + op + ' ' + y + ' noch einmal genau.';
      default: return key === 'kernaufgaben' ? 'Mit 10 mal hast du zu viel gerechnet. Das Zuviel musst du abziehen!'
        : op === '−' ? 'Du hast ' + y + ' zu viel dazugerechnet. Also musst du ' + y + ' wieder abziehen!'
          : 'Du hast ' + y + ' zu viel weggenommen. Also musst du ' + y + ' wieder dazutun!';
    }
  }

  /** Aufgabe aus einer Rechnung (Stufe "Mit Hilfe") und einem Fehler bauen. opt: { rnd } */
  function build(base, cand, opt) {
    var rnd = (opt && opt.rnd) || Math.random;
    var ls = lines(base), shown = apply(ls, cand), L = cand.line;
    var truth = ls[L];
    // das verbesserte Feld ist das Ergebnis der Aufgabe (id 'res', damit sie damit fertig ist)
    var fixTokens = truth.map(function (x, k) {
      if (k === cand.item) return I('res', x.v);
      return x.num ? N(x.v) : T(x.v);
    });
    var name = KIDS[Math.floor(rnd() * KIDS.length)];
    var rows = [{
      label: 'Welche Zeile ist falsch? Tippe sie an.',
      tokens: [{ t: 'choice', id: 'zeile', options: shown.map(text), answer: L, check: function (v) { return v === L; } }],
      hint: cand.flip ? 'Rechne jede Zeile nach – und schau dir auch die Rechenzeichen genau an!'
        : 'Rechne jede Zeile nach. Wo stimmt das Ergebnis nicht?',
      advice: function () { return 'Genau! In Zeile ' + (L + 1) + ' ' + NAMES[cand.type] + '. Verbessere sie!'; }
    }, {
      label: 'Zeile ' + (L + 1) + ' verbessern', tokens: fixTokens, hint: fixHint(cand, truth, base.strategy)
    }];
    return {
      op: base.op, strategy: 'fehler', a: base.a, b: base.b, answer: truth[cand.item].v, title: 'Wo steckt der Fehler?',
      // layout 'fehler' ohne eigene Darstellung: die Klasse layout-fehler an #rows gestaltet die Zeilen (css/formats.css)
      base: base.strategy, mistake: cand.type, shown: shown, layout: 'fehler', rows: rows,
      intro: name + ' hat gerechnet, aber ein Fehler hat sich eingeschlichen. Findest du ihn? 🔍'
    };
  }

  /** Zufällige Aufgabe: echter Rechenweg + ein typischer Fehler. opt: { max, rest, rnd } */
  function gen(opt, op) {
    opt = opt || {};
    var rnd = opt.rnd || Math.random, max = opt.max === 1000 ? 1000 : 100;
    var wege = Tasks.STRATEGIES[op].filter(function (s) { return s.group === 'weg'; });
    for (var i = 0; i < 200; i++) {
      var s = wege[Math.floor(rnd() * wege.length)];
      var base;
      try {
        base = s.gen({ crossing: 'egal', level: 'hilfe', profi: false, rest: !!opt.rest, max: max });
      } catch (e) { continue; }
      if (!base || !base.rows) continue;
      base.strategy = base.strategy || s.key;
      var ls = lines(base);
      if (!ls.every(lineOk)) continue;
      // jede Fehlerart gleich oft, dann eine Stelle dazu
      var cands = candidates(ls, base.strategy).filter(function (c) { return valid(ls, apply(ls, c), c, max); });
      if (!cands.length) continue;
      var types = cands.map(function (c) { return c.type; }).filter(function (t, k, a) { return a.indexOf(t) === k; });
      var type = types[Math.floor(rnd() * types.length)];
      var pool = cands.filter(function (c) { return c.type === type; });
      return build(base, pool[Math.floor(rnd() * pool.length)], { rnd: rnd });
    }
    throw new Error('Keine Fehler-Aufgabe gefunden');
  }

  Tasks.OPS.forEach(function (op) {
    Tasks.register(op, {
      key: 'fehler', name: 'Fehler finden', group: 'knobeln',
      desc: 'In einer fertigen Rechnung den Fehler finden und verbessern',
      gen: function (opt) { return gen(opt, op); }
    });
  });

  var api = { lines: lines, text: text, lineOk: lineOk, candidates: candidates, apply: apply, build: build, gen: gen };
  if (node) module.exports = api;
  else root.RR.Formats = Object.assign(root.RR.Formats || {}, { fehler: api });
})(typeof window !== 'undefined' ? window : this);
