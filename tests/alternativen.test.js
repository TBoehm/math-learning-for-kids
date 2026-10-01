// Richtige andere Rechenwege werden angenommen – für jeden Rechenweg, jede Stufe und beide Zahlenräume.
// Jeder Weg wird komplett durchgespielt: Jede spätere Zeile muss zu den Zahlen passen, die das Kind
// tatsächlich eingetragen hat. Falsche oder unpassende Schritte werden abgelehnt.
'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { Tasks, Check, inputs, opsOf, fresh, play, playPath } = require('./helfer.js');

const RANGES = [100, 1000];
const RUNS = 40;
const gen = (op, strategy, level, max, extra) =>
  Tasks.generate(Object.assign({ op, strategy, level, max, crossing: 'egal' }, extra));

// ---------- Helfer für die Wege ----------
/** Stellenwerte einer Zahl: 346 -> [300, 40, 6] (Nullen fallen weg) */
const placeParts = (n) => [100, 10, 1].map((p) => (Math.floor(n / p) % 10) * p).filter((x) => x > 0);
/** Glatte Zahlen nahe v: Zehnerzahlen höchstens 5 entfernt, bis 1000 auch Hunderterzahlen höchstens 10 entfernt */
function near(v, max) {
  const out = [];
  for (let g = 10; g <= v + 10; g += 10) {
    if (g === v) continue;
    const d = Math.abs(g - v);
    if (d <= 5 || (max === 1000 && g % 100 === 0 && d <= 10)) out.push(g);
  }
  return out;
}
function permutations(xs) {
  if (xs.length <= 1) return [xs.slice()];
  const out = [];
  xs.forEach((x, i) => permutations(xs.slice(0, i).concat(xs.slice(i + 1))).forEach((p) => out.push([x].concat(p))));
  return out;
}
/** Zufällige Zerlegung von n in k positive Teile */
function randomParts(n, k) {
  if (k <= 1 || n < k) return [n];
  const cuts = new Set();
  while (cuts.size < k - 1) cuts.add(1 + Math.floor(Math.random() * (n - 1)));
  const c = [0].concat([...cuts].sort((x, y) => x - y), [n]);
  return c.slice(1).map((x, i) => x - c[i]);
}
/** Aufgabe mit einer bestimmten Eigenschaft gezielt auswählen */
function find(make, pred) {
  for (let i = 0; i < 300000; i++) { const t = make(); if (pred(t)) return t; }
  throw new Error('Aufgabe kommt nicht vor');
}
const ok = (task, rows, msg) => {
  const r = playPath(task, rows);
  assert.ok(r.ok, Tasks.taskText(task) + ' ' + task.level + ' ' + (msg || '') + ': Weg ' + JSON.stringify(rows) +
    (r.ok ? '' : ' abgelehnt in Zeile ' + r.row + ' mit ' + JSON.stringify(r.used) + ' ' + JSON.stringify(r.result.fields.map((f) => f.status))));
  return r;
};
const rejected = (task, rows, rowIndex, msg) => {
  const r = playPath(task, rows);
  assert.ok(!r.ok, Tasks.taskText(task) + ' ' + (msg || '') + ': falscher Weg angenommen ' + JSON.stringify(rows));
  assert.equal(r.row, rowIndex, Tasks.taskText(task) + ' ' + (msg || '') + ': abgelehnt in Zeile ' + r.row + ' statt ' + rowIndex);
};
/** Schritte mit vorgegebenem Start ("Zerlegung selbst"): [[stelle, zwischenergebnis], …] */
function steps(start, parts, op) {
  let cur = start;
  return parts.map((x) => { cur = op === '+' ? cur + x : cur - x; return [x, cur]; });
}
/** Kette von Schritten: [[start, schritt, ergebnis], …] mit op */
function chain(start, steps, op) {
  let cur = start;
  return steps.map((s) => { const row = [cur, s, op === '+' ? cur + s : cur - s]; cur = row[2]; return row; });
}

