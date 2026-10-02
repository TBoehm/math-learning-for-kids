// Einstellungen: Standardwerte, alte Speicherstände, Laden und Speichern (js/settings.js).
'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const Settings = require('../js/settings.js');

// kleiner Ersatz für localStorage
function memoryStorage(initial) {
  const data = Object.assign({}, initial);
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); }
  };
}
const brokenStorage = {
  getItem() { throw new Error('privater Modus'); },
  setItem() { throw new Error('voll'); }
};
const saved = (obj) => memoryStorage({ [Settings.STORE]: JSON.stringify(obj) });

describe('Standardwerte', () => {
  test('neue Kinder starten mit "Alles selbst", Plus und allen Wegen', () => {
    const s = Settings.defaults();
    assert.deepEqual(s.settings, { op: '+', strategy: 'mix', crossing: 'egal', level: 'selbst', rest: false, sound: true, numpad: 'auto', range: 1000 });
    assert.deepEqual(s.progress, { stars: 0, streak: 0, bestStreak: 0, solved: 0 });
    assert.equal(s.companion, 'luna');
    assert.equal(s.name, '');
    assert.equal(s.welcomed, false);
  });

  test('jedes Mal eine frische Kopie', () => {
    const a = Settings.defaults();
    a.settings.level = 'hilfe';
    a.progress.stars = 9;
    assert.equal(Settings.defaults().settings.level, 'selbst');
    assert.equal(Settings.defaults().progress.stars, 0);
  });
});

describe('alte Speicherstände', () => {
  test('nichts gespeichert: Standardwerte', () => {
    assert.deepEqual(Settings.fromSaved(null), Settings.defaults());
  });

  test('"Profi-Modus" an wird zu "Zerlegung selbst", das alte Feld verschwindet', () => {
    const s = Settings.fromSaved({ welcomed: true, settings: { profi: true, sound: false } });
    assert.equal(s.settings.level, 'zerlegen');
    assert.equal('profi' in s.settings, false);
    assert.equal(s.settings.sound, false);
    assert.equal(s.welcomed, true);
  });

  test('"Profi-Modus" aus: Standardstufe "Alles selbst"', () => {
    assert.equal(Settings.fromSaved({ settings: { profi: false } }).settings.level, 'selbst');
  });

  test('eine gespeicherte Stufe gewinnt gegen den alten Profi-Schalter', () => {
    assert.equal(Settings.fromSaved({ settings: { profi: true, level: 'hilfe' } }).settings.level, 'hilfe');
  });

  test('unbekannte Stufe wird zu "Alles selbst"', () => {
    assert.equal(Settings.fromSaved({ settings: { level: 'turbo' } }).settings.level, 'selbst');
  });

  test('Fortschritt, Begleiter und Name werden übernommen, Fehlendes ergänzt', () => {
    const s = Settings.fromSaved({ progress: { stars: 7 }, companion: 'blitz', name: 'Mia' });
    assert.deepEqual(s.progress, { stars: 7, streak: 0, bestStreak: 0, solved: 0 });
    assert.equal(s.companion, 'blitz');
    assert.equal(s.name, 'Mia');
    assert.equal(s.welcomed, false);
    assert.equal(s.settings.numpad, 'auto');
  });
});

describe('Laden und Speichern', () => {
  test('speichern und wieder laden ergibt denselben Stand', () => {
    const store = memoryStorage();
    const s = Settings.defaults();
    s.name = 'Mia'; s.companion = 'blitz'; s.companions.ranch = 'blitz'; s.progress.stars = 3; s.settings.level = 'hilfe';
    assert.equal(Settings.save(store, s), true);
    assert.deepEqual(Settings.load(store), s);
  });

  test('alte Daten werden beim Laden angepasst', () => {
    assert.equal(Settings.load(saved({ settings: { profi: true } })).settings.level, 'zerlegen');
  });

  test('leerer oder kaputter Speicher: Standardwerte', () => {
    assert.deepEqual(Settings.load(memoryStorage()), Settings.defaults());
    assert.deepEqual(Settings.load(memoryStorage({ [Settings.STORE]: '{kaputt' })), Settings.defaults());
    assert.deepEqual(Settings.load(memoryStorage({ [Settings.STORE]: '5' })), Settings.defaults());
  });

  test('ohne Speicher (privater Modus) geht nichts kaputt', () => {
    assert.deepEqual(Settings.load(brokenStorage), Settings.defaults());
    assert.deepEqual(Settings.load(null), Settings.defaults());
    assert.equal(Settings.save(brokenStorage, Settings.defaults()), false);
    assert.equal(Settings.save(null, Settings.defaults()), false);
  });
});

