// Ende-zu-Ende-Tests: die echte Seite im Browser bedienen (npm run test:e2e).
'use strict';
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
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
  const { init, welcomed, ...ctxOpts } = opts;
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' }, ctxOpts));
  const page = await ctx.newPage();
  if (init) await page.addInitScript(init);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  if (welcomed !== false) {
    await page.addInitScript(() => {
      if (!localStorage.getItem('rechenranch-v1')) {
        localStorage.setItem('rechenranch-v1', JSON.stringify({ welcomed: true, name: 'Test', settings: { sound: false } }));
      }
    });
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

describe('Aufgaben über die Oberfläche lösen', () => {
  const combos = [
    ['+', 'stellenweise'], ['+', 'schrittweise'], ['+', 'hilfsaufgabe'],
    ['−', 'schrittweise'], ['−', 'ergaenzen'], ['−', 'hilfsaufgabe'],
    ['·', 'zerlegen'], ['·', 'kernaufgaben'], [':', 'zerlegen']
  ];
  for (const level of ['hilfe', 'zerlegen', 'selbst']) {
    for (const [op, strategy] of combos) {
      test(`${op} ${strategy} (${level})`, async () => {
        const { page, ctx, errors } = await openPage();
        await setSettings(page, { op, strategy, level, rest: op === ':' && level !== 'hilfe' });
        const answer = await page.evaluate(() => window.RR.app.current.task.answer);
        await solveTask(page);
        assert.equal(await page.locator('#final').textContent(), String(answer));
        await assert.doesNotReject(page.locator('#checkBtn', { hasText: 'Weiter' }).waitFor());
        await page.waitForFunction(() => document.getElementById('starCount').textContent === '1');
        assert.deepEqual(errors, []);
        await ctx.close();
      });
    }
  }
});

describe('Rückmeldung', () => {
  test('falsche Antwort: markiert, Zeile bleibt offen, Hilfe wird stärker', async () => {
    const { page, ctx } = await openPage();
    await setSettings(page, { op: '+', strategy: 'stellenweise', level: 'hilfe' });
    await waitForInputRow(page);
    const [ans] = await activeAnswers(page);
    const cell = page.locator('.row.active .cell').first();
    const bubble = page.locator('#bubbleText');

    await cell.fill(String(ans + 1));
    await cell.press('Enter');
    await assert.doesNotReject(page.locator('.row.active .cell.bad').waitFor());
    assert.equal(await page.evaluate(() => window.RR.app.current.row), 0);
    assert.doesNotMatch(await bubble.textContent(), /Tipp|Lösung/);

    await cell.fill(String(ans + 2));
    await cell.press('Enter');
    assert.match(await bubble.textContent(), /^Tipp:/);

    await cell.fill(String(ans + 3));
    await cell.press('Enter');
    assert.match(await bubble.textContent(), new RegExp('Die Lösung ist ' + ans + '\\.'));

    await cell.fill(String(ans));
    await cell.press('Enter');
    await page.waitForFunction(() => window.RR.app.current.row === 1);
    assert.equal(await page.locator('.row[data-i="0"]').getAttribute('class'), 'row done');
    await ctx.close();
  });

  test('leeres Feld zählt nicht als Fehler', async () => {
    const { page, ctx } = await openPage();
    await waitForInputRow(page);
    await page.click('#checkBtn');
    assert.equal(await page.evaluate(() => window.RR.app.current.mistakes), 0);
    assert.equal(await page.locator('.cell.bad').count(), 0);
    await ctx.close();
  });

  test('Buchstaben werden nicht angenommen', async () => {
    const { page, ctx } = await openPage();
    await waitForInputRow(page);
    const cell = page.locator('.row.active .cell').first();
    await cell.focus();
    await page.keyboard.type('a7b');
    assert.equal(await cell.inputValue(), '7');
    await ctx.close();
  });

  test('mit Fehler gelöst: Stern ja, Serie nein', async () => {
    const { page, ctx } = await openPage();
    await setSettings(page, { level: 'hilfe' });
    await waitForInputRow(page);
    const [ans] = await activeAnswers(page);
    const cell = page.locator('.row.active .cell').first();
    await cell.fill(String(ans + 1));
    await cell.press('Enter');
    await solveTask(page);
    await page.waitForFunction(() => document.getElementById('starCount').textContent === '1');
    assert.equal(await page.locator('#streakCount').textContent(), '0');
    await ctx.close();
  });

  test('5 fehlerfrei hintereinander: Galopp-Parade', async () => {
    const { page, ctx } = await openPage();
    for (let k = 0; k < 5; k++) {
      await solveTask(page);
      if (k < 4) await page.click('#checkBtn'); // Weiter
    }
    await assert.doesNotReject(page.locator('.parade').waitFor({ timeout: 3000 }));
    assert.equal(await page.locator('#streakCount').textContent(), '5');
    await ctx.close();
  });
});

describe('Zahlenfeld und Speichern', () => {
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
    const { page, ctx } = await openPage({ welcomed: false });
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

describe('Review-Befunde in der Oberfläche', () => {
  test('Profi-Division: falsche Zerlegung sperrt das zweite Feld nicht', async () => {
    const { page, ctx } = await openPage();
    // Aufgabe suchen, bei der "Zehner + Rest" nicht durch den Teiler teilbar ist
    await page.evaluate(() => {
      Object.assign(window.RR.app.state.settings, { op: ':', level: 'zerlegen', rest: false });
      do { window.RR.app.newTask(); } while ((Math.floor(window.RR.app.current.task.a / 10) * 10) % window.RR.app.current.task.b === 0);
    });
    await waitForInputRow(page);
    const { D } = await page.evaluate(() => ({ D: window.RR.app.current.task.a }));
    const cells = page.locator('.row.active .cell');
    const t = Math.floor(D / 10) * 10;
    await cells.nth(0).fill(String(t));
    await cells.nth(1).fill(String(D - t));
    await cells.nth(1).press('Enter');
    assert.equal(await cells.nth(0).evaluate((e) => e.classList.contains('bad')), true);
    assert.equal(await cells.nth(1).evaluate((e) => e.readOnly), false, 'zweites Feld bleibt änderbar');
    // jetzt richtig lösen
    const answers = await activeAnswers(page);
    await cells.nth(0).fill(String(answers[0]));
    await cells.nth(1).fill(String(answers[1]));
    await cells.nth(1).press('Enter');
    await page.waitForFunction(() => window.RR.app.current.row >= 1);
    await ctx.close();
  });

  test('Eingabefelder haben sprechende Namen', async () => {
    const { page, ctx } = await openPage();
    await setSettings(page, { op: '+', strategy: 'stellenweise', level: 'zerlegen' });
    await waitForInputRow(page);
    const labels = await page.locator('.row.active .cell').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
    assert.deepEqual(labels, ['Zehner: 1. Zahl', 'Zehner: 2. Zahl', 'Zehner: 3. Zahl']);
    await ctx.close();
  });
});

describe('Rat bei umständlicher Zerlegung', () => {
  test('Profi-Division mit "Teiler + Rest": angenommen, ohne Fehler, aber mit Tipp', async () => {
    const { page, ctx } = await openPage();
    // Aufgabe wählen, bei der "Teiler + Rest" sicher umständlich ist (nicht z. B. 42 = 2 + 40)
    await page.evaluate(() => {
      Object.assign(window.RR.app.state.settings, { op: ':', level: 'zerlegen', rest: false });
      const t = () => window.RR.app.current.task;
      do { window.RR.app.newTask(); } while (window.RR.Tasks.isEasySplit(t().b, t().a - t().b, t().b));
    });
    await waitForInputRow(page);
    const { D, d } = await page.evaluate(() => ({ D: window.RR.app.current.task.a, d: window.RR.app.current.task.b }));
    const cells = page.locator('.row.active .cell');
    await cells.nth(0).fill(String(d));
    await cells.nth(1).fill(String(D - d));
    await cells.nth(1).press('Enter');
    await page.waitForFunction(() => window.RR.app.current.row >= 1);
    assert.match(await page.locator('#bubbleText').textContent(), /leichter/);
    assert.equal(await page.evaluate(() => window.RR.app.current.mistakes), 0);
    await ctx.close();
  });
});

describe('Alles selbst', () => {
  test('neue Kinder starten mit "Alles selbst": keine Zahl in den Schritten ist vorgegeben', async () => {
    const { page, ctx } = await openPage();
    await waitForInputRow(page);
    assert.equal(await page.evaluate(() => window.RR.app.state.settings.level), 'selbst');
    assert.match(await page.locator('#strategyBadge').textContent(), /Alles selbst/);
    const row = page.locator('.row.active');
    assert.ok(await row.locator('.cell').count() >= 3);
    assert.equal(await row.locator('.tok-num').count(), 0);
    assert.equal(await page.locator('.row.info').count(), 0, 'keine vorgegebene Zerlegungszeile');
    await ctx.close();
  });

  test('alte Einstellung "Profi-Modus" wird zu "Zerlegung selbst"', async () => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.addInitScript(() => localStorage.setItem('rechenranch-v1',
      JSON.stringify({ welcomed: true, settings: { profi: true, sound: false } })));
    await page.goto(base);
    assert.equal(await page.evaluate(() => window.RR.app.state.settings.level), 'zerlegen');
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

  test('Plus: Zahlen in vertauschter Reihenfolge werden angenommen', async () => {
    const { page, ctx } = await openPage();
    await setSettings(page, { op: '+', strategy: 'stellenweise', level: 'selbst' });
    await waitForInputRow(page);
    const [x, y, z] = await activeAnswers(page);
    const cells = page.locator('.row.active .cell');
    await cells.nth(0).fill(String(y));
    await cells.nth(1).fill(String(x));
    await cells.nth(2).fill(String(z));
    await cells.nth(2).press('Enter');
    await page.waitForFunction(() => window.RR.app.current.row === 1);
    assert.equal(await page.evaluate(() => window.RR.app.current.mistakes), 0);
    await ctx.close();
  });

  test('Malkreuz verrät die Zerlegung erst nach dem Rechenschritt', async () => {
    const { page, ctx } = await openPage();
    await setSettings(page, { op: '·', strategy: 'zerlegen', level: 'selbst' });
    await waitForInputRow(page);
    assert.equal(await page.locator('.malkreuz [data-k="h0"]').textContent(), '?');
    const answers = await activeAnswers(page);
    const cells = page.locator('.row.active .cell');
    for (let i = 0; i < answers.length; i++) await cells.nth(i).fill(String(answers[i]));
    await cells.last().press('Enter');
    await page.waitForFunction(() => document.querySelector('.malkreuz [data-k="h0"]').textContent !== '?');
    await ctx.close();
  });
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
      // realistische Stimmenliste mit langen Namen (Headless-Chromium hat keine Stimmen)
      const init = () => {
        const names = ['Microsoft Katja Online (Natural) - German (Germany)', 'Microsoft Hedda - German (Germany)', 'Google Deutsch'];
        speechSynthesis.getVoices = () => names.map((name) => ({ name, lang: 'de-DE', voiceURI: name, localService: false }));
      };
      const { page, ctx } = await openPage({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, init });
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