// ---------- Plus und Minus: Hilfsaufgabe ----------
describe('Hilfsaufgabe Plus: jede Summand darf gerundet werden, dann richtig ausgleichen', () => {
  test('Beispiel 59 + 19: 60 + 19 und 59 + 20, beide mit 79 − 1', () => {
    const t = find(() => gen('+', 'hilfsaufgabe', 'selbst', 100), (x) => x.a === 59 && x.b === 19);
    ok(t, [[60, 19, 79], [79, 1, 78]]);
    ok(t, [[59, 20, 79], [79, 1, 78]]);
    ok(t, [[19, 60, 79], [79, 1, 78]]);
    ok(t, [[20, 59, 79], [79, 1, 78]]);
  });

  for (const max of RANGES) {
    test(`bis ${max}: alle glatten Hilfszahlen, Ausgleich mit dem richtigen Rechenzeichen`, () => {
      for (let k = 0; k < RUNS; k++) {
        const t = gen('+', 'hilfsaufgabe', 'selbst', max), a = t.a, b = t.b, ans = a + b;
        const pairs = [];
        near(a, max).forEach((g) => pairs.push([g, b]));
        near(b, max).forEach((g) => pairs.push([a, g]));
        near(a, max).forEach((ga) => near(b, max).forEach((gb) => pairs.push([ga, gb])));
        let tried = 0;
        for (const [x, y] of pairs) {
          const s1 = x + y, corr = s1 - ans;
          if (corr === 0) continue;
          for (const first of [[x, y], [y, x]]) {
            const r = ok(t, [first.concat(s1), [s1, Math.abs(corr), ans]]);
            tried++;
            // Rechenzeichen der Ausgleichszeile: zu viel gerechnet -> minus, zu wenig -> plus
            const played = fresh(t);
            play(played, (row, i) => [first.concat(s1), [s1, Math.abs(corr), ans]][i]);
            assert.deepEqual(opsOf(played.rows[1]), [corr > 0 ? '−' : '+'], Tasks.taskText(t) + ' ' + first);
            assert.ok(r.ok);
            // falsches Rechenzeichen beim Ausgleichen
            rejected(t, [first.concat(s1), [s1, Math.abs(corr), s1 + corr]], 1, 'Ausgleich andersherum');
          }
        }
        assert.ok(tried >= 2, Tasks.taskText(t) + ': zu wenige Wege');
        // keine Hilfszahl: das ist die ganze Aufgabe
        rejected(t, [[a, b, ans]], 0, 'ohne glatte Zahl');
        // weit weg ist keine Hilfszahl
        const far = b + 23;
        if (![a, b].concat(near(a, max), near(b, max)).includes(far)) rejected(t, [[a, far, a + far]], 0, 'weit weg');
      }
    });
  }

  test('Mit Hilfe und Zerlegung selbst: vorgegebener Weg funktioniert', () => {
    for (const max of RANGES) {
      for (const level of ['hilfe', 'zerlegen']) {
        for (let k = 0; k < RUNS; k++) assert.ok(play(fresh(gen('+', 'hilfsaufgabe', level, max))).ok);
      }
    }
  });
});

describe('Hilfsaufgabe Minus: Subtrahend oder Minuend runden, richtig ausgleichen', () => {
  for (const max of RANGES) {
    test(`bis ${max}: a − B + d, a − B − d, A − b ∓ d`, () => {
      for (let k = 0; k < RUNS; k++) {
        const t = gen('−', 'hilfsaufgabe', 'selbst', max), a = t.a, b = t.b, ans = a - b;
        const pairs = [];
        near(b, max).forEach((g) => pairs.push([a, g]));
        near(a, max).forEach((g) => pairs.push([g, b]));
        near(a, max).forEach((ga) => near(b, max).forEach((gb) => pairs.push([ga, gb])));
        let tried = 0;
        for (const [x, y] of pairs) {
          if (x < y) continue;
          const s1 = x - y, corr = ans - s1;
          if (corr === 0) continue;
          ok(t, [[x, y, s1], [s1, Math.abs(corr), ans]]);
          const played = fresh(t);
          play(played, (row, i) => [[x, y, s1], [s1, Math.abs(corr), ans]][i]);
          assert.deepEqual(opsOf(played.rows[1]), [corr > 0 ? '+' : '−'], Tasks.taskText(t) + ': ' + x + ' − ' + y);
          rejected(t, [[x, y, s1], [s1, Math.abs(corr), s1 - corr]], 1, 'Ausgleich andersherum');
          tried++;
        }
        assert.ok(tried >= 2, Tasks.taskText(t));
        // Minus: Reihenfolge fest
        const g = near(b, max)[0];
        if (g !== a) rejected(t, [[g, a, a - g]], 0, 'vertauscht');
        rejected(t, [[a, b, ans]], 0, 'ohne glatte Zahl');
      }
    });
  }
});

