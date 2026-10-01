// Logik der Oberfläche ohne DOM: Eingaben, Zahlenfeld, Rückmeldungen, Texte (js/ui-logic.js).
'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const UI = require('../js/ui-logic.js');
const Tasks = require('../js/tasks.js');
const Check = require('../js/check.js');

const T = (v) => ({ t: 'txt', v });
const N = (v) => ({ t: 'num', v });
const I = (id, answer) => ({ t: 'in', id, answer, check: (x) => x === answer });
const first = (list) => list[0];
const inputs = (row) => row.tokens.filter((t) => t.t === 'in');

describe('Eingabe ins Feld', () => {
  test('Buchstaben und Zeichen werden entfernt', () => {
    assert.equal(UI.sanitize('a7b'), '7');
    assert.equal(UI.sanitize('-4,5'), '45');
    assert.equal(UI.sanitize(' 1 2 '), '12');
    assert.equal(UI.sanitize(''), '');
  });
  test('höchstens vier Ziffern (bis 1000)', () => {
    assert.equal(UI.sanitize('12345'), '1234');
    assert.equal(UI.sanitize('100'), '100');
  });
});

describe('Zahlenfeld', () => {
  test('Ziffern werden angehängt', () => {
    assert.equal(UI.applyKey('', false, '4'), '4');
    assert.equal(UI.applyKey('4', false, '7'), '47');
  });
  test('höchstens vier Ziffern', () => {
    assert.equal(UI.applyKey('1000', false, '5'), '1000');
  });
  test('⌫ löscht die letzte Ziffer', () => {
    assert.equal(UI.applyKey('47', false, '⌫'), '4');
    assert.equal(UI.applyKey('', false, '⌫'), '');
  });
  test('nach dem Prüfen ("frisch") ersetzt die erste Ziffer den alten Inhalt', () => {
    assert.equal(UI.applyKey('46', true, '7'), '7');
    assert.equal(UI.applyKey('100', true, '7'), '7', 'auch bei drei Ziffern');
    assert.equal(UI.applyKey('46', true, '⌫'), '');
  });

  test('Zielfeld: zuletzt gewähltes Feld, sonst das erste leere', () => {
    const a = { value: '40', readOnly: false }, b = { value: '', readOnly: false }, c = { value: '', readOnly: false };
    assert.equal(UI.pickTarget([a, b, c], c), c);
    assert.equal(UI.pickTarget([a, b, c], null), b);
    assert.equal(UI.pickTarget([a, b, c], { value: '', readOnly: false }), b, 'Feld aus einer anderen Zeile zählt nicht');
  });
  test('Zielfeld: gesperrte (richtige) Felder werden übersprungen', () => {
    const a = { value: '40', readOnly: true }, b = { value: '3', readOnly: false };
    assert.equal(UI.pickTarget([a, b], a), b);
    assert.equal(UI.pickTarget([a], a), null);
    assert.equal(UI.pickTarget([], null), null);
  });

  test('Bildschirmtastatur nur aus, wenn das Zahlenfeld auf einem Touch-Gerät da ist', () => {
    assert.equal(UI.inputMode(true, true), 'none');
    assert.equal(UI.inputMode(true, false), 'numeric');
    assert.equal(UI.inputMode(false, true), 'numeric');
    assert.equal(UI.inputMode(false, false), 'numeric');
  });
});

