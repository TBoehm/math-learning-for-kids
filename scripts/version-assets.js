#!/usr/bin/env node
/*
 * Cache-Sperre: hängt an alle Verweise auf css/ und js/ in index.html "?v=<Hash>" an.
 * Der Hash wird aus dem Inhalt aller Dateien in css/ und js/ berechnet – ändert sich etwas,
 * ändert sich die Version, und Browser laden alles neu statt alte und neue Dateien zu mischen.
 * Aufruf: npm run stamp (tests/assets.test.js prüft, dass die Version aktuell ist).
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? files(p) : [p];
  });
}

/** Version aus dem Inhalt von css/ und js/ (Dateinamen sortiert, unabhängig vom Betriebssystem). */
function assetVersion(root) {
  const h = crypto.createHash('sha1');
  ['css', 'js'].flatMap((d) => files(path.join(root, d)))
    .map((p) => [path.relative(root, p).split(path.sep).join('/'), p])
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .forEach(([rel, p]) => { h.update(rel + '\0'); h.update(fs.readFileSync(p).toString('utf8').replace(/\r\n/g, '\n')); });
  return h.digest('hex').slice(0, 10);
}

/** Setzt oder ersetzt ?v= an allen relativen Verweisen auf css/ und js/. */
function stamp(html, v) {
  return html.replace(/((?:href|src)=")((?:css|js)\/[^"?]+)(?:\?v=[^"]*)?"/g, (m, a, p) => a + p + '?v=' + v + '"');
}

if (require.main === module) {
  const root = path.join(__dirname, '..');
  const file = path.join(root, 'index.html');
  const v = assetVersion(root);
  fs.writeFileSync(file, stamp(fs.readFileSync(file, 'utf8'), v));
  console.log('Version ' + v + ' in index.html gesetzt.');
}

module.exports = { assetVersion, stamp };
