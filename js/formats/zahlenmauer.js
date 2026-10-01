/*
 * Knobeln: Zahlenmauern. Jeder Stein ist die Summe der beiden Steine darunter.
 *   Plus:  untere Reihe gegeben, Reihe für Reihe nach oben rechnen (eine Zeile = eine Reihe der Mauer)
 *   Minus: Spitze und einige Steine gegeben ("Zahlenmauer mit Lücken"), fehlende Steine Schritt für Schritt
 *          finden – mal plus, mal minus (eine Zeile = ein Stein)
 * Gezeichnet wird die Mauer von js/layouts/wall.js (task.layout = 'wall').
 * Reines Modul ohne DOM – getestet in tests/zahlenmauer.test.js.
 */
(function (root) {
  'use strict';

  var node = typeof module !== 'undefined' && module.exports;
  var Tasks = node ? require('../tasks.js') : root.RR.Tasks;

  function rndInt(rnd, a, b) { return a + Math.floor(rnd() * (b - a + 1)); }

  /** Mauer aus der unteren Reihe: levels[0] = unten, levels[n-1] = [Spitze] */
  function build(bottom) {
    var levels = [bottom.slice()];
    while (levels[levels.length - 1].length > 1) {
      var last = levels[levels.length - 1], next = [];
      for (var j = 0; j + 1 < last.length; j++) next.push(last[j] + last[j + 1]);
      levels.push(next);
    }
    return levels;
  }

  /**
   * Lösungsweg Schritt für Schritt: immer ein Stein, den man aus zwei bekannten Nachbarn rechnen kann.
   * levels: Zahlen der Mauer, given: welche Steine gegeben sind (gleiche Form).
   * -> [{ k, j, kind: 'sum' | 'sub', parts: [[k, j], [k, j]] }] oder null (so nicht lösbar)
   *    sum: Stein = parts[0] + parts[1] (die zwei darunter); sub: Stein = parts[0] (darüber) − parts[1] (Nachbar)
   */
  function deduce(levels, given) {
    var known = given.map(function (l) { return l.slice(); });
    var steps = [];
    var found = true;
    while (found) {
      found = false;
      // von oben nach unten, von links nach rechts: so liest ein Kind die Mauer
      for (var k = levels.length - 2; k >= 0 && !found; k--) {
        for (var j = 0; j + 1 < levels[k].length && !found; j++) {
          var A = known[k + 1][j], L = known[k][j], R = known[k][j + 1];
          var step = null;
          if (!A && L && R) step = { k: k + 1, j: j, kind: 'sum', parts: [[k, j], [k, j + 1]] };
          else if (A && L && !R) step = { k: k, j: j + 1, kind: 'sub', parts: [[k + 1, j], [k, j]] };
          else if (A && !L && R) step = { k: k, j: j, kind: 'sub', parts: [[k + 1, j], [k, j + 1]] };
          if (step) { known[step.k][step.j] = true; steps.push(step); found = true; }
        }
      }
    }
    var all = known.every(function (l) { return l.every(Boolean); });
    return all ? steps : null;
  }

  // ---------- Aufgabe bauen ----------
  function bricksOf(levels, given) {
    return levels.map(function (l, k) {
      return l.map(function (v, j) { return { k: k, j: j, v: v, given: !!given[k][j], id: null, row: null }; });
    });
  }

  function label(k, n) { return k === n - 1 ? 'Spitze' : (k + 1) + '. Reihe'; }

  // Wert eines Steins: gegeben, vom Kind schon eingetragen oder (falls noch nicht) die Musterlösung
  function valueOf(b, vals) { return b.given || !(b.id in vals) ? b.v : vals[b.id]; }

  function brickInput(b, exp) {
    return {
      t: 'in', id: b.id, answer: b.v, expected: exp,
      check: function (v, vals) { return v === exp(vals); }
    };
  }

  /** Plusmauer: untere Reihe gegeben. */
  function plusTask(bottom) {
    var levels = build(bottom), n = levels.length;
    var given = levels.map(function (l, k) { return l.map(function () { return k === 0; }); });
    var wall = bricksOf(levels, given);
    var rows = [];
    for (var k = 1; k < n; k++) {
      var tokens = wall[k].map(function (b) {
        var below = [wall[b.k - 1][b.j], wall[b.k - 1][b.j + 1]];
        b.id = k === n - 1 ? 'res' : 'z' + k + b.j;
        b.row = k - 1;
        return brickInput(b, function (vals) { return valueOf(below[0], vals) + valueOf(below[1], vals); });
      });
      var first = [wall[k - 1][0].v, wall[k - 1][1].v];
      rows.push({
        tokens: tokens, label: label(k, n),
        hint: (k === n - 1 ? 'Die Spitze ist die Summe der zwei Steine darunter: '
          : 'Jeder Stein ist die Summe der zwei Steine darunter. Fang links an: ') + first[0] + ' + ' + first[1] + '.'
      });
    }
    return {
      op: '+', strategy: 'zahlenmauer', title: 'Zahlenmauer', answer: levels[n - 1][0],
      layout: 'wall', wall: { levels: wall }, rows: rows,
      intro: 'jeder Stein ist die Summe der zwei Steine darunter. Fang unten an und rechne nach oben! 🧱'
    };
  }

  /** Zahlenmauer mit Lücken: gegebene Steine (given), der Rest wird Schritt für Schritt gefunden. */
  function minusTask(bottom, given) {
    var levels = build(bottom), n = levels.length;
    var steps = deduce(levels, given);
    if (!steps) throw new Error('Mauer nicht lösbar');
    var wall = bricksOf(levels, given), last = steps[steps.length - 1];
    var at = function (p) { return wall[p[0]][p[1]]; };
    var rows = steps.map(function (s, i) {
      var b = wall[s.k][s.j], p = s.parts.map(at);
      b.id = i === steps.length - 1 ? 'res' : 'z' + s.k + s.j;
      b.row = i;
      var exp = s.kind === 'sum'
        ? function (vals) { return valueOf(p[0], vals) + valueOf(p[1], vals); }
        : function (vals) { return valueOf(p[0], vals) - valueOf(p[1], vals); };
      var hint = s.kind === 'sum'
        ? 'Rechne die zwei Steine darunter zusammen: ' + p[0].v + ' + ' + p[1].v + '.'
        : 'Oben steht ' + p[0].v + ', unten daneben ' + p[1].v + '. Was fehlt noch? Rechne ' + p[0].v + ' − ' + p[1].v + '.';
      return { tokens: [brickInput(b, exp)], label: label(s.k, n), hint: hint };
    });
    return {
      op: '−', strategy: 'zahlenmauer', title: 'Zahlenmauer', answer: levels[last.k][last.j],
      layout: 'wall', wall: { levels: wall }, steps: steps, rows: rows,
      intro: 'in dieser Mauer fehlen Steine. Jeder Stein ist die Summe der zwei darunter – manchmal hilft dir Minus! 🧱'
    };
  }

  // ---------- Zufall ----------
  // Gewicht der unteren Steine für die Spitze: 3 Reihen 1+2+1, 4 Reihen 1+3+3+1
  function randomBottom(n, max, rnd) {
    var w = n === 3 ? 4 : 8, avg = max / w;
    var lo = Math.max(2, Math.floor(avg * 0.3)), hi = Math.max(lo + 3, Math.floor(avg * 1.6));
    for (var i = 0; i < 5000; i++) {
      var bottom = [];
      for (var j = 0; j < n; j++) bottom.push(rndInt(rnd, lo, hi));
      var top = build(bottom)[n - 1][0];
      if (top <= max && top >= max * 0.3) return bottom;
    }
    throw new Error('Keine passende Mauer gefunden');
  }

  function sizeFor(level) { return level === 'hilfe' ? 3 : 4; }

  function plus(opt) {
    opt = opt || {};
    var rnd = opt.rnd || Math.random;
    return plusTask(randomBottom(sizeFor(opt.level), opt.max === 1000 ? 1000 : 100, rnd));
  }

  function minus(opt) {
    opt = opt || {};
    var rnd = opt.rnd || Math.random, n = sizeFor(opt.level);
    var bottom = randomBottom(n, opt.max === 1000 ? 1000 : 100, rnd);
    var levels = build(bottom);
    var spots = [];
    levels.forEach(function (l, k) { l.forEach(function (v, j) { if (k < n - 1) spots.push([k, j]); }); });
    for (var i = 0; i < 5000; i++) {
      // Spitze + (n−1) weitere Steine; nur Mauern, die man Schritt für Schritt lösen kann
      var given = levels.map(function (l, k) { return l.map(function () { return k === n - 1; }); });
      var pool = spots.slice();
      for (var c = 0; c < n - 1; c++) {
        var p = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
        given[p[0]][p[1]] = true;
      }
      if (deduce(levels, given)) return minusTask(bottom, given);
    }
    throw new Error('Keine lösbare Zahlenmauer mit Lücken gefunden');
  }

  Tasks.register('+', {
    key: 'zahlenmauer', name: 'Zahlenmauer', group: 'knobeln',
    desc: 'Jeder Stein ist die Summe der zwei Steine darunter', gen: plus
  });
  Tasks.register('−', {
    // nicht „Minusmauer“: so heißen in der Fachdidaktik Mauern mit Unterschieds-Regel
    key: 'zahlenmauer', name: 'Zahlenmauer mit Lücken', group: 'knobeln',
    desc: 'Jeder Stein ist die Summe der zwei Steine darunter. Fehlende Steine finden – mit Plus und Minus', gen: minus
  });

  var api = { build: build, deduce: deduce, plusTask: plusTask, minusTask: minusTask, plus: plus, minus: minus };
  if (node) module.exports = api;
  else root.RR.Formats = Object.assign(root.RR.Formats || {}, { zahlenmauer: api });
})(typeof window !== 'undefined' ? window : this);