describe('Felder nach dem Prüfen', () => {
  test('richtig: grün und gesperrt', () => {
    assert.deepEqual(UI.fieldEffect('correct'), { cls: 'ok', shake: false, locked: true, fresh: false });
  });
  test('falsch oder ungültig: rot, wackelt, bleibt änderbar, nächste Ziffer ersetzt', () => {
    for (const s of ['wrong', 'invalid']) {
      assert.deepEqual(UI.fieldEffect(s), { cls: 'bad', shake: true, locked: false, fresh: true }, s);
    }
  });
  test('wartend (hängt von einem falschen Feld ab): bleibt änderbar und unmarkiert', () => {
    assert.deepEqual(UI.fieldEffect('pending'), { cls: '', shake: false, locked: false, fresh: true });
  });
  test('Profi-Division mit falscher Zerlegung: das zweite Feld wird nicht gesperrt', () => {
    // Aufgabe gezielt wählen: Zehner des Dividenden nicht durch den Teiler teilbar
    let t;
    do { t = Tasks.generate({ op: ':', level: 'zerlegen' }); } while ((Math.floor(t.a / 10) * 10) % t.b === 0);
    // erste Teilaufgabe [p1] : d = [q1] – der Teil ist falsch, das Ergebnisfeld bleibt änderbar
    const row = t.rows[0], [p1, q1] = inputs(row), tens = Math.floor(t.a / 10) * 10;
    const r = Check.checkRow(row, { [p1.id]: String(tens), [q1.id]: String(Math.floor(tens / t.b)) }, {});
    const fx = r.fields.map((f) => UI.fieldEffect(f.status));
    assert.equal(fx[0].cls, 'bad');
    assert.equal(fx[1].locked, false, 'zweites Feld bleibt änderbar');
  });
});

describe('Was passiert nach dem Prüfen?', () => {
  const row = { label: 'Zehner', hint: 'Rechne die Zehner.', tokens: [I('a', 40), T('+'), I('b', 30), T('='), I('z', 70)] };
  const check = (a, b, z) => Check.checkRow(row, { a, b, z }, {});

  test('alles leer: kein Fehler, Hinweis "Trag zuerst …", erstes Feld', () => {
    assert.deepEqual(UI.outcome(check('', '', '')), { kind: 'empty', mistake: false, focus: 0 });
  });
  test('teilweise leer: kein Fehler, weiter zum ersten leeren Feld', () => {
    assert.deepEqual(UI.outcome(check('40', '', '')), { kind: 'incomplete', mistake: false, focus: 1 });
    assert.deepEqual(UI.outcome(check('41', '30', '')), { kind: 'incomplete', mistake: false, focus: 2 }, 'auch nicht, wenn eine Zahl falsch ist');
  });
  test('richtig: kein Fehler', () => {
    assert.deepEqual(UI.outcome(check('40', '30', '70')), { kind: 'correct', mistake: false, focus: null });
  });
  test('falsch: ein Fehler, Fokus aufs erste falsche Feld (nicht auf wartende)', () => {
    assert.deepEqual(UI.outcome(check('40', '31', '70')), { kind: 'wrong', mistake: true, focus: 1 });
    assert.deepEqual(UI.outcome(check('40', 'x', '70')), { kind: 'wrong', mistake: true, focus: 1 }, 'ungültig zählt wie falsch');
  });
});

describe('Rückmeldung nach einem Fehler', () => {
  const row = { label: 'Zehner', hint: 'Rechne die Zehner.', tokens: [N(40), T('+'), N(30), T('='), I('z', 70)] };
  const wrong = Check.checkRow(row, { z: '71' }, {});

  test('1. Fehler: Ermutigung ohne Tipp und Lösung', () => {
    const text = UI.wrongText(row, wrong, 1, first);
    assert.equal(text, UI.TEXTS.oops[0]);
    assert.doesNotMatch(text, /Tipp|Lösung/);
  });
  test('2. Fehler: Tipp', () => {
    assert.equal(UI.wrongText(row, wrong, 2, first), 'Tipp: Rechne die Zehner.');
  });
  test('ab dem 3. Fehler: Tipp und Lösung', () => {
    assert.equal(UI.wrongText(row, wrong, 3, first), 'Rechne die Zehner. Die Lösung ist 70.');
    assert.equal(UI.wrongText(row, wrong, 5, first), 'Rechne die Zehner. Die Lösung ist 70.');
  });
  test('ohne eigene Auswahl wird zufällig ermutigt', () => {
    assert.ok(UI.TEXTS.oops.includes(UI.wrongText(row, wrong, 1)));
  });
});