// ---------- Schrittweise ----------
describe('Schrittweise Plus: eigene Schritte, auch mehr als zwei', () => {
  test('Beispiel 47 + 38: auch 47 + 3 = 50, 50 + 30 = 80, 80 + 5 = 85', () => {
    const t = find(() => gen('+', 'schrittweise', 'selbst', 100), (x) => x.a === 47 && x.b === 38);
    ok(t, chain(47, [3, 30, 5], '+'));
    ok(t, chain(47, [30, 8], '+'));
    ok(t, chain(47, [8, 30], '+'));
    ok(t, chain(38, [40, 7], '+'), 'mit der zweiten Zahl anfangen');
  });

  for (const max of RANGES) {
    test(`bis ${max}: Stellen in jeder Reihenfolge, bis zum Zehner, freie Schritte`, () => {
      for (let k = 0; k < RUNS; k++) {
        const t = gen('+', 'schrittweise', 'selbst', max), a = t.a, b = t.b, T = a + b;
        const ways = permutations(placeParts(b)).map((p) => chain(a, p, '+'));
        permutations(placeParts(a)).forEach((p) => ways.push(chain(b, p, '+')));
        if (a % 10 && (a % 10) + (b % 10) >= 10) {
          const toTen = 10 - (a % 10);
          ways.push(chain(a, [toTen].concat(placeParts(b - toTen)), '+'));
        }
        for (let n = 2; n <= 4; n++) ways.push(chain(a, randomParts(b, n), '+'));
        ways.forEach((w) => ok(t, w));
        // Plus: Startzahl und Schritt dürfen getauscht stehen
        ok(t, chain(a, placeParts(b), '+').map((r) => [r[1], r[0], r[2]]), 'getauscht');
        // ganze Zahl auf einmal ist kein Schritt
        rejected(t, [[a, b, T]], 0, 'alles auf einmal');
        // Schritt muss beim letzten Ergebnis anfangen
        const p = placeParts(b);
        if (p.length >= 2) {
          rejected(t, [[a, p[0], a + p[0]], [a + p[0] + 1, p[1], a + p[0] + 1 + p[1]]], 1, 'falscher Start');
          // über das Ziel hinaus
          rejected(t, [[a, p[0], a + p[0]], [a + p[0], b, a + p[0] + b]], 1, 'zu weit');
        }
      }
    });
  }

  test('Zerlegung selbst: Einer zuerst geht auch, die Schritte folgen der Zerlegung', () => {
    for (const max of RANGES) {
      for (let k = 0; k < RUNS; k++) {
        const t = gen('+', 'schrittweise', 'zerlegen', max);
        // jede Zeile: [Stelle, Zwischenergebnis] – die Stelle steht im Schritt (14 + [6] = [20])
        for (const p of permutations(placeParts(t.b))) {
          const r = ok(t, steps(t.a, p, '+'));
          assert.equal(r.vals.res, t.answer);
        }
        const p0 = placeParts(t.b)[0];
        rejected(t, [[p0 + 1, t.a + p0 + 1]], 0, 'keine Stelle');
      }
    }
  });
});

