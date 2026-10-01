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

  /**
   * Positionen auf dem Rechenstrich: proportional, aber mit Mindestabstand, damit nichts überlappt.
   * -> { jumps: [{ row, j }], x: function (zahl) -> x-Koordinate }
   */
  function lineLayout(task, W) {
    var jumps = [];
    task.rows.forEach(function (row, i) { if (row.jump) jumps.push({ row: i, j: row.jump }); });
    var values = [task.line.start];
    jumps.forEach(function (x) { values.push(x.j.to); });
    var sorted = values.slice().sort(function (a, b) { return a - b; })
      .filter(function (v, i, arr) { return i === 0 || v !== arr[i - 1]; });
    var avail = W - 2 * PAD;
    function layout(k) {
      var pos = [0];
      for (var i = 1; i < sorted.length; i++) pos.push(pos[i - 1] + Math.max(GAP, (sorted[i] - sorted[i - 1]) * k));
      return pos;
    }
    var lo = 0, hi = 100;
    for (var it = 0; it < 40; it++) {
      var mid = (lo + hi) / 2, p = layout(mid);
      if (p[p.length - 1] > avail) hi = mid; else lo = mid;
    }
    var pos = layout(lo), total = pos[pos.length - 1] || 1;
    var offset = PAD + (avail - total) / 2;
    return { jumps: jumps, x: function (v) { return offset + pos[sorted.indexOf(v)]; } };
  }

  // ---------- Malkreuz ----------
  /** Werte im Malkreuz; null/undefined = noch unbekannt. */
  function malkreuz(v, vals) {
    // partsAfter: Zerlegung erst zeigen, wenn das Kind den Schritt gerechnet hat
    function part(i) {
      if (v.partIds) return vals[v.partIds[i]];
      if (v.partsAfter && vals[v.partsAfter[i]] === undefined) return null;
      return v.parts[i];
    }
    return {
      h0: part(0), h1: part(1),
      c0: vals[v.cells[0]], c1: vals[v.cells[1]],
      sum: vals.res !== undefined ? '= ' + vals.res : '= ?'
    };
  }

  // ---------- Zerlegungsbaum ----------
  /** Texte im Zerlegungsbaum: { a, b: die beiden Teile, s: zusammen } */
  function baum(task, vals) {
    var v = task.viz;
    function part(i) {
      var p = typeof v.parts[i] === 'number' ? v.parts[i] : vals[v.parts[i]];
      var s = show(p) + ' : ' + v.d + ' = ' + show(vals[v.quots[i]]);
      if (i === 1 && task.rest && vals.r !== undefined) s += ' R ' + vals.r;
      return s;
    }
    return {
      a: part(0), b: part(1),
      s: vals.res !== undefined ? 'zusammen: ' + vals.res + (task.rest ? ' R ' + task.rest : '') : ''
    };
  }

  // ---------- Punktefeld ----------
  /** Beschriftung der beiden Reihen-Blöcke; null = (noch) nicht ändern. */
  function punktefeld(v, vals) {
    if (v.minus) {
      // 10 Reihen insgesamt, die letzten sind zu viel
      return [vals.p1 !== undefined ? '10 · ' + v.cols : null, vals.p2 !== undefined ? '− ' + vals.p2 : null];
    }
    return [vals.p1 !== undefined ? vals.p1 : null, vals.p2 !== undefined ? vals.p2 : null];
  }

  var api = {
    PAD: PAD, GAP: GAP, show: show, lineWidth: lineWidth, lineLayout: lineLayout,
    malkreuz: malkreuz, baum: baum, punktefeld: punktefeld
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RR = Object.assign(root.RR || {}, { VizLogic: api });
})(typeof window !== 'undefined' ? window : this);
