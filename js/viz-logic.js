/*
 * Inhalte der Anschauungen ohne DOM: was im Malkreuz, im Zerlegungsbaum und am Punktefeld
 * steht und wo die Zahlen auf dem Rechenstrich liegen. Gezeichnet wird in js/viz.js.
 * Reine Funktionen – getestet in tests/viz-logic.test.js.
 */
(function (root) {
  'use strict';

  var PAD = 30, GAP = 44;

  /** Fehlende Werte als "?" */
  function show(v) { return v === undefined || v === null ? '?' : v; }

  // ---------- Rechenstrich ----------
  /** Breite des Rechenstrichs aus dem verfügbaren Platz (0 oder weniger: nicht messbar). */
  function lineWidth(avail) {
    return Math.round(Math.max(320, Math.min(640, avail > 0 ? avail : 640)));
  }

  /** Sprung einer Zeile: fest oder abhängig von den Eingaben (Funktion der Werte); null = kein Sprung */
  function resolveJump(row, vals) {
    if (!row || !row.jump) return null;
    return typeof row.jump === 'function' ? row.jump(vals || {}) : row.jump;
  }

  /**
   * Positionen auf dem Rechenstrich: proportional, aber mit Mindestabstand, damit nichts überlappt.
   * resolved: schon gerechnete Sprünge [{ row, j }] – fehlt es, gelten die festen Sprünge der Zeilen.
   * Feste Sprünge und das Ziel (task.line.end) halten ihren Platz von Anfang an frei.
   * -> { jumps: [{ row, j }], start, x: function (zahl) -> x-Koordinate }
   */
  function lineLayout(task, W, resolved) {
    var fixed = [];
    task.rows.forEach(function (row, i) {
      if (row.jump && typeof row.jump !== 'function') fixed.push({ row: i, j: row.jump });
    });
    var jumps = resolved || fixed;
    var start = jumps.length ? jumps[0].j.from : task.line.start;
    var values = [start];
    if (task.line.end !== undefined) values.push(task.line.end);
    fixed.concat(jumps).forEach(function (x) { values.push(x.j.from, x.j.to); });
    var sorted = values.slice().sort(function (a, b) { return a - b; })
      .filter(function (v, i, arr) { return i === 0 || v !== arr[i - 1]; });
    var avail = W - 2 * PAD;
    // bei sehr vielen Zahlen wird der Mindestabstand kleiner, damit alles ins Bild passt
    var gap = sorted.length > 1 ? Math.min(GAP, avail / (sorted.length - 1)) : GAP;
    function layout(k) {
      var pos = [0];
      for (var i = 1; i < sorted.length; i++) pos.push(pos[i - 1] + Math.max(gap, (sorted[i] - sorted[i - 1]) * k));
      return pos;
    }
    var lo = 0, hi = 100;
    for (var it = 0; it < 40; it++) {
      var mid = (lo + hi) / 2, p = layout(mid);
      if (p[p.length - 1] > avail) hi = mid; else lo = mid;
    }
    var pos = layout(lo), total = pos[pos.length - 1] || 1;
    var offset = PAD + Math.max(0, (avail - total) / 2);
    return { jumps: jumps, start: start, x: function (v) { return offset + pos[sorted.indexOf(v)]; } };
  }

  // ---------- Malkreuz ----------
  /**
   * Werte im Malkreuz; null/undefined = noch unbekannt.
   * -> { a: Faktor links, heads: Teile oben, cells: Teilergebnisse, sum }
   * v.dyn(vals): bei "Alles selbst" bestimmt das Kind, welcher Faktor zerlegt wird und in wie viele Teile.
   */
  function malkreuz(v, vals) {
    var sum = vals.res !== undefined ? '= ' + vals.res : '= ?';
    var info = v.dyn ? v.dyn(vals) : null;
    if (v.dyn) {
      if (!info) return { a: v.a, heads: v.parts.map(function () { return null; }), cells: v.parts.map(function () { return undefined; }), sum: sum };
      var heads = info.parts.slice(), cells = info.prods.slice();
      // noch nicht fertig zerlegt: Platz für den nächsten Teil
      if (!info.done) { heads.push(null); cells.push(undefined); }
      return { a: info.K, heads: heads, cells: cells, sum: sum };
    }
    // partsAfter: Zerlegung erst zeigen, wenn das Kind den Schritt gerechnet hat
    function part(i) {
      if (v.partIds) return vals[v.partIds[i]];
      if (v.partsAfter && vals[v.partsAfter[i]] === undefined) return null;
      return v.parts[i];
    }
    return {
      a: v.a,
      heads: v.parts.map(function (x, i) { return part(i); }),
      cells: v.cells.map(function (id) { return vals[id]; }),
      sum: sum
    };
  }

  // ---------- Zerlegungsbaum ----------
  /**
   * Texte im Zerlegungsbaum: { parts: ['60 : 6 = 10', …], s: '= 14 R 3' }
   * Bei "Alles selbst" (viz.dyn) so viele Teile, wie das Kind gerechnet hat (p1, p2, …).
   */
  function baum(task, vals) {
    var v = task.viz, parts = [];
    function text(p, qv, rv) {
      var s = show(p) + ' : ' + v.d + ' = ' + show(qv);
      if (rv !== undefined && rv !== null) s += ' R ' + rv;
      return s;
    }
    if (v.dyn) {
      var left = v.D;
      for (var k = 1; ('p' + k) in vals; k++) { parts.push(text(vals['p' + k], vals['q' + k])); left -= vals['p' + k]; }
      // Platz für den nächsten Teil, solange noch etwas zu teilen ist
      if (!parts.length) parts = ['? : ' + v.d + ' = ?', '? : ' + v.d + ' = ?'];
      else if (left >= v.d) parts.push('? : ' + v.d + ' = ?');
    } else {
      v.parts.forEach(function (p, i) {
        var pv = typeof p === 'number' ? p : vals[p];
        var rest = v.rests && v.rests[i] ? vals[v.rests[i]] : (i === v.parts.length - 1 && task.rest && !v.rests ? vals.r : undefined);
        parts.push(text(pv, vals[v.quots[i]], rest));
      });
    }
    return {
      parts: parts,
      s: vals.res !== undefined ? '= ' + vals.res + (task.rest ? ' R ' + task.rest : '') : ''
    };
  }

  // ---------- Punktefeld ----------
  /**
   * Form und Beschriftung des Punktefelds: { rows, cols, split, minus, labels: [oben, unten] }
   * labels: null = (noch) nicht ändern. v.dyn(vals) liefert die Form nach der Zerlegung des Kindes.
   */
  function punktefeld(v, vals) {
    var f = (v.dyn && v.dyn(vals)) || v;
    var minus = !!f.minus, labels;
    if (minus) {
      // 10 Reihen insgesamt, die letzten sind zu viel
      labels = [vals.p1 !== undefined ? f.rows + ' · ' + f.cols : null, vals.p2 !== undefined ? '− ' + vals.p2 : null];
    } else {
      labels = [vals.p1 !== undefined ? vals.p1 : null, vals.p2 !== undefined ? vals.p2 : null];
    }
    return { rows: f.rows, cols: f.cols, split: f.split, minus: minus, labels: labels };
  }

  var api = {
    PAD: PAD, GAP: GAP, show: show, lineWidth: lineWidth, lineLayout: lineLayout, resolveJump: resolveJump,
    malkreuz: malkreuz, baum: baum, punktefeld: punktefeld
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RR = Object.assign(root.RR || {}, { VizLogic: api });
})(typeof window !== 'undefined' ? window : this);
