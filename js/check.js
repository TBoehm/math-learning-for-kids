/*
 * Prüf-Logik: Eingaben eines Kindes lesen und eine Zeile einer Aufgabe bewerten.
 * Reine Funktionen ohne DOM – getestet in tests/check.test.js.
 */
(function (root) {
  'use strict';

  /** '' -> null, gültige Zahl (max. 3 Ziffern) -> Zahl, alles andere -> NaN */
  function parseNumber(raw) {
    if (raw === undefined || raw === null) return null;
    var s = String(raw).trim();
    if (s === '') return null;
    if (!/^[0-9]{1,3}$/.test(s)) return NaN;
    return parseInt(s, 10);
  }

  function inputsOf(row) {
    return row.tokens.filter(function (t) { return t.t === 'in'; });
  }

  /** Erwarteter Wert eines Feldes, abhängig von bereits richtigen Werten. */
  function expectedOf(tok, vals) {
    return typeof tok.expected === 'function' ? tok.expected(vals) : tok.answer;
  }

  /**
   * Bewertet eine Zeile.
   * raw:  { feldId: 'eingegebener Text' }
   * vals: bereits gesicherte Werte aus früheren Zeilen (wird nicht verändert)
   * -> { complete, correct, fields: [{id, status, value}], vals }
   *    status: 'correct' | 'wrong' | 'empty' | 'invalid'
   *    vals:   bei richtiger Zeile inkl. der neuen Werte, sonst unverändert
   */
  function checkRow(row, raw, vals) {
    raw = raw || {};
    var tmp = Object.assign({}, vals);
    var fields = [];
    var complete = true, allOk = true;
    inputsOf(row).forEach(function (tok) {
      var v = parseNumber(raw[tok.id]);
      var status;
      if (v === null) { status = 'empty'; complete = false; }
      else if (Number.isNaN(v)) status = 'invalid';
      else status = tok.check(v, tmp) ? 'correct' : 'wrong';
      if (status !== 'correct') allOk = false;
      if (status === 'correct' || status === 'wrong') tmp[tok.id] = v;
      fields.push({ id: tok.id, status: status, value: Number.isNaN(v) ? null : v });
    });
    var correct = complete && allOk;
    return { complete: complete, correct: correct, fields: fields, vals: correct ? tmp : Object.assign({}, vals) };
  }

  /** Aufgabe gelöst, wenn das Endergebnis-Feld gesichert ist. */
  function isSolved(task, vals) {
    return !!vals && vals.res === task.answer &&
      task.rows.every(function (row) {
        return inputsOf(row).every(function (tok) { return tok.id in vals; });
      });
  }

  /** Wie viel Hilfe nach n Fehlversuchen in einer Zeile? */
  function hintLevel(n) {
    if (n <= 0) return 'none';
    if (n === 1) return 'encourage';
    if (n === 2) return 'hint';
    return 'solution';
  }

  /** Lösungen der noch nicht richtigen Felder als Text, z. B. "40 und 30". */
  function solutionText(row, result) {
    var known = {}, ok = true;
    Object.keys(result.vals).forEach(function (k) { known[k] = result.vals[k]; });
    var parts = [];
    inputsOf(row).forEach(function (tok, i) {
      var f = result.fields[i];
      if (f.status === 'correct') { known[tok.id] = f.value; return; }
      // Hängt das Feld von einem falschen Feld ab, nehmen wir die Musterlösung.
      var exp = ok ? expectedOf(tok, known) : tok.answer;
      parts.push(String(exp));
      known[tok.id] = exp;
      ok = false;
    });
    if (parts.length <= 1) return parts.join('');
    return parts.slice(0, -1).join(', ') + ' und ' + parts[parts.length - 1];
  }

  var api = { parseNumber: parseNumber, checkRow: checkRow, isSolved: isSolved, hintLevel: hintLevel, solutionText: solutionText };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RR = Object.assign(root.RR || {}, { Check: api });
})(typeof window !== 'undefined' ? window : this);
