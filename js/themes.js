/*
 * Welten (Themes): Einhorn-Ranch und Turbo-Werkstatt.
 * Texte, Begleiter, Effekte und Klänge je Welt; Wechsel der Welt merkt sich den Begleiter.
 * Reine Funktionen – getestet in tests/themes.test.js.
 */
(function (root) {
  'use strict';

  var THEMES = [
    {
      key: 'ranch',
      name: 'Einhorn-Ranch',
      title: 'Einhorn-Rechenranch',
      icon: '🦄',
      welcome: 'Willkommen auf der Rechenranch! 🌈',
      doneHint: 'Das hast du super gemacht! Drück auf „Weiter“. 🐴',
      companions: ['luna', 'blitz', 'karamell', 'nebula', 'wolke', 'aurora'],
      defaultCompanion: 'luna',
      sound: 'gallop',
      confetti: ['⭐', '💖', '🌈', '✨', '🦄', '🌸', '💜', '🐴', '🍭'],
      colors: ['#ff7ac6', '#9b6bff', '#58c7ff', '#ffd65c', '#6fe3a8', '#ff9f5a'],
      decor: ['🌸', '🌼', '🌷', '🌸', '🍄', '🌼'],
      paradeBanner: function (n) { return n + ' richtig hintereinander! 🎉'; },
      texts: {
        rowOk: ['Richtig!', 'Genau!', 'Super!', 'Prima!', 'Stimmt!', 'Klasse!', 'Jawoll!', 'Toll!'],
        perfect: ['Wieherrrvorragend! 🐴', 'Zauberhaft gerechnet! ✨', 'Du bist ein Rechen-Star! ⭐',
          'Galoppierend gut! 🏇', 'Einhorn-mäßig super! 🦄', 'Volltreffer! 🎯', 'Regenbogen-stark! 🌈'],
        solved: ['Geschafft! Fehler machen schlau. 💪', 'Super, du hast nicht aufgegeben! 🌈',
          'Richtig! Übung macht den Meister. ⭐', 'Juhu, gelöst! 🎉'],
        oops: ['Fast! Schau noch mal genau hin. 🔍', "Hoppla! Probier's noch einmal. 🐎",
          'Nicht ganz – du schaffst das! 💪', 'Hmm, rechne noch mal nach. 🤔'],
        poke: ['Hihi, das kitzelt! 🦄', 'Ich mag Zahlen fast so gern wie Möhren! 🥕',
          'Zusammen rechnen macht Spaß! 💖', 'Wiehern ist meine Lieblingssprache! 🐴',
          'Ich glaub an dich! ⭐', 'Jede Aufgabe macht dich stärker! 💪']
      }
    },
    {
      key: 'werkstatt',
      name: 'Turbo-Werkstatt',
      title: 'Turbo-Rechenwerkstatt',
      icon: '🏎️',
      welcome: 'Willkommen in der Rechenwerkstatt! 🔧',
      doneHint: 'Saubere Arbeit! Drück auf „Weiter“. 🏁',
      companions: ['v-bruno', 'v-flitz', 'v-funke', 'v-kalle', 'v-rumms', 'v-turbomax'],
      defaultCompanion: 'v-bruno',
      sound: 'engine',
      confetti: ['⭐', '🏁', '🔧', '⚡', '🏆', '🔩', '💥', '🚧'],
      colors: ['#ff8a1f', '#ffd23f', '#2f80ed', '#e63946', '#3d4451', '#2ec4b6'],
      decor: ['🚧', '🌳', '🚧', '🌲', '🚧', '🌳'],
      paradeBanner: function (n) { return n + ' richtig in Folge – Turbo! 🏁'; },
      texts: {
        rowOk: ['Richtig!', 'Zack!', 'Stimmt!', 'Sauber!', 'Passt!', 'Genau!', 'Läuft!'],
        perfect: ['Volltreffer! 🎯', 'Hammer! 🔨', 'Zack – gelöst! ⚡', 'Vollgas – richtig! 🏎️',
          'Boxenstopp? Brauchst du nicht! 🏁', 'Turbo-Rechner! 🚀', 'Läuft wie geschmiert! 🔧',
          'Saubere Arbeit, Chef! 👷', 'Bärenstark! 💪', 'Ziel erreicht! 🏆'],
        solved: ['Ziel erreicht! Weiter geht die Fahrt. 🏁', 'Geschafft – jetzt weißt du mehr! 💪',
          'Baustelle erledigt! 🚧', 'Richtig! Auch Profis justieren mal nach. 🔧'],
        oops: ['Fast! Nimm nochmal Anlauf. 🏎️', 'Kurzer Boxenstopp – du schaffst das. 🔧',
          "Kleiner Umweg – probier's nochmal! 🚧", 'Schraub nochmal kurz dran. 🔩',
          'Motor läuft noch – neuer Versuch! 💪'],
        poke: ['Wrrrumm! 🏎️', 'Brumm brumm – los geht\'s! 🚜', 'Mit Vollgas zum Ergebnis! ⚡',
          'Ich mag Zahlen fast so gern wie Matsch! 💦', 'Tank ist voll – ich bin bereit! ⛽',
          'Zusammen sind wir ein Super-Team! 🏆']
      }
    }
  ];

  function byKey(key) {
    return THEMES.filter(function (t) { return t.key === key; })[0] || THEMES[0];
  }
  function isTheme(key) { return THEMES.some(function (t) { return t.key === key; }); }

  /** Nächste Welt (für den Umschalter in der Kopfzeile). */
  function next(key) {
    var i = THEMES.indexOf(byKey(key));
    return THEMES[(i + 1) % THEMES.length].key;
  }

  /** Zu welcher Welt gehört ein Begleiter? */
  function themeOfCompanion(companionKey) {
    var t = THEMES.filter(function (x) { return x.companions.indexOf(companionKey) >= 0; })[0];
    return t ? t.key : null;
  }

  /** Begleiter-Merkliste je Welt mit Standardwerten. */
  function defaultCompanions() {
    var m = {};
    THEMES.forEach(function (t) { m[t.key] = t.defaultCompanion; });
    return m;
  }

  /**
   * Welt wechseln: den aktuellen Begleiter für die alte Welt merken und den gemerkten
   * (oder Standard-) Begleiter der neuen Welt nehmen. Gibt einen neuen Zustand zurück.
   */
  function switchTheme(state, key) {
    var s = Object.assign({}, state);
    var companions = Object.assign(defaultCompanions(), state.companions);
    if (state.companion && themeOfCompanion(state.companion) === byKey(state.theme).key) {
      companions[byKey(state.theme).key] = state.companion;
    }
    s.theme = byKey(key).key;
    s.companions = companions;
    s.companion = companions[s.theme];
    return s;
  }

  var api = {
    THEMES: THEMES, byKey: byKey, isTheme: isTheme, next: next,
    themeOfCompanion: themeOfCompanion, defaultCompanions: defaultCompanions, switchTheme: switchTheme
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RR = Object.assign(root.RR || {}, { Themes: api });
})(typeof window !== 'undefined' ? window : this);
