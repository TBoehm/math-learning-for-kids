/*
 * Anschauungen zur Aufgabe:
 *  - Rechenstrich (leerer Zahlenstrahl) mit Sprüngen – der Begleiter hüpft mit
 *  - Malkreuz für Mal-Aufgaben mit Zerlegen
 *  - Punktefeld für Kernaufgaben
 *  - Zerlegungsbaum für Geteilt-Aufgaben
 * Jede Anschauung bekommt nach jeder gelösten Zeile die gesicherten Werte.
 */
(function (root) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var reduced = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function el(tag, attrs, text) {
    var e = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function q(v) { return v === undefined || v === null ? '?' : v; }

  // ---------- Rechenstrich ----------
  function rechenstrich(box, task, companionKey) {
    // Breite an den Platz anpassen, damit die Schrift auf dem Handy groß bleibt
    // (die Box selbst ist noch leer und damit unsichtbar – darum die Karte messen)
    var avail0 = box.parentNode ? box.parentNode.clientWidth - 60 : 640;
    var W = Math.round(Math.max(320, Math.min(640, avail0 > 0 ? avail0 : 640)));
    var H = 160, Y = 100, PAD = 30, GAP = 44;
    var jumps = [];
    task.rows.forEach(function (row, i) { if (row.jump) jumps.push({ row: i, j: row.jump }); });

    // Positionen: proportional, aber mit Mindestabstand, damit nichts überlappt
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
    function x(v) { return offset + pos[sorted.indexOf(v)]; }

    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'rechenstrich', role: 'img',
      'aria-label': 'Rechenstrich' });
    svg.appendChild(el('line', { x1: 10, y1: Y, x2: W - 10, y2: Y, class: 'rs-line' }));
    var arcs = el('g'), ticks = el('g');
    svg.appendChild(arcs); svg.appendChild(ticks);

    function tick(v, cls) {
      var g = el('g', { class: 'rs-tick ' + (cls || '') });
      g.appendChild(el('line', { x1: x(v), y1: Y - 8, x2: x(v), y2: Y + 8 }));
      g.appendChild(el('text', { x: x(v), y: Y + 30, 'text-anchor': 'middle' }, v));
      ticks.appendChild(g);
    }
    tick(task.line.start, 'start');

    // hüpfender Begleiter
    var hop = el('g', { class: 'rs-hopper' });
    var mini = root.RR.Companion.svg(companionKey)
      .replace('<svg class="pony"', '<svg class="pony mini" x="-26" y="-50" width="52" height="48"');
    hop.innerHTML = mini;
    svg.appendChild(hop);
    function place(px, py) { hop.setAttribute('transform', 'translate(' + px + ',' + py + ')'); }
    place(x(task.line.start), Y);

    box.appendChild(svg);
    var shown = 0;

    return {
      update: function (vals, rowIndex) {
        jumps.forEach(function (jp, n) {
          if (jp.row !== rowIndex || n < shown) return;
          shown = n + 1;
          var j = jp.j, x1 = x(j.from), x2 = x(j.to);
          var h = Math.min(62, Math.max(24, Math.abs(x2 - x1) * 0.42));
          var dir = j.back ? 1 : -1;
          var cy = Y + dir * 2 * h;
          var path = el('path', { d: 'M' + x1 + ',' + Y + ' Q' + (x1 + x2) / 2 + ',' + cy + ' ' + x2 + ',' + Y,
            class: 'rs-arc' + (j.back ? ' back' : '') });
          arcs.appendChild(path);
          var ly = Y + dir * h + (j.back ? 20 : -10);
          arcs.appendChild(el('text', { x: (x1 + x2) / 2, y: ly, 'text-anchor': 'middle',
            class: 'rs-label' + (j.back ? ' back' : '') }, j.text));
          tick(j.to, 'new');
          if (!reduced) {
            var len = path.getTotalLength ? path.getTotalLength() : 200;
            path.style.strokeDasharray = len;
            path.style.strokeDashoffset = len;
            path.getBoundingClientRect();
            path.style.transition = 'stroke-dashoffset .7s ease';
            path.style.strokeDashoffset = 0;
          }
          // Begleiter springt den Bogen entlang
          var t0 = null, dur = reduced ? 1 : 700;
          var startX = x1, endX = x2;
          function frame(ts) {
            if (t0 === null) t0 = ts;
            var t = Math.min(1, (ts - t0) / dur);
            var px = (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * ((x1 + x2) / 2) + t * t * endX;
            var py = (1 - t) * (1 - t) * Y + 2 * (1 - t) * t * cy + t * t * Y;
            place(px, py);
            if (t < 1) root.requestAnimationFrame(frame);
          }
          root.requestAnimationFrame(frame);
          if (root.RR.Sound) root.RR.Sound.hop();
        });
      }
    };
  }

  // ---------- Malkreuz ----------
  function malkreuz(box, task) {
    var v = task.viz;
    var wrap = document.createElement('div');
    wrap.className = 'malkreuz-wrap';
    wrap.innerHTML =
      '<table class="malkreuz" aria-label="Malkreuz"><tr><th>·</th><th data-k="h0"></th><th data-k="h1"></th><th class="mk-sum-h"></th></tr>' +
      '<tr><th>' + v.a + '</th><td data-k="c0"></td><td data-k="c1"></td><td class="mk-sum" data-k="sum"></td></tr></table>';
    box.appendChild(wrap);
    function set(k, val) {
      var c = wrap.querySelector('[data-k="' + k + '"]');
      var text = String(q(val));
      if (c.textContent !== text) {
        c.textContent = text;
        if (val !== undefined && val !== null) { c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop', 'filled'); }
      }
    }
    function render(vals) {
      set('h0', v.partIds ? vals[v.partIds[0]] : v.parts[0]);
      set('h1', v.partIds ? vals[v.partIds[1]] : v.parts[1]);
      set('c0', vals[v.cells[0]]);
      set('c1', vals[v.cells[1]]);
      set('sum', vals.res !== undefined ? '= ' + vals.res : '= ?');
    }
    render({});
    return { update: render };
  }

  // ---------- Punktefeld ----------
  function punktefeld(box, task) {
    var v = task.viz;
    var S = 22, R = 8, PADL = 12, PADT = 12;
    var W = PADL * 2 + v.cols * S + 70, H = PADT * 2 + v.rows * S + (v.rows > v.split ? 10 : 0);
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'punktefeld', role: 'img', 'aria-label': 'Punktefeld' });
    for (var r = 0; r < v.rows; r++) {
      for (var c = 0; c < v.cols; c++) {
        var second = r >= v.split;
        var cy = PADT + r * S + S / 2 + (second ? 10 : 0);
        svg.appendChild(el('circle', { cx: PADL + c * S + S / 2, cy: cy, r: R,
          class: 'dot ' + (second ? (v.minus ? 'dot-minus' : 'dot-b') : 'dot-a'),
          style: 'animation-delay:' + ((r * v.cols + c) * 8) + 'ms' }));
      }
    }
    if (v.rows > v.split) {
      var ly = PADT + v.split * S + 5;
      svg.appendChild(el('line', { x1: 4, y1: ly, x2: PADL + v.cols * S + 8, y2: ly, class: 'pf-split' }));
    }
    var lx = PADL + v.cols * S + 14;
    var l1 = el('text', { x: lx, y: PADT + Math.min(v.split, v.rows) * S / 2 + 6, class: 'pf-label' }, '');
    var l2 = el('text', { x: lx, y: PADT + (v.split + v.rows) * S / 2 + 14, class: 'pf-label b' }, '');
    svg.appendChild(l1); svg.appendChild(l2);
    box.appendChild(svg);
    return {
      update: function (vals) {
        if (v.minus) {
          // 10 Reihen insgesamt, die letzten sind zu viel
          if (vals.p1 !== undefined) l1.textContent = '10 · ' + v.cols;
          if (vals.p2 !== undefined) l2.textContent = '− ' + vals.p2;
        } else {
          if (vals.p1 !== undefined) l1.textContent = vals.p1;
          if (vals.p2 !== undefined) l2.textContent = vals.p2;
        }
      }
    };
  }

  // ---------- Zerlegungsbaum (Geteilt) ----------
  function baum(box, task) {
    var v = task.viz;
    var wrap = document.createElement('div');
    wrap.className = 'baum';
    wrap.innerHTML =
      '<div class="baum-top"><span class="pill">' + v.D + ' : ' + v.d + '</span></div>' +
      '<svg class="baum-lines" viewBox="0 0 200 40" preserveAspectRatio="none" aria-hidden="true">' +
      '<path d="M100,0 L45,40 M100,0 L155,40"/></svg>' +
      '<div class="baum-parts"><span class="pill" data-k="a"></span><span class="pill" data-k="b"></span></div>' +
      '<div class="baum-sum" data-k="s"></div>';
    box.appendChild(wrap);
    function set(k, text) {
      var c = wrap.querySelector('[data-k="' + k + '"]');
      if (c.textContent !== text) { c.textContent = text; c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); }
    }
    function part(vals, i) {
      var p = typeof v.parts[i] === 'number' ? v.parts[i] : vals[v.parts[i]];
      var qq = vals[v.quots[i]];
      var s = q(p) + ' : ' + v.d + ' = ' + q(qq);
      if (i === 1 && task.rest && vals.r !== undefined) s += ' R ' + vals.r;
      return s;
    }
    function render(vals) {
      set('a', part(vals, 0));
      set('b', part(vals, 1));
      set('s', vals.res !== undefined ? 'zusammen: ' + vals.res + (task.rest ? ' Rest ' + task.rest : '') : '');
    }
    render({});
    return { update: render };
  }

  /** Erstellt die passende Anschauung für eine Aufgabe (oder null). */
  function create(box, task, companionKey) {
    box.innerHTML = '';
    if (task.line) return rechenstrich(box, task, companionKey);
    if (!task.viz) return null;
    if (task.viz.type === 'malkreuz') return malkreuz(box, task);
    if (task.viz.type === 'punktefeld') return punktefeld(box, task);
    if (task.viz.type === 'baum') return baum(box, task);
    return null;
  }

  root.RR = Object.assign(root.RR || {}, { Viz: { create: create } });
})(window);
