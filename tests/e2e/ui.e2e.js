// Ende-zu-Ende-Tests: die echte Seite im Browser bedienen (npm run test:e2e).
// Nur, was sich ohne Browser nicht prüfen lässt: Verdrahtung, Fokus, Layout, Dialoge, keine JS-Fehler.
// Die Logik dahinter steckt in reinen Modulen und hat Unit-Tests (tests/*.test.js).
'use strict';
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const STORE = 'rechenranch-v1';
const WELCOMED = { welcomed: true, name: 'Test', settings: { sound: false } };
let server, base, browser;

before(async () => {
  server = http.createServer((req, res) => {
    const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
    if (!p.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    fs.readFile(p, (err, data) => {
      if (err) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  await new Promise((r) => server.listen(0, r));
  base = 'http://localhost:' + server.address().port + '/';
  browser = await chromium.launch();
});
after(async () => { await browser.close(); server.close(); });

// saved: Speicherstand vor dem ersten Laden (null = erster Besuch); init: Skript vor dem Laden
async function openPage(opts = {}) {
  const { saved = WELCOMED, init, ...ctxOpts } = opts;
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' }, ctxOpts));
  const page = await ctx.newPage();
  if (init) await page.addInitScript(init);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  if (saved) {
    await page.addInitScript(([key, data]) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, data);
    }, [STORE, JSON.stringify(saved)]);
  }
  await page.goto(base);
  return { page, ctx, errors };
}

// Antworten der aktiven Zeile aus der laufenden Aufgabe lesen
function activeAnswers(page) {
  return page.evaluate(() => {
    const c = window.RR.app.current;
    return c.task.rows[c.row].tokens.filter((t) => t.t === 'in').map((t) => t.answer);
  });
}

async function waitForInputRow(page) {
  await page.waitForFunction(() => {
    const c = window.RR.app.current;
    return c.done || (c.row >= 0 && document.querySelector('.row.active .cell'));
  });
}

async function solveTask(page) {
  for (let guard = 0; guard < 10; guard++) {
    await waitForInputRow(page);
    if (await page.evaluate(() => window.RR.app.current.done)) return;
    const answers = await activeAnswers(page);
    const cells = page.locator('.row.active .cell');
    assert.equal(await cells.count(), answers.length);
    for (let i = 0; i < answers.length; i++) await cells.nth(i).fill(String(answers[i]));
    await cells.last().press('Enter');
  }
  throw new Error('Aufgabe nicht gelöst');
}

async function setSettings(page, settings) {
  await page.evaluate((s) => {
    Object.assign(window.RR.app.state.settings, s);
    window.RR.app.newTask();
  }, settings);
}

// Rauchtest: jeder Rechenweg mit seiner Anschauung lässt sich bedienen, ohne JS-Fehler.
// Ob die Rechenschritte stimmen, prüfen die Unit-Tests für alle Stufen.
describe('Aufgaben über die Oberfläche lösen', () => {
  const combos = [
    ['+', 'stellenweise'], ['+', 'schrittweise'], ['+', 'hilfsaufgabe'], ['+', 'vereinfachen'],
    ['−', 'schrittweise'], ['−', 'ergaenzen'], ['−', 'hilfsaufgabe'], ['−', 'vereinfachen'],
    ['·', 'zerlegen'], ['·', 'kernaufgaben'], ['·', 'hilfsaufgabe'], [':', 'zerlegen']
  ];
  for (const level of ['hilfe', 'selbst']) {
    describe(`Stufe "${level}"`, () => {
      let page, ctx, errors;
      before(async () => { ({ page, ctx, errors } = await openPage()); });
      after(async () => { await ctx.close(); });
      for (const [op, strategy] of combos) {
        test(`${op} ${strategy}`, async () => {
          await setSettings(page, { op, strategy, level, rest: op === ':' && level !== 'hilfe' });
          const answer = await page.evaluate(() => window.RR.app.current.task.answer);
          await solveTask(page);
          assert.equal(await page.locator('#final').textContent(), String(answer));
          await assert.doesNotReject(page.locator('#checkBtn', { hasText: 'Weiter' }).waitFor());
          assert.deepEqual(errors, []);
        });
      }
    });
  }
});

describe('Rückmeldung', () => {
  test('falsche Antwort: Feld rot, Begleiter antwortet, Zeile bleibt offen', async () => {
    const { page, ctx } = await openPage();
    await setSettings(page, { op: '+', strategy: 'stellenweise', level: 'hilfe' });
    await waitForInputRow(page);
    const [ans] = await activeAnswers(page);
    const cell = page.locator('.row.active .cell').first();
    const bubble = page.locator('#bubbleText');
    const intro = await bubble.textContent();

    // Eingabe wird gesäubert (Buchstaben fliegen raus)
    await cell.focus();
    await page.keyboard.type('x' + (ans + 1));
    assert.equal(await cell.inputValue(), String(ans + 1));

    await cell.press('Enter');
    await assert.doesNotReject(page.locator('.row.active .cell.bad').waitFor());
    assert.notEqual(await bubble.textContent(), intro);
    assert.equal(await page.evaluate(() => window.RR.app.current.row), 0);

    // neue Eingabe nimmt die Markierung weg
    await page.keyboard.type(String(ans));
    assert.equal(await page.locator('.row.active .cell.bad').count(), 0);
    await ctx.close();
  });

  test('5 fehlerfrei hintereinander: Galopp-Parade', async () => {
    // 4 fehlerfreie Aufgaben sind schon gespeichert, die 5. löst die Parade aus
    const { page, ctx } = await openPage({ saved: Object.assign({}, WELCOMED, {
      progress: { stars: 4, streak: 4, bestStreak: 4, solved: 4 }
    }) });
    await setSettings(page, { op: '+', strategy: 'stellenweise', level: 'hilfe' });
    await solveTask(page);
    await assert.doesNotReject(page.locator('.parade').waitFor({ timeout: 3000 }));
    assert.equal(await page.locator('#streakCount').textContent(), '5');
    await ctx.close();
  });
});

describe('Zahlenfeld, Dialoge und Speichern', () => {
  test('Zahlenfeld auf dem Handy: tippen und prüfen', async () => {
    const { page, ctx } = await openPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    assert.equal(await page.locator('#numpad').isVisible(), true);
    await waitForInputRow(page);
    const answers = await activeAnswers(page);
    const cells = page.locator('.row.active .cell');
    for (let i = 0; i < answers.length; i++) {
      await cells.nth(i).tap();
      for (const d of String(answers[i])) await page.locator('.np-key', { hasText: new RegExp('^' + d + '$') }).tap();
    }
    const rowBefore = await page.evaluate(() => window.RR.app.current.row);
    await page.locator('.np-ok').tap();
    await page.waitForFunction((r) => window.RR.app.current.row > r || window.RR.app.current.done, rowBefore);
    await ctx.close();
  });

  test('Begrüßung beim ersten Besuch, Name und Sterne bleiben gespeichert', async () => {
    const { page, ctx } = await openPage({ saved: null });
    await assert.doesNotReject(page.locator('#welcomeDlg[open]').waitFor());
    await page.fill('#nameInput', 'Mia');
    await page.click('.buddy-card >> text=Blitz');
    await page.click('#welcomeDlg button[value=ok]');
    await page.waitForFunction(() => /Mia/.test(document.getElementById('bubbleText').textContent));
    await page.evaluate(() => { window.RR.app.state.settings.sound = false; });
    await solveTask(page);
    await page.waitForFunction(() => document.getElementById('starCount').textContent === '1');
    await page.reload();
    assert.equal(await page.locator('#welcomeDlg[open]').count(), 0);
    assert.equal(await page.locator('#starCount').textContent(), '1');
    assert.equal(await page.evaluate(() => window.RR.app.state.companion), 'blitz');
    await ctx.close();
  });

  test('Stufe in den Einstellungen umschalten', async () => {
    const { page, ctx } = await openPage();
    await page.click('#settingsBtn');
    await page.click('.seg[data-setting="level"] button[data-value="hilfe"]');
    await page.click('#settingsDlg button[value=ok]');
    await page.waitForFunction(() => window.RR.app.current.task.level === 'hilfe');
    assert.match(await page.locator('#strategyBadge').textContent(), /Mit Hilfe/);
    await ctx.close();
  });
});

describe('Responsives Layout', () => {
  for (const [w, h] of [[320, 640], [390, 844], [768, 1024], [1024, 768], [1440, 900], [844, 390]]) {
    test(`${w}×${h}: kein waagerechtes Scrollen, alles erreichbar`, async () => {
      const { page, ctx, errors } = await openPage({ viewport: { width: w, height: h } });
      await setSettings(page, { op: '−', strategy: 'ergaenzen' });
      await waitForInputRow(page);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(overflow <= 0, 'horizontaler Überlauf: ' + overflow + 'px');
      for (const sel of ['#equation', '#checkBtn', '.row.active .cell', '#opChips', '#buddyFigure']) {
        const box = await page.locator(sel).first().boundingBox();
        assert.ok(box && box.width > 0 && box.x >= 0 && box.x + box.width <= w + 1, sel + ' sichtbar');
      }
      const fontPx = await page.locator('.row.active .eq').evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
      assert.ok(fontPx >= 22, 'Rechenschrift groß genug: ' + fontPx);
      assert.deepEqual(errors, []);
      await ctx.close();
    });
  }
});

describe('Fokus', () => {
  test('schnell nacheinander in mehrere Felder tippen: jede Zahl landet im richtigen Feld', async () => {
    const { page, ctx } = await openPage();
    await setSettings(page, { op: '+', strategy: 'stellenweise', level: 'selbst' });
    await waitForInputRow(page);
    // Fokus wechseln, ohne dem Browser Zeit für ausstehende Timer zu lassen
    const values = await page.evaluate(() => {
      const cells = [...document.querySelectorAll('.row.active .cell')];
      cells[0].focus(); cells[1].focus(); cells[2].focus();
      return new Promise((resolve) => setTimeout(() => {
        resolve(document.activeElement === cells[2]);
      }, 50));
    });
    assert.equal(values, true, 'Fokus bleibt im zuletzt gewählten Feld');
    await ctx.close();
  });
});

describe('Dialoge auf kleinen Bildschirmen', () => {
  for (const [w, h] of [[320, 640], [390, 844]]) {
    test(`Einstellungen ${w}×${h}: nichts ragt über den Rand`, async () => {
      const { page, ctx } = await openPage({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true });
      await page.click('#settingsBtn');
      await page.locator('#settingsDlg[open]').waitFor();
      const over = await page.evaluate(() => {
        const dlg = document.getElementById('settingsDlg');
        const box = dlg.querySelector('.sheet-inner').getBoundingClientRect();
        return [...dlg.querySelectorAll('button, select, legend, label')]
          .filter((e) => e.getBoundingClientRect().width > 0)
          .filter((e) => { const r = e.getBoundingClientRect(); return r.right > box.right + 1 || r.right > document.documentElement.clientWidth; })
          .map((e) => e.textContent.trim().slice(0, 20));
      });
      assert.deepEqual(over, []);
      await ctx.close();
    });
  }
});

describe('Erweiterungs-Gerüst im Browser', () => {
  // Test-Aufgabenarten direkt im Browser anmelden und erzeugen
  async function useTestStrategy(page, def) {
    await page.evaluate((src) => {
      const def = (0, eval)('(' + src + ')');
      if (!window.RR.Tasks.STRATEGIES['+'].some((s) => s.key === def.key)) window.RR.Tasks.register('+', def);
      Object.assign(window.RR.app.state.settings, { op: '+', strategy: def.key });
      window.RR.app.newTask();
    }, def);
  }

  test('Auswahlfeld: Antippen wählt und prüft', async () => {
    const { page, ctx, errors } = await openPage();
    await useTestStrategy(page, `{ key: 'e2ewahl', name: 'Wahl', group: 'knobeln', gen: function () {
      return { op: '+', strategy: 'e2ewahl', a: 40, b: 2, answer: 42, rows: [{ label: 'Welche?', hint: '', tokens: [
        { t: 'choice', id: 'res', options: ['41', '42', '43'], answer: 1, check: function (v) { return v === 1; } }] }] }; } }`);
    await page.locator('.row.active .choice-btn', { hasText: '43' }).click();
    await page.waitForFunction(() => window.RR.app.current.mistakes === 1);
    await page.locator('.row.active .choice-btn', { hasText: '42' }).click();
    await page.waitForFunction(() => window.RR.app.current.done);
    assert.deepEqual(errors, []);
    await ctx.close();
  });

  test('Rechnung selbst verlängern: neue Zeile wird angehängt', async () => {
    const { page, ctx, errors } = await openPage();
    await useTestStrategy(page, `{ key: 'e2eweg', name: 'Weg', gen: function () {
      var mk = function (id, ans) { return { label: 'Schritt', hint: '', tokens: [{ t: 'in', id: id, answer: ans, check: function (v) { return v === ans; } }] }; };
      return { op: '+', strategy: 'e2eweg', a: 1, b: 1, answer: 2, rows: [mk('s1', 1)],
        nextRow: function (vals) { return mk('res', 2); } }; } }`);
    await page.locator('.row.active .cell').fill('1');
    await page.locator('.row.active .cell').press('Enter');
    await page.waitForFunction(() => document.querySelectorAll('#rows .row').length === 2 && window.RR.app.current.row === 1);
    await page.locator('.row.active .cell').fill('2');
    await page.locator('.row.active .cell').press('Enter');
    await page.waitForFunction(() => window.RR.app.current.done);
    assert.deepEqual(errors, []);
    await ctx.close();
  });

  test('eigene Darstellung (layout) wird verwendet', async () => {
    const { page, ctx, errors } = await openPage();
    await page.evaluate(() => {
      window.RR.Layouts = window.RR.Layouts || {};
      window.RR.Layouts.e2etest = { render: function (task, box, h) {
        task.rows.forEach(function (row, i) {
          const d = document.createElement('div');
          d.className = 'row future e2e-layout'; d.dataset.i = i;
          d.innerHTML = row.tokens.map(function (t) { return h.tokenHtml(t, 'Feld'); }).join('');
          box.appendChild(d);
        });
      } };
    });
    await useTestStrategy(page, `{ key: 'e2elayout', name: 'Layout', group: 'knobeln', gen: function () {
      return { op: '+', strategy: 'e2elayout', a: 1, b: 1, answer: 2, layout: 'e2etest', rows: [{ label: '', hint: '',
        tokens: [{ t: 'in', id: 'res', answer: 2, check: function (v) { return v === 2; } }] }] }; } }`);
    assert.equal(await page.locator('.e2e-layout .cell').count(), 1);
    await page.locator('.row.active .cell').fill('2');
    await page.locator('.row.active .cell').press('Enter');
    await page.waitForFunction(() => window.RR.app.current.done);
    assert.deepEqual(errors, []);
    await ctx.close();
  });

  test('Zahlenraum in den Einstellungen umschalten', async () => {
    const { page, ctx } = await openPage();
    assert.equal(await page.evaluate(() => window.RR.app.current.task.max), 1000);
    await page.click('#settingsBtn');
    await page.click('.seg[data-setting="range"] button[data-value="100"]');
    await page.click('#settingsDlg button[value=ok]');
    await page.waitForFunction(() => window.RR.app.current.task.max === 100);
    await ctx.close();
  });

  test('Rechenweg-Auswahl zeigt Gruppen-Überschriften, wenn es mehrere Gruppen gibt', async () => {
    const { page, ctx } = await openPage();
    await page.evaluate(() => {
      window.RR.Tasks.register('+', { key: 'e2egrp', name: 'Mauer', group: 'knobeln', gen: function () { return null; } });
      Object.assign(window.RR.app.state.settings, { op: '+', strategy: 'mix' });
      window.RR.app.renderOps();
    });
    assert.deepEqual(await page.locator('#stratChips .strat-group').allTextContents(), ['Rechenwege', 'Knobeln']);
    await ctx.close();
  });
});
