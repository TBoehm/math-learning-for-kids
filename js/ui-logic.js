/*
 * Logik der Oberfläche ohne DOM: Eingaben säubern, Zahlenfeld, was nach dem Prüfen
 * mit den Feldern passiert, Texte des Begleiters.
 * Reine Funktionen – getestet in tests/ui-logic.test.js.
 */
(function (root) {
  'use strict';

  var node = typeof module !== 'undefined' && module.exports;
  var Tasks = node ? require('./tasks.js') : root.RR.Tasks;
  var Check = node ? require('./check.js') : root.RR.Check;

  // ---------- Texte ----------
  var TEXTS = {
    rowOk: ['Richtig!', 'Genau!', 'Super!', 'Prima!', 'Stimmt!', 'Klasse!', 'Jawoll!', 'Toll!'],
    perfect: ['Wieherrrvorragend! 🐴', 'Zauberhaft gerechnet! ✨', 'Du bist ein Rechen-Star! ⭐',
      'Galoppierend gut! 🏇', 'Einhorn-mäßig super! 🦄', 'Volltreffer! 🎯', 'Regenbogen-stark! 🌈'],
    solved: ['Geschafft! Fehler machen schlau. 💪', 'Super, du hast nicht aufgegeben! 🌈',
      'Richtig! Übung macht den Meister. ⭐', 'Juhu, gelöst! 🎉'],
    oops: ['Fast! Schau noch mal genau hin. 🔍', "Hoppla! Probier's noch einmal. 🐎",
      'Nicht ganz – du schaffst das! 💪', 'Hmm, rechne noch mal nach. 🤔'],
    poke: ['Hihi, das kitzelt! 🦄', 'Ich mag Zahlen fast so gern wie Möhren! 🥕',
      'Zusammen rechnen macht Spaß! 💖', 'Wiehern ist meine Lieblingssprache! 🐴',
      'Ich glaub an dich! ⭐', 'Jede Aufgabe macht dich stärker! 💪']
  };

  /** Zufälliges Element; rnd ist austauschbar (Standard: Math.random). */
  function pick(list, rnd) { return list[Math.floor((rnd || Math.random)() * list.length)]; }

  // ---------- Eingabe ----------
  var DIGITS = 4; // bis 1000
  /** Nur Ziffern, höchstens vier. */
  function sanitize(value) { return String(value).replace(/[^0-9]/g, '').slice(0, DIGITS); }

  /**
   * Taste im Zahlenfeld: Ziffer anhängen (max. 4) oder ⌫ löschen.
   * fresh: Feld wurde gerade geprüft – dann ersetzt die erste Taste den Inhalt.
   */
  function applyKey(value, fresh, key) {
    if (fresh) value = '';
    if (key === '⌫') return value.slice(0, -1);
    return value.length < DIGITS ? value + key : value;
  }

  /** Feld für das Zahlenfeld: zuletzt gewähltes, sonst erstes leeres, sonst erstes änderbares. */
  function pickTarget(cells, last) {
    var open = cells.filter(function (c) { return !c.readOnly; });
    if (last && open.indexOf(last) >= 0) return last;
    return open.filter(function (c) { return !c.value; })[0] || open[0] || null;
  }

  /** Bildschirmtastatur unterdrücken, wenn das Zahlenfeld auf einem Touch-Gerät da ist. */
  function inputMode(numpadVisible, coarse) { return numpadVisible && coarse ? 'none' : 'numeric'; }

  // ---------- Nach dem Prüfen ----------
  /**
   * Was mit einem Feld nach dem Prüfen passiert.
   * -> { cls: 'ok' | 'bad' | '', shake, locked: nicht mehr änderbar, fresh: nächste Eingabe ersetzt }
   */
  function fieldEffect(status) {
    if (status === 'correct') return { cls: 'ok', shake: false, locked: true, fresh: false };
    // hängt von einem falschen Feld ab: nicht markieren, aber änderbar lassen
    if (status === 'pending') return { cls: '', shake: false, locked: false, fresh: true };
    return { cls: 'bad', shake: true, locked: false, fresh: true };
  }

  /**
   * Ergebnis von Check.checkRow für die Oberfläche deuten.
   * -> { kind: 'empty' | 'incomplete' | 'correct' | 'wrong', mistake: zählt als Fehler, focus: Feldnummer oder null }
   * Leere Felder zählen nie als Fehler.
   */
  function outcome(result) {
    var st = result.fields.map(function (f) { return f.status; });
    if (!result.complete) {
      var empty = st.indexOf('empty');
      return { kind: st.every(function (s) { return s === 'empty'; }) ? 'empty' : 'incomplete', mistake: false, focus: empty };
    }
    if (result.correct) return { kind: 'correct', mistake: false, focus: null };
    var bad = st.findIndex(function (s) { return s !== 'correct' && s !== 'pending'; });
    return { kind: 'wrong', mistake: true, focus: bad < 0 ? null : bad };
  }

  /** Text nach dem n-ten Fehlversuch in einer Zeile: Ermutigung, Tipp, Tipp + Lösung. texts: Texte der Welt */
  function wrongText(row, result, rowMistakes, pickFn, texts) {
    var level = Check.hintLevel(rowMistakes);
    if (level === 'encourage') return (pickFn || pick)((texts || TEXTS).oops);
    if (level === 'hint') return 'Tipp: ' + row.hint;
    var sol = Check.solutionText(row, result);
    return sol ? row.hint + ' Die Lösung ist ' + sol + '.' : row.hint;
  }

  /** Text nach einer richtigen Zeile: ein Rat geht vor, sonst Lob und der nächste Schritt. */
  function rowDoneText(row, next, vals, pickFn, texts) {
    var advice = row.advice ? row.advice(vals) : null;
    return advice || (pickFn || pick)((texts || TEXTS).rowOk) + (next && next.label ? ' Weiter: ' + next.label + '.' : '');
  }

  // ---------- Texte zur Aufgabe ----------
  /** Namen der Eingabefelder einer Zeile, z. B. "Zehner: 1. Zahl". */
  function cellLabels(row) {
    var n = 0;
    return row.tokens.filter(function (t) { return t.t === 'in' || t.t === 'choice'; }).map(function () {
      n++;
      return (row.label ? row.label + ': ' : '') + n + '. Zahl';
    });
  }

  /** Schild über der Aufgabe, z. B. "Stellenweise · Alles selbst". */
  function badgeText(task) {
    var lvl = Tasks.LEVELS.filter(function (l) { return l.key === task.level; })[0];
    return task.strategyName + ' · ' + lvl.name;
  }

  /** Einleitung des Begleiters; greetName: Name für die Anrede oder ''. Eigene Aufgabenarten bringen task.intro mit. */
  function introText(task, greetName) {
    var intro = task.intro || {
      stellenweise: 'rechne stellenweise: Zehner und Einer getrennt.',
      schrittweise: task.op === '+' ? 'rechne schrittweise: erst die Zehner dazu, dann die Einer.'
        : 'rechne schrittweise: erst die Zehner weg, dann die Einer.',
      hilfsaufgabe: 'nimm eine Hilfsaufgabe mit einer glatten Zahl.',
      ergaenzen: 'ergänze von ' + task.b + ' bis ' + task.a + '. Wie weit musst du springen?',
      zerlegen: task.op === ':' ? 'zerlege ' + task.a + ' in zwei leichte Teile.' : 'zerlege die Malaufgabe in zwei leichte.',
      kernaufgaben: 'nutze eine leichte Kernaufgabe.'
    }[task.strategy] || '';
    if (task.level === 'selbst') intro += ' Schreib jeden Schritt selbst auf. ✏️';
    return greetName ? greetName + ', ' + intro : intro.charAt(0).toUpperCase() + intro.slice(1);
  }

  /** Begrüßung nach dem Willkommens-Dialog. */
  function welcomeText(name, companionName) {
    return (name ? 'Hallo ' + name + '! ' : 'Hallo! ') + 'Ich bin ' + companionName + '. Lass uns zusammen rechnen! 🌈';
  }
  function cleanName(value) { return String(value).trim().slice(0, 20); }

  /**
   * Was passiert nach einer richtigen Zeile?
   * 'finish' (gelöst) | 'next' (nächste Zeile) | 'append' (das Kind verlängert die Rechnung:
   * task.nextRow liefert die nächste Zeile) | 'stuck' (sollte nicht vorkommen)
   */
  function afterCorrect(task, vals, i) {
    if (Check.isSolved(task, vals)) return 'finish';
    if (i + 1 < task.rows.length) return 'next';
    if (typeof task.nextRow === 'function') return 'append';
    return 'stuck';
  }

  var api = {
    afterCorrect: afterCorrect,
    TEXTS: TEXTS, pick: pick, sanitize: sanitize, applyKey: applyKey, pickTarget: pickTarget, inputMode: inputMode,
    fieldEffect: fieldEffect, outcome: outcome, wrongText: wrongText, rowDoneText: rowDoneText,
    cellLabels: cellLabels, badgeText: badgeText, introText: introText, welcomeText: welcomeText, cleanName: cleanName
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RR = Object.assign(root.RR || {}, { UI: api });
})(typeof window !== 'undefined' ? window : this);
