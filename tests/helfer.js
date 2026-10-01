// Gemeinsame Helfer für die Unit-Tests: Aufgaben Zeile für Zeile durchspielen wie ein Kind.
// (Kein Test selbst – der Dateiname endet nicht auf .test.js.)
'use strict';
const assert = require('node:assert/strict');
const Tasks = require('../js/tasks.js');
const Check = require('../js/check.js');
const UI = require('../js/ui-logic.js');

const inputs = (row) => row.tokens.filter((t) => t.t === 'in' || t.t === 'choice');
/** Rechenzeichen einer Zeile (ohne = und R) */
const opsOf = (row) => row.tokens.filter((t) => t.t === 'txt' && t.v !== '=' && t.v !== 'R').map((t) => t.v);

/** Kopie einer Aufgabe, die man unabhängig durchspielen kann (Zeilen werden beim Spielen angehängt). */
function fresh(task) { return Object.assign({}, task, { rows: task.rows.slice() }); }

/** Erwartete Werte einer Zeile zu den schon gesicherten Werten (wie die Lösung im Tipp). */
function expectedValues(row, vals) {
  const known = Object.assign({}, vals);
  return inputs(row).map((tok) => {
    const v = typeof tok.expected === 'function' ? tok.expected(known) : tok.answer;
    known[tok.id] = v;
    return v;
  });
}

/**
 * Spielt eine Aufgabe durch. pick(row, i, vals) liefert die Eingaben einer Zeile
 * (Zahlen in der Reihenfolge der Felder) oder null/undefined für die erwarteten Werte.
 * Zeilen, die die Aufgabe selbst anhängt (task.nextRow), werden wie in der App angehängt.
 * after(row, i, vals) wird nach jeder richtigen Zeile aufgerufen (vals: Werte genau nach dieser Zeile).
 * -> { ok: true, vals, rows } oder { ok: false, row, result, vals, used }
 */
function play(task, pick, after) {
  let vals = {};
  for (let i = 0; i < 40; i++) {
    if (i >= task.rows.length) {
      assert.equal(typeof task.nextRow, 'function', Tasks.taskText(task) + ': keine Zeile ' + i);
      const nr = task.nextRow(vals);
      assert.ok(nr && Array.isArray(nr.tokens), Tasks.taskText(task) + ': nextRow liefert keine Zeile');
      task.rows.push(nr);
    }
    const row = task.rows[i];
    const ins = inputs(row);
    let used = pick ? pick(row, i, vals) : null;
    if (!used) used = expectedValues(row, vals);
    const raw = {};
    ins.forEach((t, k) => { raw[t.id] = used[k] === undefined ? '' : String(used[k]); });
    const r = Check.checkRow(row, raw, vals);
    if (!r.correct) return { ok: false, row: i, result: r, vals, used };
    vals = r.vals;
    if (after) after(row, i, vals);
    if (!ins.length) continue; // Info-Zeile
    const step = UI.afterCorrect(task, vals, i);
    if (step === 'finish') return { ok: true, vals, rows: i + 1 };
    assert.notEqual(step, 'stuck', Tasks.taskText(task) + ': hängt nach Zeile ' + i);
  }
  throw new Error(Tasks.taskText(task) + ': zu viele Zeilen');
}

/** Spielt einen festen Weg: rows[i] = Eingaben der Zeile i (fehlend/null = erwartete Werte). */
function playPath(task, rows) { return play(fresh(task), (row, i) => rows[i] || null); }

/** Zahl ausrechnen: Liste aus Zahlen und Rechenzeichen, von links nach rechts (Punkt vor Strich). */
function evaluate(xs) {
  // erst · und :, dann + und −
  const t = [xs[0]];
  for (let i = 1; i < xs.length; i += 2) {
    const o = xs[i], n = xs[i + 1];
    if (o === '·') t[t.length - 1] *= n;
    else if (o === ':') { t[t.length - 1] /= n; }
    else t.push(o, n);
  }
  let v = t[0];
  for (let i = 1; i < t.length; i += 2) v = t[i] === '+' ? v + t[i + 1] : v - t[i + 1];
  return v;
}

/**
 * Prüft, dass die Gleichung einer Zeile mit den Werten stimmt. Mit Rest: "a : d = q R r"
 * heißt a = q · d + r und r < d. Liefert die Zahlen der Zeile (für Bereichsprüfungen).
 */
function assertTrueEquation(task, row, vals, i) {
  const toks = row.tokens.map((t) => (t.t === 'txt' ? t.v : t.t === 'num' ? t.v : vals[t.id]));
  const nums = toks.filter((x) => typeof x === 'number');
  const where = Tasks.taskText(task) + ' Zeile ' + i + ' (' + row.label + '): ' + toks.join(' ');
  toks.forEach((x) => assert.ok(x !== undefined, where + ': Wert fehlt'));
  const eq = toks.indexOf('=');
  if (eq < 0) return nums;
  const left = toks.slice(0, eq), rIdx = toks.indexOf('R');
  const right = toks.slice(eq + 1, rIdx < 0 ? undefined : rIdx);
  if (rIdx >= 0) {
    // a : d = q R r
    assert.equal(left.length, 3, where);
    assert.equal(left[1], ':', where);
    const r = toks[rIdx + 1], q = evaluate(right);
    assert.equal(left[0], q * left[2] + r, where);
    assert.ok(r >= 0 && r < left[2], where + ': Rest zu groß');
  } else {
    assert.equal(evaluate(left), evaluate(right), where);
  }
  return nums;
}

module.exports = { inputs, opsOf, fresh, expectedValues, play, playPath, evaluate, assertTrueEquation, Tasks, Check, UI };