describe('Schrittweise Minus: eigene Schritte, auch mehr als zwei', () => {
  for (const max of RANGES) {
    test(`bis ${max}: Stellen in jeder Reihenfolge, bis zum Zehner, freie Schritte`, () => {
      for (let k = 0; k < RUNS; k++) {
        const t = gen('−', 'schrittweise', 'selbst', max), a = t.a, b = t.b;
        const ways = permutations(placeParts(b)).map((p) => chain(a, p, '−'));
        if (a % 10 && (a % 10) < (b % 10)) ways.push(chain(a, [a % 10].concat(placeParts(b - (a % 10))), '−'));
        for (let n = 2; n <= 4; n++) ways.push(chain(a, randomParts(b, n), '−'));
        ways.forEach((w) => ok(t, w));
        rejected(t, [[a, b, a - b]], 0, 'alles auf einmal');
        const p = placeParts(b);
        rejected(t, [[p[0], a, p[0] - a]], 0, 'vertauscht');
        if (p.length >= 2) rejected(t, [[a, p[0], a - p[0]], [a - p[0], b, a - p[0] - b]], 1, 'zu weit');
      }
    });
  }
  test('Zerlegung selbst: jede Reihenfolge der Stellen', () => {
    for (const max of RANGES) {
      for (let k = 0; k < RUNS; k++) {
        const t = gen('−', 'schrittweise', 'zerlegen', max);
        for (const p of permutations(placeParts(t.b))) assert.equal(ok(t, steps(t.a, p, '−')).vals.res, t.answer);
      }
    }
  });
});

// ---------- Stellenweise ----------
describe('Stellenweise: Stellen in jeder Reihenfolge', () => {
  for (const max of RANGES) {
    test(`bis ${max}`, () => {
      for (let k = 0; k < RUNS; k++) {
        const t = gen('+', 'stellenweise', 'selbst', max), a = t.a, b = t.b;
        const shared = [], lonely = [];
        [100, 10, 1].forEach((p) => {
          const x = (Math.floor(a / p) % 10) * p, y = (Math.floor(b / p) % 10) * p;
          if (x && y) shared.push([x, y]);
          else if (x || y) lonely.push(x || y);
        });
        for (const order of permutations(shared)) {
          const rows = order.map(([x, y], i) => (i % 2 ? [y, x, x + y] : [x, y, x + y]));
          const sums = rows.map((r) => r[2]).concat(lonely);
          rows.push(sums.slice().reverse().concat(a + b));
          ok(t, rows);
        }
        // Stellen mischen ist falsch
        if (shared.length >= 2) {
          const [x] = shared[0], [, y] = shared[1];
          rejected(t, [[x, y, x + y]], 0, 'Stellen gemischt');
        }
      }
    });
  }
  test('Zerlegung selbst: Zahlen in einer Zeile dürfen getauscht werden', () => {
    for (const max of RANGES) {
      for (let k = 0; k < RUNS; k++) {
        const t = gen('+', 'stellenweise', 'zerlegen', max);
        const r = play(fresh(t), (row, i, vals) => {
          const ins = inputs(row);
          if (ins.length !== 3) return null;
          const exp = ins.map((x) => x.answer);
          return [exp[1], exp[0], exp[2]];
        });
        assert.ok(r.ok, Tasks.taskText(t));
      }
    }
  });
});

// ---------- Ergänzen ----------
describe('Ergänzen: beliebige Sprünge bis zur großen Zahl', () => {
  for (const max of RANGES) {
    test(`bis ${max}`, () => {
      for (let k = 0; k < RUNS; k++) {
        const t = gen('−', 'ergaenzen', 'selbst', max), a = t.a, b = t.b, d = a - b;
        const jumpLists = [[d]];
        for (let n = 2; n <= 4; n++) jumpLists.push(randomParts(d, n));
        if (b % 10 && b - (b % 10) + 10 < a) jumpLists.push([10 - (b % 10), d - 10 + (b % 10)]);
        for (const jumps of jumpLists) {
          const rows = chain(b, jumps, '+');
          if (jumps.length === 1) {
            rows.push([a, b, d]);                                  // 82 − 37 = 45
          } else {
            rows.push(jumps.slice().reverse().concat(d));          // Sprünge zusammen, beliebige Reihenfolge
            rows.push([d, b, a]);                                  // Umkehraufgabe 45 + 37 = 82
          }
          ok(t, rows, 'Sprünge ' + jumps);
        }
        // Umkehraufgabe in der üblichen Reihenfolge
        const j2 = randomParts(d, 2);
        if (j2.length === 2) ok(t, chain(b, j2, '+').concat([[j2[0], j2[1], d], [b, d, a]]));
        // über das Ziel hinaus
        rejected(t, [[b, d + 1, a + 1]], 0, 'zu weit');
        if (d >= 2) rejected(t, [[b, 1, b + 1], [b, d - 1, a - 1]], 1, 'falscher Start');
      }
    });
  }
});