describe('Rechenwege zur Auswahl', () => {
  test('mit "Alle Wege" vorneweg, wenn es mehrere gibt', () => {
    assert.deepEqual(Settings.strategyChoices('+').map((s) => s.key), ['mix', 'stellenweise', 'schrittweise', 'hilfsaufgabe', 'vereinfachen']);
    assert.deepEqual(Settings.strategyChoices('−').map((s) => s.key), ['mix', 'schrittweise', 'ergaenzen', 'hilfsaufgabe', 'vereinfachen']);
    assert.equal(Settings.strategyChoices('+')[0].name, 'Alle Wege');
    assert.deepEqual(Settings.strategyChoices('·').map((s) => s.key), ['mix', 'zerlegen', 'kernaufgaben', 'hilfsaufgabe']);
  });

  test('nur ein Weg: kein "Alle Wege"', () => {
    assert.deepEqual(Settings.strategyChoices(':').map((s) => s.key), ['zerlegen']);
  });

  test('gemischte Rechenarten: keine Auswahl', () => {
    assert.deepEqual(Settings.strategyChoices('mix'), []);
  });

  test('Weg, den es bei der Rechenart nicht gibt, wird zu "mix"', () => {
    assert.equal(Settings.validStrategy('−', 'ergaenzen'), 'ergaenzen');
    assert.equal(Settings.validStrategy('+', 'ergaenzen'), 'mix');
    assert.equal(Settings.validStrategy('·', 'stellenweise'), 'mix');
    assert.equal(Settings.validStrategy(':', 'mix'), 'mix');
    assert.equal(Settings.validStrategy('mix', 'ergaenzen'), 'ergaenzen', 'bei "gemischt" bleibt alles, wie es ist');
  });
});

describe('Aufgeklapptes Menü: was steht auf dem Knopf?', () => {
  test('Gruppe und Name des gewählten Wegs', () => {
    assert.deepEqual(Settings.strategyLabel('+', 'mix'), { group: 'Rechenwege', name: 'Alle Wege' });
    assert.deepEqual(Settings.strategyLabel('+', 'schrittweise'), { group: 'Rechenwege', name: 'Schrittweise' });
    assert.deepEqual(Settings.strategyLabel('−', 'ergaenzen'), { group: 'Rechenwege', name: 'Ergänzen' });
  });
  test('unbekannter Weg: wie "Alle Wege"', () => {
    assert.deepEqual(Settings.strategyLabel('+', 'ergaenzen'), { group: 'Rechenwege', name: 'Alle Wege' });
  });
  test('nur ein Weg (Geteilt): dieser Weg', () => {
    assert.deepEqual(Settings.strategyLabel(':', 'mix'), { group: 'Rechenwege', name: 'Zerlegen' });
  });
  test('gemischte Rechenarten: kein Menü', () => {
    assert.equal(Settings.strategyLabel('mix', 'mix'), null);
  });
});

describe('Zahlenraum-Schalter', () => {
  test('setzt bis 100 oder bis 1000, auch aus Text', () => {
    assert.equal(Settings.withRange(Settings.defaults().settings, '100').range, 100);
    assert.equal(Settings.withRange(Settings.defaults().settings, 1000).range, 1000);
    assert.equal(Settings.withRange(Settings.defaults().settings, 'quatsch').range, 1000);
  });
  test('verändert die alten Einstellungen nicht und verlangt eine neue Aufgabe', () => {
    const s = Settings.defaults().settings;
    const t = Settings.withRange(s, 100);
    assert.equal(s.range, 1000);
    assert.notEqual(Settings.taskKey(t), Settings.taskKey(s));
  });
});

describe('Neue Aufgabe nach den Einstellungen?', () => {
  test('nur Zehnerübergang, Stufe und Rest ändern die Aufgabe', () => {
    const s = Settings.defaults().settings;
    const key = Settings.taskKey(s);
    assert.equal(Settings.taskKey(Object.assign({}, s, { sound: false, numpad: 'on' })), key);
    for (const change of [{ crossing: 'mit' }, { level: 'hilfe' }, { rest: true }]) {
      assert.notEqual(Settings.taskKey(Object.assign({}, s, change)), key, JSON.stringify(change));
    }
  });
});

describe('Zahlenfeld', () => {
  test('"automatisch" nur auf Touch-Geräten, "immer" und "aus" wie gesagt', () => {
    assert.equal(Settings.numpadVisible('auto', true), true);
    assert.equal(Settings.numpadVisible('auto', false), false);
    assert.equal(Settings.numpadVisible('on', false), true);
    assert.equal(Settings.numpadVisible('on', true), true);
    assert.equal(Settings.numpadVisible('off', true), false);
    assert.equal(Settings.numpadVisible('off', false), false);
  });
});

describe('Stufen', () => {
  test('levelInfo liefert Name und Beschreibung', () => {
    assert.equal(Settings.levelInfo('hilfe').name, 'Mit Hilfe');
    assert.equal(Settings.levelInfo('selbst').desc, 'Jeden Rechenschritt schreibst du selbst auf.');
    assert.equal(Settings.levelInfo('turbo'), undefined);
  });
});

