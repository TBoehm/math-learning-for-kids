/*
 * Fortschritt: Sterne, Serien, Galopp-Parade und Freischaltungen.
 * Reine Funktionen – getestet in tests/progress.test.js.
 */
(function (root) {
  'use strict';

  var PARADE_EVERY = 5;

  function isUnlocked(state, companion) { return (state.stars || 0) >= companion.stars; }

  /**
   * Wertet eine gelöste Aufgabe aus.
   * result: { mistakes, hintsUsed }
   * -> { state: neuer Zustand, events: { perfect, parade, unlocked: [...] } }
   */
  function applyResult(state, result, companions) {
    var s = Object.assign({}, state);
    var perfect = (result.mistakes || 0) === 0;
    s.stars = (s.stars || 0) + 1;
    s.solved = (s.solved || 0) + 1;
    s.streak = perfect ? (s.streak || 0) + 1 : 0;
    s.bestStreak = Math.max(s.bestStreak || 0, s.streak);
    var unlocked = (companions || []).filter(function (c) {
      return c.stars > (state.stars || 0) && c.stars <= s.stars;
    });
    return {
      state: s,
      events: { perfect: perfect, parade: perfect && s.streak % PARADE_EVERY === 0, unlocked: unlocked }
    };
  }

  var api = { applyResult: applyResult, isUnlocked: isUnlocked, PARADE_EVERY: PARADE_EVERY };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RR = Object.assign(root.RR || {}, { Progress: api });
})(typeof window !== 'undefined' ? window : this);