// ---------- Vereinfachen ----------
describe('Vereinfachen: beide Zahlen passend verändern', () => {
  for (const max of RANGES) {
    test(`Plus bis ${max}: gegensinnig, eine Zahl wird glatt`, () => {
      for (let k = 0; k < RUNS; k++) {
        const t = gen('+', 'vereinfachen', 'selbst', max), a = t.a, b = t.b;
        let tried = 0;
        for (let d = -10; d <= 10; d++) {
          const x = a + d, y = b - d;
          if (!d || x <= 0 || y <= 0) continue;
          const glatt = near(a, max).includes(x) || near(b, max).includes(y);
          if (glatt) { ok(t, [[x, y, a + b]]); ok(t, [[y, x, a + b]]); tried++; }
          else if (x % 10 && y % 10) rejected(t, [[x, y, a + b]], 0, 'nichts glatt');
          // gleichsinnig ist bei Plus falsch
          rejected(t, [[a + d, b + d, a + b + 2 * d]], 0, 'gleichsinnig');
        }
        assert.ok(tried >= 1, Tasks.taskText(t));
        rejected(t, [[a, b, a + b]], 0, 'nicht verändert');
      }
    });
    test(`Minus bis ${max}: gleichsinnig, eine Zahl wird glatt`, () => {
      for (let k = 0; k < RUNS; k++) {
        const t = gen('−', 'vereinfachen', 'selbst', max), a = t.a, b = t.b;
        let tried = 0;
        for (let d = -10; d <= 10; d++) {
          const x = a + d, y = b + d;
          if (!d || y <= 0) continue;
          const glatt = near(a, max).includes(x) || near(b, max).includes(y);
          if (glatt) { ok(t, [[x, y, a - b]]); tried++; }
          rejected(t, [[a + d, b - d, a - b + 2 * d]], 0, 'gegensinnig');
        }
        assert.ok(tried >= 1, Tasks.taskText(t));
      }
    });
  }
  test('Zerlegung selbst: jede passende Veränderung', () => {
    for (const max of RANGES) {
      for (let k = 0; k < RUNS; k++) {
        const tp = gen('+', 'vereinfachen', 'zerlegen', max);
        for (const x of near(tp.a, max)) {
          const y = tp.a + tp.b - x;
          if (y > 0) assert.equal(ok(tp, [[x, y]]).vals.res, tp.answer);
        }
        const tm = gen('−', 'vereinfachen', 'zerlegen', max);
        for (const y of near(tm.b, max)) assert.equal(ok(tm, [[tm.a + y - tm.b, y]]).vals.res, tm.answer);
      }
    }
  });
});

// ---------- Mal: Zerlegen ----------
describe('Mal Zerlegen: jeden Faktor zerlegen, auch in mehr als zwei Teile', () => {
  for (const max of RANGES) {
    test(`bis ${max}`, () => {
      for (let k = 0; k < RUNS; k++) {
        const t = gen('·', 'zerlegen', 'selbst', max), a = t.a, b = t.b;
        const big = Math.max(a, b), small = Math.min(a, b);
        const ways = [];
        const prodRows = (kept, parts, swap) => parts.map((p, i) => ((i + (swap ? 1 : 0)) % 2 ? [kept, p, kept * p] : [p, kept, kept * p]));
        permutations(placeParts(big)).forEach((p) => ways.push(prodRows(small, p)));
        ways.push(prodRows(small, placeParts(big), true));
        if (Math.floor(big / 10) % 10 >= 2) ways.push(prodRows(small, [10, big - 10]));       // 23 = 10 + 13
        if (big >= 21) ways.push(prodRows(small, [10, 10, big - 20]));                    // 23 = 10 + 10 + 3
        for (let s = 1; s < small; s++) ways.push(prodRows(big, [s, small - s]));          // 7 · 48 = 5 · 48 + 2 · 48
        for (const rows of ways) {
          const prods = rows.map((r) => r[2]);
          ok(t, rows.concat([prods.slice().reverse().concat(a * b)]), 'Teile ' + rows.map((r) => r[0] + '·' + r[1]));
        }
        // falscher Faktor
        rejected(t, [[small + 1, placeParts(big)[0], (small + 1) * placeParts(big)[0]]], 0, 'falscher Faktor');
        // Teil größer als der Rest
        const p0 = placeParts(big)[0];
        rejected(t, [[small, p0, small * p0], [small, big, small * big]], 1, 'zu großer Teil');
        // die ganze Aufgabe ist keine Zerlegung
        rejected(t, [[a, b, a * b]], 0, 'ganze Aufgabe');
      }
    });
  }
  test('Zerlegung selbst: beide Reihenfolgen und andere Zerlegungen', () => {
    for (const max of RANGES) {
      for (let k = 0; k < RUNS; k++) {
        const t = gen('·', 'zerlegen', 'zerlegen', max);
        const big = Math.max(t.a, t.b);
        const p = placeParts(big);
        assert.equal(ok(t, [p.slice().reverse()]).vals.res, t.answer);
        assert.equal(ok(t, [[big - 10, 10]]).vals.res, t.answer);
      }
    }
  });
});

