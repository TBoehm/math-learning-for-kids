// Browser-Tests für das Rechenraster der schriftlichen Verfahren (js/layouts/column.js).
// Nur Verdrahtung und Layout – die Rechenlogik prüfen die Unit-Tests (tests/schriftlich.test.js).
'use strict';
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const SAVED = { welcomed: true, name: 'Test', settings: { sound: false } };
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

async function openPage(opts = {}) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' }, opts));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript((data) => {
    if (!localStorage.getItem('rechenranch-v1')) localStorage.setItem('rechenranch-v1', data);
  }, JSON.stringify(SAVED));
  await page.goto(base);
  return { page, ctx, errors };
}

// Gezielt eine bestimmte Aufgabe zeigen (kein Zufall)
async function showTask(page, kind, terms, level) {
  await page.evaluate(([kind, terms, level]) => {
    const op = kind === 'add' ? '+' : '−';
    const key = 'e2e-' + kind + '-' + terms.join('-') + '-' + level;
    if (!window.RR.Tasks.STRATEGIES[op].some((s) => s.key === key)) {
      window.RR.Tasks.register(op, { key, name: 'Test', group: 'schriftlich',
        gen: (opt) => window.RR.Schriftlich.build(kind, terms, { level, max: opt.max }) });
    }
    Object.assign(window.RR.app.state.settings, { op, strategy: key, level, range: 1000 });
    window.RR.app.newTask();
  }, [kind, terms, level]);
  await page.locator('#rows .row.active').first().waitFor();
}

// Musterlösung der aktiven Zeile: Felder, die leer bleiben dürfen, bleiben leer
function activeAnswers(page) {
  return page.evaluate(() => {
    const c = window.RR.app.current;
    return c.task.rows[c.row].tokens.filter((t) => t.t === 'in')
      .map((t) => ({ id: t.id, v: t.silent || (typeof t.blank === 'number' && t.answer === t.blank) ? '' : String(t.answer) }));
  });
}

async function solveActiveRow(page) {
  const row = await page.evaluate(() => window.RR.app.current.row);
  for (const { id, v } of await activeAnswers(page)) {
    if (v) await page.locator(`.row.active .cell[data-id="${id}"]`).fill(v);
  }
  await page.locator('#checkBtn').click();
  await page.waitForFunction((r) => window.RR.app.current.row > r || window.RR.app.current.done, row);
}

const bandX = (page) => page.locator('.row.active .k-band').evaluate((e) => e.getBoundingClientRect().x);

