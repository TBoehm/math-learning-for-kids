# Einhorn-Rechenranch – Hinweise für die Entwicklung

Statische Lern-App (HTML/CSS/JS ohne Build) für halbschriftliches Rechnen, Klasse 3, Zahlenraum bis 100.
Veröffentlicht über GitHub Pages ("Deploy from a branch: main"): jeder Push auf `main` geht live.

## Tests – verbindliche Regeln

- **Testgetrieben (TDD):** erst einen fehlschlagenden Test schreiben, dann implementieren.
- **Unit vor E2E:** Alles, was sich als Unit-Test prüfen lässt, wird als Unit-Test geschrieben –
  nicht als E2E-Test. Logik gehört deshalb in reine Module ohne DOM (`js/tasks.js`, `js/check.js`,
  `js/progress.js`, `js/speech.js`, …), die per `module.exports` in Node testbar sind.
  Steckt testbare Logik in `js/app.js` oder `js/viz.js`, wird sie zuerst in ein reines Modul ausgelagert.
- **E2E nur für das, was nur im Browser geht:** Verdrahtung von DOM und Ereignissen, Fokus,
  Layout/Responsivität, Dialoge, dass keine JS-Fehler auftreten. Pro Thema ein schlanker Test.
- Zufall in Tests: Wenn ein Test eine bestimmte Eigenschaft der Aufgabe braucht, die Aufgabe gezielt
  auswählen (nicht hoffen). Wackelnde Tests sind Fehler und werden an der Ursache behoben.
- Beide Suiten laufen in der CI (`.github/workflows/ci.yml`):
  - `npm test` – Unit-Tests (Node, ohne Abhängigkeiten)
  - `npm run test:e2e` – Browser-Tests mit Playwright (lokal: `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`)

## Sonstiges

- **Keine Lehrwerks- oder Verlagsnamen** (z. B. Schulbuchreihen, Verlage) in der App oder in
  öffentlichen Texten des Repos. Inhaltlich darf sich die App an gängigen Lehrwerken und den
  Fachanforderungen Schleswig-Holstein orientieren, aber ohne sie zu nennen.
- Texte für Kinder: kindgerechtes Deutsch, Fachbegriffe wie in der Grundschule (Zehner, Einer,
  Malpunkt `·`, Geteilt `:`, Rest `R`).
- Keine externen Server zur Laufzeit ohne guten Grund (Datenschutz an Schulen); Schrift liegt lokal.
- Responsiv für Handy, Tablet und Desktop.
