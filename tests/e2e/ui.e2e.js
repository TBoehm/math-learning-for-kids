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

// saved: Speicherstand vor dem ersten Laden (null = erster Besuch)
async function openPage(opts = {}) {
  const { saved = WELCOMED, ...ctxOpts } = opts;
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' }, ctxOpts));
  const page = await ctx.newPage();
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
    ['+', 'stellenweise'], ['+', 'schrittweise'], ['+', 'hilfsaufgabe'],
    ['−', 'schrittweise'], ['−', 'ergaenzen'], ['−', 'hilfsaufgabe'],
    ['·', 'zerlegen'], ['·', 'kernaufgaben'], [':', 'zerlegen']
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