describe('Schriftlich rechnen im Raster', () => {
  test('Raster mit Stellen, Zahlen untereinander, ganze Rechnung sichtbar', async () => {
    const { page, ctx, errors } = await openPage();
    await showTask(page, 'add', [438, 254], 'selbst');
    assert.equal(await page.locator('#rows.layout-column .cgrid').count(), 1);
    const heads = await page.locator('.cgrid .k-head').evaluateAll((es) =>
      es.sort((a, b) => a.getBoundingClientRect().x - b.getBoundingClientRect().x).map((e) => e.textContent));
    assert.deepEqual(heads, ['T', 'H', 'Z', 'E']);
    assert.equal(await page.locator('.cgrid .k-t0').allTextContents().then((x) => x.join('')), '438');
    assert.equal(await page.locator('.cgrid .k-t1').allTextContents().then((x) => x.join('')), '254');
    assert.equal(await page.locator('.cgrid .k-sign').textContent(), '+');
    // erst der Überschlag; die Felder aller Spalten sind schon zu sehen
    assert.equal(await page.evaluate(() => window.RR.app.current.row), 0);
    const cells = page.locator('.cgrid .k-slot .cell');
    assert.equal(await cells.count(), 6, 'Ziffern E, Z, H, T und zwei Übertrag-Felder');
    for (let i = 0; i < await cells.count(); i++) assert.equal(await cells.nth(i).isVisible(), true);
    assert.deepEqual(errors, []);
    await ctx.close();
  });

  test('Spalten von rechts nach links lösen, bis zum Ergebnis', async () => {
    const { page, ctx, errors } = await openPage();
    await showTask(page, 'add', [438, 254], 'selbst');
    await solveActiveRow(page); // Überschlag
    const xs = [];
    for (let i = 0; i < 3; i++) {
      xs.push(await bandX(page));
      // die aktive Spalte bekommt den Fokus
      assert.equal(await page.evaluate(() => document.activeElement.closest('.row.active') !== null), true);
      await solveActiveRow(page);
    }
    assert.ok(xs[0] > xs[1] && xs[1] > xs[2], 'Einer, Zehner, Hunderter: ' + xs);
    assert.equal(await page.locator('#final').textContent(), '692');
    assert.deepEqual(errors, []);
    await ctx.close();
  });

  test('falsche Ziffer: Feld rot, Fehler zählt, Spalte bleibt aktiv', async () => {
    const { page, ctx } = await openPage();
    await showTask(page, 'sub', [532, 278], 'zerlegen');
    await solveActiveRow(page);
    await page.locator('.row.active .cell[data-id="l1"]').fill('2');
    await page.locator('.row.active .cell[data-id="b0"]').fill('12');
    await page.locator('.row.active .cell[data-id="d0"]').fill('6');
    await page.locator('.row.active .cell[data-id="d0"]').press('Enter');
    await page.locator('.row.active .cell.bad[data-id="d0"]').waitFor();
    assert.equal(await page.evaluate(() => window.RR.app.current.mistakes), 1);
    assert.equal(await page.evaluate(() => window.RR.app.current.row), 1);
    await ctx.close();
  });

  test('Handy: mit dem Zahlenfeld tippen und prüfen', async () => {
    const { page, ctx, errors } = await openPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    await showTask(page, 'sub', [503, 278], 'zerlegen');
    assert.equal(await page.locator('#numpad').isVisible(), true);
    for (let r = 0; r < 4; r++) {
      const row = await page.evaluate(() => window.RR.app.current.row);
      for (const { id, v } of await activeAnswers(page)) {
        if (!v) continue;
        await page.locator(`.row.active .cell[data-id="${id}"]`).tap();
        for (const d of v) await page.locator('.np-key', { hasText: new RegExp('^' + d + '$') }).tap();
      }
      await page.locator('.np-ok').tap();
      await page.waitForFunction((r) => window.RR.app.current.row > r || window.RR.app.current.done, row);
      if (r === 0) {
        // die aktive Spalte wird über das Zahlenfeld geschoben, nicht dahinter versteckt
        await page.waitForFunction(() => {
          const cell = document.querySelector('.row.active .k-res .cell').getBoundingClientRect();
          return cell.top >= 0 && cell.bottom <= document.getElementById('numpad').getBoundingClientRect().top;
        }, null, { timeout: 3000 });
      }
    }
    assert.equal(await page.evaluate(() => window.RR.app.current.done), true);
    assert.equal(await page.locator('#final').textContent(), '225');
    assert.deepEqual(errors, []);
    await ctx.close();
  });

  for (const [w, h] of [[320, 640], [390, 844], [1280, 900]]) {
    test(`${w}×${h}: Raster passt, kein waagerechtes Scrollen`, async () => {
      const { page, ctx, errors } = await openPage({ viewport: { width: w, height: h } });
      for (const [kind, terms] of [['sub', [503, 278]], ['add', [199, 299, 399]]]) {
        await showTask(page, kind, terms, 'selbst');
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        assert.ok(overflow <= 0, 'horizontaler Überlauf: ' + overflow + 'px');
        const card = await page.locator('#taskCard').boundingBox();
        const grid = await page.locator('.cgrid').boundingBox();
        assert.ok(grid.x >= card.x && grid.x + grid.width <= card.x + card.width + 1, 'Raster in der Karte');
        const cell = await page.locator('.cgrid .k-res .cell').first().boundingBox();
        assert.ok(cell.width >= 30, 'Ziffernfeld groß genug zum Tippen: ' + cell.width);
      }
      assert.deepEqual(errors, []);
      await ctx.close();
    });
  }

  test('Auswahl: Gruppe "Schriftlich" mit eigenen Rechenwegen', async () => {
    const { page, ctx } = await openPage();
    await page.evaluate(() => {
      Object.assign(window.RR.app.state.settings, { op: '−', strategy: 'mix' });
      window.RR.app.renderOps();
    });
    assert.deepEqual(await page.locator('#stratChips .strat-group').allTextContents(), ['Rechenwege', 'Knobeln', 'Schriftlich']);
    await page.click('#stratSummary');
    await page.locator('.strat-chip', { hasText: 'Ergänzen)' }).click();
    await page.waitForFunction(() => window.RR.app.current.task.strategy === 'schriftlich-erg');
    assert.equal(await page.locator('.cgrid').count(), 1);
    await ctx.close();
  });
});
