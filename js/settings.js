/*
 * Einstellungen und Speicherstand: Standardwerte, alte Speicherstände anpassen,
 * Laden/Speichern (mit austauschbarem Speicher), Auswahl der Rechenwege.
 * Reine Funktionen ohne DOM – getestet in tests/settings.test.js.
 */
(function (root) {
  'use strict';

  var Tasks = typeof module !== 'undefined' && module.exports ? require('./tasks.js') : root.RR.Tasks;

  var STORE = 'rechenranch-v1';

  var DEFAULTS = {
    settings: { op: '+', strategy: 'mix', crossing: 'egal', level: 'selbst', rest: false, sound: true, numpad: 'auto', range: 1000 },
    progress: { stars: 0, streak: 0, bestStreak: 0, solved: 0 },
    companion: 'luna', name: '', welcomed: false
  };

  /** Frische Kopie der Standardwerte. */
  function defaults() { return JSON.parse(JSON.stringify(DEFAULTS)); }

  function levelInfo(key) {
    return Tasks.LEVELS.filter(function (l) { return l.key === key; })[0];
  }

  /** Gespeicherten Stand (oder null) mit den Standardwerten zusammenführen und anpassen. */
  function fromSaved(raw) {
    var s = defaults();
    if (!raw) return s;
    s.settings = Object.assign(s.settings, raw.settings);
    // früher gab es nur "Profi-Modus" (an = Zerlegung selbst)
    if (raw.settings && !raw.settings.level && raw.settings.profi) s.settings.level = 'zerlegen';
    delete s.settings.profi;
    if (!levelInfo(s.settings.level)) s.settings.level = 'selbst';
    // Zahlenraum: bis 100 (Wiederholung) oder bis 1000 (Stoff der 3. Klasse)
    s.settings.range = Number(s.settings.range) === 100 ? 100 : 1000;
    s.progress = Object.assign(s.progress, raw.progress);
    ['companion', 'name', 'welcomed'].forEach(function (k) { if (k in raw) s[k] = raw[k]; });
    return s;
  }

  /** storage: localStorage oder Ersatz mit getItem/setItem (darf fehlen oder Fehler werfen). */
  function load(storage) {
    try {
      return fromSaved(JSON.parse(storage.getItem(STORE) || 'null'));
    } catch (e) { /* privater Modus o. Ä. – dann eben ohne Speichern */ }
    return defaults();
  }
  function save(storage, state) {
    try { storage.setItem(STORE, JSON.stringify(state)); return true; } catch (e) { return false; }
  }

  /** Rechenwege zum Auswählen; "Alle Wege" nur, wenn es mehrere gibt. */
  function strategyChoices(op) {
    if (op === 'mix') return [];
    var list = [{ key: 'mix', name: 'Alle Wege', group: 'weg' }].concat(Tasks.STRATEGIES[op]);
    return list.length === 2 ? list.slice(1) : list;
  }
  /** Gibt es den Rechenweg bei dieser Rechenart nicht, gilt "mix". */
  function validStrategy(op, strategy) {
    if (op === 'mix') return strategy;
    return strategyChoices(op).some(function (s) { return s.key === strategy; }) ? strategy : 'mix';
  }

  /** Nur diese Einstellungen verlangen eine neue Aufgabe. */
  function taskKey(settings) {
    return JSON.stringify([settings.crossing, settings.level, settings.rest, Number(settings.range)]);
  }

  /** Zahlenfeld zeigen? mode: 'auto' | 'on' | 'off', coarse: Touch-Gerät */
  function numpadVisible(mode, coarse) {
    return mode === 'on' || (mode === 'auto' && !!coarse);
  }

  var api = {
    STORE: STORE, defaults: defaults, fromSaved: fromSaved, load: load, save: save, levelInfo: levelInfo,
    strategyChoices: strategyChoices, validStrategy: validStrategy, taskKey: taskKey, numpadVisible: numpadVisible
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RR = Object.assign(root.RR || {}, { Settings: api });
})(typeof window !== 'undefined' ? window : this);
