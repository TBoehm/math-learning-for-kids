# Mitentwickeln

Schön, dass du mitmachen willst! Fehler und Ideen bitte als
[Issue](https://github.com/tboehm/math-learning-for-kids/issues) melden, Änderungen gern als Pull Request.
Die verbindlichen Regeln für Tests und Texte stehen in [`CLAUDE.md`](CLAUDE.md). Sie gelten für Menschen
und KI-Agenten gleichermaßen. Die Kurzfassung:

- **Testgetrieben:** erst ein fehlschlagender Test, dann der Code.
- **Richtige Alternativen annehmen:** Geprüft wird, ob ein Schritt mathematisch stimmt und zum Rechenweg passt.
  Er muss nicht der Musterlösung gleichen.
- **Unit vor E2E:** Logik steckt in reinen Modulen ohne DOM; Browser-Tests nur für Verdrahtung, Fokus und Layout.
- **Keine Lehrwerks- oder Verlagsnamen**, keine externen Server zur Laufzeit, kindgerechtes Deutsch.
- **Deutsch denken, nicht übersetzen:** Vor jedem neuen oder geänderten deutschen Text gilt das Verfahren aus
  [`.claude/skills/deutsch-first/SKILL.md`](.claude/skills/deutsch-first/SKILL.md) (Telefon-Test, Rückübersetzungs-Test,
  keine Gedankenstriche als Satztrenner).
- Mit einem Beitrag stimmst du zu, dass er unter der [MIT-Lizenz](LICENSE) des Projekts veröffentlicht wird.

## Loslegen

Reines HTML/CSS/JavaScript ohne Build-Schritt. `index.html` lässt sich sogar direkt per Doppelklick öffnen.

```bash
npm ci               # Entwicklungs-Werkzeuge genau nach package-lock.json (Testserver, Playwright)
npm start            # lokaler Server auf http://localhost:8080
npm test             # Unit-Tests (Node, ohne Abhängigkeiten)
npx playwright install chromium
npm run test:e2e     # Browser-Tests: Oberfläche auf Handy, Tablet, Desktop
npm run stamp        # nach Änderungen an css/ oder js/: Cache-Sperre (?v=<Hash>) in index.html setzen
```

Werkzeuge werden nie ungeprüft nachgeladen: alle stehen mit fester Version in `package-lock.json`, und die
GitHub Actions in `.github/workflows/ci.yml` sind per Commit-Hash festgelegt (Versions-Tags lassen sich
verschieben). Beim Aktualisieren den Hash des neuen Release-Tags eintragen und die Version als Kommentar dahinter
(`tests/toolchain.test.js` prüft das).

| Datei | Inhalt |
|---|---|
| `js/tasks.js` | Aufgaben-Generator für alle Rechenwege; `Tasks.build(op, weg, a, b, opt)` baut einen Rechenweg zu festen Zahlen (alle Rechenarten, z. B. für „Welcher Weg?“ und „So geht's“) |
| `js/explain.js` | „So geht's“: Erklärung je Rechenweg (Idee, Beispiel, Tipps, Quellen) und was der Dialog bei jedem Schritt zeigt (ohne DOM) |
| `js/formats/*.js` | Knobel-Aufgaben: Zahlenmauer, Fehler finden, Welcher Weg?, Überschlagen |
| `js/layouts/wall.js` | Darstellung der Zahlenmauer als Pyramide |
| `js/check.js` | Prüf-Logik: Eingaben lesen, Zeilen bewerten, Hilfe-Stufen, Lösungstext |
| `js/progress.js` | Sterne, Serien, Parade, Freischaltungen |
| `js/settings.js` | Einstellungen: Standardwerte, alte Speicherstände anpassen, Laden/Speichern (bei mehreren offenen Tabs werden die Stände zusammengeführt, statt sich zu überschreiben), Auswahl der Rechenwege |
| `js/ui-logic.js` | Logik der Oberfläche ohne DOM: Eingaben, Zahlenfeld, Felder nach dem Prüfen, Texte des Begleiters |
| `js/viz-logic.js` | Inhalte der Anschauungen ohne DOM: Malkreuz, Zerlegungsbaum, Punktefeld, Lage auf dem Rechenstrich |
| `js/viz.js` | Rechenstrich, Malkreuz, Punktefeld, Zerlegungsbaum |
| `js/themes.js` | Welten: Texte, Begleiter, Effekte und Klänge je Welt, Weltwechsel |
| `js/vehicles.js` | Fahrzeug-Begleiter der Werkstatt als SVG (Bagger, Rennauto, Feuerwehr, Kipplaster, Monstertruck, Helden-Auto) |
| `js/formats/schriftlich.js` | Schriftlich addieren und subtrahieren: Rechnung Stelle für Stelle, Zeilen, Tipps (ohne DOM) |
| `js/layouts/column.js`, `css/column.css` | Rechenraster (Karopapier) für die schriftlichen Verfahren |
| `js/companion.js` | Begleiter als SVG |
| `js/sound.js` | Klänge per Web-Audio (keine Sounddateien) |
| `js/app.js` | Oberfläche und Ablauf |

Die Prüf-Logik (`check.js`, `progress.js`) ist testgetrieben entwickelt und ohne DOM testbar.
`tests/tasks.test.js` und `tests/rechenwege.test.js` erzeugen zehntausende Aufgaben und prüfen, dass jede Zeile rechnerisch stimmt,
alles im Zahlenraum bleibt und falsche Antworten abgelehnt werden; `tests/alternativen.test.js` spielt für jeden
Rechenweg andere richtige Wege durch und prüft, dass sie angenommen werden.
Auch die Logik der Oberfläche (`settings.js`, `ui-logic.js`, `viz-logic.js`) steckt in reinen Modulen mit Unit-Tests;
die Browser-Tests (`tests/e2e/`) prüfen nur, was einen echten Browser braucht: Verdrahtung, Fokus, Layout und Dialoge.

### Rückmeldung bei Fehlern

Passt eine eingetragene Zahl nicht zum Rechenweg, sagt der Begleiter gleich beim ersten Prüfen, warum. Dazu kann jedes
Eingabefeld einen Grund liefern: `tok.why(wert, werte)` gibt einen Satz zurück, z. B. „60 steckt nicht in 54, denn
54 = 50 + 4. Nimm die 50. Die liegt am nächsten an 60.“ (Hilfen dafür: `Tasks.why`). `Check.checkRow` setzt daraus
`result.why`. Stimmt die Gleichung mit den Zahlen des Kindes trotzdem (13 + 60 = 73), beginnt der Text mit
„13 + 60 = 73 stimmt, aber …“. Felder, deren Ergebnis von einer frei gewählten Zahl abhängt, tragen dafür `deps`.
So bleiben sie unmarkiert, statt rot zu werden. Tests: `tests/rueckmeldung.test.js`.

### „So geht's“: Rechenwege erklären

Neben dem Rechenweg-Schild steht ein Knopf „So geht's“. Er öffnet einen Dialog, in dem der Begleiter den Weg an einem
Beispiel erklärt (`js/explain.js`, Dialog in `js/app.js`). Damit die Erklärung immer zur App passt, ist fast nichts von Hand
geschrieben:

- Das **Beispiel** ist eine echte Aufgabe aus dem Generator in der Stufe „Mit Hilfe“ (`Tasks.build` bzw. `Schriftlich.build`),
  gezeichnet wie beim Üben. Nur sind die Felder schon ausgefüllt.
- Zu jeder Zeile sagt der Begleiter den **Tipp der App** (`row.hint`).
- Von Hand geschrieben sind nur die **Idee** am Anfang, die **Tipps** am Ende und der **Hinweis für Erwachsene** mit Quellen.

Die Rechenwege und Beispiele stammen aus den frei zugänglichen Seiten von KIRA, PIKAS und Mahiko (DZLM), nicht aus Lehrwerken.
Wo möglich ist das Beispiel genau das aus der Quelle (z. B. 399 + 473 auf vier Wegen); `tests/explain.test.js` prüft, dass
die App diese Rechnungen genau so aufschreibt, und dass **jeder** halbschriftliche Rechenweg und jedes schriftliche Verfahren
eine Erklärung hat. Ein neuer Rechenweg braucht deshalb einen Eintrag in `Explain.LESSONS` (Beispiel je Zahlenraum, Idee,
Tipps, Hinweis, Quellen) und, falls er zu festen Zahlen gebaut werden soll, einen Eintrag in `BUILD` in `js/tasks.js`.
Knobeleien haben keinen Knopf.

## Veröffentlichung

GitHub Pages muss unter **Settings → Pages → Source** auf **GitHub Actions** eingestellt sein. Der Workflow
`.github/workflows/ci.yml` führt bei jedem Push und Pull Request Unit- und Browser-Tests aus. Nur bei einem Push auf
`main` und nur nachdem beide Test-Jobs erfolgreich waren, veröffentlicht der abhängige Job
„GitHub Pages veröffentlichen“ die statischen Dateien. Pull Requests veröffentlichen nichts.

Zusätzlich sollte `main` durch eine Branch-Regel mit den Pflicht-Checks „Unit-Tests“ und
„Browser-Tests (Ende-zu-Ende)“ geschützt sein und nur über Pull Requests geändert werden.

## Knobel-Module

Jede Knobelei ist ein eigenes Modul in `js/formats/` und meldet sich mit `Tasks.register(op, def)` an
(Gruppe `knobeln`). Die Zahlenmauer zeichnet `js/layouts/wall.js` als Pyramide; die Gestaltung der Knobeleien
steht in `css/formats.css`. Unit-Tests: `tests/zahlenmauer.test.js`, `tests/fehler.test.js`,
`tests/welcherweg.test.js`, `tests/ueberschlag.test.js`.
