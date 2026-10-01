# Einhorn-Rechenranch 🦄🐴

Lern-App für Kinder der **3. Klasse**: Plus, Minus, Mal und Geteilt im **Zahlenraum bis 1000** (zur Wiederholung auch bis 100) –
gerechnet wird im **halbschriftlichen Verfahren**, Schritt für Schritt, mit Einhörnern und Pferden als Begleiter.

**Live:** https://tboehm.github.io/math-learning-for-kids/

## Rechenwege

| Rechenart | Rechenwege | Anschauung |
|---|---|---|
| **+** Plus | Stellenweise (H+H, Z+Z, E+E – Reihenfolge frei) · Schrittweise (346 + 200 + 20 + 8, eigene Schritte erlaubt) · Hilfsaufgabe (59 + 19 → 60 + 19 − 1 oder 59 + 20 − 1) · Vereinfachen (239 + 41 = 240 + 40) | Rechenstrich |
| **−** Minus | Schrittweise · Ergänzen, wenn die Zahlen nah beieinander liegen (590 → 600 → 900 → 930, Probe mit der Umkehraufgabe) · Hilfsaufgabe (82 − 39 → 82 − 40 + 1 oder 80 − 39 + 2) · Vereinfachen (73 − 29 = 74 − 30) | Rechenstrich |
| **·** Mal | Zerlegen (4 · 23 = 4 · 20 + 4 · 3, auch 7 · 48 = 5 · 48 + 2 · 48) · Kernaufgaben mit 1 ·, 2 ·, 5 ·, 10 · (7 · 8 = 5 · 8 + 2 · 8, 8 · 6 = 10 · 6 − 2 · 6) · Hilfsaufgabe (9 · 15 = 10 · 15 − 15, 6 · 39 = 6 · 40 − 6) | Malkreuz, Punktefeld |
| **:** Geteilt | Zerlegen in leichte Teile (852 : 4 = 800 : 4 + 40 : 4 + 12 : 4), Ergebniszeile `852 : 4 = 213`, Probe `213 · 4 = 852`, optional mit Rest | Zerlegungsbaum |

Jede Aufgabe wird zufällig neu erzeugt. Das Kind löst sie Zeile für Zeile; jede Zeile wird sofort geprüft.

- **Hilfe in Stufen:** 1. Fehler → Ermutigung, 2. Fehler → Tipp zum Rechenschritt, 3. Fehler → Tipp + Lösung.
- **Wie viel Hilfe?** – drei Stufen:
  - *Mit Hilfe:* Zerlegung und Zwischenschritte sind vorgegeben, nur die Ergebnisse werden eingetragen.
  - *Zerlegung selbst:* Das Kind zerlegt selbst (z. B. 38 = 30 + 8), die Schritte sind vorgegeben.
  - *Alles selbst* (Standard): Das Kind erkennt und schreibt jeden Zwischenschritt komplett selbst,
    wie im Heft: `47 + 30 = 77`, `77 + 8 = 85`. Jeder richtige Schritt, der zum Rechenweg passt, wird
    angenommen (welche Zahl gerundet wird, welche Stelle zuerst kommt, wie viele Schritte, Sprünge oder
    Teile); jeder weitere Schritt wird gegen die Zahlen geprüft, die das Kind tatsächlich eingetragen hat,
    und die Rechnung wächst mit. Umständliche Wege werden angenommen, der Begleiter zeigt dann einen leichteren.
- **Einstellungen:** Zehnerübergang ohne / gemischt / mit, Geteilt mit Rest, Töne, Zahlenfeld.
- **Belohnungen:** Sterne, Serie ohne Fehler, Galopp-Parade nach 5 fehlerfreien Aufgaben in Folge,
  neue Begleiter ab 10, 25, 50 und 100 Sternen (Pony, Sternen-Einhorn, Pegasus, Regenbogen-Flügeleinhorn).
- **Responsiv:** Handy, Tablet und Desktop; auf Touch-Geräten gibt es ein großes Zahlenfeld.
- **Datenschutz:** keine externen Server, keine Cookies, keine Tracker. Schrift (Fredoka, OFL) liegt im Projekt,
  Fortschritt nur im `localStorage` des Geräts.

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
| `js/check.js` | Prüf-Logik: Eingaben lesen, Zeilen bewerten, Hilfe-Stufen, Lösungstext |
| `js/progress.js` | Sterne, Serien, Parade, Freischaltungen |
| `js/settings.js` | Einstellungen: Standardwerte, alte Speicherstände anpassen, Laden/Speichern, Auswahl der Rechenwege |
| `js/ui-logic.js` | Logik der Oberfläche ohne DOM: Eingaben, Zahlenfeld, Felder nach dem Prüfen, Texte des Begleiters |
| `js/viz-logic.js` | Inhalte der Anschauungen ohne DOM: Malkreuz, Zerlegungsbaum, Punktefeld, Lage auf dem Rechenstrich |
| `js/viz.js` | Rechenstrich, Malkreuz, Punktefeld, Zerlegungsbaum |
| `js/companion.js` | Begleiter als SVG |
| `js/sound.js` | Klänge per Web-Audio (keine Sounddateien) |
| `js/app.js` | Oberfläche und Ablauf |

Die Prüf-Logik (`check.js`, `progress.js`) ist testgetrieben entwickelt und ohne DOM testbar.
`tests/tasks.test.js` und `tests/rechenwege.test.js` erzeugen zehntausende Aufgaben und prüfen, dass jede Zeile rechnerisch stimmt,
alles im Zahlenraum bleibt und falsche Antworten abgelehnt werden; `tests/alternativen.test.js` spielt für jeden
Rechenweg andere richtige Wege durch und prüft, dass sie angenommen werden.
Auch die Logik der Oberfläche (`settings.js`, `ui-logic.js`, `viz-logic.js`) steckt in reinen Modulen mit Unit-Tests;
die Browser-Tests (`tests/e2e/`) prüfen nur, was einen echten Browser braucht: Verdrahtung, Fokus, Layout und Dialoge.

## Veröffentlichung

GitHub Pages ist auf **Deploy from a branch → `main` / root** eingestellt: jeder Push auf `main` geht automatisch live.
Der Workflow `.github/workflows/ci.yml` führt bei jedem Push und Pull Request Unit- und Browser-Tests aus.
Damit nur Grünes live geht: in *Settings → Branches* eine Regel für `main` mit den Pflicht-Checks
„Unit-Tests“ und „Browser-Tests (Ende-zu-Ende)“ anlegen und Änderungen per Pull Request mergen.
