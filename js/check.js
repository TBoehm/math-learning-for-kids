/*
 * Prüf-Logik: Eingaben eines Kindes lesen und eine Zeile einer Aufgabe bewerten.
 * Reine Funktionen ohne DOM – getestet in tests/check.test.js.
 */
(function (root) {
  'use strict';

  /** '' -> null, gültige Zahl (max. 4 Ziffern, bis 1000 reicht das) -> Zahl, alles andere -> NaN */
  function parseNumber(raw) {
    if (raw === undefined || raw === null) return null;
    var s = String(raw).trim();
    if (s === '') return null;
    if (!/^[0-9]{1,4}$/.test(s)) return NaN;
    return parseInt(s, 10);
  }

  function inputsOf(row) {
    // Eingabefelder und Auswahlfelder (Wert = Nummer der gewählten Antwort)
    return row.tokens.filter(function (t) { return t.t === 'in' || t.t === 'choice'; });
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
   *            | 'pending' (hängt von einem Feld ab, das noch nicht stimmt)
   *    vals:   bei richtiger Zeile inkl. der neuen Werte, sonst unverändert
   */
  function checkRow(row, raw, vals) {
    raw = raw || {};
    var tmp = Object.assign({}, vals);
    var fields = [];
    var complete = true, allOk = true, inRow = {};
    inputsOf(row).forEach(function (tok) {
      var v = parseNumber(raw[tok.id]);
      // leer gelassen und das bedeutet etwas (z. B. kein Übertrag): blank ist der Wert,
      // als Funktion aus den schon richtigen Werten berechnet (z. B. Ergebnis aus seinen Ziffern)
      if (v === null && tok.blank !== undefined && tok.blank !== null) {
        v = typeof tok.blank === 'function' ? tok.blank(tmp) : tok.blank;
      }
      var blocked = (tok.deps || []).some(function (d) { return d in inRow && inRow[d] !== 'correct'; });
      var status;
      if (v === null) { status = 'empty'; complete = false; }
      else if (Number.isNaN(v)) status = 'invalid';
      else if (blocked) status = 'pending';
      else status = tok.check(v, tmp) ? 'correct' : 'wrong';
      inRow[tok.id] = status;
      if (status !== 'correct') allOk = false;
      if (status === 'correct') tmp[tok.id] = v;
      fields.push({ id: tok.id, status: status, value: Number.isNaN(v) ? null : v });
    });
    var correct = complete && allOk;
    return {
      complete: complete, correct: correct, fields: fields, vals: correct ? tmp : Object.assign({}, vals),
      why: correct ? null : diagnose(row, fields, tmp)
    };
  }

  // ---------- Warum passt die Zahl nicht? ----------
  var OPS = ['+', '−', '·', ':'];

  /** Zahlen und Rechenzeichen einer Seite ausrechnen (Punkt vor Strich); null, wenn es nicht aufgeht */
  function evaluate(xs) {
    var t = [xs[0]];
    for (var i = 1; i < xs.length; i += 2) {
      var o = xs[i], n = xs[i + 1];
      if (o === '·') t[t.length - 1] *= n;
      else if (o === ':') {
        if (!n || t[t.length - 1] % n) return null;
        t[t.length - 1] /= n;
      } else t.push(o, n);
    }
    var v = t[0];
    for (var k = 1; k < t.length; k += 2) v = t[k] === '+' ? v + t[k + 1] : v - t[k + 1];
    return v;
  }

  /**
   * Die Gleichung einer Zeile mit den Zahlen des Kindes als Text ("13 + 60 = 73"), wenn sie stimmt –
   * sonst null. Mit Rest: "50 : 8 = 6 R 2". Ein Text vorne (Ü:) bleibt stehen.
   */
  function trueEquation(row, values) {
    var shown = [], left = [], right = [], side = left, rest = null;
    for (var i = 0; i < row.tokens.length; i++) {
      var tok = row.tokens[i], v;
      if (tok.t === 'txt') {
        if (tok.v === '=') { if (side === right) return null; side = right; }
        else if (tok.v === 'R') { if (side !== right) return null; rest = []; }
        else if (OPS.indexOf(tok.v) >= 0) (rest || side).push(tok.v);
        else if (shown.length) return null;      // Text mitten in der Zeile: keine Gleichung
        shown.push(tok.v);
        continue;
      }
      if (tok.t === 'num') v = tok.v;
      else if (tok.t === 'ref' || tok.t === 'in') v = values[tok.id];
      else return null;
      if (typeof v !== 'number') return null;
      (rest || side).push(v);
      shown.push(v);
    }
    if (!left.length || !right.length || (left.length + right.length) % 2) return null;
    if (rest) {
      // a : d = q R r heißt a = q · d + r mit r < d
      if (left.length !== 3 || left[1] !== ':' || right.length !== 1 || rest.length !== 1) return null;
      if (!(rest[0] < left[2] && left[0] === right[0] * left[2] + rest[0])) return null;
    } else {
      var l = evaluate(left);
      if (l === null || l !== evaluate(right)) return null;
    }
    return shown.join(' ');
  }

  function capital(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  /** nach "…, aber": klein weiter (Sätze der Gründe beginnen nie mit einem Nomen) */
  function small(s) { return s.charAt(0).toLowerCase() + s.slice(1); }

  /**
   * Rückmeldung zu einer falschen Zeile – oder null (dann ermutigt der Begleiter nur).
   * Felder können einen Grund liefern: tok.why(wert, werte) -> Satz, warum die Zahl nicht passt,
   * und welche Zahl passt (z. B. die nähere). Stimmt die Rechnung mit den Zahlen des Kindes
   * (13 + 60 = 73), wird das zuerst gesagt – der Fehler steckt dann in der Wahl der Zahl.
   */
  function diagnose(row, fields, known) {
    var ins = inputsOf(row), kid = Object.assign({}, known), wrong = [], filled = true;
    fields.forEach(function (f, i) {
      if (f.value === null) filled = false; else kid[f.id] = f.value;
      if (f.status === 'wrong') wrong.push({ tok: ins[i], v: f.value });
    });
    if (!wrong.length) return null;
    var reason = null;
    for (var i = 0; i < wrong.length && !reason; i++) {
      if (typeof wrong[i].tok.why !== 'function') continue;
      try { reason = wrong[i].tok.why(wrong[i].v, Object.assign({}, known)) || null; } catch (e) { reason = null; }
    }
    var eq = filled ? trueEquation(row, kid) : null;
    if (eq) {
      return eq + ' stimmt, aber ' + (reason ? small(reason)
        : (wrong[0].tok.t === 'in' ? wrong[0].v + ' passt hier nicht.' : 'das passt hier nicht.') + (row.hint ? ' ' + row.hint : ''));
    }
    return reason ? capital(reason) : null;
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

  /**
   * Lösungen der noch nicht richtigen Felder als Text, z. B. "40 und 30".
   * Nicht genannt werden versteckte Felder (silent) und Felder, die leer bleiben sollen (blank).
   */
  function solutionText(row, result) {
    var known = {}, ok = true;
    Object.keys(result.vals).forEach(function (k) { known[k] = result.vals[k]; });
    var parts = [];
    inputsOf(row).forEach(function (tok, i) {
      var f = result.fields[i];
      if (f.status === 'correct') { known[tok.id] = f.value; return; }
      // Hängt das Feld von einem falschen Feld ab, nehmen wir die Musterlösung.
      var exp = ok ? expectedOf(tok, known) : tok.answer;
      // Auswahlfeld: die Antwort selbst nennen, nicht ihre Nummer; stille/leer erlaubte Felder auslassen
      if (!tok.silent && !(typeof tok.blank === 'number' && exp === tok.blank)) {
        parts.push(String(tok.t === 'choice' ? tok.options[exp] : exp));
      }
      known[tok.id] = exp;
      ok = false;
    });
    if (parts.length <= 1) return parts.join('');
    return parts.slice(0, -1).join(', ') + ' und ' + parts[parts.length - 1];
  }

  var api = { parseNumber: parseNumber, checkRow: checkRow, trueEquation: trueEquation, isSolved: isSolved, hintLevel: hintLevel, solutionText: solutionText };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RR = Object.assign(root.RR || {}, { Check: api });
})(typeof window !== 'undefined' ? window : this);