// Issue #3: Die App ist in zwei Tabs offen. Jeder Tab hat seinen eigenen Stand im Speicher (Arbeitsspeicher)
// und darf beim Speichern nicht überschreiben, was der andere Tab inzwischen gespeichert hat.
describe('Mehrere Tabs', () => {
  const Progress = require('../js/progress.js');
  const copy = (s) => JSON.parse(JSON.stringify(s));
  // ein Tab: Stand beim Laden merken (Basis), ändern, mit Settings.sync speichern
  function tab(storage) {
    const t = { state: Settings.load(storage) };
    t.base = copy(t.state);
    t.save = () => { t.state = Settings.sync(storage, t.base, t.state); t.base = copy(t.state); };
    t.solve = (mistakes = 0) => { t.state.progress = Progress.applyResult(t.state.progress, { mistakes }).state; t.save(); };
    return t;
  }
  const start = { progress: { stars: 5, streak: 2, bestStreak: 4, solved: 9 } };

  test('Sterne aus beiden Tabs gehen nicht verloren', () => {
    const store = saved(start);
    const a = tab(store), b = tab(store);
    a.solve();
    b.solve();
    const s = Settings.load(store);
    assert.equal(s.progress.stars, 7);
    assert.equal(s.progress.solved, 11);
    assert.equal(b.state.progress.stars, 7, 'Tab B kennt danach auch den Stern aus Tab A');
  });

  test('eine Einstellung im einen Tab löscht keine Sterne aus dem anderen', () => {
    const store = saved(start);
    const a = tab(store), b = tab(store);
    a.solve();
    b.state.settings.sound = false;
    b.save();
    const s = Settings.load(store);
    assert.equal(s.progress.stars, 6);
    assert.equal(s.settings.sound, false);
  });

  test('Sterne im einen Tab löschen keine Einstellung aus dem anderen', () => {
    const store = saved(start);
    const a = tab(store), b = tab(store);
    a.state.settings.op = '·';
    a.state.settings.level = 'hilfe';
    a.save();
    b.solve();
    const s = Settings.load(store);
    assert.equal(s.settings.op, '·');
    assert.equal(s.settings.level, 'hilfe');
    assert.equal(s.progress.stars, 6);
  });

  test('ändern beide Tabs dieselbe Einstellung, gilt die zuletzt gespeicherte', () => {
    const store = saved(start);
    const a = tab(store), b = tab(store);
    a.state.settings.op = '·'; a.save();
    b.state.settings.op = ':'; b.save();
    assert.equal(Settings.load(store).settings.op, ':');
  });

  test('Name, Welt und Begleiter aus verschiedenen Tabs bleiben alle erhalten', () => {
    const store = saved(start);
    const a = tab(store), b = tab(store);
    a.state.name = 'Mia'; a.state.welcomed = true; a.save();
    b.state.companion = 'blitz'; b.state.companions = Object.assign({}, b.state.companions, { ranch: 'blitz' }); b.save();
    const s = Settings.load(store);
    assert.equal(s.name, 'Mia');
    assert.equal(s.welcomed, true);
    assert.equal(s.companion, 'blitz');
    assert.equal(s.companions.ranch, 'blitz');
  });

  test('Serie zählt im eigenen Tab weiter, die beste Serie bleibt die größte', () => {
    const store = saved(start);
    const a = tab(store), b = tab(store);
    a.solve(); a.solve(); a.solve();      // Serie in A: 5, beste 5
    b.solve(1);                           // Fehler in B: Serie 0
    const s = Settings.load(store);
    assert.equal(s.progress.streak, 0);
    assert.equal(s.progress.bestStreak, 5);
    assert.equal(s.progress.stars, 9);
  });

  test('Neu anfangen setzt die Sterne zurück, auch wenn der andere Tab nichts geändert hat', () => {
    const store = saved(start);
    const a = tab(store);
    a.state.progress = Settings.defaults().progress;
    a.save();
    assert.deepEqual(Settings.load(store).progress, Settings.defaults().progress);
  });

  test('ohne Speicher (privater Modus) bleibt der eigene Stand erhalten', () => {
    const a = tab(brokenStorage);
    a.solve(); a.solve();
    assert.equal(a.state.progress.stars, 2);
  });

  test('beim ersten Speichern (noch nichts gespeichert) wird der eigene Stand geschrieben', () => {
    const store = memoryStorage();
    const a = tab(store);
    a.solve();
    assert.equal(Settings.load(store).progress.stars, 1);
  });

  test('merge ohne Änderung im eigenen Tab übernimmt den Stand des anderen Tabs', () => {
    const base = Settings.fromSaved(start);
    const theirs = Settings.fromSaved(Object.assign({}, start, { theme: 'werkstatt', settings: { op: ':' } }));
    theirs.progress.stars = 12;
    const m = Settings.merge(base, copy(base), theirs);
    assert.equal(m.theme, 'werkstatt');
    assert.equal(m.settings.op, ':');
    assert.equal(m.progress.stars, 12);
  });
});
