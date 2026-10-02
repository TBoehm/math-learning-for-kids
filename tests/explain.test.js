// „So geht's“: Der Begleiter erklärt jeden Rechenweg an einem Beispiel (js/explain.js).
// Die Beispiele kommen aus dem echten Aufgaben-Generator (Stufe „Mit Hilfe“) und werden mit den Tipps
// der App erzählt – so passt die Erklärung immer zu dem, was die App beim Rechnen erwartet.
// Die Rechenwege und Beispiele stammen aus fachdidaktischen Quellen (KIRA, PIKAS, Mahiko – DZLM);
// die Tests unten prüfen, dass die App die dort gezeigten Rechnungen genau so aufschreibt.
'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const Explain = require('../js/explain.js');
const Tasks = require('../js/tasks.js');
const Check = require('../js/check.js');

const RANGES = [100, 1000];
/** alle Rechenwege, die eine Erklärung brauchen: halbschriftlich und schriftlich */
const ways = () => Tasks.OPS.flatMap((op) => Tasks.STRATEGIES[op]
  .filter((s) => s.group === 'weg' || s.group === 'schriftlich').map((s) => [op, s.key]));
/** Zeilen des Beispiels als Text, z. B. "300 + 400 = 700" */
const lines = (l) => l.task.rows.map((r) => Explain.rowText(r, l.vals));

describe('Für jeden Rechenweg gibt es eine Erklärung', () => {
  test('alle halbschriftlichen Rechenwege und schriftlichen Verfahren', () => {
    const all = ways();
    assert.ok(all.length >= 15, 'Rechenwege und schriftliche Verfahren gefunden');
    for (const [op, key] of all) assert.equal(Explain.has(op, key), true, op + ' ' + key);
  });
  test("Knobeleien und Unbekanntes haben keinen „So geht's“-Knopf", () => {
    for (const key of ['zahlenmauer', 'fehler', 'welcherweg', 'ueberschlag', 'gibtsnicht']) assert.equal(Explain.has('+', key), false, key);
    assert.equal(Explain.has('?', 'stellenweise'), false);
    assert.equal(Explain.lesson('+', 'zahlenmauer', 100), null);
  });
});

describe('Das Beispiel ist eine echte Aufgabe der App', () => {
  for (const [op, key] of ways()) {
    for (const max of RANGES) {
      test(`${op} ${key} bis ${max}`, () => {
        const l = Explain.lesson(op, key, max);
        const t = l.task;
        // passt in den Zahlenraum
        assert.ok(t.a <= max && t.b <= max && t.answer <= max, Tasks.taskText(t));
        if (max === 100) assert.ok(Object.values(l.vals).every((v) => v <= 100), 'alle Zahlen bis 100: ' + JSON.stringify(l.vals));
        // ganz gelöst, mit den Werten, die die App als richtig annimmt
        let vals = {};
        t.rows.forEach((row, i) => {
          const raw = {};
          row.tokens.filter((x) => x.t === 'in' || x.t === 'choice').forEach((x) => { raw[x.id] = String(l.vals[x.id]); });
          const r = Check.checkRow(row, raw, vals);
          assert.ok(r.correct, `Zeile ${i}: ${row.label}`);
          vals = r.vals;
        });
        assert.equal(Check.isSolved(t, l.vals), true);
        assert.equal(l.vals.res, t.answer);
        // Titel und Name wie im Rechenweg-Menü
        const s = Tasks.STRATEGIES[op].find((x) => x.key === key);
        assert.equal(l.name, s.name);
        assert.equal(l.title, "So geht's: " + s.name);
        // erst die Idee, dann jede Zeile mit dem Tipp der App, zum Schluss Tipps
        assert.equal(l.steps.length, t.rows.length + 2);
        assert.ok(l.steps[0].say.length > 40, 'Idee');
        t.rows.forEach((row, i) => {
          assert.equal(l.steps[i + 1].row, i);
          assert.equal(l.steps[i + 1].say, row.hint, 'der Begleiter sagt den Tipp der App');
        });
        assert.ok(l.steps[l.steps.length - 1].say.length > 20, 'Tipps zum Schluss');
      });
    }
  }
});

