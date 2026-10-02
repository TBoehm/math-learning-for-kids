---
name: deutsch-first
description: MANDATORY generation-time procedure BEFORE writing or editing ANY German text in this project - texts the companion says (hints, feedback, intros in js/tasks.js, js/check.js, js/ui-logic.js, js/themes.js, js/explain.js, js/formats/*.js), UI strings in index.html, README.md, CONTRIBUTING.md, CLAUDE.md and other docs. Core rule - copy from briefings, issues or user messages is RAW MATERIAL and must be re-idiomized, never pasted verbatim (it is often AI-generated and full of calques). Every German sentence must pass the Telefon-Test and the Rückübersetzungs-Test BEFORE it lands in a file. INVOKE this skill at the moment you are about to draft or change German text, NOT after. Also invoke when the user types /deutsch-first or complains that text "klingt übersetzt" / "englisch gedacht".
---

# Deutsch-first — denke deutsch, schreibe deutsch

Du bist dabei, deutsche Texte zu schreiben oder zu ändern. Diese Prozedur läuft **beim Schreiben**, nicht hinterher. Hintergrund: Der User hat wiederholt Texte zurückgewiesen, die „englisch gedacht und deutsch geschrieben" waren — zuletzt 2026-06-10 („ist gemessen" als Calque von _it's been measured_). Passive Regeln in CLAUDE.md und Review-Wortlisten haben das nicht verhindert. Deshalb dieses Verfahren.

## Verfahren (je Satz, vor dem Schreiben in die Datei)

1. **Briefing-Text ist Rohmaterial, nie Endfassung.** Textvorschläge aus Issues, Briefings, Änderungs-Docs oder User-Nachrichten NIEMALS wörtlich übernehmen — auch wenn sie auf Deutsch sind und „sinngemäß" erlaubt ist. Sie sind oft selbst KI-generiert und enthalten genau die Calques, die dieser Skill verhindern soll (real passiert: „ist gemessen" und „hat es sich bezahlt" standen 1:1 im Briefing-Doc und wurden durchgereicht). Inhalt extrahieren, Satz selbst neu formulieren.

2. **Telefon-Test.** Würdest du diesen Satz genau so am Telefon sagen? Bei Texten für Kinder: Würde eine Lehrerin oder ein Elternteil das einem Drittklässler genau so sagen? Wenn du zögerst: nicht patchen, sondern den Satz von der Aussage her neu denken und neu schreiben.

3. **Rückübersetzungs-Test.** Übersetze den Satz probeweise ins Englische. Wenn die englische Fassung flüssiger oder „nativer" wirkt als die deutsche, wurde der Satz englisch gedacht → komplett neu formulieren, nicht einzelne Wörter tauschen.

4. **Calque-Hotlist** (alles schon real durchgerutscht, deshalb explizit):

   | Englisch gedacht                                                     | Deutsch gedacht                                                        |
   | -------------------------------------------------------------------- | ---------------------------------------------------------------------- |
   | „ist gemessen" (_it's been measured_)                                | „ist belegt" / aktiv: „Die Studie X hat gemessen, dass …"              |
   | „hat sich bezahlt" (_has paid for itself_)                           | „hat sich bezahlt **gemacht**"                                         |
   | „wird zunehmend gefragt" (_is increasingly asked_)                   | „**ist** zunehmend gefragt"                                            |
   | temporales „über" („über die drei Wochen")                           | „verteilt über/auf …", „in den drei Wochen"                            |
   | elliptischer Konditionalsatz („Übernimmt dein Arbeitgeber nicht, …") | Objekt ausschreiben („Übernimmt dein Arbeitgeber die Kosten nicht, …") |
   | Komma-Spleiß (englischer Satzrhythmus)                               | Punkt, Semikolon oder Konnektor („und", „denn")                        |
   | „Async Feedback", wo kein Fachbegriff nötig ist                      | „Feedback zwischendurch/nebenbei"                                      |
   | „ein Rädchen in einer großen Maschine"                               | „ein Rädchen im Getriebe"                                              |

5. **Stil-Regeln dieses Projekts gelten zusätzlich** (nicht Ersatz):
   - **Ansprache:** Kinder werden geduzt (alles, was der Begleiter sagt, und die Oberfläche). README und Doku für Eltern und Lehrkräfte bleiben sachlich ohne direkte Anrede oder mit „du", wie in CONTRIBUTING.md.
   - **Kindgerecht:** kurze Sätze, Grundschul-Fachbegriffe (Zehner, Einer, Malpunkt `·`, Geteilt `:`, Rest `R`, Übertrag, umwechseln), keine Fremdwörter.
   - **Keine Gedankenstrich-Satztrenner** („Nicht ganz – du schaffst das!" → „Nicht ganz. Du schaffst das!"). Gedankenstriche nur als Bis-Strich oder in festen Wendungen.
   - **Keine „nicht weil … sondern"-Antithesen.**
   - Etablierte Tech-Begriffe in der Entwickler-Doku (Repo, Workflow, Setup, Unit-Test, Pull Request …) bleiben.
   - Texte, die Tests wörtlich prüfen, gemeinsam mit den Tests ändern.

## Definition of done

Jeder neue oder geänderte deutsche Satz hat Schritt 1–5 durchlaufen, **bevor** er in die Datei geschrieben wird.
