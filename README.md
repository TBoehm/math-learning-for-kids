# Einhorn-Rechenranch 🦄🐴 & Turbo-Rechenwerkstatt 🏎️🚜

Lern-App für Kinder der **3. Klasse**: Plus, Minus, Mal und Geteilt im **Zahlenraum bis 100** –
gerechnet wird im **halbschriftlichen Verfahren**, Schritt für Schritt, mit Einhörnern und Pferden als Begleiter.

**Live:** https://tboehm.github.io/math-learning-for-kids/

## Rechenwege

| Rechenart | Rechenwege | Anschauung |
|---|---|---|
| **+** Plus | Stellenweise (Z+Z, E+E) · Schrittweise (erst Zehner, dann Einer) · Hilfsaufgabe (47 + 39 → 47 + 40 − 1) | Rechenstrich |
| **−** Minus | Schrittweise · Ergänzen (37 → 40 → 80 → 82) · Hilfsaufgabe (82 − 39 → 82 − 40 + 1) | Rechenstrich |
| **·** Mal | Zerlegen (4 · 23 = 4 · 20 + 4 · 3) · Kernaufgaben (7 · 8 = 5 · 8 + 2 · 8, 9 · 6 = 10 · 6 − 1 · 6) | Malkreuz, Punktefeld |
| **:** Geteilt | Zerlegen (84 : 6 = 60 : 6 + 24 : 6), optional mit Rest | Zerlegungsbaum |
| **Schriftlich** | Addieren (auch mit drei Zahlen, Übertrag bis 1000) · Subtrahieren durch Abziehen mit Entbündeln (503 − 278: aus 5 wird 4, aus 0 wird 9, aus 3 wird 13) · Subtrahieren durch Ergänzen mit Übertrag | Rechenraster auf Karopapier |

**Schriftlich rechnen:** erst ein Überschlag (Ü: 440 + 250 = 690), dann Spalte für Spalte von rechts nach links –
Einer, Zehner, Hunderter. Die ganze Rechnung steht im Raster (H | Z | E), die aktive Spalte leuchtet.
*Mit Hilfe* stehen Überträge und umgewechselte Zahlen schon da, bei *Zerlegung selbst* gibt es Felder nur dort,
wo etwas hingehört, bei *Alles selbst* überall – das Kind entscheidet selbst, wo es überträgt oder umwechselt
(leer lassen heißt „nichts“). Im Zahlenraum bis 100 wird zweistellig gerechnet.

Jede Aufgabe wird zufällig neu erzeugt. Das Kind löst sie Zeile für Zeile; jede Zeile wird sofort geprüft.

- **Hilfe in Stufen:** 1. Fehler → Ermutigung, 2. Fehler → Tipp zum Rechenschritt, 3. Fehler → Tipp + Lösung.
- **Wie viel Hilfe?** – drei Stufen:
  - *Mit Hilfe:* Zerlegung und Zwischenschritte sind vorgegeben, nur die Ergebnisse werden eingetragen.
  - *Zerlegung selbst:* Das Kind zerlegt selbst (z. B. 38 = 30 + 8), die Schritte sind vorgegeben.
  - *Alles selbst* (Standard): Das Kind erkennt und schreibt jeden Zwischenschritt komplett selbst,
    wie im Heft: `47 + 30 = 77`, `77 + 8 = 85`. Bei Plus und Mal ist die Reihenfolge egal, beim Teilen
    ist jede gültige Zerlegung erlaubt; jeder Schritt wird gegen die Zahlen geprüft, die das Kind
    tatsächlich eingetragen hat. Umständliche Zerlegungen werden angenommen, der Begleiter zeigt dann
    einen leichteren Weg.
- **Einstellungen:** Zehnerübergang ohne / gemischt / mit, Geteilt mit Rest, Töne, Zahlenfeld.
- **Belohnungen:** Sterne, Serie ohne Fehler, Galopp-Parade nach 5 fehlerfreien Aufgaben in Folge,
  neue Begleiter ab 10, 25, 50 und 100 Sternen (Pony, Sternen-Einhorn, Pegasus, Regenbogen-Flügeleinhorn).
- **Responsiv:** Handy, Tablet und Desktop; auf Touch-Geräten gibt es ein großes Zahlenfeld.
- **Datenschutz:** keine externen Server, keine Cookies, keine Tracker. Schrift (Fredoka, OFL) liegt im Projekt,
  Fortschritt nur im `localStorage` des Geräts.

## Knobeln

