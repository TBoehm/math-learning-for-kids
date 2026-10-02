/*
 * „So geht's“: Der Begleiter erklärt einen Rechenweg an einem Beispiel – Schritt für Schritt im Dialog.
 *
 * Damit die Erklärung immer zu dem passt, was die App beim Rechnen erwartet:
 *   - Das Beispiel ist eine echte Aufgabe aus dem Generator (Tasks.build bzw. Schriftlich.build,
 *     Stufe „Mit Hilfe“) – dieselben Zeilen, Beschriftungen und Schreibweisen wie beim Üben.
 *   - Zu jeder Zeile sagt der Begleiter den Tipp, den die App auch beim Üben gibt (row.hint).
 *   - Von Hand geschrieben sind nur die Idee am Anfang, die Tipps am Ende und der Hinweis für Erwachsene.
 * Die Rechenwege und Beispiele stammen aus fachdidaktischen Quellen (KIRA, PIKAS, Mahiko vom DZLM);
 * tests/explain.test.js prüft, dass die App die dort gezeigten Rechnungen genau so aufschreibt.
 *
 * Reines Modul ohne DOM – getestet in tests/explain.test.js. Den Dialog baut js/app.js.
 */
(function (root) {
  'use strict';

  var node = typeof module !== 'undefined' && module.exports;
  var Tasks = node ? require('./tasks.js') : root.RR.Tasks;
  var Check = node ? require('./check.js') : root.RR.Check;
  var Schriftlich = node ? require('./formats/schriftlich.js') : root.RR.Schriftlich;

  // ---------- Quellen (für Erwachsene) ----------
  var KIRA = 'https://kira.dzlm.de/', PIKAS = 'https://pikas.dzlm.de/';
  var SRC = {
    kiraAdd: { title: 'KIRA (DZLM): Halbschriftliche Addition', url: KIRA + 'arithmetik/halbschriftliches-rechnen/halbschriftliche-addition' },
    kiraSub: { title: 'KIRA (DZLM): Halbschriftliche Subtraktion', url: KIRA + 'arithmetik/halbschriftliches-rechnen/halbschriftliche-subtraktion' },
    kiraMul: { title: 'KIRA (DZLM): Halbschriftliche Multiplikation', url: KIRA + 'arithmetik/halbschriftliches-rechnen/halbschriftliche-multiplikation' },
    kiraDiv: { title: 'KIRA (DZLM): Halbschriftliche Division', url: KIRA + 'arithmetik/halbschriftliches-rechnen/halbschriftliche-division' },
    pikas: { title: 'PIKAS (DZLM): Halbschriftliche Strategien bei Addition und Subtraktion', url: PIKAS + 'schumas/arithmetik-12/modul-4/mini-module/42-halbschriftliche-strategien' },
    pikasSub: { title: 'PIKAS (DZLM): Halbschriftliche Subtraktion im Tausenderraum', url: PIKAS + 'schumas/arithmetik-34/modul-3/mini-module/41-halbschriftliche-subtraktion' },
    mahiko: { title: 'Mahiko (DZLM): Grundlagen zu „Sicher im Einmaleins“', url: 'https://mahiko.dzlm.de/node/73' },
    kiraSchriftAdd: { title: 'KIRA (DZLM): Der schriftliche Additionsalgorithmus', url: KIRA + 'der-schriftliche-additionsalgorithmus' },
    kiraSchriftSub: { title: 'KIRA (DZLM): Zu den Verfahren der schriftlichen Subtraktion', url: KIRA + 'zu-den-verfahren-der-schriftlichen-subtraktion' }
  };

  /** "Hunderter, Zehner und Einer" bzw. "Zehner und Einer" */
  function places(big) { return big ? 'Hunderter, Zehner und Einer' : 'Zehner und Einer'; }
  function order(big, verb) { return big ? 'erst die Hunderter, dann die Zehner, dann die Einer ' + verb + '.' : 'erst die Zehner, dann die Einer ' + verb + '.'; }

  // ---------- Erklärungen ----------
  // ex: Beispiel je Zahlenraum [a, b, round]; idea(big, task): was der Begleiter zuerst sagt; tips: zum Schluss;
  // note: für Erwachsene: Name in der Fachliteratur, Herkunft des Beispiels, was die App zusätzlich annimmt.
  // kind: schriftliches Verfahren (Schriftlich.build), sonst Tasks.build.
  var LESSONS = {
    '+': {
      stellenweise: {
        ex: { 100: [19, 39], 1000: [399, 473] },
        idea: function (big) {
          return 'Bei „Stellenweise“ zerlegst du beide Zahlen in ' + places(big) + '. Dann rechnest du jede Stelle für sich: ' +
            (big ? 'Hunderter plus Hunderter, ' : '') + 'Zehner plus Zehner, Einer plus Einer. Zum Schluss rechnest du alles zusammen.';
        },
        tips: ['Schreib immer die ganze Zahl hin: 90 + 70 = 160, nicht 16.',
          'Bei „Alles selbst“ darfst du selbst wählen, mit welcher Stelle du anfängst.'],
        note: 'In der Fachdidaktik heißt dieser Weg „Stellenweise“ oder „Stellen extra“. Beide Summanden werden in Stellenwerte zerlegt, ' +
          'die Stellen einzeln addiert und die Teilergebnisse zusammengefasst. 399 + 473 und 19 + 39 sind Kinderlösungen aus KIRA. ' +
          'Bei „Alles selbst“ nimmt die App die Stellen in jeder Reihenfolge an.',
        sources: [SRC.kiraAdd, SRC.pikas]
      },
      schrittweise: {
        ex: { 100: [19, 39], 1000: [399, 473] },
        idea: function (big) {
          return 'Bei „Schrittweise“ bleibt die erste Zahl ganz. Die zweite Zahl zerlegst du und rechnest sie Stück für Stück dazu: ' +
            order(big, 'dazu') + ' Jedes Ergebnis ist der Start für den nächsten Schritt.';
        },
        tips: ['Bei „Alles selbst“ darfst du deine Schritte selbst wählen, zum Beispiel erst bis zum nächsten Zehner.',
          'Auf dem Rechenstrich siehst du jeden Sprung.'],
        note: 'In der Fachdidaktik heißt dieser Weg „Schrittweise“. Der erste Summand bleibt erhalten, der zweite wird (meist nach Stellenwerten) ' +
          'zerlegt und nacheinander addiert; das letzte Zwischenergebnis ist das Ergebnis. 399 + 473 ist eine Kinderlösung aus KIRA. ' +
          'Bei „Alles selbst“ nimmt die App auch andere Schritte an, etwa erst bis zum nächsten Zehner.',
        sources: [SRC.kiraAdd, SRC.pikas]
      },
      hilfsaufgabe: {
        ex: { 100: [19, 39], 1000: [399, 473, 'a'] },
        idea: function () {
          return 'Bei der „Hilfsaufgabe“ suchst du dir eine leichtere Aufgabe. Eine Zahl, die fast glatt ist, machst du glatt: ' +
            'Aus 99 wird zum Beispiel 100. Dann rechnest du die leichte Aufgabe. Zum Schluss gleichst du aus: ' +
            'Was du zu viel dazugerechnet hast, nimmst du wieder weg.';
        },
        tips: ['Das klappt gut bei Zahlen, die fast glatt sind, wie 99, 198 oder 39.',
          'Pass beim Ausgleichen auf: Zu viel dazugerechnet? Dann nimmst du es wieder weg.'],
        note: 'In der Fachdidaktik heißt dieser Weg „Hilfsaufgabe“. Eine Zahl wird zum vollen Zehner oder Hunderter verändert, die leichtere Aufgabe ' +
          'gerechnet und das Ergebnis nachträglich korrigiert (KIRA: 399 + 473 = 400 + 473 − 1). Typischer Fehler: Korrektur in die ' +
          'falsche Richtung. Bei „Alles selbst“ nimmt die App jede der beiden Zahlen als Hilfszahl an.',
        sources: [SRC.kiraAdd, SRC.pikas]
      },
      vereinfachen: {
        ex: { 100: [19, 39], 1000: [399, 473, 'a'] },
        idea: function () {
          return 'Beim „Vereinfachen“ gibt eine Zahl der anderen etwas ab, bis eine Zahl glatt ist. Was die eine bekommt, gibt die ' +
            'andere ab. So bleibt das Ergebnis gleich. Danach ist die Aufgabe leicht, und du musst nichts mehr ausgleichen.';
        },
        tips: ['Das klappt gut, wenn eine Zahl fast glatt ist.', 'Wichtig: Die eine Zahl bekommt genau so viel, wie die andere abgibt.'],
        note: 'In der Fachdidaktik heißt dieser Weg „Vereinfachen“. Beide Summanden werden gegensinnig verändert (Konstanz der Summe). ' +
          'So entsteht eine leichtere Aufgabe mit demselben Ergebnis, und ein Korrekturschritt entfällt. 399 + 473 = 400 + 472 ist eine ' +
          'Kinderlösung aus KIRA.',
        sources: [SRC.kiraAdd, SRC.pikas]
      }
    },
    '−': {
      schrittweise: {
        ex: { 100: [62, 39], 1000: [526, 283] },
        idea: function (big) {
          return 'Bei „Schrittweise“ bleibt die erste Zahl ganz. Die zweite Zahl zerlegst du und nimmst sie Stück für Stück weg: ' +
            order(big, 'weg') + ' Jedes Ergebnis ist der Start für den nächsten Schritt.';
        },
        tips: ['Schreib jedes Zwischenergebnis genau ab. Damit rechnest du weiter.',
          'Bei „Alles selbst“ darfst du deine Schritte selbst wählen, zum Beispiel erst bis zum nächsten Zehner.'],
        note: 'In der Fachdidaktik heißt dieser Weg „Schrittweise“. Der Minuend bleibt erhalten, der Subtrahend wird zerlegt und nacheinander ' +
          'abgezogen. 526 − 283 ist ein Beispiel aus PIKAS. Häufiger Merkfehler laut KIRA: ein Zwischenergebnis falsch abschreiben. ' +
          'Bei „Alles selbst“ nimmt die App auch andere Schritte an.',
        sources: [SRC.pikas, SRC.kiraSub]
      },
      ergaenzen: {
        ex: { 100: [62, 58], 1000: [702, 698] },
        idea: function () {
          return 'Beim „Ergänzen“ fragst du: Wie weit ist es von der kleinen Zahl bis zur großen? Du springst von der kleinen Zahl ' +
            'nach oben, am besten zu glatten Zahlen. Alle Sprünge zusammen sind das Ergebnis.';
        },
        tips: ['Das klappt gut, wenn die beiden Zahlen nah beieinander liegen, wie bei 702 − 698.',
          'Bei „Alles selbst“ darfst du deine Sprünge selbst wählen.', 'Die Probe zeigt dir, ob alles stimmt.'],
        note: 'In der Fachdidaktik heißt dieser Weg „Ergänzen“, ein Sonderfall der Subtraktion. Vom Subtrahenden wird schrittweise ' +
          'bis zum Minuenden ergänzt; die Teilschritte ergeben zusammen die Differenz (PIKAS). Besonders geschickt, wenn die Zahlen nah beieinander ' +
          'liegen (KIRA: 701 − 698). Bei „Alles selbst“ nimmt die App beliebige Sprünge an.',
        sources: [SRC.pikas, SRC.pikasSub]
      },
      hilfsaufgabe: {
        ex: { 100: [82, 39], 1000: [845, 399] },
        idea: function () {
          return 'Bei der „Hilfsaufgabe“ machst du die Zahl, die du wegnimmst, glatt: Aus 399 wird zum Beispiel 400. ' +
            'Dann rechnest du die leichte Aufgabe. Weil du so zu viel weggenommen hast, gibst du es am Ende wieder dazu.';
        },
        tips: ['Das klappt gut, wenn die Zahl, die du wegnimmst, fast glatt ist, wie 99, 199 oder 39.',
          'Zu viel weggenommen? Dann gibst du es wieder dazu und nimmst nicht noch mal etwas weg!'],
        note: 'In der Fachdidaktik heißt dieser Weg „Hilfsaufgabe“. Der Subtrahend (oder der Minuend) wird zur glatten Zahl verändert, die leichtere ' +
          'Aufgabe gerechnet und das Ergebnis korrigiert. Fehler beim Ausgleichen sind typisch (KIRA). Bei „Alles selbst“ nimmt die ' +
          'App beide Varianten mit dem passenden Ausgleich an.',
        sources: [SRC.kiraSub, SRC.pikas]
      },
      vereinfachen: {
        ex: { 100: [73, 29], 1000: [773, 299] },
        idea: function () {
          return 'Beim „Vereinfachen“ veränderst du beide Zahlen um gleich viel, bis die Zahl, die du wegnimmst, glatt ist. ' +
            'Der Abstand zwischen den Zahlen bleibt dabei gleich, also auch das Ergebnis.';
        },
        tips: ['Bei Minus bekommen beide Zahlen gleich viel dazu.',
          'Achtung, anders als bei Plus: Dort gibt eine Zahl der anderen etwas ab.'],
        note: 'In der Fachdidaktik heißt dieser Weg „Vereinfachen“. Minuend und Subtrahend werden gleichsinnig verändert (Konstanz der Differenz). ' +
          'Typischer Fehler laut KIRA: gegensinnig verändern wie bei der Addition (773 − 299 wird fälschlich zu 772 − 300).',
        sources: [SRC.kiraSub, SRC.pikas]
      }
    },
    '·': {
      zerlegen: {
        ex: { 100: [4, 23], 1000: [9, 29] },
        idea: function (big, t) {
          var n = Math.max(t.a, t.b), parts = Tasks.placeParts(n);
          return 'Beim „Zerlegen“ teilst du die große Zahl in ihre Stellen: ' + n + ' = ' + parts.join(' + ') + '. Jeden Teil ' +
            'nimmst du einzeln mal. Dann rechnest du die Teilergebnisse zusammen.';
        },
        tips: ['Zerlege in Zehner und Einer: 29 = 20 + 9, nicht 2 und 9.',
          'Vergiss keinen Teil: Jeder Teil wird mit derselben Zahl malgenommen.'],
        note: 'In der Fachliteratur heißt dieser Weg bei der Multiplikation meist „Schrittweise“: Ein Faktor wird in seine ' +
          'Stellenwerte zerlegt, und die Teilprodukte werden addiert. 9 · 29 = 9 · 20 + 9 · 9 ist eine Kinderlösung aus KIRA. ' +
          'Typischer Fehler: ziffernweise statt stellengerecht zerlegen. Bei „Alles selbst“ nimmt die App auch andere Zerlegungen an.',
        sources: [SRC.kiraMul]
      },
      kernaufgaben: {
        ex: { 100: [6, 8], 1000: [9, 6] },
        idea: function () {
          return 'Kernaufgaben sind die leichten Malaufgaben mit 1, 2, 5 und 10. Eine schwere Aufgabe baust du daraus: Du rechnest ' +
            'eine Kernaufgabe und nimmst noch etwas dazu oder wieder weg.';
        },
        tips: ['5 mal ist die Hälfte von 10 mal. 2 mal ist das Doppelte.',
          'Bei 9 mal und 8 mal ist es oft leichter, von 10 mal etwas wegzunehmen.'],
        note: 'Ableiten aus Kernaufgaben: Aus den leichten Aufgaben mit 1, 2, 5 und 10 werden schwierigere Einmaleins-Aufgaben ' +
          'erschlossen, z. B. 6 · 8 = 5 · 8 + 1 · 8 oder 9 · 6 = 10 · 6 − 1 · 6 (Mahiko). Bei „Alles selbst“ nimmt die App jede ' +
          'Zerlegung in Kernaufgaben an.',
        sources: [SRC.mahiko]
      },
      hilfsaufgabe: {
        ex: { 100: [3, 29], 1000: [5, 49] },
        idea: function () {
          return 'Bei der „Hilfsaufgabe“ machst du eine Zahl glatt, die fast glatt ist: Aus 49 wird zum Beispiel 50. ' +
            'Die leichte Malaufgabe rechnest du zuerst. Dann nimmst du weg, was zu viel war.';
        },
        tips: ['Wie viel ist zu viel? Bei 5 · 50 statt 5 · 49 sind es 5 · 1 = 5.', 'Das klappt gut bei Zahlen kurz vor einem Zehner: 9, 19, 49, 98.'],
        note: 'In der Fachdidaktik heißt dieser Weg „Hilfsaufgabe“. Ein Faktor wird zur glatten Zahl verändert, und das Ergebnis ' +
          'der leichteren Aufgabe wird anschließend korrigiert. 5 · 49 = 5 · 50 − 5 · 1 ist eine Kinderlösung aus KIRA.',
        sources: [SRC.kiraMul]
      }
    },
    ':': {
      zerlegen: {
        ex: { 100: [96, 8], 1000: [852, 4] },
        idea: function () {
          return 'Beim Geteilt-Rechnen zerlegst du die große Zahl in leichte Teile. Leicht sind Teile, bei denen du das Ergebnis ' +
            'sofort weißt, wie 80 : 8 oder 400 : 4. Jeden Teil teilst du einzeln, dann rechnest du die Ergebnisse zusammen.';
        },
        tips: ['Mit der Probe prüfst du: Ergebnis mal Teiler gibt wieder die große Zahl.',
          'Bleibt am Ende etwas übrig, das nicht mehr passt, ist das der Rest (R).'],
        note: 'In der Fachdidaktik heißt dieser Weg „Schrittweise“. Der Dividend wird in leicht teilbare Teile zerlegt, ' +
          'z. B. 482 : 2 = 400 : 2 + 80 : 2 + 2 : 2 (KIRA), und die Teilergebnisse werden addiert. Zur Probe dient die Umkehraufgabe. ' +
          'Bei „Zerlegung selbst“ und „Alles selbst“ nimmt die App jede passende Zerlegung an.',
        sources: [SRC.kiraDiv]
      }
    }
  };
  // schriftliche Verfahren
  LESSONS['+'].schriftlich = {
    kind: 'add', ex: { 100: [47, 38], 1000: [596, 247] },
    idea: function () {
      return 'Beim schriftlichen Addieren schreibst du die Zahlen stellengerecht untereinander: Einer unter Einer, Zehner unter ' +
        'Zehner. Du rechnest von rechts nach links. Sind es 10 oder mehr, schreibst du die Einer hin und den Zehner als kleinen ' +
        'Übertrag zur nächsten Stelle.';
    },
    tips: ['Den Übertrag rechnest du in der nächsten Stelle mit.', 'Erst der Überschlag, am Ende der Vergleich: Passt dein Ergebnis?'],
    note: 'Schriftliche Addition: Die Zahlen stehen stellengerecht untereinander. Gerechnet wird von rechts nach links, und der ' +
      'Übertrag steht am unteren Rand der nächsten Spalte (KIRA, Beispiel 596 + 247). In der App kommen Überschlag und Vergleich dazu.',
    sources: [SRC.kiraSchriftAdd]
  };
  LESSONS['−'].schriftlich = {
    kind: 'sub', ex: { 100: [73, 28], 1000: [736, 328] },
    idea: function () {
      return 'Beim schriftlichen Subtrahieren mit Abziehen schreibst du die Zahlen stellengerecht untereinander und rechnest ' +
        'von rechts nach links: oben minus unten. Ist oben zu wenig, wechselst du um: Ein Zehner wird zu 10 Einern. Die alte ' +
        'Ziffer streichst du durch und schreibst die neue darüber.';
    },
    tips: ['Beim Umwechseln wird links eins weniger, und die Stelle rechts daneben bekommt 10 dazu.',
      'Mit der Probe prüfst du: Ergebnis plus untere Zahl gibt wieder die obere Zahl.'],
    note: 'Verfahren „Abziehen mit Entbündeln“: Nur der Minuend wird umgeformt; reicht eine Stelle nicht, wird ein Bündel der ' +
      'nächsthöheren Stelle entbündelt („3 − 8 geht nicht …“, KIRA). Mit Überschlag, Vergleich und Probe.',
    sources: [SRC.kiraSchriftSub]
  };
  LESSONS['−']['schriftlich-erg'] = {
    kind: 'erg', ex: { 100: [73, 28], 1000: [736, 328] },
    idea: function () {
      return 'Beim schriftlichen Subtrahieren mit Ergänzen fragst du in jeder Stelle: Wie viel fehlt von unten bis oben? ' +
        'Geht das nicht, ergänzt du bis zur Zahl mit einer 1 davor, zum Beispiel von 8 bis 13. Dann schreibst du eine 1 als ' +
        'Übertrag zur nächsten Stelle der unteren Zahl.';
    },
    tips: ['Den Übertrag zählst du in der nächsten Stelle zur unteren Ziffer dazu.',
      'Mit der Probe prüfst du: Ergebnis plus untere Zahl gibt wieder die obere Zahl.'],
    note: 'Verfahren „Ergänzen mit Erweitern“: Reicht eine Stelle nicht, werden Minuend (10 Einer) und Subtrahend (1 Zehner) ' +
      'gleich erweitert; die Differenz bleibt dabei gleich („8 + ? = 3 geht nicht …“, KIRA). Mit Überschlag, Vergleich und Probe.',
    sources: [SRC.kiraSchriftSub]
  };

  function def(op, key) { return (LESSONS[op] && Object.prototype.hasOwnProperty.call(LESSONS[op], key) && LESSONS[op][key]) || null; }
  /** Gibt es zu diesem Rechenweg eine Erklärung? */
  function has(op, key) { return !!def(op, key); }

  // ---------- Beispiel lösen ----------
  function inputs(row) { return row.tokens.filter(function (t) { return t.t === 'in' || t.t === 'choice'; }); }

  /** Löst eine Aufgabe Zeile für Zeile mit den erwarteten Werten (wie Check sie annimmt) -> alle Werte */
  function solve(task) {
    var vals = {};
    task.rows.forEach(function (row, i) {
      var known = Object.assign({}, vals), raw = {};
      inputs(row).forEach(function (tok) {
        var v = typeof tok.expected === 'function' ? tok.expected(known) : tok.answer;
        known[tok.id] = v;
        raw[tok.id] = String(v);
      });
      var r = Check.checkRow(row, raw, vals);
      if (!r.correct) throw new Error('Beispiel ' + Tasks.taskText(task) + ': Zeile ' + i + ' geht nicht auf');
      vals = r.vals;
    });
    return vals;
  }

  /** Was in einem Feld steht; eine 0 ganz vorne, die man weglassen darf, bleibt leer. */
  function cellValue(tok, vals) {
    var v = vals[tok.id];
    if (v === undefined || (tok.blank === 0 && v === 0)) return '';
    return String(v);
  }

  /** Zeile als Text, z. B. "300 + 400 = 700" */
  function rowText(row, vals) {
    return row.tokens.map(function (tok) {
      if (tok.t === 'in') return cellValue(tok, vals);
      if (tok.t === 'ref') return String(vals[tok.id]);
      if (tok.t === 'choice') return tok.options[vals[tok.id]];
      return String(tok.v);
    }).filter(function (s) { return s !== ''; }).join(' ');
  }

  // ---------- Erklärung ----------
  /**
   * Erklärung zu einem Rechenweg im Zahlenraum max (100 oder 1000), oder null.
   * -> { op, key, name, title, task, vals, steps: [{ say, row }], note, sources }
   *    steps: erst die Idee (row: null), dann je Zeile der Tipp der App (row: Nummer), zum Schluss Tipps (row: null)
   */
  function lesson(op, key, max) {
    var d = def(op, key);
    if (!d) return null;
    var big = max === 1000, ex = d.ex[big ? 1000 : 100];
    var task = d.kind ? Schriftlich.build(d.kind, [ex[0], ex[1]], { level: 'hilfe', max: big ? 1000 : 100 })
      : Tasks.build(op, key, ex[0], ex[1], { level: 'hilfe', max: big ? 1000 : 100, round: ex[2] });
    var name = Tasks.STRATEGIES[op].filter(function (s) { return s.key === key; })[0].name;
    var steps = [{ say: d.idea(big, task), row: null }];
    task.rows.forEach(function (row, i) { steps.push({ say: row.hint, row: i }); });
    steps.push({ say: d.tips.join(' '), row: null });
    return {
      op: op, key: key, name: name, title: "So geht's: " + name, task: task, vals: solve(task),
      steps: steps, note: d.note, sources: d.sources.slice()
    };
  }

  /** Nummer der Zeile, in der das Ergebnis steht (Feld 'res') */
  function resultRow(task) {
    for (var i = 0; i < task.rows.length; i++) {
      if (task.rows[i].tokens.some(function (t) { return t.id === 'res'; })) return i;
    }
    return task.rows.length - 1;
  }

  /**
   * Was der Dialog bei Schritt k zeigt.
   * -> { step, say, rows: ['future'|'active'|'done', …], first, last, solved (Ergebnis steht da), counter, next, equation, result }
   */
  function view(l, k) {
    var n = l.steps.length, step = Math.max(0, Math.min(n - 1, k)), s = l.steps[step], t = l.task;
    var cur = s.row !== null ? s.row : step === 0 ? -1 : t.rows.length;
    var last = step === n - 1;
    var rest = t.op === ':' && t.rest ? ' R ' + t.rest : '';
    return {
      step: step, say: s.say,
      rows: t.rows.map(function (r, i) { return i < cur ? 'done' : i === cur ? 'active' : 'future'; }),
      first: step === 0, last: last, solved: cur >= resultRow(t),
      counter: (step + 1) + ' / ' + n, next: last ? 'Jetzt du! 💪' : 'Weiter ➜',
      equation: Tasks.taskText(t), result: t.answer + rest
    };
  }

  var api = { has: has, lesson: lesson, view: view, solve: solve, rowText: rowText, cellValue: cellValue, LESSONS: LESSONS };
  if (node) module.exports = api;
  else root.RR = Object.assign(root.RR || {}, { Explain: api });
})(typeof window !== 'undefined' ? window : this);
