/*
 * Darstellung "column": schriftliches Rechnen im Rechenraster (Karopapier).
 * Die Rechenlogik steckt in js/formats/schriftlich.js; hier wird nur gezeichnet.
 *
 * Aufbau in #rows:
 *   .row[data-i=0]            Überschlag – eine normale Rechenzeile über dem Raster
 *   .cgrid                    das Raster (CSS-Grid): Stellen-Köpfe, Zahlen, Rechenzeichen, Strich
 *     .row.col-step[data-i]   je Spalten-Schritt; display: contents – seine Kinder liegen direkt im Raster:
 *       .k-band               Leuchtstreifen über die ganze Spalte (aktive Spalte hervorgehoben)
 *       .k-head               Stellen-Kopf (E, Z, H)
 *       .k-slot               Platz für ein Feld oder eine vorgegebene Zahl (place: line + col)
 *       input[type=hidden]    das Gesamtergebnis 'res' (wird aus den Ziffern zusammengesetzt)
 * Spätere Spalten bleiben sichtbar, aber blass (css/column.css). Weil die Spalten-Zeilen keine eigene
 * Box haben, leiten sie scrollIntoView an das Raster weiter.
 */
(function (root) {
  'use strict';

  var HEAD = ['E', 'Z', 'H', 'T'];
  var MAXLEN = { res: 1, carry: 1, n1: 2, n2: 2 };

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function put(e, row, col) {
    e.style.gridRow = String(row);
    e.style.gridColumn = String(col);
    return e;
  }

  // Normale Rechenzeile (Überschlag), aufgebaut wie im Rest der App
  function plainRow(row, i, h) {
    var d = el('div', 'row future');
    d.dataset.i = i;
    var labels = h.cellLabels(row), n = 0;
    d.appendChild(el('span', 'row-label', row.label));
    var eq = el('div', 'eq');
    eq.innerHTML = row.tokens.map(function (tok) {
      return h.tokenHtml(tok, tok.t === 'in' || tok.t === 'choice' ? tok.aria || labels[n++] : '');
    }).join('');
    d.appendChild(eq);
    return d;
  }

  function render(task, box, h) {
    var col = task.column, ncols = col.ncols;
    var line = {};
    col.lines.forEach(function (l, k) { line[l] = k + 1; });
    var gcol = function (c) { return 2 + (ncols - 1 - c); }; // Spalte 1: Rechenzeichen
    var stepCols = {};
    task.rows.forEach(function (row) { if (row.col !== undefined) stepCols[row.col] = true; });

    task.rows.forEach(function (row, i) { if (row.col === undefined) box.appendChild(plainRow(row, i, h)); });

    var paper = el('div', 'cpaper');
    var grid = el('div', 'cgrid cgrid-' + col.kind);
    grid.style.gridTemplateColumns = 'repeat(' + (ncols + 1) + ', var(--sq))';
    grid.style.gridTemplateRows = 'repeat(' + col.lines.length + ', var(--sq))';
    grid.setAttribute('role', 'group');
    grid.setAttribute('aria-label', 'Schriftliche Rechnung ' + col.terms.join(' ' + col.op + ' '));

    // Stellen-Köpfe ohne eigenen Schritt (z. B. T für das Ergebnis)
    for (var c = ncols - 1; c >= 0; c--) {
      if (!stepCols[c]) grid.appendChild(put(el('div', 'k-head k-c' + c, HEAD[c]), line.head, gcol(c)));
    }
    // Zahlen stellengerecht untereinander, Rechenzeichen davor
    col.terms.forEach(function (x, t) {
      var s = String(x);
      for (var k = 0; k < s.length; k++) {
        var cc = s.length - 1 - k;
        grid.appendChild(put(el('div', 'k-num k-t' + t + ' k-c' + cc + (t === 0 ? ' k-top' : ''), s.charAt(k)), line['t' + t], gcol(cc)));
      }
      if (t > 0) grid.appendChild(put(el('div', 'k-sign', col.op), line['t' + t], 1));
    });
    // Strich über dem Ergebnis
    var rule = put(el('div', 'k-rule'), line.res, 1);
    rule.style.gridColumn = '1 / -1';
    grid.appendChild(rule);

    // Spalten-Schritte
    task.rows.forEach(function (row, i) {
      if (row.col === undefined) return;
      var d = el('div', 'row future col-step');
      d.dataset.i = i;
      d.dataset.col = row.col;
      // display: contents hat keine Box – die App scrollt beim Weiterschalten die Zeile ins Bild,
      // hier also das ganze Raster (damit es z. B. nicht hinter dem Zahlenfeld verschwindet)
      d.scrollIntoView = function (o) { paper.scrollIntoView(o); };
      var band = put(el('div', 'k-band'), 1, gcol(row.col));
      band.style.gridRow = '1 / -1';
      d.appendChild(band);
      d.appendChild(put(el('div', 'k-head k-c' + row.col, HEAD[row.col]), line.head, gcol(row.col)));
      var labels = h.cellLabels(row), n = 0;
      row.tokens.forEach(function (tok) {
        var aria = tok.t === 'in' ? tok.aria || labels[n] : '';
        if (tok.t === 'in') n++;
        if (!tok.place) return;
        if (tok.place.line === 'hidden') {
          var hid = el('input', 'cell cell-sum');
          hid.type = 'hidden';
          hid.dataset.id = tok.id;
          hid.readOnly = true;
          d.appendChild(hid);
          return;
        }
        var slot = put(el('div', 'k-slot k-' + tok.place.line + ' k-c' + tok.place.col), line[tok.place.line], gcol(tok.place.col));
        if (tok.t === 'num') {
          slot.classList.add('fix');
          slot.appendChild(el('span', 'k-fixnum', String(tok.v)));
        } else {
          slot.innerHTML = h.tokenHtml(tok, aria);
          var inp = slot.querySelector('input.cell');
          // Platzhalter: leere Felder per CSS erkennen (:placeholder-shown)
          inp.placeholder = ' ';
          inp.maxLength = MAXLEN[tok.place.line] || 4;
          if (tok.blank !== undefined) slot.classList.add('may-blank');
        }
        d.appendChild(slot);
      });
      grid.appendChild(d);
    });

    paper.appendChild(grid);
    box.appendChild(paper);
  }

  root.RR = root.RR || {};
  root.RR.Layouts = root.RR.Layouts || {};
  root.RR.Layouts.column = { render: render };
})(window);