describe('Rückmeldung nach einer richtigen Zeile', () => {
  const row = { label: 'Zehner', tokens: [] };
  test('Lob und der nächste Schritt', () => {
    assert.equal(UI.rowDoneText(row, { label: 'Einer' }, {}, first), UI.TEXTS.rowOk[0] + ' Weiter: Einer.');
  });
  test('ohne Namen des nächsten Schritts nur Lob', () => {
    assert.equal(UI.rowDoneText(row, { label: '' }, {}, first), UI.TEXTS.rowOk[0]);
    assert.equal(UI.rowDoneText(row, undefined, {}, first), UI.TEXTS.rowOk[0]);
  });
  test('ein Rat (umständliche Zerlegung) geht vor', () => {
    const advised = { label: 'Zerlegen', advice: (vals) => (vals.p1 === 6 ? 'Mit 60 + 24 geht es leichter.' : null) };
    assert.equal(UI.rowDoneText(advised, { label: 'Teilen' }, { p1: 6 }, first), 'Mit 60 + 24 geht es leichter.');
    assert.equal(UI.rowDoneText(advised, { label: 'Teilen' }, { p1: 60 }, first), UI.TEXTS.rowOk[0] + ' Weiter: Teilen.');
  });
  test('Profi-Division mit "Teiler + Rest": angenommen ohne Fehler, aber mit Rat', () => {
    let t;
    do { t = Tasks.generate({ op: ':', level: 'zerlegen' }); }
    while (Tasks.isEasySplit(t.b, t.a - t.b, t.b) || t.rows.filter((x) => /Teil$/.test(x.label)).length !== 2);
    // 1. Teil: [d] : d = [1], 2. Teil: der Rest – richtig, aber umständlich
    let r = Check.checkRow(t.rows[0], { p1: String(t.b), q1: '1' }, {});
    assert.equal(UI.outcome(r).mistake, false);
    const last = t.rows[1], left = t.a - t.b;
    const raw = { p2: String(left), q2: String(Math.floor(left / t.b)) };
    if (t.rest) raw.r = String(left % t.b);
    r = Check.checkRow(last, raw, r.vals);
    assert.equal(UI.outcome(r).mistake, false);
    assert.match(UI.rowDoneText(last, t.rows[2], r.vals, first), /leichter/);
  });
});

describe('Name einer fertigen Zeile', () => {
  test('ohne labelDone bleibt der Name', () => {
    assert.equal(UI.doneLabel({ label: 'Zehner', tokens: [] }, {}), 'Zehner');
  });
  test('labelDone benennt die Zeile nach dem, was das Kind gerechnet hat', () => {
    const row = { label: 'Eine Stelle', tokens: [], labelDone: (vals) => (vals.sx1 === 6 ? 'Einer' : null) };
    assert.equal(UI.doneLabel(row, { sx1: 6 }), 'Einer');
    assert.equal(UI.doneLabel(row, { sx1: 7 }), 'Eine Stelle');
  });
  test('Stellenweise, alles selbst: erst die Einer gerechnet -> "Einer"', () => {
    const t = Tasks.build('+', 'stellenweise', 47, 38, { level: 'selbst', max: 100 });
    const r = Check.checkRow(t.rows[0], { sx1: '8', sy1: '7', z1: '15' }, {});
    assert.equal(r.correct, true);
    assert.equal(UI.doneLabel(t.rows[0], r.vals), 'Einer');
  });
});

describe('Namen der Eingabefelder (für Screenreader)', () => {
  test('Zeilenname und Nummer der Zahl', () => {
    const t = Tasks.generate({ op: '+', strategy: 'stellenweise', level: 'zerlegen' });
    assert.deepEqual(UI.cellLabels(t.rows[0]), ['Zehner: 1. Zahl', 'Zehner: 2. Zahl', 'Zehner: 3. Zahl']);
  });
  test('vorgegebene Zahlen werden nicht mitgezählt', () => {
    const row = { label: 'Zusammen', tokens: [N(40), T('+'), I('a', 7), T('='), I('b', 47)] };
    assert.deepEqual(UI.cellLabels(row), ['Zusammen: 1. Zahl', 'Zusammen: 2. Zahl']);
  });
  test('Zeile ohne Namen', () => {
    assert.deepEqual(UI.cellLabels({ tokens: [I('a', 1)] }), ['1. Zahl']);
  });
});

