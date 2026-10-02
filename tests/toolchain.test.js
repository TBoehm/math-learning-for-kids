// Werkzeuge und CI: nichts wird ungeprüft nachgeladen (Issue #5).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8'));
const ci = fs.readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8');

test('npm start nutzt den Server aus dem Lockfile, statt ihn per npx nachzuladen', () => {
  assert.doesNotMatch(pkg.scripts.start, /npx/);
  assert.match(pkg.scripts.start, /^http-server /);
  assert.match(pkg.devDependencies['http-server'], /^\d+\.\d+\.\d+$/, 'genaue Version, kein ^ oder ~');
  assert.equal(lock.packages['node_modules/http-server'].version, pkg.devDependencies['http-server']);
});

test('GitHub Actions sind per Commit-Hash festgelegt (Tags lassen sich verschieben)', () => {
  const uses = ci.match(/uses:\s*\S+/g);
  assert.ok(uses.length >= 4);
  for (const u of uses) assert.match(u, /@[0-9a-f]{40}$/, u);
});

test('jeder Test-Job installiert mit npm ci aus dem Lockfile', () => {
  const jobs = ci.split(/\n  (?=\w[\w-]*:\n)/).filter((j) => /npm (test|run test:e2e)/.test(j));
  assert.equal(jobs.length, 2);
  for (const j of jobs) assert.match(j, /run: npm ci\n/, j.split('\n')[0]);
});
