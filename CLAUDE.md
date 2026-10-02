# Einhorn-Rechenranch – Hinweise für die Entwicklung

Statische Lern-App (HTML/CSS/JS ohne Build) für halbschriftliches (und schriftliches) Rechnen, Klasse 3, Zahlenraum bis 1000 (bis 100 zur Wiederholung).
Veröffentlicht über GitHub Pages (erforderliche Source: „GitHub Actions“): Nach einem Push auf `main` geht die App erst live,
wenn Unit- und Browser-Tests erfolgreich waren (`deploy` benötigt beide Test-Jobs).

## Tests – verbindliche Regeln

- **Testgetrieben (TDD):** erst einen fehlschlagenden Test schreiben, dann implementieren.
- **Richtige Alternativen annehmen:** Geprüft wird „ist der Schritt mathematisch richtig und passt er
  zum Rechenweg?“, nicht „stimmt er mit der Musterlösung überein?“. Neue Rechenwege brauchen Tests, die
  alle gültigen Alternativen durchspielen (siehe `tests/alternativen.test.js`).
- **Unit vor E2E:** Alles, was sich als Unit-Test prüfen lässt, wird als Unit-Test geschrieben –
  nicht als E2E-Test. Logik gehört deshalb in reine Module ohne DOM (`js/tasks.js`, `js/check.js`,
  `js/progress.js`, `js/settings.js`, `js/ui-logic.js`, …), die per `module.exports` in Node testbar sind.
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
- **Dokumentation:** `README.md` richtet sich an Eltern, Lehrkräfte und technisch Interessierte (was die App kann,
  Datenschutz, selbst hosten); Technisches für Entwickler steht in `CONTRIBUTING.md`. Neue Funktionen in beiden
  passend nachtragen; Screenshots liegen in `docs/`.
- **Lizenz:** Code MIT (`LICENSE`). Neue fremde Bestandteile (Schriften, Bilder, Bibliotheken) nur mit
  verträglicher Lizenz und mit Eintrag in `THIRD-PARTY-NOTICES.md`.
- **Cache-Sperre:** Nach Änderungen an `css/` oder `js/` `npm run stamp` ausführen (setzt `?v=<Hash>` in
  `index.html`); `tests/assets.test.js` schlägt sonst fehl. So mischen Browser nach einem Update keine alten
  und neuen Dateien.