describe('Umbruch langer Zeilen', () => {
  const T = (v) => ({ t: 'txt', v }), N = (v) => ({ t: 'num', v }), I = (id) => ({ t: 'in', id });
  test('eine Malaufgabe bleibt zusammen: 5 · 198 = 5 · 200 − 5 · 2', () => {
    const toks = [N(5), T('·'), N(198), T('='), N(5), T('·'), I('G'), T('−'), N(5), T('·'), I('d')];
    assert.deepEqual(UI.eqGroups(toks), [[0, 1, 2], [3], [4, 5, 6], [7], [8, 9, 10]]);
  });
  test('Plus und Minus trennen, Rest bleibt beim Ergebnis', () => {
    assert.deepEqual(UI.eqGroups([N(47), T('+'), N(30), T('='), I('s1')]), [[0], [1], [2], [3], [4]]);
    assert.deepEqual(UI.eqGroups([N(27), T(':'), N(6), T('='), I('q'), T('R'), I('r')]), [[0, 1, 2], [3], [4, 5, 6]]);
  });
});

describe('Texte zur Aufgabe', () => {
  test('Schild: Rechenweg und Stufe', () => {
    assert.equal(UI.badgeText(Tasks.generate({ op: '+', strategy: 'stellenweise', level: 'selbst' })), 'Stellenweise · Alles selbst');
    assert.equal(UI.badgeText(Tasks.generate({ op: ':', level: 'hilfe' })), 'Zerlegen · Mit Hilfe');
    assert.equal(UI.badgeText(Tasks.generate({ op: '−', strategy: 'ergaenzen', level: 'zerlegen' })), 'Ergänzen · Zerlegung selbst');
  });

  const task = (extra) => Object.assign({ op: '+', a: 47, b: 38, level: 'hilfe' }, extra);
  test('Einleitung je Rechenweg, groß geschrieben', () => {
    assert.equal(UI.introText(task({ strategy: 'stellenweise' }), ''), 'Rechne stellenweise: Zehner und Einer getrennt.');
    assert.equal(UI.introText(task({ strategy: 'schrittweise' }), ''), 'Rechne schrittweise: erst die Zehner dazu, dann die Einer.');
    assert.equal(UI.introText(task({ strategy: 'schrittweise', op: '−' }), ''), 'Rechne schrittweise: erst die Zehner weg, dann die Einer.');
    assert.equal(UI.introText(task({ strategy: 'hilfsaufgabe' }), ''), 'Nimm eine Hilfsaufgabe mit einer glatten Zahl.');
    assert.equal(UI.introText(task({ strategy: 'ergaenzen', op: '−', a: 82, b: 37 }), ''), 'Ergänze von 37 bis 82. Wie weit musst du springen?');
    assert.equal(UI.introText(task({ strategy: 'zerlegen', op: ':', a: 84, b: 6 }), ''), 'Zerlege 84 in leichte Teile.');
    assert.equal(UI.introText(task({ strategy: 'zerlegen', op: '·' }), ''), 'Zerlege die Malaufgabe in zwei leichte.');
    assert.equal(UI.introText(task({ strategy: 'kernaufgaben', op: '·' }), ''), 'Nutze eine leichte Kernaufgabe.');
    assert.equal(UI.introText(task({ strategy: 'vereinfachen' }), ''), 'Vereinfache: Eine Zahl gibt der anderen etwas ab, bis eine glatt ist.');
    assert.equal(UI.introText(task({ strategy: 'vereinfachen', op: '−' }), ''), 'Vereinfache: Verändere beide Zahlen um gleich viel, bis eine glatt ist.');
  });
  test('bis 1000: auch die Hunderter', () => {
    assert.equal(UI.introText(task({ strategy: 'stellenweise', max: 1000, a: 346, b: 228 }), ''), 'Rechne stellenweise: Hunderter, Zehner und Einer getrennt.');
    assert.equal(UI.introText(task({ strategy: 'schrittweise', max: 1000, a: 346, b: 228 }), ''), 'Rechne schrittweise: erst die Hunderter dazu, dann die Zehner, dann die Einer.');
    assert.equal(UI.introText(task({ strategy: 'schrittweise', op: '−', max: 1000, a: 685, b: 47 }), ''), 'Rechne schrittweise: erst die Zehner weg, dann die Einer.');
  });
  test('mit Namen: "Mia, rechne …"', () => {
    assert.equal(UI.introText(task({ strategy: 'stellenweise' }), 'Mia'), 'Mia, rechne stellenweise: Zehner und Einer getrennt.');
  });
  test('"Alles selbst": Aufforderung, jeden Schritt aufzuschreiben', () => {
    assert.equal(UI.introText(task({ strategy: 'kernaufgaben', op: '·', level: 'selbst' }), ''),
      'Nutze eine leichte Kernaufgabe. Schreib jeden Schritt selbst auf. ✏️');
  });
  test('eigene Einleitung einer Knobel-Aufgabe (task.intro) geht vor, ohne "Schreib jeden Schritt"', () => {
    const t = task({ strategy: 'zahlenmauer', level: 'selbst', intro: 'fang unten an! 🧱' });
    assert.equal(UI.introText(t, ''), 'Fang unten an! 🧱');
    assert.equal(UI.introText(t, 'Mia'), 'Mia, fang unten an! 🧱');
  });
  test('jeder Rechenweg hat eine Einleitung', () => {
    for (const op of Tasks.OPS) {
      for (const s of Tasks.STRATEGIES[op]) {
        assert.match(UI.introText(Tasks.generate({ op, strategy: s.key, level: 'hilfe' }), ''), /^[A-ZÄÖÜ].+[.?]$/, op + ' ' + s.key);
      }
    }
  });
});

