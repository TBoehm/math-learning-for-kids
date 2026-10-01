/*
 * Darstellung 'wall': Zahlenmauer als Pyramide (Spitze oben), gelöst wird trotzdem Zeile für Zeile.
 * Eine Zeile der Aufgabe ist entweder eine ganze Reihe der Mauer (Plusmauer) oder ein einzelner Stein
 * (Minusmauer) – das jeweilige Element bekommt .row[data-i] und enthält die Felder (.cell).
 * Die Mauer selbst kommt aus js/formats/zahlenmauer.js (task.wall.levels, unten zuerst).
 */
(function (root) {
  'use strict';

  function el(tag, cls) {
    var e = document.createElement(tag);
    e.className = cls;
    return e;
  }

  function render(task, box, h) {
    var levels = task.wall.levels;
    var perRow = {};
    levels.forEach(function (l) {
      l.forEach(function (b) { if (!b.given) perRow[b.row] = (perRow[b.row] || 0) + 1; });
    });
    var wall = el('div', 'wall');
    wall.style.setProperty('--n', levels[0].length);
    wall.setAttribute('role', 'group');
    wall.setAttribute('aria-label', 'Zahlenmauer');

    for (var k = levels.length - 1; k >= 0; k--) {
      var line = el('div', 'wall-level');
      var rows = levels[k].filter(function (b) { return !b.given; }).map(function (b) { return b.row; })
        .filter(function (r, i, a) { return a.indexOf(r) === i; });
      // eine Zeile mit mehreren Steinen in dieser Reihe: die ganze Reihe ist die Zeile
      var lineIsRow = rows.length === 1 && perRow[rows[0]] > 1;
      if (lineIsRow) { line.className += ' row future'; line.dataset.i = rows[0]; }
      levels[k].forEach(function (b) {
        var brick = el('div', 'brick' + (b.given ? ' given' : ''));
        if (b.given) {
          brick.innerHTML = '<span class="brick-num">' + b.v + '</span>';
        } else {
          var row = task.rows[b.row];
          var ins = row.tokens.filter(function (t) { return t.t === 'in'; });
          var n = ins.map(function (t) { return t.id; }).indexOf(b.id);
          brick.innerHTML = h.tokenHtml(ins[n], h.cellLabels(row)[n]);
          if (!lineIsRow) { brick.className += ' row future'; brick.dataset.i = b.row; }
        }
        line.appendChild(brick);
      });
      wall.appendChild(line);
    }
    box.appendChild(wall);
    var rule = el('p', 'wall-rule');
    rule.textContent = 'Zwei Steine nebeneinander ergeben zusammen den Stein darüber.';
    box.appendChild(rule);
  }

  root.RR = root.RR || {};
  root.RR.Layouts = Object.assign(root.RR.Layouts || {}, { wall: { render: render } });
})(window);
