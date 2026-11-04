/*
 * Study Quest — the child's screens: home, topics, quiz, results, game time.
 * Parent screens live in parent.js and use the same SQ.ui helpers.
 */
(function (root) {
  'use strict';
  const SQ = root.SQ, U = SQ.util, E = SQ.engine, esc = U.escape;
  const doc = root.document;

  const ICON = {
    pad: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h10a5 5 0 0 1 4.9 6l-.8 3.6a2.6 2.6 0 0 1-4.5 1.1L14.8 16H9.2l-1.8 1.7a2.6 2.6 0 0 1-4.5-1.1L2.1 13A5 5 0 0 1 7 7z"/><path d="M7 10v4M5 12h4"/><path d="M16 10.4v.2M18 12.4v.2" stroke-width="2.4"/></svg>',
    tick: '<svg class="ico tick" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 13.5 9.5 19 20 5.5"/></svg>',
    cross: '<svg class="ico cross" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    back: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    del: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h11v12H9l-6-6z"/><path d="M12.5 9.5l5 5M17.5 9.5l-5 5"/></svg>',
    close: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    swap: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5"/></svg>',
    lock: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  };

  const PRAISE = ['Correct!', 'Spot on!', 'Yes!', 'Nice one!', 'That’s it!', 'Great!', 'Exactly right!'];

  const app = (SQ.app = { state: null, childId: null, screen: null, session: null });
  const ui = (SQ.ui = { ICON: ICON, screens: {}, actions: {} });
  const screens = ui.screens, actions = ui.actions;
  const coarse = root.matchMedia && root.matchMedia('(pointer: coarse)').matches;
  let $screen, $chip, $who, $sync;

  /* ---------- shared helpers ---------- */

  ui.esc = esc;
  /** Plain question text from history -> HTML with superscripts. */
  ui.text = function (t) { return esc(t).replace(/\^(\d+|\?)/g, '<sup>$1</sup>'); };
  ui.$ = function (sel) { return doc.querySelector(sel); };

  ui.commit = function () {
    SQ.storage.save(app.state);
    SQ.sync.changed();
  };
  /** The child whose profile is open on this device. */
  function kid() { return app.state ? SQ.family.child(app.state, app.childId) : null; }
  ui.kid = kid;
  ui.selectChild = function (id) {
    app.childId = id;
    SQ.storage.setMeta('child', id);
  };
  ui.touchSettings = function (c) { (c || kid()).settings.updatedAt = Date.now(); };
  ui.touchProgress = function (c) { (c || kid()).progress.updatedAt = Date.now(); };
  ui.touchFamily = function () { app.state.family.updatedAt = Date.now(); };

  /** Pick the right first screen: setup, "who's studying", or home. */
  ui.enter = function (args) {
    if (!SQ.family.isSetUp(app.state)) return ui.show('setup', args || {});
    if (!kid()) {
      const kids = SQ.family.children(app.state);
      if (kids.length === 1) ui.selectChild(kids[0].id);
      else return ui.show('who');
    }
    ui.show('home');
  };

  ui.toast = function (msg, kind) {
    let box = doc.getElementById('toast');
    if (!box) {
      box = doc.createElement('div');
      box.id = 'toast';
      box.setAttribute('role', 'status');
      doc.body.appendChild(box);
    }
    box.className = 'toast ' + (kind || '');
    box.textContent = msg;
    box.hidden = false;
    clearTimeout(ui._toastT);
    ui._toastT = setTimeout(function () { box.hidden = true; }, 2600);
  };

  ui.show = function (name, args) {
    app.screen = { name: name, args: args || {} };
    doc.body.dataset.screen = name;
    screens[name](args || {});
    try { root.scrollTo(0, 0); } catch (e) { /* ignore */ }
    ui.chrome();
  };

  /** Re-render the current screen if it only shows data (no form being typed in). */
  ui.refresh = function () {
    const s = app.screen;
    if (!s) return;
    if (s.name === 'home' || s.name === 'topic' || s.name === 'who' || (s.name === 'parent' && (s.args.tab || 'progress') === 'progress')) {
      const y = root.scrollY;
      screens[s.name](s.args);
      try { root.scrollTo(0, y); } catch (e) { /* ignore */ }
    }
    ui.chrome();
  };

  /** Accept a newer merged state (from sync). */
  function adopt(next) {
    app.state = next;
    SQ.storage.save(next);
    if (app.childId && !kid() && SQ.family.isSetUp(next)) {
      // This profile was removed on another device.
      app.session = null;
      ui.selectChild(null);
      return ui.enter();
    }
    ui.refresh();
  }

  function fmtTime(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
    const ss = (s < 10 ? '0' : '') + s;
    return h ? h + ':' + (m < 10 ? '0' : '') + m + ':' + ss : m + ':' + ss;
  }
  ui.fmtTime = fmtTime;

  function childName() { return (kid() && kid().settings.childName) || 'there'; }

  ui.chrome = function () {
    if (!$who) return;
    const c = kid();
    const many = app.state && SQ.family.children(app.state).length > 1;
    $who.hidden = !c;
    $who.disabled = !many;
    $who.innerHTML = c ? esc(c.settings.childName) + (many ? ICON.swap : '') : '';
    $who.setAttribute('aria-label', c ? (many ? 'Switch profile, now ' : 'Profile: ') + c.settings.childName : '');
    const st = SQ.sync.status;
    $sync.hidden = st === 'off' || st === 'ready' || st === 'checking';
    $sync.className = 'sync-dot ' + st;
    $sync.title = st === 'ok' ? 'Synced' : st === 'syncing' ? 'Syncing…' : 'Offline: progress will sync later';
    tick();
  };

  /** Per topic+level accuracy from history: { 'maths.powers|2': {n, ok} } */
  ui.levelStats = function (state, sinceTs) {
    const map = {};
    state.history.forEach(function (h) {
      if (sinceTs && h.ts < sinceTs) return;
      (h.items || []).forEach(function (it) {
        const k = it.t + '|' + it.l;
        const m = map[k] || (map[k] = { t: it.t, l: it.l, n: 0, ok: 0 });
        m.n++;
        if (it.ok) m.ok++;
      });
    });
    return map;
  };

  ui.mixLabel = function (a) {
    const t = SQ.topic(a.topic);
    if (!t) return '';
    const names = a.levels.map(function (l) { const lv = SQ.level(a.topic, l); return lv ? lv.title : l; });
    return t.title + ': ' + names.join(', ');
  };

  /* ---------- shell ---------- */

  function buildShell(rootEl) {
    rootEl.innerHTML =
      '<div class="app">' +
      '<header class="bar"><div class="bar-in">' +
      '<button class="brand" data-act="home" aria-label="Study Quest, home">' +
      '<span class="brand-mark" aria-hidden="true"><span>x<sup>2</sup></span></span><span class="brand-name">Study Quest</span></button>' +
      '<div class="bar-right">' +
      '<button class="timer-chip" data-act="home" hidden></button>' +
      '<span class="sync-dot" hidden></span>' +
      '<button class="who" data-act="switch-child" hidden></button>' +
      '</div></div></header>' +
      '<main id="screen" class="screen" tabindex="-1"></main>' +
      '<footer class="foot"><button class="link" data-act="parent">For parents</button>' +
      '<span class="foot-note">Study Quest</span></footer>' +
      '</div>';
    $screen = doc.getElementById('screen');
    $chip = rootEl.querySelector('.timer-chip');
    $who = rootEl.querySelector('.who');
    $sync = rootEl.querySelector('.sync-dot');
    ui.$screen = $screen;
  }

  function set(html) { $screen.innerHTML = html; }
  ui.set = set;

  /* ---------- loading ---------- */

  screens.loading = function () {
    set('<section class="loading"><span class="spinner" aria-hidden="true"></span><p>Loading…</p></section>');
  };

  /* ---------- home ---------- */

  function trackHtml(done, need, minutes, current) {
    let cells = '';
    for (let i = 1; i <= need; i++) {
      const isDone = i <= done;
      const isNow = !isDone && i === current;
      cells += '<li class="cell' + (isDone ? ' done' : '') + (isNow ? ' now' : '') + '">' +
        '<span class="cell-box">' + (isDone ? ICON.tick : i) + '</span>' +
        '<span class="cell-label">Set ' + i + '</span></li>';
    }
    cells += '<li class="cell prize' + (done >= need ? ' done' : '') + '"><span class="cell-box">' + ICON.pad + '</span>' +
      '<span class="cell-label">' + minutes + ' min</span></li>';
    return '<ol class="track" aria-label="' + done + ' of ' + need + ' perfect sets done">' + cells + '</ol>';
  }
  ui.trackHtml = trackHtml;

  function timerCard(r) {
    return '<section class="timer-card" aria-live="off">' +
      '<div class="timer-main"><p class="eyebrow">Game time running</p>' +
      '<div class="big-time" data-timer>' + fmtTime(r.endsAt - Date.now()) + '</div>' +
      '<p class="muted">The timer keeps going even if you close this page.</p></div>' +
      '<button class="btn ghost" data-act="stop-timer">I’ve finished playing</button></section>';
  }

  function bankCard(list) {
    const mins = list.reduce(function (s, r) { return s + r.minutes; }, 0);
    return '<section class="bank-card">' +
      '<div class="bank-icon">' + ICON.pad + '</div>' +
      '<div class="bank-text"><p class="eyebrow">Ready to play</p>' +
      '<p class="bank-mins"><b>' + mins + ' minutes</b> of game time saved</p></div>' +
      '<button class="btn primary" data-act="start-timer">Start ' + list[0].minutes + '-minute timer</button></section>';
  }

  screens.home = function () {
    const s = kid(), st = s.settings;
    const streak = Math.min(E.currentStreak(s), st.setsRequired);
    const need = st.setsRequired;
    const pool = E.poolFrom(st.assignment);
    const canEarn = E.canEarnReward(s);
    const running = E.runningReward(s);
    const unused = E.unusedRewards(s);
    const left = need - streak;

    let sub;
    if (running) sub = 'Game time is on. Have fun!';
    else if (!canEarn) sub = 'You’ve earned all your game time for today. Brilliant work!';
    else if (streak > 0) sub = 'You’re ' + left + ' perfect set' + (left > 1 ? 's' : '') + ' away from game time.';
    else sub = 'Ready to earn some game time?';

    let challenge;
    if (!pool.length) {
      challenge = '<p class="notice">Ask a parent to choose the topics for the challenge.</p>';
    } else {
      const mix = st.assignment.map(function (a) {
        return '<li>' + esc(ui.mixLabel(a)) + '</li>';
      }).join('');
      challenge =
        trackHtml(streak, need, st.rewardMinutes, streak + 1) +
        '<p class="rule">Each set has <b>' + st.setSize + ' questions</b>. ' +
        (st.onMistake === 'restart'
          ? 'One mistake and the set starts again.'
          : 'A set only counts with no mistakes.') +
        (need > 1 ? ' Sets in a row only count on the same day.' : '') + '</p>' +
        '<div class="mix"><span class="mix-label">In the mix</span><ul>' + mix + '</ul></div>' +
        (canEarn
          ? '<button class="btn primary big" data-act="start-challenge">Start set ' + (streak + 1) + '</button>'
          : '<p class="notice">Daily game time is used up. Come back tomorrow, or practise below.</p>') +
        (s.progress.bestRun ? '<p class="best">Best run so far: <b>' + s.progress.bestRun + '</b> correct in a row</p>' : '');
    }

    const stats = ui.levelStats(s);
    const topics = SQ.subjects().map(function (subj) {
      return subj.topics.map(function (t) {
        let n = 0, ok = 0;
        t.levels.forEach(function (l) { const m = stats[t.id + '|' + l.id]; if (m) { n += m.n; ok += m.ok; } });
        const inMix = st.assignment.some(function (a) { return a.topic === t.id; });
        return '<button class="topic-card" data-act="topic" data-topic="' + esc(t.id) + '">' +
          '<span class="t-sub">' + esc(subj.title) + (inMix ? ' · <span class="in-mix">in the challenge</span>' : '') + '</span>' +
          '<span class="t-title">' + esc(t.title) + '</span>' +
          '<span class="t-short">' + esc(t.short) + '</span>' +
          '<span class="t-meta">' + t.levels.length + ' levels' + (n >= 10 ? ' · ' + Math.round((ok / n) * 100) + '% correct' : '') + '</span>' +
          '</button>';
      }).join('');
    }).join('');

    set(
      '<section class="hello"><h1>Hi, ' + esc(childName()) + '!</h1><p>' + sub + '</p></section>' +
      (running ? timerCard(running) : '') +
      (!running && unused.length ? bankCard(unused) : '') +
      '<section class="challenge">' +
      '<div class="ch-head"><div class="ch-icon">' + ICON.pad + '</div><div>' +
      '<p class="eyebrow">Game time challenge</p>' +
      '<h2>' + need + ' perfect set' + (need > 1 ? 's' : '') + (need > 1 ? ' in a row' : '') + ' = ' + st.rewardMinutes + ' minutes of games</h2>' +
      '</div></div>' + challenge + '</section>' +
      '<section class="learn"><div class="sec-head"><h2>Learn & practise</h2>' +
      '<p class="muted">Practice doesn’t affect game time, so it’s a safe place to make mistakes.</p></div>' +
      '<div class="topic-grid">' + topics + '</div></section>'
    );
  };

  /* ---------- topic page ---------- */

  screens.topic = function (args) {
    const t = SQ.topic(args.topic);
    if (!t) return ui.show('home');
    const subj = SQ.subject(t.subject);
    const stats = ui.levelStats(kid());
    const mix = kid().settings.assignment.find(function (a) { return a.topic === t.id; });
    const levels = t.levels.map(function (l) {
      const m = stats[t.id + '|' + l.id];
      const inMix = mix && mix.levels.indexOf(l.id) !== -1;
      return '<li class="level-row">' +
        '<div class="level-info"><p class="level-name"><span class="level-no">Level ' + l.id + '</span> ' + esc(l.title) +
        (inMix ? ' <span class="chip">in the challenge</span>' : '') + '</p>' +
        '<p class="muted">' + esc(l.description) + '</p>' +
        (m && m.n >= 5 ? '<p class="level-acc">' + Math.round((m.ok / m.n) * 100) + '% correct over ' + m.n + ' answers</p>' : '') +
        '</div>' +
        '<button class="btn" data-act="practise" data-topic="' + esc(t.id) + '" data-level="' + l.id + '">Practise</button></li>';
    }).join('');
    const lesson = t.lesson
      ? '<section class="lesson"><h2>How it works</h2>' +
        (t.lesson.intro ? '<p class="lead">' + t.lesson.intro + '</p>' : '') +
        (t.lesson.sections || []).map(function (sec) {
          return '<article class="lesson-sec"><h3>' + esc(sec.title) + '</h3>' + sec.html + '</article>';
        }).join('') + '</section>'
      : '';
    set(
      '<button class="back" data-act="home">' + ICON.back + 'All topics</button>' +
      '<section class="topic-head"><p class="eyebrow">' + esc(subj.title) + '</p><h1>' + esc(t.title) + '</h1>' +
      '<p class="muted">' + esc(t.short) + '</p></section>' +
      '<section class="levels"><h2>Practise</h2><ol class="level-list">' + levels + '</ol></section>' +
      lesson
    );
  };

  /* ---------- quiz ---------- */

  function markActiveSet(sess) {
    SQ.storage.setMeta('active', sess ? { childId: app.childId, ts: sess.startedAt, items: sess.results } : null);
  }

  function recordSet(sess, extra) {
    const items = sess.results.slice();
    const correct = items.filter(function (i) { return i.ok; }).length;
    const h = Object.assign({
      id: U.uid(),
      ts: Date.now(),
      mode: sess.mode,
      topic: sess.topic || null,
      level: sess.level || null,
      size: sess.questions.length,
      correct: correct,
      wrong: items.length - correct,
      perfect: correct === sess.questions.length,
      completed: items.length === sess.questions.length,
      items: items,
    }, extra || {});
    kid().history.push(h);
    return h;
  }

  /** A challenge set that was left half-way (page closed or Stop pressed) breaks the run. */
  function applyAbandoned(child, meta) {
    const p = child.progress;
    p.streak = 0;
    p.run = 0;
    ui.touchProgress(child);
    child.history.push({
      id: U.uid(), ts: meta.ts || Date.now(), mode: 'challenge', topic: null, level: null,
      size: child.settings.setSize, correct: (meta.items || []).filter(function (i) { return i.ok; }).length,
      wrong: (meta.items || []).filter(function (i) { return !i.ok; }).length,
      perfect: false, completed: false, abandoned: true, items: meta.items || [],
    });
  }

  function startSession(mode, topicId, level) {
    const st = kid().settings;
    const pool = mode === 'challenge' ? E.poolFrom(st.assignment) : [{ topic: topicId, level: level }];
    if (!pool.length) return ui.show('home');
    app.session = {
      mode: mode,
      topic: topicId || null,
      level: level || null,
      questions: E.buildSet(pool, st.setSize),
      index: 0,
      results: [],
      failed: false,
      ended: false,
      setNo: Math.min(E.currentStreak(kid()) + 1, st.setsRequired),
      startedAt: Date.now(),
      locked: false,
    };
    if (mode === 'challenge') markActiveSet(app.session);
    ui.show('quiz');
  }

  function keypadHtml(q) {
    const dot = q.input === 'number';
    return '<div class="keypad' + (dot ? ' with-dot' : '') + '" role="group" aria-label="Number pad">' +
      [7, 8, 9].map(k).join('') +
      '<button class="key fn" data-act="key" data-k="back" aria-label="Delete" style="grid-area:back">' + ICON.del + '</button>' +
      [4, 5, 6].map(k).join('') +
      '<button class="key fn minus" data-act="key" data-k="minus" aria-label="Minus sign" style="grid-area:minus">−</button>' +
      [1, 2, 3].map(k).join('') +
      '<button class="key" data-act="key" data-k="0" style="grid-area:k0">0</button>' +
      (dot ? '<button class="key" data-act="key" data-k="dot" aria-label="Decimal point" style="grid-area:dot">.</button>' : '') +
      '<button class="key key-check" data-act="check" style="grid-area:check">Check</button>' +
      '</div>';
    function k(n) { return '<button class="key" data-act="key" data-k="' + n + '" style="grid-area:k' + n + '">' + n + '</button>'; }
  }

  screens.quiz = function () {
    const sess = app.session;
    if (!sess) return ui.show('home');
    const st = kid().settings;
    const q = sess.questions[sess.index];
    const size = sess.questions.length;
    const label = sess.mode === 'challenge'
      ? 'Set ' + sess.setNo + ' of ' + st.setsRequired
      : 'Practice: ' + esc(SQ.topic(sess.topic).title) + ', level ' + sess.level;

    let track = '';
    for (let i = 0; i < size; i++) {
      const r = sess.results[i];
      const cls = r ? (r.ok ? 'ok' : 'bad') : (i === sess.index ? 'now' : '');
      track += '<li class="' + cls + '">' + (r ? (r.ok ? ICON.tick : ICON.cross) : '') + '</li>';
    }

    const numeric = q.input === 'integer' || q.input === 'number';
    const inputHtml = '<input id="answer" class="blank" type="text" autocomplete="off" autocorrect="off" autocapitalize="off" ' +
      'spellcheck="false" enterkeyhint="done" inputmode="' + (numeric ? (coarse ? 'none' : 'decimal') : 'text') + '" ' +
      'aria-label="Your answer">';
    const inline = q.input !== 'choice' && q.prompt.indexOf('[[?]]') !== -1;
    const promptHtml = inline ? q.prompt.replace('[[?]]', inputHtml) : q.prompt;

    let panel;
    if (q.input === 'choice') {
      panel = '<div class="choices">' + q.choices.map(function (c, i) {
        return '<button class="btn choice" data-act="choose" data-i="' + i + '">' + c + '</button>';
      }).join('') + '</div>';
    } else if (numeric) {
      panel = keypadHtml(q);
    } else {
      panel = '<div class="check-row"><button class="btn primary big" data-act="check">Check</button></div>';
    }

    set(
      '<section class="quiz mode-' + sess.mode + '">' +
      '<div class="quiz-top">' +
      '<button class="link stop" data-act="quit">' + ICON.close + 'Stop</button>' +
      '<span class="quiz-label">' + label + '</span>' +
      '<span class="quiz-count">' + (sess.index + 1) + ' / ' + size + '</span></div>' +
      '<ol class="qtrack" aria-hidden="true">' + track + '</ol>' +
      '<div class="qcard" id="qcard">' +
      (q.ask ? '<p class="ask">' + esc(q.ask) + '</p>' : '') +
      (q.given ? '<p class="given">' + q.given + '</p>' : '') +
      '<div class="expr">' + promptHtml + '<span class="mark" id="qmark"></span></div>' +
      (!inline && q.input !== 'choice' ? '<div class="answer-line"><label for="answer">Answer</label>' + inputHtml + '</div>' : '') +
      '<p class="qmsg" id="qmsg" role="status"></p>' +
      '</div>' +
      '<div id="qpanel" class="qpanel">' + panel + '</div>' +
      '</section>'
    );

    sess.qStart = Date.now();
    sess.locked = false;
    const inp = doc.getElementById('answer');
    if (inp) {
      inp.addEventListener('input', function () {
        if (numeric) {
          const v = inp.value.replace(/[-–—]/g, '−').replace(/[^0-9−.,]/g, '');
          if (v !== inp.value) inp.value = v;
        }
        sizeInput(inp);
        msg('');
      });
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); submit(); }
      });
      sizeInput(inp);
      try { inp.focus({ preventScroll: true }); } catch (e) { inp.focus(); }
    }
  };

  function sizeInput(inp) {
    const len = Math.max(1, inp.value.length);
    inp.style.width = (len * 0.62 + 1.1) + 'em';
  }

  function msg(text, kind) {
    const el = doc.getElementById('qmsg');
    if (!el) return;
    el.textContent = text;
    el.className = 'qmsg ' + (kind || '');
  }

  function press(k) {
    const sess = app.session;
    const inp = doc.getElementById('answer');
    if (!sess || sess.locked || !inp) return;
    let v = inp.value;
    if (k === 'back') v = v.slice(0, -1);
    else if (k === 'minus') v = v.charAt(0) === '−' ? v.slice(1) : '−' + v;
    else if (k === 'dot') { if (v.indexOf('.') === -1) v += (v === '' || v === '−') ? '0.' : '.'; }
    else if (v.replace('−', '').length < 9) v += k;
    inp.value = v;
    sizeInput(inp);
    msg('');
    if (!coarse) { try { inp.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
  }

  function updateRun(ok) {
    const p = kid().progress;
    const today = E.dayKey();
    if (p.streakDay !== today) { p.streak = 0; p.streakDay = today; }
    if (ok) {
      p.run = (p.run || 0) + 1;
      p.bestRun = Math.max(p.bestRun || 0, p.run);
    } else {
      p.run = 0;
      p.streak = 0;
    }
    ui.touchProgress();
  }

  function submit(choiceIndex) {
    const sess = app.session;
    if (!sess || sess.locked) return;
    const q = sess.questions[sess.index];
    const inp = doc.getElementById('answer');
    const raw = q.input === 'choice' ? choiceIndex : (inp ? inp.value : '');
    const parsed = E.parseAnswer(q, raw);
    if (!parsed.ok) {
      msg(parsed.reason === 'empty' ? 'Type your answer first.' : 'That isn’t a number yet. Use digits and the − key.', 'warn');
      const card = doc.getElementById('qcard');
      if (card) { card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake'); }
      return;
    }
    sess.locked = true;
    if (inp) inp.readOnly = true;
    const ok = E.isCorrect(q, parsed.value);
    sess.results.push({
      t: q.topic, l: q.level, q: q.text, a: E.answerText(q), g: parsed.shown, ok: ok,
      ms: Date.now() - sess.qStart,
    });
    if (sess.mode === 'challenge') {
      updateRun(ok);
      if (!sess.failed) markActiveSet(sess);
    }
    if (ok) onCorrect(sess);
    else onWrong(sess, q, parsed);
  }

  function onCorrect(sess) {
    SQ.sound.play('ok');
    const card = doc.getElementById('qcard');
    if (card) card.classList.add('is-ok');
    const mark = doc.getElementById('qmark');
    if (mark) mark.innerHTML = ICON.tick;
    msg(U.pick(PRAISE), 'ok');
    SQ.storage.save(app.state);
    setTimeout(function () {
      if (app.session !== sess || !app.screen || app.screen.name !== 'quiz') return;
      next();
    }, 850);
  }

  function onWrong(sess, q, parsed) {
    SQ.sound.play('bad');
    const st = kid().settings;
    const card = doc.getElementById('qcard');
    if (card) card.classList.add('is-bad');
    const mark = doc.getElementById('qmark');
    if (mark) mark.innerHTML = ICON.cross;
    msg('');
    const diag = E.diagnose(q, parsed.value);
    const before = sess.results.filter(function (r) { return r.ok; }).length;
    let tail, buttons;
    const isLast = sess.index >= sess.questions.length - 1;

    if (sess.mode === 'challenge' && st.onMistake === 'restart') {
      sess.ended = true;
      recordSet(sess);
      markActiveSet(null);
      ui.commit();
      tail = '<p class="fb-sub">This set is over. ' +
        (before ? 'You got ' + before + ' right before this one. ' : '') +
        'Read the working above, then start a fresh set.</p>';
      buttons = '<button class="btn primary" data-act="new-set">Start a new set</button>' +
        '<button class="btn ghost" data-act="home">Back to home</button>';
    } else {
      if (sess.mode === 'challenge') {
        if (!sess.failed) {
          sess.failed = true;
          markActiveSet(null);
        }
        ui.commit();
        tail = '<p class="fb-sub">This set won’t count for game time any more, but finishing it is good practice.</p>';
      } else {
        SQ.storage.save(app.state);
        tail = '';
      }
      buttons = '<button class="btn primary" data-act="next">' + (isLast ? 'See results' : 'Next question') + '</button>';
    }

    const panel = doc.getElementById('qpanel');
    panel.innerHTML =
      '<section class="feedback">' +
      '<div class="fb-head"><p class="fb-title">Not quite</p>' +
      '<p class="fb-ans">' + (q.input === 'choice' ? 'You picked' : 'You wrote') + ' <s>' + esc(parsed.shown) + '</s>. The answer is <b>' + esc(E.answerText(q)) + '</b>.</p></div>' +
      (diag ? '<p class="pen-note">' + diag + '</p>' : '') +
      (q.steps.length ? '<div class="working"><p class="working-title">How to work it out</p><ol class="work-lines">' +
        q.steps.map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ol></div>' : '') +
      tail +
      '<div class="fb-actions">' + buttons + '</div></section>';
    app.feedbackAt = Date.now();
    const first = panel.querySelector('.fb-actions .btn');
    if (first) { try { first.focus({ preventScroll: true }); } catch (e) { first.focus(); } }
    try { panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { /* ignore */ }
  }

  function next() {
    const sess = app.session;
    if (!sess) return;
    sess.index++;
    if (sess.index >= sess.questions.length) finishSet();
    else ui.show('quiz');
  }

  function finishSet() {
    const sess = app.session;
    const s = kid(), st = s.settings, p = s.progress;
    const h = recordSet(sess);
    app.session = null;

    if (sess.mode !== 'challenge') {
      ui.commit();
      return ui.show('practice-done', { h: h, topic: sess.topic, level: sess.level });
    }
    markActiveSet(null);
    if (!h.perfect) {
      ui.commit();
      return ui.show('set-failed', { h: h });
    }

    const today = E.dayKey();
    if (p.streakDay !== today) { p.streak = 0; p.streakDay = today; }
    p.streak += 1;
    ui.touchProgress();

    if (p.streak >= st.setsRequired) {
      p.streak = 0;
      if (E.canEarnReward(s)) {
        const now = Date.now();
        const reward = { id: U.uid(), ts: now, minutes: st.rewardMinutes, startedAt: null, endsAt: null, updatedAt: now };
        s.rewards.push(reward);
        ui.commit();
        SQ.sound.play('win');
        return ui.show('reward', { reward: reward });
      }
      ui.commit();
      SQ.sound.play('set');
      return ui.show('set-done', { limit: true });
    }
    ui.commit();
    SQ.sound.play('set');
    ui.show('set-done', {});
  }

  function reviewList(items) {
    const wrong = items.filter(function (i) { return !i.ok; });
    if (!wrong.length) return '';
    return '<div class="review"><h2>Check these again</h2><ul>' + wrong.map(function (it) {
      return '<li><span class="rq">' + ui.text(it.q) + '</span>' +
        '<span class="rg">You wrote <s>' + esc(it.g) + '</s></span>' +
        '<span class="ra">Answer <b>' + esc(it.a) + '</b></span></li>';
    }).join('') + '</ul></div>';
  }

  screens['set-done'] = function (args) {
    const s = kid(), st = s.settings;
    const streak = Math.min(E.currentStreak(s), st.setsRequired);
    const left = st.setsRequired - streak;
    set(
      '<section class="result good">' +
      '<div class="stamp" aria-hidden="true">' + st.setSize + '/' + st.setSize + '</div>' +
      '<h1>Perfect set!</h1>' +
      (args.limit
        ? '<p class="lead">No mistakes at all. Today’s game time is already used up, but this still counts as great practice.</p>'
        : '<p class="lead">No mistakes at all. ' + left + ' more perfect set' + (left > 1 ? 's' : '') + ' to unlock <b>' + st.rewardMinutes + ' minutes</b> of game time.</p>' +
          trackHtml(streak, st.setsRequired, st.rewardMinutes, streak + 1)) +
      '<div class="actions">' +
      (args.limit ? '<button class="btn primary" data-act="home">Back to home</button>'
        : '<button class="btn primary big" data-act="start-challenge">Start set ' + (streak + 1) + '</button>' +
          '<button class="btn ghost" data-act="home">Take a break</button>') +
      '</div></section>'
    );
  };

  screens['set-failed'] = function (args) {
    const h = args.h;
    set(
      '<section class="result">' +
      '<div class="stamp bad" aria-hidden="true">' + h.correct + '/' + h.size + '</div>' +
      '<h1>' + (h.size - h.correct === 1 ? 'So close!' : 'Keep going!') + '</h1>' +
      '<p class="lead">A challenge set only counts with no mistakes. Look at these, then try a fresh set.</p>' +
      reviewList(h.items) +
      '<div class="actions"><button class="btn primary big" data-act="new-set">Start a new set</button>' +
      '<button class="btn ghost" data-act="home">Back to home</button></div></section>'
    );
  };

  screens['practice-done'] = function (args) {
    const h = args.h;
    const all = h.correct === h.size;
    set(
      '<section class="result' + (all ? ' good' : '') + '">' +
      '<div class="stamp' + (all ? '' : ' bad') + '" aria-hidden="true">' + h.correct + '/' + h.size + '</div>' +
      '<h1>' + (all ? 'All correct!' : h.correct >= h.size * 0.7 ? 'Good practice!' : 'Practice makes progress') + '</h1>' +
      '<p class="lead">' + (all ? 'You’re ready for this in the game time challenge.' : 'Every mistake you look at now is one you won’t make in the challenge.') + '</p>' +
      reviewList(h.items) +
      '<div class="actions">' +
      '<button class="btn primary" data-act="practise" data-topic="' + esc(args.topic) + '" data-level="' + args.level + '">Practise again</button>' +
      '<button class="btn ghost" data-act="topic" data-topic="' + esc(args.topic) + '">Back to topic</button>' +
      (all ? '<button class="btn ghost" data-act="home">Go to the challenge</button>' : '') +
      '</div></section>'
    );
  };

  screens.reward = function (args) {
    const r = args.reward;
    set(
      '<section class="result reward">' +
      '<div class="reward-icon">' + ICON.pad + '</div>' +
      '<p class="eyebrow">Unlocked</p>' +
      '<h1>Game time!</h1>' +
      '<p class="reward-mins"><b>' + r.minutes + '</b> minutes</p>' +
      '<p class="lead">' + kid().settings.setsRequired + ' perfect set' + (kid().settings.setsRequired > 1 ? 's in a row' : '') +
      '. That took real focus. Well done, ' + esc(childName()) + '!</p>' +
      '<div class="actions"><button class="btn primary big" data-act="start-timer">Start the timer now</button>' +
      '<button class="btn ghost" data-act="home">Save it for later</button></div></section>'
    );
    confetti();
  };

  /* ---------- game timer ---------- */

  let lastRunning = null, lastChild = null;
  function tick() {
    const c = kid();
    if (!c || !$chip) { if ($chip) $chip.hidden = true; lastRunning = null; return; }
    const now = Date.now();
    const r = E.runningReward(c, now);
    if (r) {
      $chip.hidden = false;
      $chip.innerHTML = ICON.pad + '<span>' + fmtTime(r.endsAt - now) + '</span>';
      $chip.setAttribute('aria-label', 'Game time left: ' + fmtTime(r.endsAt - now));
    } else {
      $chip.hidden = true;
    }
    doc.querySelectorAll('[data-timer]').forEach(function (el) {
      el.textContent = r ? fmtTime(r.endsAt - now) : '0:00';
    });
    // Remember the state first: refresh() below calls tick() again.
    const prevId = lastRunning, prevChild = lastChild;
    lastRunning = r ? r.id : null;
    lastChild = c.id;
    if (prevId && prevChild === c.id && (!r || r.id !== prevId)) {
      const prev = c.rewards.find(function (x) { return x.id === prevId; });
      if (prev && !prev.stoppedEarly && now - prev.endsAt < 5000) {
        SQ.sound.play('end');
        ui.toast('Game time is over! Great job today.');
      }
      if (app.screen && app.screen.name === 'home') ui.refresh();
    }
  }

  /* ---------- confetti ---------- */

  function confetti() {
    if (root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const c = doc.createElement('canvas');
    c.className = 'confetti';
    doc.body.appendChild(c);
    const ctx = c.getContext('2d');
    if (!ctx) { c.remove(); return; }
    const dpr = root.devicePixelRatio || 1;
    const W = c.width = root.innerWidth * dpr, H = c.height = root.innerHeight * dpr;
    const css = getComputedStyle(doc.documentElement);
    const colors = ['--biro', '--marker', '--tick', '--pen'].map(function (v) { return css.getPropertyValue(v).trim() || '#2448d6'; });
    const parts = [];
    for (let i = 0; i < 140; i++) {
      parts.push({
        x: W / 2 + (Math.random() - 0.5) * W * 0.3, y: H * 0.35,
        vx: (Math.random() - 0.5) * 18 * dpr, vy: (-Math.random() * 16 - 4) * dpr,
        s: (5 + Math.random() * 6) * dpr, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3,
        c: colors[i % colors.length],
      });
    }
    const t0 = performance.now();
    (function frame(t) {
      const age = t - t0;
      ctx.clearRect(0, 0, W, H);
      parts.forEach(function (p) {
        p.vy += 0.45 * dpr; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
        ctx.globalAlpha = Math.max(0, 1 - age / 2800);
        ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        ctx.restore();
      });
      if (age < 2800) requestAnimationFrame(frame); else c.remove();
    })(t0);
  }

  /* ---------- actions ---------- */

  actions.home = function () { app.session = null; ui.show('home'); };
  actions.topic = function (el) { ui.show('topic', { topic: el.dataset.topic }); };
  actions.practise = function (el) { startSession('practice', el.dataset.topic, Number(el.dataset.level)); };
  actions['start-challenge'] = function () {
    if (!E.canEarnReward(kid())) return ui.show('home');
    startSession('challenge');
  };
  actions['new-set'] = function () {
    if (Date.now() - (app.feedbackAt || 0) < 400) return;
    actions['start-challenge']();
  };
  actions.key = function (el) { press(el.dataset.k); };
  actions.check = function () { submit(); };
  actions.choose = function (el) { submit(Number(el.dataset.i)); };
  actions.next = function () {
    if (Date.now() - (app.feedbackAt || 0) < 400) return;
    next();
  };

  actions.quit = function () {
    const sess = app.session;
    if (!sess) return ui.show('home');
    if (sess.mode !== 'challenge' || sess.failed || sess.ended) {
      const topic = sess.topic;
      if (sess.results.length && !sess.ended) {
        recordSet(sess, { completed: false });
        ui.commit();
      }
      app.session = null;
      return topic ? ui.show('topic', { topic: topic }) : ui.show('home');
    }
    const panel = doc.getElementById('qpanel');
    sess.locked = true;
    panel.innerHTML = '<section class="feedback confirm"><p class="fb-title">Stop this set?</p>' +
      '<p>If you stop now, this set won’t count and your sets in a row go back to 0.</p>' +
      '<div class="fb-actions"><button class="btn primary" data-act="quit-cancel">Keep going</button>' +
      '<button class="btn ghost" data-act="quit-confirm">Stop the set</button></div></section>';
  };
  actions['quit-cancel'] = function () { ui.show('quiz'); };
  actions['quit-confirm'] = function () {
    const sess = app.session;
    if (sess) {
      applyAbandoned(kid(), { ts: sess.startedAt, items: sess.results });
      markActiveSet(null);
      ui.commit();
    }
    app.session = null;
    ui.show('home');
  };

  actions['start-timer'] = function () {
    if (E.runningReward(kid())) return ui.show('home');
    const r = E.unusedRewards(kid())[0];
    if (!r) return ui.show('home');
    const now = Date.now();
    r.startedAt = now;
    r.endsAt = now + r.minutes * 60000;
    r.updatedAt = now;
    ui.commit();
    ui.show('home');
  };
  actions['stop-timer'] = function () {
    const r = E.runningReward(kid());
    if (r) {
      r.endsAt = Date.now();
      r.stoppedEarly = true;
      r.updatedAt = Date.now();
      ui.commit();
    }
    ui.show('home');
  };

  /* ---------- who's studying ---------- */

  screens.who = function () {
    const kids = SQ.family.children(app.state);
    set(
      '<section class="who-screen"><h1>Who\u2019s studying?</h1>' +
      '<p class="muted">Pick your name.</p>' +
      '<div class="who-grid">' + kids.map(function (c, i) {
        const name = c.settings.childName || 'Child';
        return '<button class="who-card" data-act="pick-child" data-id="' + esc(c.id) + '">' +
          '<span class="avatar a' + (i % 4) + '" aria-hidden="true">' + esc(name.charAt(0).toUpperCase()) + '</span>' +
          '<span class="who-name">' + esc(name) + '</span>' +
          (c.settings.childPinHash ? '<span class="who-lock" title="PIN">' + ICON.lock + '</span>' : '') +
          '</button>';
      }).join('') + '</div></section>'
    );
  };

  actions['switch-child'] = function () {
    if (app.screen && app.screen.name === 'quiz') return;
    if (SQ.family.children(app.state).length < 2) return;
    app.session = null;
    ui.show('who');
  };
  actions['pick-child'] = function (el) {
    const c = SQ.family.child(app.state, el.dataset.id);
    if (!c) return ui.show('who');
    if (c.settings.childPinHash && c.id !== app.childId) return ui.show('pin', { mode: 'child', childId: c.id });
    ui.selectChild(c.id);
    ui.show('home');
  };

  /* ---------- boot ---------- */

  function onClick(e) {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const fn = actions[el.dataset.act];
    if (!fn) return;
    e.preventDefault();
    SQ.sound.unlock();
    fn(el, e);
  }

  function onKey(e) {
    if (!app.screen || app.screen.name !== 'quiz' || !app.session || app.session.locked) return;
    const inp = doc.getElementById('answer');
    if (!inp || doc.activeElement === inp || e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^[0-9]$/.test(e.key)) { press(e.key); e.preventDefault(); }
    else if (e.key === '-' || e.key === '−') { press('minus'); e.preventDefault(); }
    else if (e.key === 'Backspace') { press('back'); e.preventDefault(); }
    else if (e.key === 'Enter' && !(doc.activeElement && doc.activeElement.tagName === 'BUTTON')) { submit(); e.preventDefault(); }
  }

  function joinCodeFromHash() {
    const m = /^#join-([0-9A-Za-z-]{12,20})$/.exec(root.location.hash || '');
    if (!m) return null;
    try { root.history.replaceState(null, '', root.location.pathname + root.location.search); } catch (e) { /* ignore */ }
    return SQ.sync.normaliseCode(m[1]);
  }

  app.boot = function (rootEl) {
    buildShell(rootEl);
    app.state = SQ.storage.load();
    app.childId = SQ.storage.getMeta('child');
    if (!app.childId && app.state.children.some(function (c) { return c.id === 'main'; })) {
      app.childId = 'main'; // upgraded from the one-child version
    }

    const active = SQ.storage.getMeta('active');
    if (active) {
      const c = SQ.family.child(app.state, active.childId || app.childId);
      if (c) {
        applyAbandoned(c, active);
        SQ.storage.save(app.state);
        SQ.sync.changed();
      }
      markActiveSet(null);
    }

    SQ.sync.bind(function () { return app.state; }, adopt);
    SQ.sync.onChange(function () { ui.chrome(); });
    doc.addEventListener('click', onClick);
    doc.addEventListener('keydown', onKey);

    const join = joinCodeFromHash();
    ui.show('loading');
    SQ.sync.init()
      .then(function (enabled) { return enabled && SQ.sync.family ? SQ.sync.pull() : null; })
      .catch(function () { return null; })
      .then(function () { ui.enter({ join: join }); });

    setInterval(tick, 1000);
    setInterval(function () {
      if (doc.visibilityState === 'visible' && SQ.sync.family && !(app.screen && app.screen.name === 'quiz')) SQ.sync.pull();
    }, 45000);
    doc.addEventListener('visibilitychange', function () {
      if (doc.visibilityState === 'hidden') SQ.sync.flushNow();
      else if (SQ.sync.family && !(app.screen && app.screen.name === 'quiz')) SQ.sync.pull();
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
