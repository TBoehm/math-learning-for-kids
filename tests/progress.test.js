// Tests für Sterne, Serien und Freischaltungen (js/progress.js).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Progress = require('../js/progress.js');

const fresh = () => ({ stars: 0, streak: 0, bestStreak: 0, solved: 0 });
const unlocks = [{ key: 'a', stars: 0 }, { key: 'b', stars: 3 }, { key: 'c', stars: 5 }];

test('fehlerfrei gelöst: 1 Stern, Serie +1', () => {
  const r = Progress.applyResult(fresh(), { mistakes: 0, hintsUsed: 0 }, unlocks);
  assert.equal(r.state.stars, 1);
  assert.equal(r.state.streak, 1);
  assert.equal(r.state.bestStreak, 1);
  assert.equal(r.state.solved, 1);
  assert.equal(r.events.perfect, true);
});

test('mit Fehlern gelöst: trotzdem 1 Stern, aber Serie beginnt von vorn', () => {
  const s = Object.assign(fresh(), { streak: 4, bestStreak: 4, stars: 4 });
  const r = Progress.applyResult(s, { mistakes: 2, hintsUsed: 0 }, unlocks);
  assert.equal(r.state.stars, 5);
  assert.equal(r.state.streak, 0);
  assert.equal(r.state.bestStreak, 4);
  assert.equal(r.events.perfect, false);
});

test('Tipps zählen nicht als Fehler, beenden aber die Serie nicht', () => {
  const s = Object.assign(fresh(), { streak: 2, bestStreak: 2 });
  const r = Progress.applyResult(s, { mistakes: 0, hintsUsed: 1 }, unlocks);
  assert.equal(r.state.streak, 3);
});

test('jede 5. fehlerfreie Aufgabe in Folge löst die Galopp-Parade aus', () => {
  let s = fresh(), parades = 0;
  for (let i = 0; i < 10; i++) {
    const r = Progress.applyResult(s, { mistakes: 0, hintsUsed: 0 }, unlocks);
    if (r.events.parade) parades++;
    s = r.state;
  }
  assert.equal(parades, 2);
});

test('Freischaltung genau beim Erreichen der Sternzahl', () => {
  let s = fresh();
  const got = [];
  for (let i = 0; i < 6; i++) {
    const r = Progress.applyResult(s, { mistakes: 1, hintsUsed: 0 }, unlocks);
    got.push(r.events.unlocked.map((u) => u.key).join(','));
    s = r.state;
  }
  assert.deepEqual(got, ['', '', 'b', '', 'c', '']);
});

test('applyResult verändert den alten Zustand nicht', () => {
  const s = fresh();
  Progress.applyResult(s, { mistakes: 0, hintsUsed: 0 }, unlocks);
  assert.deepEqual(s, fresh());
});

test('isUnlocked', () => {
  assert.equal(Progress.isUnlocked({ stars: 4 }, unlocks[1]), true);
  assert.equal(Progress.isUnlocked({ stars: 4 }, unlocks[2]), false);
});
