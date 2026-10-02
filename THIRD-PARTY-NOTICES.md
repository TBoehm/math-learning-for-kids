# Fremde Bestandteile und Lizenzen

Der Code der Einhorn-Rechenranch steht unter der [MIT-Lizenz](LICENSE). Diese Datei listet alles auf,
was **nicht** unter diese Lizenz fällt oder von Dritten stammt.

## Mit der App ausgeliefert

| Bestandteil | Dateien | Lizenz | Herkunft |
|---|---|---|---|
| **Fredoka** (Schrift, Schnitte 400/600/700, Latin-Untermenge) | `fonts/fredoka-latin-*-normal.woff2` | [SIL Open Font License 1.1](fonts/OFL.txt) | © 2016 The Fredoka Project Authors ([github.com/hafontia/Fredoka-One](https://github.com/hafontia/Fredoka-One)); WOFF2-Dateien unverändert von [Fontsource](https://fontsource.org/fonts/fredoka) (`@fontsource/fredoka`) |
| **Porträtfoto** im Chip „Agentic Engineering for Teams“ | `img/tobias-boehm.jpg` | **alle Rechte vorbehalten**, nicht MIT | © Tobias Boehm. Wer die App weiterverteilt oder selbst hostet, entfernt den Chip oder ersetzt das Bild. |

Die OFL erlaubt, die Schrift zusammen mit Software zu verwenden, zu verändern und weiterzugeben. Die Lizenzdatei
muss dabei mitgeliefert werden (`fonts/OFL.txt`); die Schrift selbst darf nicht einzeln verkauft werden.

## Selbst gemacht (MIT)

- **Begleiter und Fahrzeuge** (Einhörner, Pferde, Bagger, Rennauto …): eigene SVG-Zeichnungen im Code
  (`js/companion.js`, `js/vehicles.js`).
- **Klänge**: entstehen zur Laufzeit über die Web Audio API; Sounddateien gibt es keine (`js/sound.js`).
- **Favicon**: `favicon.svg` und die Welt-Symbole werden im Code erzeugt.

## Nicht mitgeliefert

- **Emojis** (🦄 ⭐ 🔥 …) sind Textzeichen; dargestellt werden sie mit der Emoji-Schrift des jeweiligen Geräts.
  Es werden keine Emoji-Grafiken mitgeliefert.
- **Playwright** (Apache License 2.0, © Microsoft Corporation) dient nur als Entwicklungs-Abhängigkeit
  (`devDependencies`) für die Browser-Tests und ist nicht Teil der veröffentlichten App.
- **http-server** (MIT) ist ebenfalls nur Entwicklungs-Abhängigkeit (lokaler Testserver für `npm start`) und
  nicht Teil der veröffentlichten App.
- Zur Laufzeit lädt die App **nichts** von fremden Servern: keine CDNs, keine Webfonts von Dritten,
  keine Analyse- oder Werbedienste.