// ---------- Mal: Kernaufgaben ----------
const KERN = [1, 2, 5, 10];
describe('Kernaufgaben: jeden Faktor in Kernaufgaben zerlegen (1 ·, 2 ·, 5 ·, 10 ·)', () => {
  test('alle Zerlegungen in Kernaufgaben, plus oder minus', () => {
    for (let k = 0; k < RUNS * 3; k++) {
      const t = gen('·', 'kernaufgaben', 'selbst', k % 2 ? 100 : 1000), a = t.a, b = t.b;
      let tried = 0;
      for (const [f, g] of [[a, b], [b, a]]) {
        for (const k1 of KERN) {
          if (k1 === f) continue;
          const plus = k1 < f && KERN.includes(f - k1), minus = k1 > f && KERN.includes(k1 - f);
          if (!plus && !minus) continue;
          const k2 = plus ? f - k1 : k1 - f;
          const last = plus ? [k2 * g, k1 * g, a * b] : [k1 * g, k2 * g, a * b];
          ok(t, [[k1, g, k1 * g], [g, k2, k2 * g], last], f + ' = ' + k1 + (plus ? ' + ' : ' − ') + k2);
          const played = fresh(t);
          play(played, (row, i) => [[k1, g, k1 * g], [g, k2, k2 * g], last][i]);
          assert.deepEqual(opsOf(played.rows[2]), [plus ? '+' : '−']);
          tried++;
        }
      }
      assert.ok(tried >= 1, Tasks.taskText(t));
      // 3 · und 4 · sind keine Kernaufgaben
      rejected(t, [[3, b, 3 * b]], 0, '3 ·');
      if (a === 8) rejected(t, [[5, b, 5 * b]], 0, '8 = 5 + 3');
    }
  });
  test('Zerlegung selbst: Reihenfolge der Kernaufgaben egal (bei plus)', () => {
    for (let k = 0; k < RUNS; k++) {
      const t = gen('·', 'kernaufgaben', 'zerlegen', 100);
      const row0 = t.rows[0];
      if (opsOf(row0)[0] !== '+') continue;
      const exp = inputs(row0).map((x) => x.answer);
      assert.equal(ok(t, [exp.slice().reverse()]).vals.res, t.answer);
    }
  });
});

// ---------- Mal: Hilfsaufgabe ----------
describe('Mal mit Hilfsaufgabe: einen Faktor glatt machen und ausgleichen', () => {
  for (const max of RANGES) {
    test(`bis ${max}`, () => {
      for (let k = 0; k < RUNS; k++) {
        const t = gen('·', 'hilfsaufgabe', 'selbst', max), a = t.a, b = t.b, ans = a * b;
        let tried = 0;
        for (const [f, g] of [[a, b], [b, a]]) {
          for (const G of near(f, max)) {
            const d = G - f, s1 = G * g, z = Math.abs(d) * g;
            const rows = [[G, g, s1]];
            if (Math.abs(d) >= 2) rows.push([Math.abs(d), g, z]);
            rows.push([s1, z, ans]);
            ok(t, rows, f + ' -> ' + G);
            const played = fresh(t);
            play(played, (row, i) => rows[i]);
            assert.deepEqual(opsOf(played.rows[rows.length - 1]), [d > 0 ? '−' : '+']);
            const wrong = rows.slice(0, -1).concat([[s1, z, d > 0 ? s1 + z : s1 - z]]);
            rejected(t, wrong, rows.length - 1, 'Ausgleich andersherum');
            tried++;
          }
        }
        assert.ok(tried >= 1, Tasks.taskText(t));
        rejected(t, [[a, b, ans]], 0, 'ganze Aufgabe');
      }
    });
  }
});

