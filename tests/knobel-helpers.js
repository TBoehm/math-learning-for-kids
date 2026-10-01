// Hilfen für die Tests der Knobel-Aufgaben (js/formats/*.js). Keine Test-Datei (kein .test.js).
'use strict';
const assert = require('node:assert/strict');
const Check = require('../js/check.js');
const UI = require('../js/ui-logic.js');

/** Kleiner Zufallsgenerator mit Startwert, damit Tests wiederholbar sind (mulberry32). */
function seeded(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const fields = (row) => row.tokens.filter((t) => t.t === 'in' || t.t === 'choice');

/**
 * Löst eine Aufgabe mit den Musterlösungen Zeile für Zeile, so wie die Oberfläche:
 * jede Zeile muss mit Check.checkRow richtig sein, danach entscheidet UI.afterCorrect.
 * choose(row, i, vals) darf für einzelne Zeilen eigene Eingaben liefern ({ id: wert }).
 * -> gesicherte Werte (vals)
 */
function solve(task, choose) {
  let vals = {};
  for (let i = 0; i < 30; i++) {
    const row = task.rows[i];
    const raw = {};
    fields(row).forEach((tok) => { raw[tok.id] = String(tok.answer); });
    Object.assign(raw, choose ? choose(row, i, vals) || {} : {});
    const r = Check.checkRow(row, raw, vals);
    assert.ok(r.correct, 'Zeile ' + i + ' (' + row.label + ') wird nicht angenommen: ' + JSON.stringify(r.fields));
    vals = r.vals;
    const step = UI.afterCorrect(task, vals, i);
    if (step === 'finish') return vals;
    assert.notEqual(step, 'stuck', 'Aufgabe hängt nach Zeile ' + i);
    if (step === 'append') task.rows.push(task.nextRow(vals));
  }
  throw new Error('Aufgabe wird nicht fertig');
}

/** Alle Zahlen, die in einer Aufgabe zu sehen oder einzutragen sind. */
function numbersOf(task) {
  const out = [];
  task.rows.forEach((row) => row.tokens.forEach((t) => {
    if (t.t === 'num') out.push(t.v);
    if (t.t === 'in') out.push(t.answer);
  }));
  return out;
}

module.exports = { seeded, solve, fields, numbersOf };
