/*
 * Begleiter: Einhörner, Pferde und Pegasusse als SVG.
 * Animationen kommen aus CSS (Klassen .pony-*, Zustände am Container).
 */
(function (root) {
  'use strict';

  var COMPANIONS = [
    { key: 'luna', name: 'Luna', kind: 'Einhorn', stars: 0,
      body: '#fff8fc', shade: '#f4d6ea', mane: ['#ff8fcf', '#b48cff', '#7fd3ff', '#ffd36e'],
      hoof: '#c9a2ff', horn: true, lashes: true },
    { key: 'blitz', name: 'Blitz', kind: 'Pferd', stars: 0,
      body: '#b2723f', shade: '#8e5529', mane: ['#3b2313', '#5b3720', '#2c190d'],
      hoof: '#3a2a20', blaze: true, snout: '#c98d5c' },
    { key: 'karamell', name: 'Karamell', kind: 'Pony', stars: 10,
      body: '#f3c47e', shade: '#dba45c', mane: ['#fff6e2', '#ffe8b8', '#fffaf0'],
      hoof: '#8a6a4a', lashes: true, snout: '#f8d7a6' },
    { key: 'nebula', name: 'Nebula', kind: 'Sternen-Einhorn', stars: 25,
      body: '#5d4ca0', shade: '#43357d', mane: ['#ff7ad9', '#7ae4ff', '#ffe27a', '#b9a2ff'],
      hoof: '#ffe27a', horn: true, hornColor: ['#e9fbff', '#8fe7ff'], lashes: true, sparkles: true, snout: '#7464b8' },
    { key: 'wolke', name: 'Wolke', kind: 'Pegasus', stars: 50,
      body: '#ffffff', shade: '#dce8f7', mane: ['#8fd3ff', '#c8ecff', '#5fb6ff'],
      hoof: '#9ec9ff', wings: true, lashes: true },
    { key: 'aurora', name: 'Aurora', kind: 'Regenbogen-Flügeleinhorn', stars: 100,
      body: '#fff2fb', shade: '#f2d5ea', mane: ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#4dabf7', '#9775fa'],
      hoof: '#ffd43b', horn: true, wings: true, lashes: true }
  ];

  var uid = 0;

  function byKey(key) {
    return COMPANIONS.filter(function (c) { return c.key === key; })[0] || COMPANIONS[0];
  }

  function leg(cls, x, top, color, hoof) {
    return '<g class="pony-leg ' + cls + '">' +
      '<rect x="' + (x - 7) + '" y="' + top + '" width="14" height="' + (176 - top) + '" rx="7" fill="' + color + '"/>' +
      '<rect x="' + (x - 8) + '" y="168" width="16" height="12" rx="4" fill="' + hoof + '"/>' +
      '</g>';
  }

  function maneBlobs(points, colors, r0) {
    return points.map(function (p, i) {
      var r = r0 - i * 0.9;
      return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + r.toFixed(1) + '" fill="' + colors[i % colors.length] + '"/>';
    }).join('');
  }

  function star(x, y, s, color) {
    var pts = [];
    for (var i = 0; i < 10; i++) {
      var a = Math.PI / 5 * i - Math.PI / 2, rr = i % 2 ? s * 0.45 : s;
      pts.push((x + Math.cos(a) * rr).toFixed(1) + ',' + (y + Math.sin(a) * rr).toFixed(1));
    }
    return '<polygon points="' + pts.join(' ') + '" fill="' + color + '"/>';
  }

  /** Liefert das SVG eines Begleiters als String. */
  function svg(key, opts) {
    var c = byKey(key);
    opts = opts || {};
    var id = 'p' + (++uid);
    var m = c.mane;
    var snout = c.snout || c.body;
    var hornC = c.hornColor || ['#fff3b0', '#ffc93c'];
    var out = [];

    out.push('<svg class="pony" viewBox="-6 -22 232 210" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' +
      c.kind + ' ' + c.name + '">');
    out.push('<defs>' +
      '<linearGradient id="' + id + 'b" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0.45" stop-color="' + c.body + '"/><stop offset="1" stop-color="' + c.shade + '"/></linearGradient>' +
      '<linearGradient id="' + id + 'h" x1="0" y1="1" x2="1" y2="0">' +
      '<stop offset="0" stop-color="' + hornC[1] + '"/><stop offset="1" stop-color="' + hornC[0] + '"/></linearGradient>' +
      '</defs>');

    out.push('<ellipse class="pony-shadow" cx="104" cy="182" rx="62" ry="7" fill="rgba(60,40,90,.18)"/>');
    out.push('<g class="pony-all">');

    // Schweif
    out.push('<g class="pony-tail">');
    var tail = [
      'M52,98 C28,92 14,118 22,146 C26,158 18,168 10,170',
      'M52,100 C34,104 30,126 36,148 C40,160 34,168 28,172',
      'M52,96 C30,84 8,100 8,126 C8,140 0,150 -2,154'
    ];
    tail.forEach(function (d, i) {
      out.push('<path d="' + d + '" fill="none" stroke="' + m[i % m.length] + '" stroke-width="' + (13 - i * 2) +
        '" stroke-linecap="round"/>');
    });
    out.push('</g>');

    // hintere Beine (dunkler)
    out.push(leg('pony-leg-bl', 74, 120, c.shade, c.hoof));
    out.push(leg('pony-leg-fl', 132, 120, c.shade, c.hoof));

    // Körper
    out.push('<ellipse cx="100" cy="110" rx="54" ry="33" fill="url(#' + id + 'b)"/>');
    if (c.sparkles) {
      out.push(star(80, 102, 5, '#ffe27a') + star(100, 118, 3.5, '#fff') + star(118, 98, 4, '#7ae4ff') + star(66, 120, 3, '#ff9be6'));
    }

    // vordere Beine
    out.push(leg('pony-leg-br', 60, 122, c.body, c.hoof));
    out.push(leg('pony-leg-fr', 118, 122, c.body, c.hoof));

    // Hals
    out.push('<path d="M124,104 C126,76 136,58 148,46 L176,60 C164,76 160,98 154,118 Z" fill="' + c.body + '"/>');

    // Mähne am Hals
    out.push('<g class="pony-mane">' +
      maneBlobs([[150, 20], [141, 30], [135, 43], [130, 56], [126, 70], [123, 84], [121, 97]], m, 14) +
      '</g>');

    // Kopf
    out.push('<g class="pony-head">');
    // Ohr
    out.push('<path d="M140,30 L136,2 L156,22 Z" fill="' + c.body + '"/>');
    out.push('<path d="M141,25 L139,10 L150,21 Z" fill="#ffb3d1"/>');
    out.push('<ellipse cx="160" cy="46" rx="31" ry="28" fill="' + c.body + '"/>');
    out.push('<ellipse cx="184" cy="64" rx="19" ry="15" fill="' + snout + '"/>');
    if (c.blaze) {
      out.push('<path d="M166,22 C176,30 186,48 194,60 C190,66 184,64 180,58 C172,46 164,34 160,24 Z" fill="#fff4e8"/>');
    }
    out.push('<ellipse cx="193" cy="61" rx="2.6" ry="2" fill="rgba(60,30,60,.55)"/>');
    out.push('<path d="M180,72 Q187,76 194,71" fill="none" stroke="rgba(60,30,60,.5)" stroke-width="2.2" stroke-linecap="round"/>');
    out.push('<ellipse class="pony-blush" cx="176" cy="58" rx="7" ry="4" fill="#ff8fb8" opacity=".55"/>');
    // Auge
    out.push('<g class="pony-eye">' +
      '<ellipse cx="163" cy="42" rx="7" ry="9" fill="#2b1b3d"/>' +
      '<circle cx="166" cy="38.5" r="2.8" fill="#fff"/>' +
      '<circle cx="161" cy="46" r="1.4" fill="#fff" opacity=".8"/>' +
      (c.lashes ? '<path d="M166,33 L170,28 M169,35 L174,31 M163,33 L164,27" stroke="#2b1b3d" stroke-width="2" stroke-linecap="round"/>' : '') +
      '</g>');
    // Horn
    if (c.horn) {
      out.push('<g class="pony-horn">' +
        '<path d="M154,20 L178,-18 L168,24 Z" fill="url(#' + id + 'h)"/>' +
        '<path d="M157,15 L167,18 M160,8 L169,11 M164,0 L171,3 M168,-8 L174,-6" stroke="rgba(255,255,255,.85)" stroke-width="2" stroke-linecap="round"/>' +
        '</g>');
    }
    // Stirnlocke
    out.push(maneBlobs([[148, 18], [157, 15], [146, 30]], [m[1 % m.length], m[0], m[2 % m.length]], 9));
    out.push('</g>');

    // Flügel
    if (c.wings) {
      out.push('<g class="pony-wing">' +
        '<path d="M108,96 C100,70 84,50 52,40 C58,50 50,54 54,62 C44,64 44,74 52,78 C44,82 46,92 56,94 C72,104 94,102 108,96 Z" fill="#fff" stroke="' + m[0] + '" stroke-width="3" stroke-linejoin="round"/>' +
        '<path d="M98,92 C88,80 74,72 60,70 M100,84 C92,70 80,60 66,54" fill="none" stroke="' + m[0] + '" stroke-width="2.5" stroke-linecap="round" opacity=".7"/>' +
        '</g>');
    }

    out.push('</g></svg>');
    return out.join('');
  }

  var api = { COMPANIONS: COMPANIONS, byKey: byKey, svg: svg };
  root.RR = Object.assign(root.RR || {}, { Companion: api });
})(window);