// ---------- Geteilt ----------
describe('Geteilt: freie Zerlegung in zwei oder mehr Teile, Ergebnis, Probe', () => {
  for (const max of RANGES) {
    test(`bis ${max}`, () => {
      for (let k = 0; k < RUNS; k++) {
        const t = gen(':', 'zerlegen', 'selbst', max, { rest: k % 2 === 0 }), D = t.a, d = t.b, q = t.answer, r = t.rest;
        for (let n = 2; n <= 4; n++) {
          const qs = randomParts(q, n);
          if (qs.length < 2) continue;
          const rows = qs.map((x) => [x * d, d, x]);
          rows.push(r ? [q, r] : [q]);
          rows.push(r ? [q, d, r, D] : [q, d, D]);
          ok(t, rows, 'Teile ' + qs);
          // Probe mit getauschten Faktoren
          const swapped = rows.slice(0, -1).concat([r ? [d, q, r, D] : [d, q, D]]);
          ok(t, swapped, 'Probe getauscht');
        }
        // nicht teilbarer Teil
        rejected(t, [[d * 10 + 1, d, 10]], 0, 'nicht teilbar');
        // ganze Zahl ist keine Zerlegung
        if (!r) rejected(t, [[D, d, q]], 0, 'ganze Zahl');
        // Teil größer als der Rest
        rejected(t, [[d, d, 1], [D, d, Math.floor(D / d)]], 1, 'zu großer Teil');
        // falscher Rest im Ergebnis
        if (r) {
          const rows = [[(q - 1) * d, d, q - 1], [d, d, 1], [q, r + 1]];
          rejected(t, rows, 2, 'falscher Rest');
        }
      }
    });
  }
  test('Zerlegung selbst: jede Zerlegung mit Zahlen aus der Reihe', () => {
    for (const max of RANGES) {
      for (let k = 0; k < RUNS; k++) {
        const t = gen(':', 'zerlegen', 'zerlegen', max, { rest: k % 2 === 0 });
        // je Teil eine Zeile [Teil] : d = [Ergebnis] (R [Rest]) – erst kleine Teile (je ein d), der letzte ist der Rest
        const n = t.rows.filter((r) => /Teil$/.test(r.label)).length, D = t.a, d = t.b;
        if (t.answer < n + 1) continue;
        const rows = [];
        let left = D;
        for (let i = 0; i < n - 1; i++) { rows.push([d, 1]); left -= d; }
        rows.push(t.rest ? [left, Math.floor(left / d), left % d] : [left, left / d]);
        assert.equal(ok(t, rows).vals.res, t.answer);
      }
    }
  });
});

// ---------- alle Stufen: der vorgegebene Weg geht immer ----------
test('alle Rechenwege, Stufen und Zahlenräume: der erwartete Weg wird angenommen', () => {
  for (const op of Tasks.OPS) {
    for (const s of Tasks.STRATEGIES[op].filter((x) => x.group === 'weg')) {
      for (const level of ['hilfe', 'zerlegen', 'selbst']) {
        for (const max of RANGES) {
          for (let k = 0; k < 20; k++) {
            const t = gen(op, s.key, level, max, { rest: k % 2 === 0 });
            const r = play(fresh(t));
            assert.ok(r.ok, Tasks.taskText(t) + ' ' + s.key + ' ' + level);
            assert.equal(r.vals.res, t.answer);
            assert.ok(Check.isSolved(t, r.vals) || typeof t.nextRow === 'function');
          }
        }
      }
    }
  }
});
