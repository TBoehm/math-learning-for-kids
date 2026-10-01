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
  var Logic = root.RR.VizLogic, q = Logic.show;
  var reduced = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function el(tag, attrs, text) {
    var e = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  // ---------- Rechenstrich ----------
  // Die Sprünge können von den Eingaben des Kindes abhängen (eigene Schritte): Nach jeder Zeile
  // wird der Strich neu aufgeteilt und neu gezeichnet; nur der neue Bogen wird animiert.
  function rechenstrich(box, task, companionKey) {
    // Breite an den Platz anpassen, damit die Schrift auf dem Handy groß bleibt
    // (die Box selbst ist noch leer und damit unsichtbar – darum die Karte messen)
    var W = Logic.lineWidth(box.parentNode ? box.parentNode.clientWidth - 60 : 640);
    var H = 160, Y = 100;
    var resolved = [];

    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'rechenstrich', role: 'img',
      'aria-label': 'Rechenstrich' });
    svg.appendChild(el('line', { x1: 10, y1: Y, x2: W - 10, y2: Y, class: 'rs-line' }));
    var arcs = el('g'), ticks = el('g');
    svg.appendChild(arcs); svg.appendChild(ticks);

    // hüpfender Begleiter
    var hop = el('g', { class: 'rs-hopper' });
    var mini = root.RR.Companion.svg(companionKey)
      .replace('<svg class="pony"', '<svg class="pony mini" x="-26" y="-50" width="52" height="48"');
    hop.innerHTML = mini;
    svg.appendChild(hop);
    function place(px, py) { hop.setAttribute('transform', 'translate(' + px + ',' + py + ')'); }

    function tick(x, v, cls) {
      var g = el('g', { class: 'rs-tick ' + (cls || '') });
      g.appendChild(el('line', { x1: x(v), y1: Y - 8, x2: x(v), y2: Y + 8 }));
      g.appendChild(el('text', { x: x(v), y: Y + 30, 'text-anchor': 'middle' }, v));
      ticks.appendChild(g);
    }
    function arc(x, j, animate) {
      var x1 = x(j.from), x2 = x(j.to);
      var h = Math.min(62, Math.max(24, Math.abs(x2 - x1) * 0.42));
      var dir = j.back ? 1 : -1;
      var cy = Y + dir * 2 * h;
      var path = el('path', { d: 'M' + x1 + ',' + Y + ' Q' + (x1 + x2) / 2 + ',' + cy + ' ' + x2 + ',' + Y,
        class: 'rs-arc' + (j.back ? ' back' : '') });
      arcs.appendChild(path);
      var ly = Y + dir * h + (j.back ? 20 : -10);
      arcs.appendChild(el('text', { x: (x1 + x2) / 2, y: ly, 'text-anchor': 'middle',
        class: 'rs-label' + (j.back ? ' back' : '') }, j.text));
      if (animate && !reduced) {
        var len = path.getTotalLength ? path.getTotalLength() : 200;
        path.style.strokeDasharray = len;
        path.style.strokeDashoffset = len;
        path.getBoundingClientRect();
        path.style.transition = 'stroke-dashoffset .7s ease';
        path.style.strokeDashoffset = 0;
      }
      return { x1: x1, x2: x2, cy: cy };
    }
    /** alles neu zeichnen; animate: den letzten Sprung animieren -> Lage des letzten Bogens */
    function draw(animate) {
      clear(arcs); clear(ticks);
      var lay = Logic.lineLayout(task, W, resolved), x = lay.x, last = null;
      tick(x, lay.start, 'start');
      resolved.forEach(function (jp, n) {
        var isLast = n === resolved.length - 1;
        var geo = arc(x, jp.j, animate && isLast);
        tick(x, jp.j.to, animate && isLast ? 'new' : '');
        if (isLast) last = geo;
      });
      return { lay: lay, last: last };
    }

    box.appendChild(svg);
    var first = draw(false);
    place(first.lay.x(first.lay.start), Y);

    return {
      update: function (vals, rowIndex) {
        var j = Logic.resolveJump(task.rows[rowIndex], vals);
        if (!j || resolved.some(function (r) { return r.row === rowIndex; })) return;
        resolved.push({ row: rowIndex, j: j });
        var geo = draw(true).last;
        // Begleiter springt den Bogen entlang
        var t0 = null, dur = reduced ? 1 : 700;
        function frame(ts) {
          if (t0 === null) t0 = ts;
          var t = Math.min(1, (ts - t0) / dur);
          var px = (1 - t) * (1 - t) * geo.x1 + 2 * (1 - t) * t * ((geo.x1 + geo.x2) / 2) + t * t * geo.x2;
          var py = (1 - t) * (1 - t) * Y + 2 * (1 - t) * t * geo.cy + t * t * Y;
          place(px, py);
          if (t < 1) root.requestAnimationFrame(frame);
        }
        root.requestAnimationFrame(frame);
        if (root.RR.Sound) root.RR.Sound.hop();
      }
    };
  }

  // ---------- Malkreuz ----------
  // So viele Spalten, wie es Teile gibt (bei "Alles selbst" bestimmt das Kind die Zerlegung).
  function malkreuz(box, task) {
    var v = task.viz;
    var wrap = document.createElement('div');
    wrap.className = 'malkreuz-wrap';
    box.appendChild(wrap);
    var cols = -1;
    function build(n) {
      var head = '', body = '';
      for (var i = 0; i < n; i++) { head += '<th data-k="h' + i + '"></th>'; body += '<td data-k="c' + i + '"></td>'; }
      wrap.innerHTML = '<table class="malkreuz" aria-label="Malkreuz"><tr><th>·</th>' + head + '<th class="mk-sum-h"></th></tr>' +
        '<tr><th data-k="a"></th>' + body + '<td class="mk-sum" data-k="sum"></td></tr></table>';
      cols = n;
    }
    function set(k, val, pop) {
      var c = wrap.querySelector('[data-k="' + k + '"]');
      var text = String(q(val));
      if (c.textContent !== text) {
        c.textContent = text;
        if (pop && val !== undefined && val !== null) { c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop', 'filled'); }
      }
    }
    function render(vals) {
      var m = Logic.malkreuz(v, vals);
      var n = Math.max(m.heads.length, m.cells.length);
      if (n !== cols) build(n);
      set('a', m.a, false);
      for (var i = 0; i < n; i++) { set('h' + i, m.heads[i], true); set('c' + i, m.cells[i], true); }
      set('sum', m.sum, true);
    }
    render({});
    return { update: render };
  }

  // ---------- Punktefeld ----------
  // Die Form kann sich nach der ersten Zeile ändern (das Kind zerlegt die andere Zahl): dann neu zeichnen.
  function punktefeld(box, task) {
    var v = task.viz;
    var S = 22, R = 8, PADL = 12, PADT = 12;
    var shape = '', svg = null, l1 = null, l2 = null;
    function build(f) {
      if (svg) box.removeChild(svg);
      var W = PADL * 2 + f.cols * S + 70, H = PADT * 2 + f.rows * S + (f.rows > f.split ? 10 : 0);
      svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'punktefeld', role: 'img', 'aria-label': 'Punktefeld' });
      for (var r = 0; r < f.rows; r++) {
        for (var c = 0; c < f.cols; c++) {
          var second = r >= f.split;
          var cy = PADT + r * S + S / 2 + (second ? 10 : 0);
          svg.appendChild(el('circle', { cx: PADL + c * S + S / 2, cy: cy, r: R,
            class: 'dot ' + (second ? (f.minus ? 'dot-minus' : 'dot-b') : 'dot-a'),
            style: 'animation-delay:' + ((r * f.cols + c) * 8) + 'ms' }));
        }
      }
      if (f.rows > f.split) {
        var ly = PADT + f.split * S + 5;
        svg.appendChild(el('line', { x1: 4, y1: ly, x2: PADL + f.cols * S + 8, y2: ly, class: 'pf-split' }));
      }
      var lx = PADL + f.cols * S + 14;
      l1 = el('text', { x: lx, y: PADT + Math.min(f.split, f.rows) * S / 2 + 6, class: 'pf-label' }, '');
      l2 = el('text', { x: lx, y: PADT + (f.split + f.rows) * S / 2 + 14, class: 'pf-label b' }, '');
      svg.appendChild(l1); svg.appendChild(l2);
      box.appendChild(svg);
    }
    function render(vals) {
      var f = Logic.punktefeld(v, vals);
      var key = [f.rows, f.cols, f.split, f.minus].join(',');
      if (key !== shape) { build(f); shape = key; }
      if (f.labels[0] !== null) l1.textContent = f.labels[0];
      if (f.labels[1] !== null) l2.textContent = f.labels[1];
    }
    render({});
    return { update: render };
  }

  // ---------- Zerlegungsbaum (Geteilt) ----------
  // So viele Äste, wie es Teile gibt.
  function baum(box, task) {
    var v = task.viz;
    var wrap = document.createElement('div');
    wrap.className = 'baum';
    box.appendChild(wrap);
    var count = -1;
    function build(n) {
      var d = '', pills = '';
      var step = n > 1 ? 110 / (n - 1) : 0;
      for (var i = 0; i < n; i++) {
        var x = n > 1 ? 45 + i * step : 100;
        d += 'M100,0 L' + x + ',40 ';
        pills += '<span class="pill" data-k="p' + i + '"></span>';
      }
      wrap.innerHTML =
        '<div class="baum-top"><span class="pill">' + v.D + ' : ' + v.d + '</span></div>' +
        '<svg class="baum-lines" viewBox="0 0 200 40" preserveAspectRatio="none" aria-hidden="true">' +
        '<path d="' + d.trim() + '"/></svg>' +
        '<div class="baum-parts">' + pills + '</div>' +
        '<div class="baum-sum" data-k="s"></div>';
      count = n;
    }
    function set(k, text) {
      var c = wrap.querySelector('[data-k="' + k + '"]');
      if (c.textContent !== text) { c.textContent = text; c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); }
    }
    function render(vals) {
      var b = Logic.baum(task, vals);
      if (b.parts.length !== count) build(b.parts.length);
      b.parts.forEach(function (t, i) { set('p' + i, t); });
      set('s', b.s);
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
