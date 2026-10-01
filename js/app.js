/* Einhorn-Rechenranch – Oberfläche und Spielablauf. */
(function () {
  'use strict';

  var RR = window.RR;
  var Tasks = RR.Tasks, Check = RR.Check, Progress = RR.Progress;
  var Companion = RR.Companion, Sound = RR.Sound, Viz = RR.Viz;

  var STORE = 'rechenranch-v1';
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarse = window.matchMedia('(pointer: coarse)');

  var DEFAULTS = {
    settings: { op: '+', strategy: 'mix', crossing: 'egal', profi: false, rest: false, sound: true, numpad: 'auto' },
    progress: { stars: 0, streak: 0, bestStreak: 0, solved: 0 },
    companion: 'luna', name: '', welcomed: false
  };

  // ---------- Speicher ----------
  function load() {
    var s = JSON.parse(JSON.stringify(DEFAULTS));
    try {
      var raw = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (raw) {
        s.settings = Object.assign(s.settings, raw.settings);
        s.progress = Object.assign(s.progress, raw.progress);
        ['companion', 'name', 'welcomed'].forEach(function (k) { if (k in raw) s[k] = raw[k]; });
      }
    } catch (e) { /* privater Modus o. Ä. – dann eben ohne Speichern */ }
    return s;
  }
  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { /* egal */ }
  }

  var state = load();
  var cur = null;      // aktuelle Aufgabe
  var lastInput = null;
  var taskSeq = 0;

  var $ = function (id) { return document.getElementById(id); };
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  // ---------- Texte ----------
  var TXT = {
    rowOk: ['Richtig!', 'Genau!', 'Super!', 'Prima!', 'Stimmt!', 'Klasse!', 'Jawoll!', 'Toll!'],
    perfect: ['Wieherrrvorragend! 🐴', 'Zauberhaft gerechnet! ✨', 'Du bist ein Rechen-Star! ⭐',
      'Galoppierend gut! 🏇', 'Einhorn-mäßig super! 🦄', 'Volltreffer! 🎯', 'Regenbogen-stark! 🌈'],
    solved: ['Geschafft! Fehler machen schlau. 💪', 'Super, du hast nicht aufgegeben! 🌈',
      'Richtig! Übung macht den Meister. ⭐', 'Juhu, gelöst! 🎉'],
    oops: ['Fast! Schau noch mal genau hin. 🔍', "Hoppla! Probier's noch einmal. 🐎",
      'Nicht ganz – du schaffst das! 💪', 'Hmm, rechne noch mal nach. 🤔'],
    poke: ['Hihi, das kitzelt! 🦄', 'Ich mag Zahlen fast so gern wie Möhren! 🥕',
      'Zusammen rechnen macht Spaß! 💖', 'Wiehern ist meine Lieblingssprache! 🐴',
      'Ich glaub an dich! ⭐', 'Jede Aufgabe macht dich stärker! 💪']
  };

  // ---------- Sprechblase ----------
  function say(text) {
    var b = $('bubble');
    $('bubbleText').textContent = text;
    b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
  }
  function speak() {
    if (!('speechSynthesis' in window)) return;
    var text = $('bubbleText').textContent
      .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
      .replace(/·/g, ' mal ').replace(/:/g, ' geteilt durch ').replace(/−/g, ' minus ');
    window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text);
    u.lang = 'de-DE'; u.rate = 0.95; u.pitch = 1.15;
    window.speechSynthesis.speak(u);
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
    var sbox = $('stratChips');
    sbox.innerHTML = '';
    if (state.settings.op === 'mix') { sbox.hidden = true; return; }
    sbox.hidden = false;
    var list = [{ key: 'mix', name: 'Alle Wege' }].concat(Tasks.STRATEGIES[state.settings.op]);
    if (list.length === 2) list = list.slice(1);
    list.forEach(function (s) {
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
    var task = Tasks.generate({ op: s.op, strategy: s.strategy, crossing: s.crossing, profi: s.profi, rest: s.rest });
    cur = { task: task, row: -1, vals: {}, rowMistakes: 0, mistakes: 0, hintsUsed: 0, done: false, id: ++taskSeq };
    renderTask();
    var greet = state.name && Math.random() < 0.3 ? state.name + ', ' : '';
    var intro = {
      stellenweise: 'rechne stellenweise: Zehner und Einer getrennt.',
      schrittweise: task.op === '+' ? 'rechne schrittweise: erst die Zehner dazu, dann die Einer.'
        : 'rechne schrittweise: erst die Zehner weg, dann die Einer.',
      hilfsaufgabe: 'nimm eine Hilfsaufgabe mit einer glatten Zahl.',
      ergaenzen: 'ergänze von ' + task.b + ' bis ' + task.a + '. Wie weit musst du springen?',
      zerlegen: task.op === ':' ? 'zerlege ' + task.a + ' in zwei leichte Teile.' : 'zerlege die Malaufgabe in zwei leichte.',
      kernaufgaben: 'nutze eine leichte Kernaufgabe.'
    }[task.strategy] || '';
    say((greet ? greet + intro : intro.charAt(0).toUpperCase() + intro.slice(1)));
    activateRow(0);
  }

  function tokenHtml(tok) {
    if (tok.t === 'txt') return '<span class="tok-op">' + tok.v + '</span>';
    if (tok.t === 'num') return '<span class="tok-num">' + tok.v + '</span>';
    if (tok.t === 'ref') return '<span class="tok-num tok-ref" data-ref="' + tok.id + '">?</span>';
    return '<input class="cell" data-id="' + tok.id + '" type="text" maxlength="3" autocomplete="off" ' +
      'autocorrect="off" spellcheck="false" enterkeyhint="done" pattern="[0-9]*" aria-label="Zahl eintragen">';
  }

  function renderTask() {
    var t = cur.task;
    $('strategyBadge').textContent = t.strategyName + (t.profi ? ' · Profi' : '');
    $('strategyBadge').title = t.strategyDesc;
    var rest = t.op === ':' && t.rest ? '<span class="final-rest" hidden> R ' + t.rest + '</span>' : '';
    $('equation').innerHTML = '<span>' + Tasks.taskText(t) + ' = </span><span class="final" id="final">?</span>' + rest;
    var rows = $('rows');
    rows.innerHTML = '';
    t.rows.forEach(function (row, i) {
      var d = document.createElement('div');
      d.className = 'row future';
      d.dataset.i = i;
      d.innerHTML = '<span class="row-label">' + row.label + '</span><div class="eq">' +
        row.tokens.map(tokenHtml).join('') + '</div>';
      rows.appendChild(d);
    });
    rows.querySelectorAll('.cell').forEach(setupInput);
    applyInputMode();
    cur.viz = Viz.create($('viz'), t, state.companion);
    $('checkBtn').textContent = 'Prüfen ✔';
    $('checkBtn').classList.remove('next');
    $('taskCard').classList.remove('solved');
  }

  function rowEl(i) { return $('rows').querySelector('.row[data-i="' + i + '"]'); }
  function inputsIn(i) { return Array.prototype.slice.call(rowEl(i).querySelectorAll('.cell')); }

  function fillRefs() {
    $('rows').querySelectorAll('.tok-ref').forEach(function (r) {
      var v = cur.vals[r.dataset.ref];
      if (v !== undefined) r.textContent = v;
    });
  }

  function activateRow(i) {
    cur.row = i;
    cur.rowMistakes = 0;
    var el = rowEl(i);
    el.classList.remove('future');
    el.classList.add('active');
    fillRefs();
    if (i > 0 && el.scrollIntoView) el.scrollIntoView({ block: 'nearest', behavior: reducedMotion ? 'auto' : 'smooth' });
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
      var clean = inp.value.replace(/[^0-9]/g, '').slice(0, 3);
      if (clean !== inp.value) inp.value = clean;
      inp.classList.remove('bad', 'shake');
    });
    inp.addEventListener('focus', function () {
      lastInput = inp; markCurrent(inp);
      setTimeout(function () { try { inp.select(); } catch (e) { /* egal */ } }, 0);
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

    if (!r.complete) {
      var empty = ins.filter(function (inp, k) { return r.fields[k].status === 'empty'; });
      if (empty.length < ins.length) { focusInput(empty[0]); return; }
      say('Trag zuerst eine Zahl ein. ✏️');
      focusInput(empty[0]);
      return;
    }

    r.fields.forEach(function (f, k) {
      var inp = ins[k];
      inp.classList.remove('bad', 'shake', 'ok');
      if (f.status === 'correct') { inp.classList.add('ok'); inp.readOnly = true; }
      else { void inp.offsetWidth; inp.classList.add('bad', 'shake'); inp.dataset.fresh = '1'; }
    });

    if (r.correct) {
      cur.vals = r.vals;
      var el = rowEl(i);
      el.classList.remove('active');
      el.classList.add('done');
      markCurrent(null);
      fillRefs();
      if (cur.viz) cur.viz.update(cur.vals, i);
      if (Check.isSolved(cur.task, cur.vals)) { finish(); return; }
      Sound.step();
      react('nod', 700);
      var next = cur.task.rows[i + 1];
      say(pick(TXT.rowOk) + (next && next.label ? ' Weiter: ' + next.label + '.' : ''));
      activateRow(i + 1);
      return;
    }

    cur.rowMistakes++;
    cur.mistakes++;
    Sound.wrong();
    react('oops', 900);
    var level = Check.hintLevel(cur.rowMistakes);
    if (level === 'encourage') say(pick(TXT.oops));
    else if (level === 'hint') say('Tipp: ' + row.hint);
    else say(row.hint + ' Die Lösung ist ' + Check.solutionText(row, r) + '.');
    var firstBad = ins.filter(function (inp, k) { return r.fields[k].status !== 'correct'; })[0];
    if (firstBad) focusInput(firstBad);
  }

  function hint() {
    if (!cur) return;
    Sound.tap();
    if (cur.done) { say('Das hast du super gemacht! Drück auf „Weiter“. 🐴'); return; }
    cur.hintsUsed++;
    react('nod', 700);
    say('Tipp: ' + cur.task.rows[cur.row].hint);
  }

  function finish() {
    cur.done = true;
    var t = cur.task;
    var fin = $('final');
    fin.textContent = t.answer;
    fin.classList.add('solved');
    var restEl = document.querySelector('.final-rest');
    if (restEl) restEl.hidden = false;
    $('taskCard').classList.add('solved');
    $('checkBtn').textContent = 'Weiter ➜';
    $('checkBtn').classList.add('next');
    $('checkBtn').focus({ preventScroll: true });

    var res = Progress.applyResult(state.progress, { mistakes: cur.mistakes, hintsUsed: cur.hintsUsed }, Companion.COMPANIONS);
    state.progress = res.state;
    save();
    Sound.win();
    react('happy', 1400);
    say(pick(res.events.perfect ? TXT.perfect : TXT.solved));
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
  var CONFETTI = ['⭐', '💖', '🌈', '✨', '🦄', '🌸', '💜', '🐴', '🍭'];
  var COLORS = ['#ff7ac6', '#9b6bff', '#58c7ff', '#ffd65c', '#6fe3a8', '#ff9f5a'];
  function confetti(origin) {
    var layer = $('fxLayer');
    var r = origin.getBoundingClientRect();
    var ox = r.left + r.width / 2, oy = r.top + r.height / 2;
    var n = reducedMotion ? 10 : 42;
    for (var i = 0; i < n; i++) {
      var p = document.createElement('span');
      p.className = 'confetti';
      if (i % 3 === 0) { p.classList.add('bit'); p.style.background = pick(COLORS); }
      else p.textContent = pick(CONFETTI);
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
    p.innerHTML = '<div class="parade-banner">' + streak + ' richtig hintereinander! 🎉</div>' +
      '<div class="parade-runner is-gallop"><div class="parade-trail"></div>' + Companion.svg(state.companion) + '</div>';
    layer.appendChild(p);
    Sound.fanfare();
    setTimeout(function () { Sound.gallop(14); }, 600);
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
    $('unlockTake').onclick = function () { state.companion = c.key; save(); renderBuddy(); dlg.close(); say('Hallo, ich bin ' + c.name + '! ✨'); react('happy'); };
    Sound.fanfare();
    dlg.showModal();
    confetti($('unlockFigure'));
  }

  // ---------- Zahlenfeld ----------
  function numpadVisible() {
    var m = state.settings.numpad;
    return m === 'on' || (m === 'auto' && coarse.matches);
  }
  function applyInputMode() {
    var vis = numpadVisible();
    $('numpad').hidden = !vis;
    document.body.classList.toggle('has-numpad', vis);
    $('rows').querySelectorAll('.cell').forEach(function (c) {
      c.setAttribute('inputmode', vis && coarse.matches ? 'none' : 'numeric');
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
    var ins = inputsIn(cur.row).filter(function (c) { return !c.readOnly; });
    if (lastInput && ins.indexOf(lastInput) >= 0) return lastInput;
    return ins.filter(function (c) { return !c.value; })[0] || ins[0] || null;
  }
  function numKey(k) {
    Sound.tap();
    if (k === '✔') { check(); return; }
    var inp = targetInput();
    if (!inp) return;
    // Nach dem Fokussieren ist alles markiert: erste Ziffer ersetzt den Inhalt
    if (inp.dataset.fresh === '1') { inp.value = ''; inp.dataset.fresh = ''; }
    if (k === '⌫') inp.value = inp.value.slice(0, -1);
    else if (inp.value.length < 3) inp.value += k;
    inp.classList.remove('bad', 'shake');
    lastInput = inp;
    markCurrent(inp);
  }

  // ---------- Dialoge ----------
  function renderBuddyGrid() {
    var grid = $('buddyGrid');
    grid.innerHTML = '';
    Companion.COMPANIONS.forEach(function (c) {
      var open = Progress.isUnlocked(state.progress, c);
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'buddy-card' + (state.companion === c.key ? ' selected' : '') + (open ? '' : ' locked');
      b.disabled = !open;
      b.setAttribute('aria-pressed', state.companion === c.key);
      b.innerHTML = '<div class="bc-fig">' + Companion.svg(c.key) + '</div><b>' + c.name + '</b><small>' +
        (open ? c.kind : '🔒 ab ' + c.stars + ' ⭐') + '</small>';
      b.addEventListener('click', function () {
        state.companion = c.key; save(); Sound.hop(); renderBuddyGrid(); renderBuddy();
      });
      grid.appendChild(b);
    });
  }
  function openWelcome() {
    $('nameInput').value = state.name || '';
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
  }

  function initDialogs() {
    $('welcomeDlg').addEventListener('close', function () {
      state.name = $('nameInput').value.trim().slice(0, 20);
      state.welcomed = true;
      save();
      renderBuddy();
      say((state.name ? 'Hallo ' + state.name + '! ' : 'Hallo! ') + 'Ich bin ' + companionName() + '. Lass uns zusammen rechnen! 🌈');
      react('happy');
    });

    var before = null;
    $('settingsBtn').addEventListener('click', function () {
      Sound.tap();
      before = JSON.stringify([state.settings.crossing, state.settings.profi, state.settings.rest]);
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
      var now = JSON.stringify([state.settings.crossing, state.settings.profi, state.settings.rest]);
      if (now !== before) newTask();
    });
    $('changeBuddyBtn').addEventListener('click', function () {
      $('settingsDlg').close();
      openWelcome();
    });
    $('resetBtn').addEventListener('click', function () {
      if (!window.confirm('Wirklich alle Sterne und Freischaltungen löschen?')) return;
      state.progress = JSON.parse(JSON.stringify(DEFAULTS.progress));
      state.companion = Progress.isUnlocked(state.progress, Companion.byKey(state.companion)) ? state.companion : 'luna';
      save(); updateStats(); renderBuddy();
    });
  }

  // ---------- Hintergrund ----------
  function decorate() {
    var tw = document.querySelector('.twinkles');
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
    var kinds = ['🌸', '🌼', '🌷', '🌸', '🍄', '🌼'];
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
    decorate();
    renderBuddy();
    renderOps();
    buildNumpad();
    updateStats();
    initDialogs();

    $('checkBtn').addEventListener('click', check);
    $('hintBtn').addEventListener('click', hint);
    $('newBtn').addEventListener('click', function () { Sound.tap(); newTask(); });
    $('speakBtn').addEventListener('click', speak);
    $('buddyFigure').addEventListener('click', function () {
      Sound.hop(); react('happy', 1000); say(pick(TXT.poke));
    });
    if (coarse.addEventListener) coarse.addEventListener('change', applyInputMode);

    newTask();
    if (!state.welcomed) openWelcome();
  }

  // Für automatische Tests
  RR.app = {
    get state() { return state; },
    get current() { return cur; },
    newTask: newTask,
    check: check
  };

  init();
})();
