# Einhorn-Rechenranch 🦄🐴

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
- **Einstellungen:** Zehnerübergang ohne / gemischt / mit, Geteilt mit Rest, Töne, Zahlenfeld, Vorlese-Stimme.
- **Vorlesen:** nimmt automatisch die beste deutsche Stimme des Geräts (z. B. „Katja (Natural)“ in Edge,
  „Google Deutsch“ in Chrome, „Anna (Premium)“ auf dem iPad); in den Einstellungen wählbar mit Hörprobe.
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
| `js/viz.js` | Rechenstrich, Malkreuz, Punktefeld, Zerlegungsbaum |
| `js/companion.js` | Begleiter als SVG |
| `js/voice.js` | Beste deutsche Vorlese-Stimme des Geräts finden (Edge „Natural“, Google, Apple Premium …) |
| `js/speech.js` | Text für „Vorlesen“ aufbereiten (84 : 6 → „84 geteilt durch 6“) |
| `js/sound.js` | Klänge per Web-Audio (keine Sounddateien) |
| `js/app.js` | Oberfläche und Ablauf |

Die Prüf-Logik (`check.js`, `progress.js`, `speech.js`) ist testgetrieben entwickelt und ohne DOM testbar.
`tests/tasks.test.js` erzeugt zehntausende Aufgaben und prüft, dass jede Zeile rechnerisch stimmt,
alles im Zahlenraum bis 100 bleibt und falsche Antworten abgelehnt werden.

## Veröffentlichung

GitHub Pages ist auf **Deploy from a branch → `main` / root** eingestellt: jeder Push auf `main` geht automatisch live.
Der Workflow `.github/workflows/ci.yml` führt bei jedem Push und Pull Request Unit- und Browser-Tests aus.
Damit nur Grünes live geht: in *Settings → Branches* eine Regel für `main` mit den Pflicht-Checks
„Unit-Tests“ und „Browser-Tests (Ende-zu-Ende)“ anlegen und Änderungen per Pull Request mergen.
