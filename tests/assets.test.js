// Cache-Sperre: CSS und JS in index.html tragen ?v=<Inhalts-Hash>, damit Browser nach einem Update
// nicht alte und neue Dateien mischen (scripts/version-assets.js, npm run stamp).
'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const V = require('../scripts/version-assets.js');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const refs = [...html.matchAll(/(?:href|src)="((?:css|js)\/[^"]+)"/g)].map((m) => m[1]);

describe('Cache-Sperre für CSS und JS', () => {
  test('es gibt Verweise auf CSS und JS', () => {
    assert.ok(refs.some((r) => r.startsWith('css/')) && refs.some((r) => r.startsWith('js/')));
  });
  test('jeder Verweis trägt die aktuelle Version – sonst: npm run stamp', () => {
    const v = V.assetVersion(root);
    for (const r of refs) assert.equal(r.split('?v=')[1], v, r + ' (npm run stamp ausführen)');
  });
  test('stamp setzt oder ersetzt die Version, andere Verweise bleiben', () => {
    const a = '<link href="css/a.css"><script src="js/b.js?v=alt"></script><img src="img/x.jpg"><a href="https://x.de/js/y.js">';
    assert.equal(V.stamp(a, 'neu'),
      '<link href="css/a.css?v=neu"><script src="js/b.js?v=neu"></script><img src="img/x.jpg"><a href="https://x.de/js/y.js">');
  });
  test('Version hängt vom Inhalt ab', () => {
    assert.match(V.assetVersion(root), /^[0-9a-f]{10}$/);
  });
});
