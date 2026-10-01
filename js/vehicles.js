/*
 * Begleiter der Turbo-Rechenwerkstatt: Fahrzeuge als SVG.
 * Gleicher Rahmen wie die Einhörner (viewBox, .pony-all, .pony-shadow), damit
 * Größe, Mini-Hüpfer und Zustände (.is-happy, .is-oops, .is-nod, .is-gallop) passen.
 * Animationen kommen aus css/vehicles.css (Klassen .v-*).
 * Reines Modul ohne DOM – getestet in tests/vehicles.test.js.
 */
(function (root) {
  'use strict';

  var COMPANIONS = [
    { key: 'v-bruno', name: 'Bruno', kind: 'Bagger', stars: 0,
      body: ['#ffd84a', '#f2a900'], lid: '#d98e00' },
    { key: 'v-flitz', name: 'Flitz', kind: 'Rennauto', stars: 0,
      body: ['#33d1e0', '#1560b8'], lid: '#0f4f9a', accent: '#ff8a1f', number: '7' },
    { key: 'v-funke', name: 'Funke', kind: 'Feuerwehrauto', stars: 10,
      body: ['#ff5545', '#c8141c'], lid: '#a50f17', light: '#2f9bff' },
    { key: 'v-kalle', name: 'Kalle', kind: 'Kipplaster', stars: 25,
      body: ['#ffa53a', '#e45f0a'], lid: '#c24f06', load: ['#f6d58a', '#c99543'] },
    { key: 'v-rumms', name: 'Rumms', kind: 'Monstertruck', stars: 50,
      body: ['#9ee84f', '#2f9e44'], lid: '#23803a', mud: '#7a4f2a', number: '50' },
    { key: 'v-turbomax', name: 'Turbo-Max', kind: 'Helden-Auto', stars: 100,
      body: ['#8a6cff', '#4526b8'], lid: '#1c1446', gold: '#ffc83d', cape: ['#ff7a3d', '#d42a4c'] }
  ];

  var INK = '#1d2233';
  var TYRE = '#26232e';
  var FONT = "Fredoka, ui-rounded, 'Segoe UI', system-ui, sans-serif";
  var uid = 0;

  function byKey(key) {
    return COMPANIONS.filter(function (c) { return c.key === key; })[0] || COMPANIONS[0];
  }

  function n(v) { return String(Math.round(v * 10) / 10); }

  function lin(id, stops, x2, y2) {
    return '<linearGradient id="' + id + '" x1="0" y1="0" x2="' + (x2 === undefined ? 0 : x2) + '" y2="' + (y2 === undefined ? 1 : y2) + '">' +
      stops.map(function (s) { return '<stop offset="' + s[0] + '" stop-color="' + s[1] + '"/>'; }).join('') +
      '</linearGradient>';
  }

  function star(x, y, s, color) {
    var pts = [];
    for (var i = 0; i < 10; i++) {
      var a = Math.PI / 5 * i - Math.PI / 2, rr = i % 2 ? s * 0.45 : s;
      pts.push(n(x + Math.cos(a) * rr) + ',' + n(y + Math.sin(a) * rr));
    }
    return '<polygon points="' + pts.join(' ') + '" fill="' + color + '" stroke-linejoin="round"/>';
  }

  /** Ein Rad: Reifen mit Profil, Felge mit Speichen (dreht sich als Ganzes). */
  function wheel(id, cx, cy, r, o) {
    o = o || {};
    var tr = r * (o.knobby ? 0.9 : 0.92);
    var circ = 2 * Math.PI * tr;
    var blocks = o.knobby ? 14 : 18;
    var seg = circ / blocks;
    var rim = r * (o.rim || 0.56);
    var out = ['<g class="v-wheel">'];
    out.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + TYRE + '"/>');
    out.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + n(tr) + '" fill="none" stroke="' + (o.knobby ? '#45404f' : '#3a3644') +
      '" stroke-width="' + n(r * (o.knobby ? 0.2 : 0.12)) + '" stroke-dasharray="' + n(seg * 0.5) + ' ' + n(seg * 0.5) + '"/>');
    out.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + n(r * 0.72) + '" fill="#34303d"/>');
    out.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + n(rim) + '" fill="url(#' + (o.gold ? id + 'au' : id + 'cr') + ')"/>');
    for (var i = 0; i < 5; i++) {
      out.push('<rect x="' + n(cx - rim * 0.13) + '" y="' + n(cy - rim * 0.92) + '" width="' + n(rim * 0.26) + '" height="' + n(rim * 0.62) +
        '" rx="' + n(rim * 0.12) + '" fill="' + (o.gold ? '#b9851a' : '#7d8796') + '" transform="rotate(' + (i * 72) + ' ' + cx + ' ' + cy + ')"/>');
    }
    out.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + n(rim * 0.36) + '" fill="' + (o.hub || (o.gold ? '#ffe08a' : '#e9eef4')) + '"/>');
    out.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + n(rim * 0.14) + '" fill="' + INK + '" opacity=".55"/>');
    if (o.mud) {
      out.push('<path d="M' + n(cx - r * 0.95) + ',' + n(cy + r * 0.1) + ' q' + n(r * 0.12) + ',' + n(-r * 0.3) + ' ' + n(r * 0.3) + ',' + n(-r * 0.2) +
        ' q' + n(r * 0.1) + ',' + n(r * 0.25) + ' ' + n(-r * 0.12) + ',' + n(r * 0.45) + ' z" fill="' + o.mud + '"/>');
      out.push('<circle cx="' + n(cx + r * 0.62) + '" cy="' + n(cy - r * 0.68) + '" r="' + n(r * 0.13) + '" fill="' + o.mud + '"/>');
      out.push('<circle cx="' + n(cx + r * 0.3) + '" cy="' + n(cy + r * 0.82) + '" r="' + n(r * 0.1) + '" fill="' + o.mud + '"/>');
    }
    out.push('</g>');
    // Glanz bleibt stehen, während das Rad sich dreht
    out.push('<path d="M' + n(cx - r * 0.7) + ',' + n(cy - r * 0.42) + ' A' + n(r * 0.82) + ',' + n(r * 0.82) + ' 0 0 1 ' + n(cx - r * 0.1) + ',' + n(cy - r * 0.82) +
      '" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="' + n(Math.max(2, r * 0.08)) + '" stroke-linecap="round"/>');
    return out.join('');
  }

  /** Kleine Laufrolle (Kette des Baggers). */
  function roller(cx, cy, r) {
    return '<g class="v-wheel">' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="#5b5668"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + n(r * 0.62) + '" fill="#ffcc2e"/>' +
      '<rect x="' + n(cx - r * 0.12) + '" y="' + n(cy - r * 0.62) + '" width="' + n(r * 0.24) + '" height="' + n(r * 1.24) + '" fill="#b98200"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + n(r * 0.24) + '" fill="#3a3545"/>' +
      '</g>';
  }

  /**
   * Ein Auge hinter der Scheibe: Augapfel, Pupille nach vorn (rechts), Glanzpunkte,
   * dazu ein Lid, das von oben schräg ins Auge ragt (entschlossener Blick).
   * lidL / lidR: Höhe der Lidkante links / rechts als Anteil vom Radius (−1 oben … 1 unten).
   */
  function eye(cid, cx, cy, rx, ry, lid, lidL, lidR) {
    var x0 = cx - rx - 3, x1 = cx + rx + 3;
    var yl = cy + ry * lidL, yr = cy + ry * lidR;
    var top = cy - ry - 3;
    var px = cx + rx * 0.24, py = cy + ry * 0.12;
    return '<clipPath id="' + cid + '"><ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '"/></clipPath>' +
      '<g class="v-eye">' +
      '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="#fff"/>' +
      '<g clip-path="url(#' + cid + ')">' +
      '<ellipse cx="' + n(px) + '" cy="' + n(py) + '" rx="' + n(rx * 0.62) + '" ry="' + n(ry * 0.66) + '" fill="#2a3f7a"/>' +
      '<ellipse cx="' + n(px + rx * 0.06) + '" cy="' + n(py + ry * 0.04) + '" rx="' + n(rx * 0.38) + '" ry="' + n(ry * 0.42) + '" fill="#0d1020"/>' +
      '<circle cx="' + n(px + rx * 0.22) + '" cy="' + n(py - ry * 0.22) + '" r="' + n(rx * 0.22) + '" fill="#fff"/>' +
      '<circle cx="' + n(px - rx * 0.2) + '" cy="' + n(py + ry * 0.28) + '" r="' + n(rx * 0.1) + '" fill="#fff" opacity=".8"/>' +
      '<path d="M' + n(x0) + ',' + n(top) + ' L' + n(x1) + ',' + n(top) + ' L' + n(x1) + ',' + n(yr) + ' Q' + n(cx) + ',' + n((yl + yr) / 2 - ry * 0.04) + ' ' + n(x0) + ',' + n(yl) + ' Z" fill="' + lid + '"/>' +
      '</g>' +
      '<path d="M' + n(x0 + 1) + ',' + n(yl) + ' Q' + n(cx) + ',' + n((yl + yr) / 2 - ry * 0.04) + ' ' + n(x1 - 1) + ',' + n(yr) + '" fill="none" stroke="' + INK + '" stroke-width="2.6" stroke-linecap="round"/>' +
      '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="none" stroke="' + INK + '" stroke-width="2"/>' +
      '</g>';
  }

  /** Zwei Augen nebeneinander (das vordere etwas größer). */
  function eyes(id, x, y, gap, rx, ry, lid) {
    return eye(id + 'e1', x, y, rx * 0.92, ry * 0.94, lid, -0.8, -0.32) +
      eye(id + 'e2', x + gap, y + 1, rx, ry, lid, -0.3, -0.78);
  }

  /** Verschmitztes Grinsen, rechts etwas höher. */
  function smile(x, y, w) {
    var x0 = x - w / 2, x1 = x + w / 2, y1 = y - w * 0.2;
    return '<path d="M' + n(x0) + ',' + n(y) + ' Q' + n(x - w * 0.02) + ',' + n(y + w * 0.62) + ' ' + n(x1) + ',' + n(y1) +
      ' Q' + n(x) + ',' + n(y + w * 0.12) + ' ' + n(x0) + ',' + n(y) + ' Z" fill="' + INK + '" stroke="' + INK + '" stroke-width="2.4" stroke-linejoin="round"/>' +
      '<path d="M' + n(x0 + w * 0.2) + ',' + n(y + w * 0.1) + ' Q' + n(x) + ',' + n(y + w * 0.16) + ' ' + n(x1 - w * 0.18) + ',' + n(y1 + w * 0.08) +
      '" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>';
  }

  /** Abgaswölkchen (nur beim Flitzen sichtbar) – wandern nach hinten/oben. */
  function puffs(x, y, up) {
    var dx = up ? -4 : -10, dy = up ? -10 : -3;
    return '<g class="v-puff">' +
      '<circle class="v-puff-1" cx="' + x + '" cy="' + y + '" r="6" fill="#eef1f6" stroke="#aab3c2" stroke-width="1.5"/>' +
      '<circle class="v-puff-2" cx="' + (x + dx) + '" cy="' + (y + dy) + '" r="8" fill="#e2e6ee" stroke="#aab3c2" stroke-width="1.5"/>' +
      '<circle class="v-puff-3" cx="' + (x + dx * 2.1) + '" cy="' + (y + dy * 2.1) + '" r="10" fill="#d6dbe5" stroke="#aab3c2" stroke-width="1.5"/>' +
      '</g>';
  }

  /** Tempo-Striche hinter dem Fahrzeug (nur beim Flitzen sichtbar). */
  function speedLines(x, ys) {
    return '<g class="v-speed">' + ys.map(function (y, i) {
      var len = 26 - i * 5;
      return '<line x1="' + (x - len) + '" y1="' + y + '" x2="' + x + '" y2="' + y + '" stroke="rgba(255,255,255,.9)" stroke-width="4" stroke-linecap="round"/>' +
        '<line x1="' + (x - len) + '" y1="' + y + '" x2="' + x + '" y2="' + y + '" stroke="rgba(60,70,110,.45)" stroke-width="2" stroke-linecap="round"/>';
    }).join('') + '</g>';
  }

  /** Dunkler Radkasten hinter dem Ausschnitt im Aufbau. */
  function wells(list) {
    return list.map(function (w) {
      return '<path d="M' + (w[0] - w[2]) + ',' + w[1] + ' A' + w[2] + ',' + w[2] + ' 0 0 1 ' + (w[0] + w[2]) + ',' + w[1] + ' Z" fill="#1a1822"/>';
    }).join('');
  }

  function shadow(cx, rx) {
    return '<ellipse class="pony-shadow" cx="' + cx + '" cy="182" rx="' + rx + '" ry="7" fill="rgba(40,30,60,.22)"/>';
  }

  function headlight(x, y, rot) {
    return '<ellipse cx="' + x + '" cy="' + y + '" rx="7" ry="4.5" fill="#fff6c8" stroke="#c9b25a" stroke-width="1.5" transform="rotate(' + (rot || 0) + ' ' + x + ' ' + y + ')"/>' +
      '<circle cx="' + (x + 2) + '" cy="' + (y - 1) + '" r="1.6" fill="#fff"/>';
  }

  // ---------------------------------------------------------------- Bagger
  function bruno(c, id) {
    var o = [];
    o.push(shadow(112, 100));
    o.push('<g class="pony-all">');
    o.push(puffs(56, 66, true));
    o.push('<g class="v-body">');
    // Auspuff
    o.push('<rect x="52" y="70" width="8" height="28" rx="2" fill="url(#' + id + 'cr)"/><rect x="50" y="68" width="12" height="5" rx="2" fill="#3a3545"/>');
    // Drehkranz
    o.push('<rect x="44" y="134" width="88" height="14" rx="4" fill="#3a3545"/>');
    // Oberwagen
    o.push('<rect x="20" y="94" width="130" height="46" rx="10" fill="url(#' + id + 'b)"/>');
    // Gegengewicht mit Warnstreifen
    o.push('<clipPath id="' + id + 'k"><path d="M12,104 Q12,92 24,92 L42,92 L42,140 L24,140 Q12,140 12,128 Z"/></clipPath>');
    o.push('<g clip-path="url(#' + id + 'k)"><rect x="10" y="90" width="34" height="52" fill="#2b2735"/>' +
      [0, 1, 2, 3, 4].map(function (i) {
        return '<path d="M' + (4 + i * 14) + ',142 L' + (24 + i * 14) + ',90 L' + (31 + i * 14) + ',90 L' + (11 + i * 14) + ',142 Z" fill="#ffd84a"/>';
      }).join('') + '</g>');
    // Motorgitter
    o.push('<rect x="50" y="104" width="24" height="5" rx="2.5" fill="#3a3545" opacity=".75"/><rect x="50" y="113" width="24" height="5" rx="2.5" fill="#3a3545" opacity=".75"/><rect x="50" y="122" width="24" height="5" rx="2.5" fill="#3a3545" opacity=".75"/>');
    o.push('<rect x="20" y="132" width="66" height="8" rx="4" fill="' + c.lid + '" opacity=".55"/>');
    // Kabine
    o.push('<path d="M82,140 L82,56 Q82,40 98,40 L122,40 Q138,40 140,56 L146,140 Z" fill="url(#' + id + 'b)"/>');
    o.push('<path d="M86,56 Q86,44 98,44 L110,44" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="3" stroke-linecap="round"/>');
    // Rundumleuchte (gelb)
    o.push('<rect x="102" y="34" width="16" height="7" rx="2" fill="#3a3545"/><path d="M104,35 Q104,24 110,24 Q116,24 116,35 Z" fill="#ffb02e"/><path d="M107,31 Q107,27 110,27" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/>');
    // Fenster
    o.push('<path d="M90,54 Q90,48 96,48 L124,48 Q131,48 132,55 L136,98 L90,98 Z" fill="url(#' + id + 'g)" stroke="#3a3545" stroke-width="3" stroke-linejoin="round"/>');
    o.push(eyes(id, 102, 76, 21, 10, 12, c.lid));
    o.push('<path d="M126,54 L131,60" stroke="rgba(255,255,255,.8)" stroke-width="3" stroke-linecap="round"/>');
    o.push(smile(114, 116, 22));
    o.push('<rect x="88" y="104" width="4" height="22" rx="2" fill="' + c.lid + '" opacity=".6"/>');
    o.push('</g>');
    // Arm (Drehpunkt am Oberwagen)
    o.push('<g class="v-arm" style="transform-origin:142px 120px">');
    o.push('<path d="M142,120 Q154,62 188,42" fill="none" stroke="' + c.lid + '" stroke-width="22" stroke-linecap="round"/>');
    o.push('<path d="M142,118 Q153,64 187,42" fill="none" stroke="#ffcf2e" stroke-width="15" stroke-linecap="round"/>');
    o.push('<path d="M150,96 Q158,70 176,54" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="3" stroke-linecap="round"/>');
    o.push('<path d="M188,42 L208,106" fill="none" stroke="' + c.lid + '" stroke-width="15" stroke-linecap="round"/>');
    o.push('<path d="M187,43 L206,104" fill="none" stroke="#ffcf2e" stroke-width="9" stroke-linecap="round"/>');
    o.push('<path d="M156,100 L176,62" stroke="#3a3545" stroke-width="9" stroke-linecap="round"/><path d="M164,86 L182,54" stroke="url(#' + id + 'cr)" stroke-width="5" stroke-linecap="round"/>');
    // Schaufel
    o.push('<path d="M198,100 L222,96 Q228,128 208,146 L186,144 Q200,128 198,100 Z" fill="url(#' + id + 'b)" stroke="' + c.lid + '" stroke-width="3" stroke-linejoin="round"/>');
    o.push('<path d="M188,144 l-6,8 l10,-2 Z M196,145 l-4,9 l10,-3 Z M204,145 l-2,9 l9,-5 Z" fill="#c9d1db" stroke="#7d8796" stroke-width="1.5" stroke-linejoin="round"/>');
    [[142, 120, 6], [188, 42, 5], [206, 104, 4.5]].forEach(function (p) {
      o.push('<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + p[2] + '" fill="#3a3545"/><circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + (p[2] * 0.45) + '" fill="#c9d1db"/>');
    });
    o.push('</g>');
    // Kette
    o.push('<rect x="18" y="146" width="136" height="34" rx="17" fill="#2b2735"/>');
    o.push('<rect x="18" y="146" width="136" height="34" rx="17" fill="none" stroke="#4a4556" stroke-width="4" stroke-dasharray="7 5"/>');
    o.push('<rect x="27" y="153" width="118" height="20" rx="10" fill="#4a4556"/>');
    o.push(roller(36, 163, 12) + roller(62, 165, 7.5) + roller(86, 165, 7.5) + roller(110, 165, 7.5) + roller(136, 163, 12));
    o.push('</g>');
    return o.join('');
  }

  // ---------------------------------------------------------------- Rennauto
  function flitz(c, id) {
    var o = [];
    var body = 'M20,160 Q10,160 10,150 L10,126 Q10,114 24,112 L80,106 Q98,68 130,66 L146,66 Q166,68 186,102 L208,112 Q222,118 220,138 L218,150 Q216,160 206,160 L198,160 A26,26 0 0 0 146,160 L80,160 A26,26 0 0 0 28,160 Z';
    o.push(shadow(114, 102));
    o.push('<g class="pony-all">');
    o.push(speedLines(2, [96, 124, 140]));
    o.push(puffs(0, 150, false));
    o.push('<g class="v-body">');
    // Heckflügel
    o.push('<rect x="20" y="88" width="6" height="26" rx="2" fill="#2b2735"/><rect x="34" y="90" width="6" height="22" rx="2" fill="#2b2735"/>');
    o.push('<path d="M-2,82 Q22,76 50,80 L50,90 Q22,88 -2,96 Z" fill="url(#' + id + 'a)"/><path d="M-4,78 L4,78 L4,100 L-4,100 Z" fill="#2b2735"/>');
    // Auspuff
    o.push('<rect x="2" y="144" width="12" height="7" rx="3" fill="url(#' + id + 'cr)"/>');
    o.push(wells([[54, 160, 26], [172, 160, 26]]));
    o.push('<path d="' + body + '" fill="url(#' + id + 'b)"/>');
    o.push('<clipPath id="' + id + 'k"><path d="' + body + '"/></clipPath>');
    o.push('<g clip-path="url(#' + id + 'k)">' +
      '<path d="M0,120 L230,112 L230,124 L0,134 Z" fill="' + c.accent + '"/>' +
      '<path d="M0,138 L230,128 L230,132 L0,142 Z" fill="#ffd23f"/>' +
      '<rect x="0" y="152" width="230" height="10" fill="rgba(10,20,60,.25)"/>' +
      '<path d="M84,104 Q100,70 130,68 L146,68" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="4" stroke-linecap="round"/>' +
      '</g>');
    // Scheibe
    o.push('<path d="M94,104 Q108,76 130,74 L146,74 Q162,76 180,104 Z" fill="url(#' + id + 'g)" stroke="#123a70" stroke-width="3" stroke-linejoin="round"/>');
    o.push(eyes(id, 134, 91, 22, 9.5, 11.5, c.lid));
    // Spiegel
    o.push('<path d="M176,100 L186,96 Q190,96 189,100 L184,104 Z" fill="' + c.lid + '"/>');
    // Lufteinlass
    o.push('<path d="M66,116 L84,114 L80,124 L64,126 Z" fill="#12305e" opacity=".8"/>');
    // Startnummer
    o.push('<circle cx="114" cy="138" r="15" fill="#fff" stroke="' + INK + '" stroke-width="2.5"/>');
    o.push('<text x="114" y="146" text-anchor="middle" font-family="' + FONT + '" font-weight="700" font-size="23" fill="' + INK + '">' + c.number + '</text>');
    o.push(headlight(206, 116, 20));
    o.push(smile(203, 137, 20));
    o.push('<path d="M198,160 L224,154 L224,150 L204,152 Z" fill="#2b2735"/>');
    o.push('</g>');
    o.push(wheel(id, 54, 157, 23) + wheel(id, 172, 157, 23));
    o.push('</g>');
    return o.join('');
  }

  // ---------------------------------------------------------------- Feuerwehr
  function funke(c, id) {
    var o = [];
    var body = 'M16,160 Q8,160 8,152 L8,84 Q8,74 18,74 L146,74 L148,58 Q150,46 164,46 L196,46 Q208,46 211,58 L218,104 Q220,112 220,122 L220,152 Q220,160 212,160 L202,160 A22,22 0 0 0 158,160 L114,160 A22,22 0 0 0 70,160 L68,160 A22,22 0 0 0 24,160 Z';
    o.push(shadow(114, 102));
    o.push('<g class="pony-all">');
    o.push(speedLines(4, [92, 118, 136]));
    o.push(puffs(2, 154, false));
    o.push('<g class="v-body">');
    // Leiter
    o.push('<rect x="22" y="68" width="14" height="8" fill="#3a3545"/><rect x="124" y="68" width="14" height="8" fill="#3a3545"/>');
    o.push('<rect x="10" y="58" width="144" height="5" rx="2.5" fill="url(#' + id + 'cr)"/><rect x="10" y="67" width="144" height="5" rx="2.5" fill="url(#' + id + 'cr)"/>');
    var rungs = '';
    for (var x = 16; x < 152; x += 11) rungs += '<rect x="' + x + '" y="62" width="3.5" height="6" fill="#9aa5b4"/>';
    o.push(rungs);
    o.push(wells([[46, 160, 22], [92, 160, 22], [180, 160, 22]]));
    o.push('<path d="' + body + '" fill="url(#' + id + 'b)"/>');
    o.push('<clipPath id="' + id + 'k"><path d="' + body + '"/></clipPath>');
    o.push('<g clip-path="url(#' + id + 'k)">' +
      '<rect x="0" y="134" width="230" height="10" fill="#fff"/>' +
      '<rect x="0" y="144" width="230" height="4" fill="#ffd23f"/>' +
      '<rect x="0" y="152" width="230" height="10" fill="rgba(80,0,10,.25)"/>' +
      '</g>');
    // Rollläden
    o.push('<rect x="16" y="82" width="124" height="46" rx="6" fill="url(#' + id + 'cr)"/>');
    var lines = '';
    for (var y = 88; y < 126; y += 6) lines += '<line x1="18" y1="' + y + '" x2="138" y2="' + y + '" stroke="rgba(60,70,90,.22)" stroke-width="1.5"/>';
    o.push(lines);
    o.push('<line x1="57" y1="82" x2="57" y2="128" stroke="#8d97a6" stroke-width="3"/><line x1="99" y1="82" x2="99" y2="128" stroke="#8d97a6" stroke-width="3"/>');
    o.push('<rect x="30" y="121" width="12" height="4" rx="2" fill="#5d6675"/><rect x="72" y="121" width="12" height="4" rx="2" fill="#5d6675"/><rect x="114" y="121" width="12" height="4" rx="2" fill="#5d6675"/>');
    o.push('<line x1="148" y1="76" x2="148" y2="150" stroke="' + c.lid + '" stroke-width="3" opacity=".7"/>');
    // Blaulicht
    o.push('<rect x="160" y="38" width="44" height="9" rx="3" fill="#2b2f3a"/>');
    o.push('<g class="v-light v-light-a"><path d="M163,39 Q163,27 172,27 Q181,27 181,39 Z" fill="url(#' + id + 'l)"/><path d="M167,34 Q167,30 171,30" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/></g>');
    o.push('<g class="v-light v-light-b"><path d="M183,39 Q183,27 192,27 Q201,27 201,39 Z" fill="url(#' + id + 'l)"/><path d="M187,34 Q187,30 191,30" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/></g>');
    // Scheibe
    o.push('<path d="M165,54 L198,54 Q205,54 206,61 L212,98 L165,98 Q159,98 159,92 L159,60 Q159,54 165,54 Z" fill="url(#' + id + 'g)" stroke="#6b0a10" stroke-width="3" stroke-linejoin="round"/>');
    o.push(eyes(id, 175, 77, 20, 9, 11.5, c.lid));
    o.push('<path d="M156,104 L156,128" stroke="' + c.lid + '" stroke-width="2.5" opacity=".6"/>');
    o.push('<text x="182" y="124" text-anchor="middle" font-family="' + FONT + '" font-weight="700" font-size="16" fill="#fff">112</text>');
    o.push(headlight(214, 112, 80));
    o.push(smile(207, 128, 17));
    o.push('<rect x="204" y="152" width="20" height="8" rx="3" fill="url(#' + id + 'cr)"/>');
    o.push('<path d="M209,66 L216,66 L216,62 L223,63 L223,79 L216,79 L216,70 L209,70 Z" fill="#2b2f3a"/>');
    o.push('</g>');
    o.push(wheel(id, 46, 160, 20) + wheel(id, 92, 160, 20) + wheel(id, 180, 160, 20));
    o.push('</g>');
    return o.join('');
  }

  // ---------------------------------------------------------------- Kipplaster
  function kalle(c, id) {
    var o = [];
    var cab = 'M152,160 L152,64 Q152,54 162,54 L192,54 Q204,54 207,64 L218,108 Q220,114 220,122 L220,152 Q220,160 212,160 L203,160 A23,23 0 0 0 157,160 Z';
    o.push(shadow(112, 104));
    o.push('<g class="pony-all">');
    o.push(puffs(149, 28, true));
    o.push('<g class="v-body">');
    // Fahrgestell
    o.push('<rect x="10" y="132" width="150" height="14" rx="4" fill="#2b2735"/>');
    o.push('<path d="M18,146 A24,24 0 0 1 66,146 M62,146 A24,24 0 0 1 110,146" fill="none" stroke="#2b2735" stroke-width="6"/>');
    // Kippmulde (Drehpunkt hinten unten)
    o.push('<g class="v-tipper" style="transform-origin:12px 132px">');
    o.push('<path d="M4,72 Q22,42 52,46 Q74,28 102,38 Q130,36 150,62 L150,74 L4,74 Z" fill="url(#' + id + 's)"/>');
    o.push('<circle cx="40" cy="56" r="4" fill="#b98a3e"/><circle cx="74" cy="44" r="3" fill="#9a7a50"/><circle cx="104" cy="50" r="4.5" fill="#b98a3e"/><circle cx="128" cy="56" r="3" fill="#8f8a84"/><circle cx="58" cy="62" r="3" fill="#8f8a84"/><circle cx="88" cy="60" r="2.5" fill="#fff4cf"/>');
    o.push('<path d="M10,132 L2,78 L154,78 L150,132 Z" fill="url(#' + id + 'b)"/>');
    o.push('<rect x="0" y="70" width="158" height="10" rx="3" fill="' + c.lid + '"/>');
    o.push('<rect x="2" y="71" width="154" height="3" rx="1.5" fill="rgba(255,255,255,.45)"/>');
    [32, 60, 88, 116].forEach(function (x) {
      o.push('<path d="M' + x + ',82 L' + (x + 1) + ',128" stroke="' + c.lid + '" stroke-width="5" stroke-linecap="round" opacity=".65"/>');
    });
    o.push('<clipPath id="' + id + 'k"><path d="M10,132 L2,80 L18,80 L22,132 Z"/></clipPath>');
    o.push('<g clip-path="url(#' + id + 'k)"><rect x="0" y="78" width="24" height="56" fill="#2b2735"/>' +
      [0, 1, 2, 3, 4].map(function (i) {
        return '<path d="M-6,' + (96 + i * 16) + ' L30,' + (74 + i * 16) + ' L30,' + (82 + i * 16) + ' L-6,' + (104 + i * 16) + ' Z" fill="#ffd23f"/>';
      }).join('') + '</g>');
    o.push('<text x="128" y="114" text-anchor="middle" font-family="' + FONT + '" font-weight="700" font-size="20" fill="#fff" stroke="' + c.lid + '" stroke-width="1">25</text>');
    o.push('</g>');
    // Auspuff
    o.push('<rect x="145" y="32" width="8" height="44" rx="2" fill="url(#' + id + 'cr)"/><rect x="143" y="30" width="12" height="5" rx="2" fill="#3a3545"/>');
    // Kabine
    o.push(wells([[180, 160, 23]]));
    o.push('<path d="' + cab + '" fill="url(#' + id + 'b)"/>');
    o.push('<path d="M157,70 Q157,59 166,59 L180,59" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="3" stroke-linecap="round"/>');
    o.push('<path d="M164,62 L192,62 Q199,62 201,68 L210,100 L164,100 Q160,100 160,96 L160,66 Q160,62 164,62 Z" fill="url(#' + id + 'g)" stroke="#7a3304" stroke-width="3" stroke-linejoin="round"/>');
    o.push(eyes(id, 174, 81, 20, 8.5, 11, c.lid));
    // Dachschild
    o.push('<rect x="160" y="48" width="40" height="7" rx="3" fill="#2b2735"/><rect x="164" y="49.5" width="8" height="4" rx="2" fill="#ffb02e"/><rect x="188" y="49.5" width="8" height="4" rx="2" fill="#ffb02e"/>');
    o.push('<path d="M156,108 L214,108" stroke="' + c.lid + '" stroke-width="2.5" opacity=".6"/>');
    o.push('<path d="M160,130 L178,112 L186,112 L168,130 Z M172,130 L190,112 L196,112 L178,130 Z" fill="#2b2735" opacity=".85"/>');
    o.push(headlight(214, 118, 80));
    o.push(smile(206, 136, 17));
    o.push('<rect x="204" y="150" width="20" height="9" rx="3" fill="url(#' + id + 'cr)"/>');
    o.push('<path d="M206,66 L214,68 L214,82 L208,82 Z" fill="#2b2735"/>');
    o.push('</g>');
    o.push(wheel(id, 42, 159, 21) + wheel(id, 86, 159, 21) + wheel(id, 180, 159, 21));
    o.push('</g>');
    return o.join('');
  }

  // ---------------------------------------------------------------- Monstertruck
  function rumms(c, id) {
    var o = [];
    var body = 'M8,94 L8,66 Q8,58 16,58 L98,58 L110,30 Q114,22 124,22 L156,22 Q166,22 172,30 L186,56 L206,60 Q220,63 220,76 L220,88 Q220,96 212,96 L16,96 Q8,96 8,94 Z';
    o.push(shadow(112, 104));
    o.push('<g class="pony-all">');
    o.push(speedLines(0, [66, 86]));
    o.push(puffs(2, 84, false));
    // Fahrwerk (hinter den Rädern)
    o.push('<rect x="50" y="126" width="122" height="10" rx="4" fill="#2b2735"/>');
    o.push('<g class="v-body">');
    [[100, 94, 98, 128], [122, 94, 124, 128]].forEach(function (s) {
      var zig = '', k;
      for (k = 0; k <= 8; k++) {
        var t = k / 8, x = s[0] + (s[2] - s[0]) * t + (k % 2 ? 6 : -6), y = s[1] + 4 + (s[3] - s[1] - 8) * t;
        zig += (k ? ' L' : 'M') + n(x) + ',' + n(y);
      }
      o.push('<line x1="' + s[0] + '" y1="' + s[1] + '" x2="' + s[2] + '" y2="' + s[3] + '" stroke="url(#' + id + 'cr)" stroke-width="7" stroke-linecap="round"/>');
      o.push('<path d="' + zig + '" fill="none" stroke="#ff8a1f" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>');
    });
    // Rammbügel-Lichter auf dem Dach
    o.push('<rect x="116" y="13" width="48" height="8" rx="3" fill="#2b2735"/>');
    [124, 140, 156].forEach(function (x) {
      o.push('<circle cx="' + x + '" cy="12" r="6" fill="#ffe27a" stroke="#2b2735" stroke-width="2.5"/>');
    });
    o.push('<path d="' + body + '" fill="url(#' + id + 'b)"/>');
    o.push('<clipPath id="' + id + 'k"><path d="' + body + '"/></clipPath>');
    o.push('<g clip-path="url(#' + id + 'k)">' +
      // Flammen
      '<path d="M206,62 Q176,58 146,56 Q160,63 156,68 Q128,63 88,66 Q118,73 126,78 Q110,82 96,88 Q140,89 160,84 Q186,92 208,86 Q216,74 206,62 Z" stroke="#e8590c" stroke-width="1.5" stroke-linejoin="round" fill="url(#' + id + 'f)"/>' +
      '<rect x="0" y="86" width="230" height="12" fill="rgba(20,60,20,.3)"/>' +
      '<path d="M0,96 q8,-12 16,-4 q6,-10 14,-2 q10,-8 16,2 L46,98 Z M150,98 q4,-10 12,-6 q8,-8 14,0 q8,-6 12,4 Z" fill="' + c.mud + '"/>' +
      '</g>');
    o.push('<rect x="8" y="58" width="90" height="6" rx="3" fill="#2b2735"/>');
    o.push('<text x="52" y="88" text-anchor="middle" font-family="' + FONT + '" font-weight="700" font-size="20" fill="#fff" stroke="#1f6b2c" stroke-width="1">' + c.number + '</text>');
    // Scheibe
    o.push('<path d="M118,28 L156,28 Q162,28 166,34 L178,56 L104,56 Z" fill="url(#' + id + 'g)" stroke="#145226" stroke-width="3" stroke-linejoin="round"/>');
    o.push(eyes(id, 128, 43, 22, 8.5, 10.5, c.lid));
    o.push(headlight(214, 70, 80));
    o.push(smile(203, 81, 18));
    o.push('<rect x="208" y="86" width="16" height="10" rx="3" fill="url(#' + id + 'cr)"/>');
    o.push('</g>');
    // Kotflügel
    o.push('<path d="M10.7,127 A44,44 0 0 1 93.3,127 M128.7,127 A44,44 0 0 1 211.3,127" fill="none" stroke="#2b2735" stroke-width="8" stroke-linecap="round"/>');
    o.push(wheel(id, 52, 142, 38, { knobby: true, mud: c.mud, rim: 0.5 }) + wheel(id, 170, 142, 38, { knobby: true, mud: c.mud, rim: 0.5 }));
    // Matsch-Spritzer
    o.push('<g class="v-mud"><circle cx="4" cy="150" r="4" fill="' + c.mud + '"/><circle cx="-2" cy="138" r="2.5" fill="' + c.mud + '"/><circle cx="8" cy="166" r="3" fill="' + c.mud + '"/></g>');
    o.push('</g>');
    return o.join('');
  }

  // ---------------------------------------------------------------- Helden-Auto
  function turbomax(c, id) {
    var o = [];
    var body = 'M18,160 Q8,160 8,150 L8,126 Q8,114 22,112 L74,104 Q96,72 128,70 L144,70 Q166,72 184,100 L206,108 Q222,114 220,134 L218,150 Q216,160 206,160 L196,160 A26,26 0 0 0 144,160 L82,160 A26,26 0 0 0 30,160 Z';
    o.push(shadow(114, 102));
    o.push('<g class="pony-all">');
    o.push(speedLines(0, [120, 138]));
    o.push(puffs(0, 150, false));
    // Umhang (hängt am Dach, weht nach hinten)
    o.push('<g class="v-cape" style="transform-origin:118px 76px">');
    o.push('<path d="M122,72 C96,54 56,56 24,66 C12,70 2,68 -4,62 C2,78 -2,92 -6,104 C6,98 14,104 22,100 C30,108 42,108 50,102 C60,110 76,104 84,98 C96,96 108,92 120,86 Z" fill="url(#' + id + 'c)"/>');
    o.push('<path d="M104,76 C80,70 52,76 22,92 M112,82 C92,84 72,92 50,100" fill="none" stroke="rgba(120,10,30,.35)" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M110,66 C86,58 56,60 30,68" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="3" stroke-linecap="round"/>');
    o.push('</g>');
    o.push('<g class="v-body">');
    o.push('<rect x="2" y="144" width="12" height="7" rx="3" fill="url(#' + id + 'cr)"/>');
    o.push(wells([[56, 160, 26], [170, 160, 26]]));
    o.push('<path d="' + body + '" fill="url(#' + id + 'b)"/>');
    o.push('<clipPath id="' + id + 'k"><path d="' + body + '"/></clipPath>');
    o.push('<g clip-path="url(#' + id + 'k)">' +
      '<path d="M230,120 Q150,118 0,140 L0,150 Q150,128 230,130 Z" fill="' + c.gold + '"/>' +
      '<rect x="0" y="152" width="230" height="10" fill="rgba(20,0,60,.3)"/>' +
      '<path d="M78,104 Q98,74 128,72 L144,72" fill="none" stroke="rgba(255,255,255,.4)" stroke-width="4" stroke-linecap="round"/>' +
      '</g>');
    // Umhang-Spange
    o.push('<circle cx="118" cy="74" r="6" fill="' + c.gold + '" stroke="#b9851a" stroke-width="2"/>');
    // Scheibe
    o.push('<path d="M88,104 Q102,78 128,77 L144,77 Q160,79 178,104 Z" fill="url(#' + id + 'g)" stroke="#24135e" stroke-width="3" stroke-linejoin="round"/>');
    // Augenmaske mit Bändern
    o.push('<path d="M118,89 C110,82 102,82 92,86 C100,89 102,93 98,98 C108,97 114,95 118,94 Z M118,95 C112,96 106,100 102,104 C110,104 116,101 119,99 Z" fill="' + c.lid + '"/>');
    o.push('<path d="M114,90 Q118,80 132,80 Q141,80 144,86 Q148,80 158,81 Q172,82 178,87 L171,94 Q170,106 157,106 Q149,106 144,99 Q140,106 131,106 Q118,106 116,97 Z" fill="' + c.lid + '"/>');
    o.push(eyes(id, 132, 92, 24, 8.5, 9.5, c.lid));
    // Emblem
    o.push('<circle cx="112" cy="134" r="15" fill="#1c1446" stroke="' + c.gold + '" stroke-width="3"/>');
    o.push(star(112, 135, 10, c.gold));
    o.push(headlight(206, 116, 20));
    o.push(smile(203, 138, 20));
    o.push('<path d="M196,160 L224,154 L224,150 L202,152 Z" fill="#1c1446"/>');
    o.push('</g>');
    o.push(wheel(id, 56, 158, 22, { gold: true }) + wheel(id, 170, 158, 22, { gold: true }));
    o.push('</g>');
    return o.join('');
  }

  var DRAW = { 'v-bruno': bruno, 'v-flitz': flitz, 'v-funke': funke, 'v-kalle': kalle, 'v-rumms': rumms, 'v-turbomax': turbomax };

  /** Liefert das SVG eines Fahrzeugs als String. */
  function svg(key) {
    var c = byKey(key);
    var id = 'v' + (++uid);
    var defs = '<defs>' +
      lin(id + 'b', [[0, c.body[0]], [1, c.body[1]]]) +
      lin(id + 'g', [[0, '#1d2a4a'], [0.22, '#2e4470'], [0.23, '#a9dcff'], [1, '#eaf7ff']]) +
      lin(id + 'cr', [[0, '#f7f9fc'], [0.5, '#b8c2cf'], [1, '#e3e8ef']]) +
      lin(id + 'au', [[0, '#fff1b0'], [0.5, '#e0a21c'], [1, '#ffd96a']]) +
      (c.accent ? lin(id + 'a', [[0, c.accent], [1, '#c4530a']]) : '') +
      (c.light ? lin(id + 'l', [[0, '#bfe3ff'], [1, c.light]]) : '') +
      (c.load ? lin(id + 's', [[0, c.load[0]], [1, c.load[1]]]) : '') +
      (c.mud ? lin(id + 'f', [[0, '#ffe14d'], [1, '#ff6a1f']], 1, 0) : '') +
      (c.cape ? lin(id + 'c', [[0, c.cape[0]], [1, c.cape[1]]], 1, 1) : '') +
      '</defs>';
    return '<svg class="pony vehicle" viewBox="-6 -22 232 210" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' +
      c.kind + ' ' + c.name + '">' + defs + DRAW[c.key](c, id) + '</svg>';
  }

  var api = { COMPANIONS: COMPANIONS, byKey: byKey, svg: svg };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RR = Object.assign(root.RR || {}, { Vehicles: api });
})(typeof window !== 'undefined' ? window : this);
