/* Rechen-App (Welten: Einhorn-Ranch, Turbo-Werkstatt) – Oberfläche und Spielablauf. */
(function () {
  'use strict';

  var RR = window.RR;
  var Tasks = RR.Tasks, Check = RR.Check, Progress = RR.Progress;
  var Companion = RR.Companion, Sound = RR.Sound, Viz = RR.Viz;
  var Settings = RR.Settings, UI = RR.UI, Themes = RR.Themes;

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarse = window.matchMedia('(pointer: coarse)');

  // ---------- Speicher ----------
  // schon der Zugriff auf localStorage kann im privaten Modus einen Fehler werfen
  function storage() { try { return window.localStorage; } catch (e) { return null; } }
  function save() { Settings.save(storage(), state); }

  var state = Settings.load(storage());
  var cur = null;      // aktuelle Aufgabe
  var lastInput = null;
  var taskSeq = 0;

  var $ = function (id) { return document.getElementById(id); };
  var pick = UI.pick;
  // Zahlenraum-Schalter neben dem Rechenweg-Menü
  function renderRange() {
    $('rangeToggle').querySelectorAll('button').forEach(function (b) {
      var on = Number(b.dataset.range) === Number(state.settings.range);
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on);
    });
  }

  // aktuelle Welt und ihre Texte
  function theme() { return Themes.byKey(state.theme); }
  function txt() { return theme().texts; }
  function themeCompanions() { return theme().companions.map(function (k) { return Companion.byKey(k); }); }

  function applyTheme() {
    var t = theme();
    document.documentElement.dataset.theme = t.key;
    document.title = t.title;
    $('brandIcon').textContent = t.icon;
    $('brandText').innerHTML = t.title.replace('-', '-<wbr>');
    var other = Themes.byKey(Themes.next(t.key));
    $('themeBtn').textContent = Themes.SWITCH_ICON;
    $('themeBtn').setAttribute('aria-label', 'Welt wechseln: ' + other.name);
    $('themeBtn').title = 'Welt wechseln: ' + other.name;
    $('welcomeStart').textContent = t.startLabel;
    $('unlockTake').textContent = t.takeLabel;
    var fav = document.querySelector('link[rel="icon"]');
    if (fav) fav.href = 'data:image/svg+xml,' + encodeURIComponent(t.favicon);
    decorate();
    renderBuddy();
  }
  function setCompanion(key) {
    state.companion = key;
    state.companions = Object.assign({}, state.companions);
    state.companions[state.theme] = key;
  }

  // ---------- Sprechblase ----------
  function say(text) {
    var b = $('bubble');
    $('bubbleText').textContent = text;
    b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
  }

  // ---------- Begleiter ----------
  function companionName() { return Companion.byKey(state.companion).name; }
  function renderBuddy() {
    $('buddyFigure').innerHTML = Companion.svg(state.companion);
    $('buddyFigure').setAttribute('aria-label', companionName() + ' – antippen');
  }
  var reactTimer = null;
  function react(kind, ms) {
    var b = $('buddy');
    b.classList.remove('is-happy', 'is-oops', 'is-nod', 'is-gallop');
    void b.offsetWidth;
    b.classList.add('is-' + kind);
    clearTimeout(reactTimer);
    reactTimer = setTimeout(function () { b.classList.remove('is-' + kind); }, ms || 1200);
  }

  // ---------- Rechenart-Auswahl ----------
  var OPS = [
    { op: '+', label: '+', name: 'Plus' },
    { op: '−', label: '−', name: 'Minus' },
    { op: '·', label: '·', name: 'Mal' },
    { op: ':', label: ':', name: 'Geteilt' },
    { op: 'mix', label: '🎲', name: 'Gemischt' }
  ];
  function renderOps() {
    var box = $('opChips');
    box.innerHTML = '';
    OPS.forEach(function (o) {
      var b = document.createElement('button');
      b.className = 'op-chip' + (state.settings.op === o.op ? ' active' : '');
      b.innerHTML = '<span class="op-sym' + (o.op === '·' || o.op === ':' ? ' big' : '') + '">' + o.label + '</span><span class="op-name">' + o.name + '</span>';
      b.setAttribute('aria-pressed', state.settings.op === o.op);
      b.addEventListener('click', function () {
        Sound.tap();
        state.settings.op = o.op;
        state.settings.strategy = 'mix';
        save(); renderOps(); newTask();
      });
      box.appendChild(b);
    });
    renderRange();
    var sbox = $('stratChips'), menu = $('stratMenu');
    sbox.innerHTML = '';
    menu.open = false;
    var label = Settings.strategyLabel(state.settings.op, state.settings.strategy);
    if (!label) { menu.hidden = true; return; }
    menu.hidden = false;
    $('stratSummary').innerHTML = '<span class="sm-group">' + label.group + '</span><span class="sm-name">' + label.name +
      '</span><span class="sm-caret" aria-hidden="true">▼</span>';
    var list = Settings.strategyChoices(state.settings.op);
    state.settings.strategy = Settings.validStrategy(state.settings.op, state.settings.strategy);
    var groups = list.map(function (s) { return s.group; }).filter(function (g, i, a) { return a.indexOf(g) === i; });
    var lastGroup = null;
    list.forEach(function (s) {
      if (groups.length > 1 && s.group !== lastGroup) {
        var h = document.createElement('span');
        h.className = 'strat-group';
        h.textContent = Tasks.GROUPS.filter(function (g) { return g.key === s.group; })[0].name;
        sbox.appendChild(h);
      }
      lastGroup = s.group;
      var b = document.createElement('button');
      var active = state.settings.strategy === s.key || (list.length === 1);
      b.className = 'strat-chip' + (active ? ' active' : '');
      b.textContent = s.name;
      if (s.desc) b.title = s.desc;
      b.setAttribute('aria-pressed', active);
      b.addEventListener('click', function () {
        Sound.tap();
        state.settings.strategy = s.key;
        save(); renderOps(); newTask();
      });
      sbox.appendChild(b);
    });
  }

  // ---------- Aufgabe aufbauen ----------
  function newTask() {
    var s = state.settings;
    var task = Tasks.generate({ op: s.op, strategy: s.strategy, crossing: s.crossing, level: s.level, rest: s.rest, max: Number(s.range) });
    cur = { task: task, row: -1, vals: {}, rowMistakes: 0, mistakes: 0, hintsUsed: 0, done: false, id: ++taskSeq };
    renderTask();
    say(UI.introText(task, state.name && Math.random() < 0.3 ? state.name : ''));
    activateRow(0);
  }

  function tokenHtml(tok, ariaLabel) {
    if (tok.t === 'txt') return '<span class="tok-op">' + tok.v + '</span>';
    if (tok.t === 'num') return '<span class="tok-num">' + tok.v + '</span>';
    if (tok.t === 'ref') return '<span class="tok-num tok-ref" data-ref="' + tok.id + '">?</span>';
    if (tok.t === 'choice') {
      // Auswahl: Knöpfe + verstecktes Feld mit der Nummer der gewählten Antwort
      return '<span class="choice" role="group" aria-label="' + ariaLabel + '" data-for="' + tok.id + '">' +
        tok.options.map(function (o, k) {
          return '<button type="button" class="choice-btn" data-k="' + k + '">' + o + '</button>';
        }).join('') +
        '<input class="cell choice-input" data-id="' + tok.id + '" type="hidden" value=""></span>';
    }
    return '<input class="cell" data-id="' + tok.id + '" type="text" maxlength="4" autocomplete="off" ' +
      'autocorrect="off" spellcheck="false" enterkeyhint="done" pattern="[0-9]*" aria-label="' + ariaLabel + '">';
  }

  function renderTask() {
    var t = cur.task;
    $('strategyBadge').textContent = UI.badgeText(t);
    $('strategyBadge').title = t.strategyDesc;
    var rest = t.op === ':' && t.rest ? '<span class="final-rest" hidden> R ' + t.rest + '</span>' : '';
    // Knobel-Aufgaben ohne einzelne Rechnung (z. B. Zahlenmauer) zeigen nur ihren Titel
    $('equation').innerHTML = t.title ? '<span>' + t.title + '</span>'
      : '<span>' + Tasks.taskText(t) + ' = </span><span class="final" id="final">?</span>' + rest;
    var rows = $('rows');
    rows.innerHTML = '';
    rows.className = 'rows' + (t.layout ? ' layout-' + t.layout : '');
    var layout = t.layout && RR.Layouts && RR.Layouts[t.layout];
    // Eine Darstellung muss je Zeile ein .row[data-i] mit den Feldern (.cell) erzeugen
    if (layout) layout.render(t, rows, { tokenHtml: tokenHtml, cellLabels: UI.cellLabels });
    else t.rows.forEach(function (row, i) { rows.appendChild(rowElement(row, i)); });
    rows.querySelectorAll('.row').forEach(wireRow);
    applyInputMode();
    cur.viz = Viz.create($('viz'), t, state.companion);
    $('checkBtn').textContent = 'Prüfen ✔';
    $('checkBtn').classList.remove('next');
    $('taskCard').classList.remove('solved');
  }

  function rowElement(row, i) {
    var d = document.createElement('div');
    d.className = 'row future';
    d.dataset.i = i;
    var labels = UI.cellLabels(row), n = 0;
    d.innerHTML = '<span class="row-label">' + row.label + '</span><div class="eq">' +
      row.tokens.map(function (tok) {
        return tokenHtml(tok, tok.t === 'in' || tok.t === 'choice' ? labels[n++] : '');
      }).join('') + '</div>';
    return d;
  }
  function wireRow(d) {
    d.querySelectorAll('.cell:not(.choice-input)').forEach(setupInput);
    d.querySelectorAll('.choice').forEach(function (group) {
      var inp = group.querySelector('.choice-input');
      group.querySelectorAll('.choice-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (inp.readOnly || !d.classList.contains('active')) return;
          group.querySelectorAll('.choice-btn').forEach(function (b) { b.classList.remove('picked'); });
          btn.classList.add('picked');
          inp.value = btn.dataset.k;
          Sound.tap();
          // Gibt es in der Zeile sonst nichts mehr einzutragen, gleich prüfen
          var open = Array.prototype.some.call(d.querySelectorAll('.cell:not(.choice-input)'), function (c) { return !c.readOnly && !c.value; });
          if (!open) check();
        });
      });
    });
  }

  function rowEl(i) { return $('rows').querySelector('.row[data-i="' + i + '"]'); }
  function inputsIn(i) { return Array.prototype.slice.call(rowEl(i).querySelectorAll('.cell')); }

  function fillRefs() {
    $('rows').querySelectorAll('.tok-ref').forEach(function (r) {
      var v = cur.vals[r.dataset.ref];
      if (v !== undefined) r.textContent = v;
    });
  }

  // Zeile ins Bild holen – über dem Zahlenfeld, falls es eingeblendet ist.
  // Zeilen ohne eigene Box (Spalten im Rechenraster, display: contents) zeigen das ganze Raster.
  function reveal(el) {
    var box = el.getClientRects().length ? el : el.closest('.cpaper') || el.parentNode;
    var r = box.getBoundingClientRect(), np = $('numpad');
    var bottom = document.body.classList.contains('has-numpad') && np.offsetParent ? np.getBoundingClientRect().top : window.innerHeight;
    var dy = UI.revealDelta(r.top, r.bottom, 8, bottom - 8);
    if (dy) window.scrollBy({ top: dy, behavior: reducedMotion ? 'auto' : 'smooth' });
  }

  function activateRow(i) {
    cur.row = i;
    cur.rowMistakes = 0;
    var el = rowEl(i);
    el.classList.remove('future');
    el.classList.add('active');
    fillRefs();
    if (i > 0) reveal(el);
    var ins = inputsIn(i);
    if (!ins.length) {
      // Info-Zeile: kurz zeigen, dann weiter
      var id = cur.id;
      setTimeout(function () {
        if (!cur || cur.id !== id) return;
        el.classList.remove('active');
        el.classList.add('done', 'info');
        activateRow(i + 1);
      }, reducedMotion ? 50 : 700);
      return;
    }
    focusInput(ins[0]);
  }

  function focusInput(inp) {
    if (!inp) return;
    if (inp.classList.contains('choice-input')) { markCurrent(null); return; }
    lastInput = inp;
    // Auf Touch-Geräten mit Zahlenfeld nicht fokussieren (sonst springt evtl. die Tastatur auf)
    if (numpadVisible() && coarse.matches) { markCurrent(inp); return; }
    inp.focus({ preventScroll: true });
    markCurrent(inp);
  }
  function markCurrent(inp) {
    $('rows').querySelectorAll('.cell.current').forEach(function (c) { c.classList.remove('current'); });
    if (inp) inp.classList.add('current');
  }

  function setupInput(inp) {
    inp.addEventListener('input', function () {
      inp.dataset.fresh = '';
      var clean = UI.sanitize(inp.value);
      if (clean !== inp.value) inp.value = clean;
      inp.classList.remove('bad', 'shake');
    });
    inp.addEventListener('focus', function () {
      lastInput = inp; markCurrent(inp);
      // select() holt in Chromium den Fokus zurück – nur, wenn das Feld noch dran ist
      setTimeout(function () {
        if (document.activeElement !== inp) return;
        try { inp.select(); } catch (e) { /* egal */ }
      }, 0);
    });
    inp.addEventListener('pointerdown', function () { lastInput = inp; markCurrent(inp); });
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); check(); }
    });
  }

  // ---------- Prüfen ----------
  function check() {
    if (!cur) return;
    if (cur.done) { newTask(); return; }
    var i = cur.row, row = cur.task.rows[i];
    var ins = inputsIn(i);
    if (!ins.length) return;
    var raw = {};
    ins.forEach(function (inp) { raw[inp.dataset.id] = inp.value; });
    var r = Check.checkRow(row, raw, cur.vals);
    var out = UI.outcome(r);

    if (out.kind === 'empty' || out.kind === 'incomplete') {
      // leere Felder zählen nicht als Fehler
      if (out.kind === 'empty') say('Trag zuerst eine Zahl ein. ✏️');
      focusInput(ins[out.focus]);
      return;
    }

    r.fields.forEach(function (f, k) {
      var inp = ins[k], fx = UI.fieldEffect(f.status);
      inp.classList.remove('bad', 'shake', 'ok');
      if (fx.shake) { void inp.offsetWidth; inp.classList.add('shake'); }
      if (fx.cls) inp.classList.add(fx.cls);
      if (fx.locked) inp.readOnly = true;
      if (fx.fresh) inp.dataset.fresh = '1';
      if (inp.classList.contains('choice-input')) {
        var g = inp.parentNode;
        g.classList.remove('bad', 'shake', 'ok');
        if (fx.cls) g.classList.add(fx.cls);
        if (fx.shake) { void g.offsetWidth; g.classList.add('shake'); }
      }
    });

    if (out.kind === 'correct') {
      cur.vals = r.vals;
      var el = rowEl(i);
      el.classList.remove('active');
      el.classList.add('done');
      // Zeilenname nach dem Rechnen, z. B. "Eine Stelle" -> "Zehner"
      var lbl = el.querySelector('.row-label');
      if (lbl) lbl.textContent = UI.doneLabel(row, cur.vals);
      markCurrent(null);
      fillRefs();
      if (cur.viz) cur.viz.update(cur.vals, i);
      var step = UI.afterCorrect(cur.task, cur.vals, i);
      if (step === 'finish' || step === 'stuck') { finish(); return; }
      if (step === 'append') {
        // das Kind verlängert die Rechnung selbst: nächste Zeile erzeugen
        var nr = cur.task.nextRow(cur.vals);
        cur.task.rows.push(nr);
        var nd = rowElement(nr, i + 1);
        $('rows').appendChild(nd);
        wireRow(nd);
        applyInputMode();
      }
      Sound.step();
      react('nod', 700);
      say(UI.rowDoneText(row, cur.task.rows[i + 1], cur.vals, null, txt()));
      activateRow(i + 1);
      return;
    }

    cur.rowMistakes++;
    cur.mistakes++;
    Sound.wrong();
    react('oops', 900);
    say(UI.wrongText(row, r, cur.rowMistakes, null, txt()));
    if (out.focus !== null) focusInput(ins[out.focus]);
  }

  function hint() {
    if (!cur) return;
    Sound.tap();
    if (cur.done) { say(theme().doneHint); return; }
    cur.hintsUsed++;
    react('nod', 700);
    say('Tipp: ' + cur.task.rows[cur.row].hint);
  }

  function finish() {
    cur.done = true;
    var t = cur.task;
    var fin = $('final');
    if (fin) { fin.textContent = t.answer; fin.classList.add('solved'); } else fin = $('equation');
    var restEl = document.querySelector('.final-rest');
    if (restEl) restEl.hidden = false;
    $('taskCard').classList.add('solved');
    $('checkBtn').textContent = 'Weiter ➜';
    $('checkBtn').classList.add('next');
    $('checkBtn').focus({ preventScroll: true });

    var res = Progress.applyResult(state.progress, { mistakes: cur.mistakes, hintsUsed: cur.hintsUsed }, themeCompanions());
    state.progress = res.state;
    save();
    Sound.win();
    react('happy', 1400);
    say(pick(res.events.perfect ? txt().perfect : txt().solved));
    confetti(fin);
    flyStar(fin);
    if (res.events.parade) setTimeout(function () { parade(res.state.streak); }, 900);
    if (res.events.unlocked.length) {
      setTimeout(function () { showUnlock(res.events.unlocked[res.events.unlocked.length - 1]); }, res.events.parade ? 4200 : 1300);
    }
  }

  // ---------- Statistik ----------
  function updateStats(bump) {
    $('starCount').textContent = state.progress.stars;
    $('streakCount').textContent = state.progress.streak;
    if (bump) {
      var s = $('starCount').parentNode;
      s.classList.remove('bump'); void s.offsetWidth; s.classList.add('bump');
    }
  }

  // ---------- Effekte ----------
  function confetti(origin) {
    var layer = $('fxLayer');
    var r = origin.getBoundingClientRect();
    var ox = r.left + r.width / 2, oy = r.top + r.height / 2;
    var n = reducedMotion ? 10 : 42;
    for (var i = 0; i < n; i++) {
      var p = document.createElement('span');
      p.className = 'confetti';
      if (i % 3 === 0) { p.classList.add('bit'); p.style.background = pick(theme().colors); }
      else p.textContent = pick(theme().confetti);
      p.style.left = ox + 'px'; p.style.top = oy + 'px';
      layer.appendChild(p);
      var ang = Math.random() * Math.PI * 2, dist = 120 + Math.random() * 260;
      var dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist * 0.7 - 120;
      var anim = p.animate([
        { transform: 'translate(-50%,-50%) scale(.3) rotate(0deg)', opacity: 1 },
        { transform: 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px)) scale(1.1) rotate(' + (Math.random() * 360) + 'deg)', opacity: 1, offset: 0.45 },
        { transform: 'translate(calc(-50% + ' + dx * 1.2 + 'px), calc(-50% + ' + (dy + 320) + 'px)) scale(.9) rotate(' + (Math.random() * 720) + 'deg)', opacity: 0 }
      ], { duration: 1600 + Math.random() * 1000, easing: 'cubic-bezier(.2,.7,.4,1)' });
      anim.onfinish = (function (el) { return function () { el.remove(); }; })(p);
    }
  }

  function flyStar(origin) {
    var from = origin.getBoundingClientRect(), to = $('starCount').getBoundingClientRect();
    var s = document.createElement('span');
    s.className = 'fly-star'; s.textContent = '⭐';
    s.style.left = (from.left + from.width / 2) + 'px'; s.style.top = (from.top + from.height / 2) + 'px';
    $('fxLayer').appendChild(s);
    var dx = to.left + to.width / 2 - (from.left + from.width / 2), dy = to.top + to.height / 2 - (from.top + from.height / 2);
    var a = s.animate([
      { transform: 'translate(-50%,-50%) scale(1)' },
      { transform: 'translate(calc(-50% + ' + dx * 0.4 + 'px), calc(-50% + ' + (dy * 0.4 - 80) + 'px)) scale(2.2)', offset: 0.4 },
      { transform: 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px)) scale(.8)' }
    ], { duration: reducedMotion ? 200 : 1100, easing: 'ease-in-out' });
    a.onfinish = function () { s.remove(); updateStats(true); };
  }

  function parade(streak) {
    var layer = $('fxLayer');
    var p = document.createElement('div');
    p.className = 'parade';
    p.innerHTML = '<div class="parade-banner">' + theme().paradeBanner(streak) + '</div>' +
      '<div class="parade-runner is-gallop"><div class="parade-trail"></div>' + Companion.svg(state.companion) + '</div>';
    layer.appendChild(p);
    Sound.fanfare();
    setTimeout(function () { if (theme().sound === 'engine') Sound.engine(5); else Sound.gallop(14); }, 600);
    var runner = p.querySelector('.parade-runner');
    var a = runner.animate([
      { transform: 'translateX(-40vw)' }, { transform: 'translateX(120vw)' }
    ], { duration: reducedMotion ? 1500 : 3400, easing: 'linear' });
    a.onfinish = function () { p.remove(); };
  }

  function showUnlock(c) {
    var dlg = $('unlockDlg');
    $('unlockFigure').innerHTML = Companion.svg(c.key);
    $('unlockText').textContent = c.name + ' (' + c.kind + ') möchte mit dir rechnen!';
    $('unlockTake').onclick = function () { setCompanion(c.key); save(); renderBuddy(); dlg.close(); say('Hallo, ich bin ' + c.name + '! ✨'); react('happy'); };
    Sound.fanfare();
    dlg.showModal();
    confetti($('unlockFigure'));
  }

  // ---------- Zahlenfeld ----------
  function numpadVisible() { return Settings.numpadVisible(state.settings.numpad, coarse.matches); }
  function applyInputMode() {
    var vis = numpadVisible();
    $('numpad').hidden = !vis;
    document.body.classList.toggle('has-numpad', vis);
    $('rows').querySelectorAll('.cell').forEach(function (c) {
      c.setAttribute('inputmode', UI.inputMode(vis, coarse.matches));
    });
  }
  function buildNumpad() {
    var keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '⌫', '✔'];
    var np = $('numpad');
    keys.forEach(function (k) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = k;
      b.className = 'np-key' + (k === '✔' ? ' np-ok' : k === '⌫' ? ' np-del' : '');
      b.setAttribute('aria-label', k === '⌫' ? 'Löschen' : k === '✔' ? 'Prüfen' : k);
      b.addEventListener('pointerdown', function (e) { e.preventDefault(); });
      b.addEventListener('click', function () { numKey(k); });
      np.appendChild(b);
    });
  }
  function targetInput() {
    if (!cur || cur.done || cur.row < 0) return null;
    // Auswahlfelder werden angetippt, nicht über das Zahlenfeld gefüllt
    return UI.pickTarget(inputsIn(cur.row).filter(function (c) { return !c.classList.contains('choice-input'); }), lastInput);
  }
  function numKey(k) {
    Sound.tap();
    if (k === '✔') { check(); return; }
    var inp = targetInput();
    if (!inp) return;
    // Nach dem Prüfen ist das Feld "frisch": erste Ziffer ersetzt den Inhalt
    inp.value = UI.applyKey(inp.value, inp.dataset.fresh === '1', k);
    inp.dataset.fresh = '';
    inp.classList.remove('bad', 'shake');
    lastInput = inp;
    markCurrent(inp);
  }

  // ---------- Dialoge ----------
  function renderBuddyGrid() {
    var grid = $('buddyGrid');
    grid.innerHTML = '';
    themeCompanions().forEach(function (c) {
      var open = Progress.isUnlocked(state.progress, c);
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'buddy-card' + (state.companion === c.key ? ' selected' : '') + (open ? '' : ' locked');
      b.disabled = !open;
      b.setAttribute('aria-pressed', state.companion === c.key);
      b.innerHTML = '<div class="bc-fig">' + Companion.svg(c.key) + '</div><b>' + c.name + '</b><small>' +
        (open ? c.kind : '🔒 ab ' + c.stars + ' ⭐') + '</small>';
      b.addEventListener('click', function () {
        setCompanion(c.key); save(); Sound.hop(); renderBuddyGrid(); renderBuddy();
      });
      grid.appendChild(b);
    });
  }
  // Welten zur Auswahl (Begrüßung)
  function renderWorldGrid() {
    var grid = $('worldGrid');
    grid.innerHTML = '';
    Themes.THEMES.forEach(function (t) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'world-card' + (state.theme === t.key ? ' selected' : '');
      b.setAttribute('aria-pressed', state.theme === t.key);
      b.innerHTML = '<span class="wc-icon">' + t.icon + '</span><b>' + t.name + '</b>';
      b.addEventListener('click', function () {
        if (state.theme === t.key) return;
        switchWorld(t.key);
        renderWorldGrid(); renderBuddyGrid();
      });
      grid.appendChild(b);
    });
    $('welcomeTitle').textContent = theme().welcome;
  }
  function switchWorld(key) {
    state = Themes.switchTheme(state, key);
    save();
    applyTheme();
    say(UI.welcomeText(state.name, companionName(), theme().hello));
    if (theme().sound === 'engine') Sound.engine(); else Sound.hop();
  }

  function openWelcome() {
    $('nameInput').value = state.name || '';
    renderWorldGrid();
    renderBuddyGrid();
    $('welcomeDlg').showModal();
  }

  function syncSettingsUI() {
    var dlg = $('settingsDlg');
    dlg.querySelectorAll('.seg').forEach(function (seg) {
      var key = seg.dataset.setting;
      seg.querySelectorAll('button').forEach(function (b) {
        var on = String(state.settings[key]) === b.dataset.value;
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', on);
      });
    });
    dlg.querySelectorAll('input[type=checkbox][data-setting]').forEach(function (c) {
      c.checked = !!state.settings[c.dataset.setting];
    });
    var lvl = Settings.levelInfo(state.settings.level);
    $('levelNote').textContent = lvl ? lvl.desc : '';
  }

  function initDialogs() {
    $('welcomeDlg').addEventListener('close', function () {
      state.name = UI.cleanName($('nameInput').value);
      state.welcomed = true;
      save();
      renderBuddy();
      say(UI.welcomeText(state.name, companionName(), theme().hello));
      react('happy');
    });

    var before = null;
    $('settingsBtn').addEventListener('click', function () {
      Sound.tap();
      before = Settings.taskKey(state.settings);
      syncSettingsUI();
      $('settingsDlg').showModal();
    });
    $('settingsDlg').querySelectorAll('.seg button').forEach(function (b) {
      b.addEventListener('click', function () {
        state.settings[b.parentNode.dataset.setting] = b.dataset.value;
        save(); syncSettingsUI(); applyInputMode(); Sound.tap();
      });
    });
    $('settingsDlg').querySelectorAll('input[type=checkbox][data-setting]').forEach(function (c) {
      c.addEventListener('change', function () {
        state.settings[c.dataset.setting] = c.checked;
        Sound.setEnabled(state.settings.sound);
        save(); Sound.tap();
      });
    });
    $('settingsDlg').addEventListener('close', function () {
      if (Settings.taskKey(state.settings) !== before) newTask();
    });
    $('changeBuddyBtn').addEventListener('click', function () {
      $('settingsDlg').close();
      openWelcome();
    });
    $('resetBtn').addEventListener('click', function () {
      if (!window.confirm('Wirklich alle Sterne und Freischaltungen löschen?')) return;
      state.progress = Settings.defaults().progress;
      if (!Progress.isUnlocked(state.progress, Companion.byKey(state.companion))) setCompanion(theme().defaultCompanion);
      save(); updateStats(); renderBuddy();
    });
  }

  // ---------- Hintergrund ----------
  function decorate() {
    var tw = document.querySelector('.twinkles');
    tw.innerHTML = '';
    for (var i = 0; i < 14; i++) {
      var s = document.createElement('span');
      s.textContent = i % 3 ? '✦' : '✧';
      s.style.left = Math.random() * 100 + '%';
      s.style.top = Math.random() * 60 + '%';
      s.style.animationDelay = (Math.random() * 4).toFixed(2) + 's';
      s.style.fontSize = (10 + Math.random() * 16) + 'px';
      tw.appendChild(s);
    }
    var fl = document.querySelector('.flowers');
    fl.innerHTML = '';
    var kinds = theme().decor;
    for (var j = 0; j < 12; j++) {
      var f = document.createElement('span');
      f.textContent = kinds[j % kinds.length];
      f.style.left = (j / 12 * 100 + Math.random() * 6) + '%';
      f.style.bottom = (2 + Math.random() * 9) + 'vh';
      f.style.animationDelay = (Math.random() * 3).toFixed(2) + 's';
      fl.appendChild(f);
    }
  }

  // ---------- Start ----------
  function init() {
    Sound.setEnabled(state.settings.sound);
    applyTheme();
    renderOps();
    buildNumpad();
    updateStats();
    initDialogs();

    $('checkBtn').addEventListener('click', check);
    $('hintBtn').addEventListener('click', hint);
    $('newBtn').addEventListener('click', function () { Sound.tap(); newTask(); });
    $('buddyFigure').addEventListener('click', function () {
      if (theme().sound === 'engine') Sound.horn(); else Sound.hop();
      react('happy', 1000); say(pick(txt().poke));
    });
    if (coarse.addEventListener) coarse.addEventListener('change', applyInputMode);
    $('rangeToggle').querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () {
        if (Number(b.dataset.range) === Number(state.settings.range)) return;
        Sound.tap();
        state.settings = Settings.withRange(state.settings, b.dataset.range);
        save(); renderRange(); newTask();
      });
    });
    // Rechenweg-Menü: Tippen daneben oder Escape klappt es wieder zu
    document.addEventListener('click', function (e) {
      if ($('stratMenu').open && !$('stratMenu').contains(e.target)) $('stratMenu').open = false;
    });
    $('stratMenu').addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && $('stratMenu').open) { $('stratMenu').open = false; $('stratSummary').focus(); }
    });
    $('stratMenu').addEventListener('toggle', function () { if ($('stratMenu').open) Sound.tap(); });
    $('themeBtn').addEventListener('click', function () {
      switchWorld(Themes.next(state.theme));
      react('happy', 1000);
      say(theme().welcome);
    });

    newTask();
    if (!state.welcomed) openWelcome();
  }

  // Für automatische Tests
  RR.app = {
    get state() { return state; },
    get current() { return cur; },
    newTask: newTask,
    renderOps: renderOps,
    check: check
  };

  init();
})();