describe('Quellen', () => {
  // keine Lehrwerks- oder Verlagsnamen (CLAUDE.md)
  const VERBOTEN = /zahlenbuch|flex und flo|denken und rechnen|welt der zahl|mathefreunde|nussknacker|einstern|klett|westermann|cornelsen|schroedel|kallmeyer|oldenbourg|mildenberger/i;
  for (const [op, key] of ways()) {
    test(`${op} ${key}: Quellen für Erwachsene, kein Lehrwerk genannt`, () => {
      const l = Explain.lesson(op, key, 1000);
      assert.ok(l.note.length > 40, 'Hinweis für Erwachsene');
      assert.ok(l.sources.length >= 1);
      for (const s of l.sources) {
        assert.match(s.url, /^https:\/\/(kira|pikas|mahiko)\.dzlm\.de\//, s.url);
        assert.ok(s.title.length > 5);
      }
      const all = [l.note, ...l.steps.map((x) => x.say), ...l.sources.map((x) => x.title)].join(' ');
      assert.doesNotMatch(all, VERBOTEN);
    });
  }
});

describe('Die App rechnet wie in den Quellen', () => {
  // KIRA, Halbschriftliche Addition: 399 + 473 auf vier Wegen (Kinderlösungen von Paul, Özge, Ali und Can)
  test('399 + 473: Stellenweise, Schrittweise, Hilfsaufgabe, Vereinfachen', () => {
    assert.deepEqual(lines(Explain.lesson('+', 'stellenweise', 1000)), ['300 + 400 = 700', '90 + 70 = 160', '9 + 3 = 12', '700 + 160 + 12 = 872']);
    assert.deepEqual(lines(Explain.lesson('+', 'schrittweise', 1000)), ['399 + 400 = 799', '799 + 70 = 869', '869 + 3 = 872']);
    assert.deepEqual(lines(Explain.lesson('+', 'hilfsaufgabe', 1000)), ['400 + 473 = 873', '873 − 1 = 872']);
    assert.deepEqual(lines(Explain.lesson('+', 'vereinfachen', 1000)), ['399 + 473 = 400 + 472', '400 + 472 = 872']);
  });
  // KIRA: 19 + 39 – Sabrina rechnet stellenweise
  test('19 + 39 stellenweise (bis 100)', () => {
    assert.deepEqual(lines(Explain.lesson('+', 'stellenweise', 100)), ['10 + 30 = 40', '9 + 9 = 18', '40 + 18 = 58']);
  });
  // PIKAS, Halbschriftliche Strategien: 526 − 283 schrittweise
  test('526 − 283 schrittweise', () => {
    assert.deepEqual(lines(Explain.lesson('−', 'schrittweise', 1000)), ['526 − 200 = 326', '326 − 80 = 246', '246 − 3 = 243']);
  });
  // KIRA, Halbschriftliche Subtraktion: 773 − 299 gleichsinnig verändern (Konstanz der Differenz)
  test('773 − 299 vereinfachen: beide Zahlen + 1', () => {
    assert.deepEqual(lines(Explain.lesson('−', 'vereinfachen', 1000)), ['773 − 299 = 774 − 300', '774 − 300 = 474']);
  });
  // PIKAS: Ergänzen – von der kleinen Zahl zur großen springen, die Sprünge zusammenrechnen
  test('702 − 698 ergänzen', () => {
    assert.deepEqual(lines(Explain.lesson('−', 'ergaenzen', 1000)), ['698 + 2 = 700', '700 + 2 = 702', '2 + 2 = 4', '698 + 4 = 702']);
  });
  // KIRA, Halbschriftliche Multiplikation: Meike (9 · 29) zerlegt einen Faktor, Tim (5 · 49) nimmt eine Hilfsaufgabe
  test('9 · 29 zerlegen und 5 · 49 mit Hilfsaufgabe', () => {
    assert.deepEqual(lines(Explain.lesson('·', 'zerlegen', 1000)), ['9 · 29 = 9 · 20 + 9 · 9', '9 · 20 = 180', '9 · 9 = 81', '180 + 81 = 261']);
    assert.deepEqual(lines(Explain.lesson('·', 'hilfsaufgabe', 1000)), ['5 · 49 = 5 · 50 − 5 · 1', '5 · 50 = 250', '250 − 5 = 245']);
  });
  // Mahiko, Sicher im Einmaleins: „10 · 6 ist einfach. Das hilft mir bei 9 · 6.“ und 6 · 8 = 5 · 8 + 1 · 8
  test('Kernaufgaben: 9 · 6 und 6 · 8', () => {
    assert.deepEqual(lines(Explain.lesson('·', 'kernaufgaben', 1000)), ['9 · 6 = 10 · 6 − 1 · 6', '10 · 6 = 60', '1 · 6 = 6', '60 − 6 = 54']);
    assert.deepEqual(lines(Explain.lesson('·', 'kernaufgaben', 100)), ['6 · 8 = 5 · 8 + 1 · 8', '5 · 8 = 40', '1 · 8 = 8', '40 + 8 = 48']);
  });
  // KIRA, Halbschriftliche Division: 482 : 2 = 400 : 2 + 80 : 2 + 2 : 2
  test('482 : 2 in Stellen zerlegt, Probe mit der Malaufgabe', () => {
    const t = Tasks.build(':', 'zerlegen', 482, 2, { level: 'hilfe', max: 1000 });
    assert.deepEqual(t.rows.map((r) => Explain.rowText(r, Explain.solve(t))),
      ['400 : 2 = 200', '80 : 2 = 40', '2 : 2 = 1', '482 : 2 = 241', '241 · 2 = 482']);
    assert.deepEqual(lines(Explain.lesson(':', 'zerlegen', 1000)), ['800 : 4 = 200', '40 : 4 = 10', '12 : 4 = 3', '852 : 4 = 213', '213 · 4 = 852']);
  });
  // KIRA, Der schriftliche Additionsalgorithmus: 596 + 247 – 13 Einer, 14 Zehner, 8 Hunderter
  test('schriftlich addieren: 596 + 247', () => {
    const l = Explain.lesson('+', 'schriftlich', 1000);
    assert.equal(Tasks.taskText(l.task), '596 + 247');
    const say = l.steps.map((x) => x.say).join(' ');
    assert.match(say, /6 \+ 7 = 13\. Schreibe 3, übertrage 1 zu den Zehnern/);
    assert.match(say, /9 \+ 4 \+ 1 \(Übertrag\) = 14/);
    assert.match(say, /5 \+ 2 \+ 1 \(Übertrag\) = 8/);
  });
  // KIRA, Zu den Verfahren der schriftlichen Subtraktion: „3 E − 8 E geht nicht …“ bzw. „8 + ? = 3 geht nicht …“
  test('schriftlich subtrahieren: Abziehen mit Entbündeln, Ergänzen mit Erweitern', () => {
    const ab = Explain.lesson('−', 'schriftlich', 100), erg = Explain.lesson('−', 'schriftlich-erg', 100);
    assert.equal(Tasks.taskText(ab.task), '73 − 28');
    assert.match(ab.steps.map((x) => x.say).join(' '), /3 − 8 geht nicht\. Wechsle 1 Zehner in 10 Einer um.*13 − 8 = 5/);
    assert.match(erg.steps.map((x) => x.say).join(' '), /8 \+ \? = 3 geht nicht.*8 \+ 5 = 13\. Schreibe 5, übertrage 1 zu den Zehnern/);
    // bis 1000: die Übungsaufgabe von KIRA
    assert.equal(Tasks.taskText(Explain.lesson('−', 'schriftlich', 1000).task), '736 − 328');
  });
});

describe('Anzeige Schritt für Schritt', () => {
  const l = Explain.lesson('+', 'stellenweise', 1000);
  const n = l.steps.length;
  test('erst die Idee: noch keine Zeile, Ergebnis verdeckt', () => {
    const v = Explain.view(l, 0);
    assert.equal(v.say, l.steps[0].say);
    assert.deepEqual(v.rows, ['future', 'future', 'future', 'future']);
    assert.equal(v.first, true);
    assert.equal(v.last, false);
    assert.equal(v.solved, false);
    assert.equal(v.counter, '1 / ' + n);
  });
  test('dann Zeile für Zeile: die aktuelle leuchtet, die vorigen sind fertig', () => {
    assert.deepEqual(Explain.view(l, 1).rows, ['active', 'future', 'future', 'future']);
    assert.deepEqual(Explain.view(l, 3).rows, ['done', 'done', 'active', 'future']);
    assert.equal(Explain.view(l, 4).solved, true, 'mit der letzten Zeile steht das Ergebnis da');
  });
  test('zum Schluss: alles fertig, Tipps, „Jetzt du!“', () => {
    const v = Explain.view(l, n - 1);
    assert.deepEqual(v.rows, ['done', 'done', 'done', 'done']);
    assert.equal(v.last, true);
    assert.equal(v.solved, true);
    assert.match(v.next, /Jetzt du/);
    assert.match(Explain.view(l, 0).next, /Weiter/);
  });
  test('Schritte außerhalb werden begrenzt', () => {
    assert.equal(Explain.view(l, -3).step, 0);
    assert.equal(Explain.view(l, 99).step, n - 1);
  });
});

describe('Zahlen im Beispiel', () => {
  test('rowText: Felder, Verweise und Rechenzeichen als eine Zeile', () => {
    const row = { tokens: [{ t: 'ref', id: 'a' }, { t: 'txt', v: '+' }, { t: 'num', v: 5 }, { t: 'txt', v: '=' }, { t: 'in', id: 'b', answer: 12 }] };
    assert.equal(Explain.rowText(row, { a: 7, b: 12 }), '7 + 5 = 12');
  });
  test('cellValue: eine 0 ganz vorne, die man weglassen darf, bleibt leer', () => {
    assert.equal(Explain.cellValue({ t: 'in', id: 'd2', blank: 0 }, { d2: 0 }), '');
    assert.equal(Explain.cellValue({ t: 'in', id: 'd1' }, { d1: 0 }), '0');
    assert.equal(Explain.cellValue({ t: 'in', id: 'x' }, {}), '');
  });
  test('Auswahl: die gewählte Antwort', () => {
    const tok = { t: 'choice', id: 'p', options: ['passt', 'passt nicht'] };
    assert.equal(Explain.rowText({ tokens: [tok] }, { p: 0 }), 'passt');
  });
});