Unter den Rechenwegen gibt es die Gruppe **Knobeln** (nicht in „Alle Wege“ und „Gemischt“). Alle Knobel-Aufgaben
halten sich an den eingestellten Zahlenraum (bis 100 oder bis 1000).

| Knobelei | Rechenarten | So geht's |
|---|---|---|
| **Zahlenmauer** | + (Plusmauer), − (Minusmauer) | Jeder Stein ist die Summe der zwei Steine darunter. Plusmauer: untere Reihe gegeben, Reihe für Reihe nach oben. Minusmauer: Spitze und einige Steine gegeben, die fehlenden Steine Schritt für Schritt finden – mal plus, mal minus. *Mit Hilfe:* 3 Reihen, sonst 4. |
| **Fehler finden** | + − · : | Eine fertige Rechnung aus einem echten Rechenweg, in genau einer Zeile steckt ein typischer Fehler (Zehnerübergang vergessen, verzählt, Einer vergessen, Null vergessen, Einmaleins-Fehler, falsches Rechenzeichen beim Ausgleichen). Falsche Zeile antippen, verbessern, richtiges Ergebnis. |
| **Welcher Weg?** | + − | Welcher Rechenweg ist hier besonders geschickt? (328 + 99 → Hilfsaufgabe, 702 − 698 → Ergänzen, 346 + 228 → Schrittweise …) Alle sinnvollen Wege zählen; danach wird mit dem gewählten Weg gerechnet. „Vereinfachen“ wird angeboten, sobald es diesen Rechenweg gibt. |
| **Überschlagen** | + − · | Ü: beide Zahlen auf Zehner (bis 1000 auch beide auf Hunderter) runden und grob rechnen, dann genau rechnen und vergleichen: „Passt dein Ergebnis zum Überschlag?“ – oder: Passt das Ergebnis eines anderen Kindes? |

Jede Knobelei ist ein eigenes Modul in `js/formats/` und meldet sich mit `Tasks.register(op, def)` an
(Gruppe `knobeln`); die Zahlenmauer wird von `js/layouts/wall.js` als Pyramide gezeichnet,
eigene Gestaltung steht in `css/formats.css`. Unit-Tests: `tests/zahlenmauer.test.js`, `tests/fehler.test.js`,
`tests/welcherweg.test.js`, `tests/ueberschlag.test.js`.

## Entwicklung

Reines HTML/CSS/JavaScript ohne Build-Schritt – `index.html` funktioniert sogar direkt per Doppelklick.

```bash
npm start            # lokaler Server auf http://localhost:8080
npm test             # Unit-Tests (Node, ohne Abhängigkeiten)
npm ci && npx playwright install chromium
npm run test:e2e     # Browser-Tests: Oberfläche auf Handy, Tablet, Desktop
```

| Datei | Inhalt |
|---|---|
| `js/tasks.js` | Aufgaben-Generator für alle Rechenwege |
| `js/formats/*.js` | Knobel-Aufgaben: Zahlenmauer, Fehler finden, Welcher Weg?, Überschlagen |
| `js/layouts/wall.js` | Darstellung der Zahlenmauer als Pyramide |
| `js/check.js` | Prüf-Logik: Eingaben lesen, Zeilen bewerten, Hilfe-Stufen, Lösungstext |
| `js/progress.js` | Sterne, Serien, Parade, Freischaltungen |
| `js/settings.js` | Einstellungen: Standardwerte, alte Speicherstände anpassen, Laden/Speichern, Auswahl der Rechenwege |
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
`tests/tasks.test.js` erzeugt zehntausende Aufgaben und prüft, dass jede Zeile rechnerisch stimmt,
alles im Zahlenraum bis 100 bleibt und falsche Antworten abgelehnt werden.
Auch die Logik der Oberfläche (`settings.js`, `ui-logic.js`, `viz-logic.js`) steckt in reinen Modulen mit Unit-Tests;
die Browser-Tests (`tests/e2e/`) prüfen nur, was einen echten Browser braucht: Verdrahtung, Fokus, Layout und Dialoge.

## Veröffentlichung

GitHub Pages ist auf **Deploy from a branch → `main` / root** eingestellt: jeder Push auf `main` geht automatisch live.
Der Workflow `.github/workflows/ci.yml` führt bei jedem Push und Pull Request Unit- und Browser-Tests aus.
Damit nur Grünes live geht: in *Settings → Branches* eine Regel für `main` mit den Pflicht-Checks
„Unit-Tests“ und „Browser-Tests (Ende-zu-Ende)“ anlegen und Änderungen per Pull Request mergen.
