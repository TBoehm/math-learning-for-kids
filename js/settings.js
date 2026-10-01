/*
 * Einstellungen und Speicherstand: Standardwerte, alte Speicherstände anpassen,
 * Laden/Speichern (mit austauschbarem Speicher), Auswahl der Rechenwege.
 * Reine Funktionen ohne DOM – getestet in tests/settings.test.js.
 */
(function (root) {
  'use strict';

  var node = typeof module !== 'undefined' && module.exports;
  var Tasks = node ? require('./tasks.js') : root.RR.Tasks;
  var Themes = node ? require('./themes.js') : root.RR.Themes;

  var STORE = 'rechenranch-v1';

  var DEFAULTS = {
    settings: { op: '+', strategy: 'mix', crossing: 'egal', level: 'selbst', rest: false, sound: true, numpad: 'auto', range: 1000 },
    progress: { stars: 0, streak: 0, bestStreak: 0, solved: 0 },
    companion: 'luna', name: '', welcomed: false,
    // Welt und gemerkter Begleiter je Welt
    theme: 'ranch', companions: null
  };

  /** Frische Kopie der Standardwerte. */
  function defaults() {
    var d = JSON.parse(JSON.stringify(DEFAULTS));
    d.companions = Themes.defaultCompanions();
    return d;
  }

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
    s.settings.range = normalRange(s.settings.range);
    s.progress = Object.assign(s.progress, raw.progress);
    ['companion', 'name', 'welcomed'].forEach(function (k) { if (k in raw) s[k] = raw[k]; });
    // Welt: unbekannt -> Ranch; Begleiter gehört zur Welt, sonst deren gemerkter/Standard-Begleiter
    s.theme = Themes.isTheme(raw.theme) ? raw.theme : 'ranch';
    s.companions = Object.assign(Themes.defaultCompanions(), raw.companions);
    var home = Themes.themeOfCompanion(s.companion);
    if (home) s.companions[home] = s.companion;
    if (home !== s.theme) s.companion = s.companions[s.theme];
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

  /** Rechenwege zum Auswählen, nach Gruppen geordnet; "Alle Wege" nur, wenn es mehrere gibt. */
  function strategyChoices(op) {
    if (op === 'mix') return [];
    var order = Tasks.GROUPS.map(function (g) { return g.key; });
    var rank = function (s) { return order.indexOf(s.group); };
    var sorted = Tasks.STRATEGIES[op].map(function (s, i) { return { s: s, i: i }; })
      .sort(function (x, y) { return rank(x.s) - rank(y.s) || x.i - y.i; })
      .map(function (x) { return x.s; });
    var list = [{ key: 'mix', name: 'Alle Wege', group: 'weg' }].concat(sorted);
    return list.length === 2 ? list.slice(1) : list;
  }
  function normalRange(v) { return Number(v) === 100 ? 100 : 1000; }
  /** Zahlenraum umschalten (Schalter über der Aufgabe): neue Einstellungen, die alten bleiben unverändert. */
  function withRange(settings, v) { return Object.assign({}, settings, { range: normalRange(v) }); }

  /** Aufschrift des Menü-Knopfs: Gruppe und Name des gewählten Wegs (null bei gemischten Rechenarten). */
  function strategyLabel(op, strategy) {
    var list = strategyChoices(op);
    if (!list.length) return null;
    var key = validStrategy(op, strategy);
    var s = list.filter(function (x) { return x.key === key; })[0] || list[0];
    var group = Tasks.GROUPS.filter(function (g) { return g.key === s.group; })[0];
    return { group: group ? group.name : '', name: s.name };
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
    strategyChoices: strategyChoices, strategyLabel: strategyLabel, withRange: withRange, validStrategy: validStrategy, taskKey: taskKey, numpadVisible: numpadVisible
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RR = Object.assign(root.RR || {}, { Settings: api });
})(typeof window !== 'undefined' ? window : this);
