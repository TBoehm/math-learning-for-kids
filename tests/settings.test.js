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
    s.name = 'Mia'; s.companion = 'blitz'; s.progress.stars = 3; s.settings.level = 'hilfe';
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
    assert.deepEqual(Settings.strategyChoices('+').map((s) => s.key), ['mix', 'stellenweise', 'schrittweise', 'hilfsaufgabe']);
    assert.equal(Settings.strategyChoices('+')[0].name, 'Alle Wege');
    assert.deepEqual(Settings.strategyChoices('·').map((s) => s.key), ['mix', 'zerlegen', 'kernaufgaben']);
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