describe('Begrüßung', () => {
  test('mit und ohne Namen', () => {
    assert.equal(UI.welcomeText('Mia', 'Blitz', '🌈'), 'Hallo Mia! Ich bin Blitz. Lass uns zusammen rechnen! 🌈');
    assert.equal(UI.welcomeText('', 'Luna', '🌈'), 'Hallo! Ich bin Luna. Lass uns zusammen rechnen! 🌈');
    // das Symbol kommt aus der Welt – in der Werkstatt kein Regenbogen
    assert.equal(UI.welcomeText('Tom', 'Bruno', '🔧'), 'Hallo Tom! Ich bin Bruno. Lass uns zusammen rechnen! 🔧');
    assert.equal(UI.welcomeText('Tom', 'Bruno'), 'Hallo Tom! Ich bin Bruno. Lass uns zusammen rechnen!');
  });
  test('Name: ohne Leerzeichen am Rand, höchstens 20 Zeichen', () => {
    assert.equal(UI.cleanName('  Mia '), 'Mia');
    assert.equal(UI.cleanName('Maximiliane-Josefine-Luise'), 'Maximiliane-Josefine');
  });
});

describe('Zufallsauswahl', () => {
  test('pick nimmt ein Element passend zur Zufallszahl', () => {
    assert.equal(UI.pick(['a', 'b', 'c'], () => 0), 'a');
    assert.equal(UI.pick(['a', 'b', 'c'], () => 0.99), 'c');
    assert.ok(['a', 'b'].includes(UI.pick(['a', 'b'])));
  });
});

describe('Ersatztexte ohne Welt', () => {
  test('passen zu jeder Welt: keine Einhörner, Pferde oder Regenbogen', () => {
    assert.doesNotMatch(JSON.stringify(UI.TEXTS), /🦄|🐴|🐎|🏇|🌈|Wieher|Galopp|Einhorn|Regenbogen|Möhren/);
  });
});

describe('Aktive Zeile ins Bild holen (nicht hinter dem Zahlenfeld)', () => {
  // Sichtbarer Bereich: 8 bis 700 (darunter liegt das Zahlenfeld)
  test('sichtbar: nicht scrollen', () => {
    assert.equal(UI.revealDelta(100, 300, 8, 700), 0);
  });
  test('unten verdeckt: so weit hoch, dass die Zeile über dem Zahlenfeld steht', () => {
    assert.equal(UI.revealDelta(535, 804, 8, 700), 104);
  });
  test('zu hoch für den Platz: oben bündig, nicht über den Anfang hinaus', () => {
    assert.equal(UI.revealDelta(400, 1200, 8, 700), 392);
  });
  test('oben verdeckt: zurückscrollen', () => {
    assert.equal(UI.revealDelta(-50, 100, 8, 700), -58);
  });
});
