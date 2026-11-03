/*
 * Study Quest — parent screens: first setup, PIN entry (parent and child),
 * parent panel with progress, rules, topics, family, devices, data.
 */
(function (root) {
  'use strict';
  const SQ = root.SQ, E = SQ.engine, ui = SQ.ui, app = SQ.app, esc = SQ.util.escape;
  const doc = root.document;
  const screens = ui.screens, actions = ui.actions;
  const UNLOCK_MS = 5 * 60 * 1000;

  function $(id) { return doc.getElementById(id); }
  function pct(x) { return Math.round(x * 100) + '%'; }
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function when(ts) {
    const d = new Date(ts);
    const hm = (d.getHours() < 10 ? '0' : '') + d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
    if (E.dayKey(ts) === E.dayKey()) return 'Today, ' + hm;
    if (E.dayKey(ts) === E.dayKey(Date.now() - 864e5)) return 'Yesterday, ' + hm;
    return d.getDate() + ' ' + MONTHS[d.getMonth()] + ', ' + hm;
  }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function validPin(p) { return /^[0-9]{4}$/.test(p); }
  function joinLink(code) {
    const l = root.location;
    return l.origin + l.pathname + '#join-' + code;
  }
  function copy(text, okMsg) {
    const done = function () { ui.toast(okMsg || 'Copied'); };
    try {
      navigator.clipboard.writeText(text).then(done, function () { ui.toast('Select the text and copy it yourself'); });
    } catch (e) {
      ui.toast('Select the text and copy it yourself');
    }
  }
  function kids() { return SQ.family.children(app.state); }
  function nameOf(c) { return (c && c.settings.childName) || 'Child'; }
  function avatar(c) {
    const i = Math.max(0, kids().indexOf(c));
    return '<span class="avatar a' + (i % 4) + '" aria-hidden="true">' + esc(nameOf(c).charAt(0).toUpperCase()) + '</span>';
  }

  /** The child the parent is looking at in the panel. */
  function pk() {
    return SQ.family.child(app.state, app.parentChild) || ui.kid() || kids()[0] || null;
  }

  /* ---------- first setup ---------- */

  screens.setup = function (args) {
    const syncOn = SQ.sync.enabled;
    const mode = syncOn ? (args.mode || (args.join ? 'join' : 'new')) : 'new';
    const seg = syncOn
      ? '<div class="seg" role="tablist">' +
        '<button role="tab" class="seg-btn' + (mode === 'new' ? ' on' : '') + '" aria-selected="' + (mode === 'new') + '" data-act="setup-mode" data-mode="new">New family</button>' +
        '<button role="tab" class="seg-btn' + (mode === 'join' ? ' on' : '') + '" aria-selected="' + (mode === 'join') + '" data-act="setup-mode" data-mode="join">I have a family code</button>' +
        '</div>'
      : '';
    const formNew =
      '<form id="setup-form" class="form" novalidate>' +
      '<label class="field"><span>Child’s name</span><input id="setup-name" maxlength="30" autocomplete="off" placeholder="For example, Sam"></label>' +
      '<label class="field"><span>Parent PIN (4 digits)</span><input id="setup-pin" type="password" inputmode="numeric" maxlength="4" autocomplete="new-password"></label>' +
      '<label class="field"><span>Repeat the PIN</span><input id="setup-pin2" type="password" inputmode="numeric" maxlength="4" autocomplete="new-password"></label>' +
      '<p class="form-err" id="setup-err" role="alert"></p>' +
      '<button class="btn primary big" type="submit">Done</button>' +
      '<p class="muted small">The parent PIN stops children changing the rules. You can add more children, their PINs, topics and rules later under “For parents” at the bottom of the page.</p>' +
      '</form>';
    const formJoin =
      '<form id="join-form" class="form" novalidate>' +
      '<label class="field"><span>Family code</span><input id="join-code" class="code-input" maxlength="14" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX-XXXX" value="' + esc(args.join || '') + '"></label>' +
      '<p class="form-err" id="join-err" role="alert"></p>' +
      '<button class="btn primary big" type="submit">Connect this device</button>' +
      '<p class="muted small">You’ll find the code on the device where everything is set up: For parents → Devices. There is also a ready-made link there that you can simply open on this device.</p>' +
      '</form>';
    ui.set(
      '<section class="panel setup">' +
      '<p class="eyebrow">For parents</p>' +
      '<h1>Set up Study Quest</h1>' +
      '<p class="muted">Your child solves sets of questions. A few perfect sets in a row, with no mistakes at all, unlock time for computer games.</p>' +
      seg + (mode === 'join' ? formJoin : formNew) +
      (!syncOn
        ? (SQ.sync.backend === 'firebase'
          ? '<p class="notice">Can’t reach the sync service right now, so the option to join a family is hidden. Check the internet connection and reload the page.</p>'
          : '<p class="notice">This copy of the site has no sync server, so progress is kept in this browser only. To share progress between a phone and a computer, set up sync (see the README).</p>')
        : '') +
      '</section>'
    );

    const f = $('setup-form');
    if (f) f.addEventListener('submit', function (e) {
      e.preventDefault();
      const name = $('setup-name').value.trim();
      const pin = $('setup-pin').value.trim(), pin2 = $('setup-pin2').value.trim();
      const err = $('setup-err');
      if (!name) { err.textContent = 'Enter your child’s name.'; return; }
      if (!validPin(pin)) { err.textContent = 'The PIN must be 4 digits.'; return; }
      if (pin !== pin2) { err.textContent = 'The PINs don’t match.'; return; }
      app.state.family.pinHash = SQ.hashPin(pin);
      ui.touchFamily();
      const child = SQ.storage.blankChild(name);
      app.state.children.push(child);
      ui.selectChild(child.id);
      SQ.storage.save(app.state);
      if (SQ.sync.enabled) {
        SQ.sync.createFamily();
        ui.commit();
        app.parentAt = Date.now();
        ui.show('parent', { tab: 'devices', fresh: true });
      } else {
        ui.commit();
        ui.show('home');
        ui.toast('All set! Ready to start.');
      }
    });

    const j = $('join-form');
    if (j) {
      const inp = $('join-code');
      inp.addEventListener('input', function () {
        const v = SQ.sync.normaliseCode(inp.value);
        if (v !== inp.value) inp.value = v;
      });
      j.addEventListener('submit', function (e) {
        e.preventDefault();
        const err = $('join-err');
        err.textContent = 'Checking the code…';
        SQ.sync.join(inp.value).then(function (state) {
          app.state = state;
          SQ.storage.save(state);
          ui.selectChild(null);
          ui.enter({});
          ui.toast('Device connected');
        }).catch(function (ex) {
          err.textContent = ex.message === 'invalid' ? 'A family code looks like XXXX-XXXX-XXXX.'
            : ex.message === 'not-found' ? 'That code wasn’t found. Check the letters and numbers.'
            : 'Can’t reach the server. Please try again.';
        });
      });
    }
  };

  actions['setup-mode'] = function (el) { ui.show('setup', { mode: el.dataset.mode }); };

  /* ---------- PIN (parent or child) ---------- */

  let pinBuf = '';
  let pinArgs = {};

  screens.pin = function (args) {
    pinBuf = '';
    pinArgs = args || {};
    const child = pinArgs.mode === 'child' ? SQ.family.child(app.state, pinArgs.childId) : null;
    if (pinArgs.mode === 'child' && !child) return ui.show('who');
    const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (n) {
      return '<button class="key" data-act="pin-key" data-k="' + n + '">' + n + '</button>';
    }).join('');
    const head = child
      ? '<p class="eyebrow">' + esc(nameOf(child)) + '</p><h1>Enter your PIN</h1>'
      : '<p class="eyebrow">For parents</p><h1>Enter the parent PIN</h1>';
    const links = child
      ? '<div class="pin-links"><button class="link" data-act="switch-child">' + ui.ICON.back + 'Back</button>' +
        '<span class="muted small">Forgot it? Ask a parent.</span></div>'
      : '<div class="pin-links"><button class="link" data-act="pin-back">' + ui.ICON.back + 'Back</button>' +
        '<button class="link" data-act="pin-forgot">Forgot the PIN?</button></div>' +
        '<div id="pin-forgot" class="forgot" hidden>' +
        '<p>The PIN can’t be recovered. You can erase all data and settings on this device and set everything up again. Other synced devices are not affected.</p>' +
        '<label class="field"><span>Type RESET to erase</span><input id="forgot-word" autocomplete="off"></label>' +
        '<button class="btn danger" data-act="pin-reset">Erase data on this device</button></div>';
    ui.set(
      '<section class="panel pin">' + (child ? avatar(child) : '') + head +
      '<div class="pin-dots" id="pin-dots" aria-label="0 / 4"><span></span><span></span><span></span><span></span></div>' +
      '<p class="form-err" id="pin-err" role="alert"></p>' +
      '<div class="pinpad">' + keys +
      '<span></span><button class="key" data-act="pin-key" data-k="0">0</button>' +
      '<button class="key fn" data-act="pin-key" data-k="back" aria-label="Delete">' + ui.ICON.del + '</button></div>' +
      links + '</section>'
    );
  };

  function pinDots() {
    const dots = $('pin-dots');
    if (!dots) return;
    Array.prototype.forEach.call(dots.children, function (d, i) { d.className = i < pinBuf.length ? 'on' : ''; });
    dots.setAttribute('aria-label', pinBuf.length + ' / 4');
  }

  function pinKey(k) {
    if (k === 'back') pinBuf = pinBuf.slice(0, -1);
    else if (pinBuf.length < 4) pinBuf += k;
    pinDots();
    $('pin-err').textContent = '';
    if (pinBuf.length < 4) return;
    const child = pinArgs.mode === 'child' ? SQ.family.child(app.state, pinArgs.childId) : null;
    const expected = child ? child.settings.childPinHash : app.state.family.pinHash;
    if (SQ.hashPin(pinBuf) === expected) {
      if (child) {
        ui.selectChild(child.id);
        ui.show('home');
      } else {
        app.parentAt = Date.now();
        ui.show('parent', { tab: 'progress' });
      }
      return;
    }
    pinBuf = '';
    const dots = $('pin-dots');
    dots.classList.remove('shake'); void dots.offsetWidth; dots.classList.add('shake');
    setTimeout(pinDots, 250);
    $('pin-err').textContent = 'Wrong PIN, try again';
  }

  actions.parent = function () {
    if (!SQ.family.isSetUp(app.state)) return ui.show('setup', {});
    app.session = null;
    if (app.parentAt && Date.now() - app.parentAt < UNLOCK_MS) return ui.show('parent', { tab: 'progress' });
    ui.show('pin', { mode: 'parent' });
  };
  actions['pin-key'] = function (el) { pinKey(el.dataset.k); };
  actions['pin-back'] = function () { ui.enter(); };
  actions['pin-forgot'] = function () { $('pin-forgot').hidden = false; $('forgot-word').focus(); };
  actions['pin-reset'] = function () {
    const w = $('forgot-word').value.trim().toUpperCase();
    if (w !== 'RESET') { ui.toast('Type the word RESET'); return; }
    SQ.sync.leave();
    SQ.storage.setMeta('active', null);
    ui.selectChild(null);
    app.state = SQ.storage.blank();
    SQ.storage.save(app.state);
    app.parentAt = 0;
    ui.show('setup', {});
  };

  doc.addEventListener('keydown', function (e) {
    if (!app.screen || app.screen.name !== 'pin') return;
    if (doc.activeElement && doc.activeElement.tagName === 'INPUT') return;
    if (/^[0-9]$/.test(e.key)) { pinKey(e.key); e.preventDefault(); }
    else if (e.key === 'Backspace') { pinKey('back'); e.preventDefault(); }
  });

  /* ---------- parent panel ---------- */

  const TABS = [
    ['progress', 'Progress', true],
    ['challenge', 'Rules', true],
    ['topics', 'Topics', true],
    ['family', 'Family', false],
    ['devices', 'Devices', false],
    ['data', 'Data', false],
  ];

  screens.parent = function (args) {
    if (!app.parentAt || Date.now() - app.parentAt > UNLOCK_MS * 6) return ui.show('pin', { mode: 'parent' });
    app.parentAt = Date.now();
    const tab = args.tab || 'progress';
    const perChild = TABS.find(function (t) { return t[0] === tab; })[2];
    const c = pk();
    const list = kids();
    const chips = perChild && list.length > 1
      ? '<div class="kid-chips" role="group" aria-label="Child">' + list.map(function (k) {
        return '<button class="kid-chip' + (k === c ? ' on' : '') + '" aria-pressed="' + (k === c) + '" data-act="parent-kid" data-id="' + esc(k.id) + '">' +
          avatar(k) + esc(nameOf(k)) + '</button>';
      }).join('') + '</div>'
      : '';
    const title = perChild ? esc(nameOf(c)) + (tab === 'progress' ? '’s progress' : tab === 'challenge' ? '’s rules' : '’s topics') : 'Parent panel';
    const body = { progress: progressTab, challenge: challengeTab, topics: topicsTab, family: familyTab, devices: devicesTab, data: dataTab }[tab](args);
    ui.set(
      '<section class="parent">' +
      '<div class="parent-head"><div><p class="eyebrow">For parents</p>' +
      '<h1>' + title + '</h1></div>' +
      '<button class="btn ghost small" data-act="parent-exit">Log out</button></div>' +
      '<nav class="tabs" role="tablist">' + TABS.map(function (t) {
        return '<button role="tab" class="tab' + (t[0] === tab ? ' on' : '') + '" aria-selected="' + (t[0] === tab) + '" data-act="parent-tab" data-tab="' + t[0] + '">' + t[1] + '</button>';
      }).join('') + '</nav>' + chips +
      '<div class="tab-body">' + body + '</div></section>'
    );
    if (bind[tab]) bind[tab](args);
  };

  actions['parent-tab'] = function (el) { ui.show('parent', { tab: el.dataset.tab }); };
  actions['parent-kid'] = function (el) {
    app.parentChild = el.dataset.id;
    ui.show('parent', { tab: app.screen.args.tab || 'progress' });
  };
  actions['parent-exit'] = function () { app.parentAt = 0; ui.enter(); };

  const bind = {};

  /* ----- progress ----- */

  function setLabel(h) {
    if (h.mode === 'practice') {
      const t = SQ.topic(h.topic);
      return 'Practice' + (t ? ': ' + esc(t.title) + ', level ' + h.level : '');
    }
    return 'Challenge';
  }

  function setResult(h) {
    if (h.abandoned) return '<span class="pill warn">stopped part-way</span>';
    if (h.mode === 'challenge') {
      if (h.perfect) return '<span class="pill good">' + h.correct + '/' + h.size + ' perfect</span>';
      const firstBad = (h.items || []).findIndex(function (i) { return !i.ok; });
      if (!h.completed && firstBad !== -1) return '<span class="pill bad">mistake on question ' + (firstBad + 1) + '</span>';
      return '<span class="pill bad">' + h.correct + '/' + h.size + '</span>';
    }
    return '<span class="pill ' + (h.correct === h.size ? 'good' : 'plain') + '">' + h.correct + '/' + (h.items || []).length + '</span>';
  }

  function meter(ratio) {
    const level = ratio >= 0.9 ? 'good' : ratio >= 0.7 ? 'warn' : 'bad';
    return '<span class="meter ' + level + '" role="img" aria-label="' + pct(ratio) + '"><span style="width:' + Math.max(2, Math.round(ratio * 100)) + '%"></span></span>';
  }

  function tile(label, value, sub) {
    return '<div class="tile"><p class="tile-label">' + label + '</p><p class="tile-value">' + value + '</p>' +
      (sub ? '<p class="tile-sub">' + sub + '</p>' : '') + '</div>';
  }

  function progressTab() {
    const s = pk(), st = s.settings;
    const today = E.dayKey();
    const todays = s.history.filter(function (h) { return E.dayKey(h.ts) === today; });
    const chal = todays.filter(function (h) { return h.mode === 'challenge'; });
    const perfect = chal.filter(function (h) { return h.perfect; }).length;
    const rewardsToday = s.rewards.filter(function (r) { return E.dayKey(r.ts) === today; });
    const minsToday = rewardsToday.reduce(function (a, r) { return a + r.minutes; }, 0);
    const weekAgo = Date.now() - 7 * 864e5;
    let n = 0, ok = 0;
    s.history.forEach(function (h) {
      if (h.ts < weekAgo) return;
      (h.items || []).forEach(function (i) { n++; if (i.ok) ok++; });
    });

    const tiles =
      '<div class="tiles">' +
      tile('Sets today', String(todays.length), 'challenge ' + chal.length + ', practice ' + (todays.length - chal.length)) +
      tile('Perfect sets today', String(perfect), 'of ' + chal.length + ' in the challenge') +
      tile('Game time today', minsToday + ' min', plural(rewardsToday.length, 'reward', 'rewards') + (st.dailyLimit ? ' of ' + st.dailyLimit : '')) +
      tile('Accuracy, last 7 days', n ? pct(ok / n) : '—', plural(n, 'answer', 'answers')) +
      '</div>';

    let chance = '';
    const ra = E.recentAccuracy(s, 100, 'challenge');
    if (ra) {
      const need = st.setSize * st.setsRequired;
      const p = Math.pow(ra.accuracy, need);
      chance = '<div class="explain"><p>Accuracy in the challenge over the last ' + ra.count + ' answers: <b>' + pct(ra.accuracy) + '</b>. ' +
        'A reward needs <b>' + need + ' correct answers in a row</b>. At this accuracy that works out in about ' +
        '<b>' + (p >= 0.995 ? '100' : Math.max(1, Math.round(p * 100))) + '%</b> of attempts' +
        (p > 0 && p < 0.5 ? ' (on average one successful attempt in ' + Math.round(1 / p) + ')' : '') + '.</p>' +
        (p < 0.15 ? '<p>If that is too hard, make the challenge easier under Rules (fewer questions or sets) or Topics (easier levels), then raise the bar as things improve.</p>' : '') +
        '</div>';
    }

    const monthAgo = Date.now() - 30 * 864e5;
    const stats = ui.levelStats(s, monthAgo);
    const rows = Object.keys(stats).map(function (k) { return stats[k]; })
      .filter(function (m) { return SQ.topic(m.t); })
      .sort(function (a, b) { return a.ok / a.n - b.ok / b.n; });
    const table = rows.length
      ? '<div class="table-wrap"><table class="stats"><thead><tr><th>Topic and level</th><th class="num">Answers</th><th>Correct</th></tr></thead><tbody>' +
        rows.map(function (m) {
          const t = SQ.topic(m.t), l = SQ.level(m.t, m.l);
          const r = m.ok / m.n;
          return '<tr><td>' + esc(t.title) + '<span class="muted"> · ' + m.l + '. ' + esc(l ? l.title : '') + '</span></td>' +
            '<td class="num">' + m.n + '</td><td class="acc"><span class="acc-num">' + pct(r) + '</span>' + meter(r) +
            (r < 0.7 ? '<span class="pill bad small">hard</span>' : '') + '</td></tr>';
        }).join('') + '</tbody></table></div>'
      : '<p class="muted">No answers in the last 30 days yet.</p>';

    const mistakes = [];
    for (let i = s.history.length - 1; i >= 0 && mistakes.length < 15; i--) {
      const h = s.history[i];
      for (let j = (h.items || []).length - 1; j >= 0 && mistakes.length < 15; j--) {
        if (!h.items[j].ok) mistakes.push({ it: h.items[j], ts: h.ts });
      }
    }
    const mistakeList = mistakes.length
      ? '<ul class="review compact">' + mistakes.map(function (m) {
        return '<li><span class="rq">' + ui.text(m.it.q) + '</span>' +
          '<span class="rg">answered <s>' + esc(m.it.g) + '</s></span>' +
          '<span class="ra">correct <b>' + esc(m.it.a) + '</b></span>' +
          '<span class="rt muted">' + when(m.ts) + '</span></li>';
      }).join('') + '</ul>'
      : '<p class="muted">No mistakes yet.</p>';

    const recent = s.history.slice(-25).reverse();
    const historyList = recent.length
      ? '<ul class="hist">' + recent.map(function (h) {
        return '<li><span class="h-when muted">' + when(h.ts) + '</span><span class="h-what">' + setLabel(h) + '</span>' + setResult(h) + '</li>';
      }).join('') + '</ul>'
      : '<p class="muted">No sets yet.</p>';

    const rewards = s.rewards.slice(-10).reverse();
    const now = Date.now();
    const rewardList = rewards.length
      ? '<ul class="hist">' + rewards.map(function (r) {
        const status = !r.startedAt ? '<span class="pill plain">not started yet</span>'
          : r.endsAt > now ? '<span class="pill good">running, ' + ui.fmtTime(r.endsAt - now) + ' left</span>'
          : '<span class="pill plain">used' + (r.stoppedEarly ? ' (stopped early)' : '') + '</span>';
        return '<li><span class="h-when muted">' + when(r.ts) + '</span><span class="h-what">' + r.minutes + ' min of games</span>' + status + '</li>';
      }).join('') + '</ul>'
      : '<p class="muted">No rewards yet.</p>';

    return tiles + chance +
      '<section class="p-sec"><h2>What’s hard (last 30 days)</h2><p class="muted small">Hardest first. Green: 90% or more, amber: 70–89%, red: below 70%.</p>' + table + '</section>' +
      '<section class="p-sec"><h2>Recent mistakes</h2>' + mistakeList + '</section>' +
      '<section class="p-sec"><h2>Set history</h2>' + historyList + '</section>' +
      '<section class="p-sec"><h2>Game time</h2>' + rewardList + '</section>';
  }

  /* ----- challenge rules ----- */

  function select(id, label, value, options) {
    return '<label class="field"><span>' + label + '</span><select id="' + id + '">' + options.map(function (o) {
      const v = Array.isArray(o) ? o[0] : o, t = Array.isArray(o) ? o[1] : o;
      return '<option value="' + v + '"' + (Number(value) === v ? ' selected' : '') + '>' + t + '</option>';
    }).join('') + '</select></label>';
  }

  function challengeTab() {
    const st = pk().settings;
    return '<form id="rules-form" class="form two-col" novalidate>' +
      select('set-size', 'Questions in a set', st.setSize, [5, 6, 8, 10, 12, 15, 20]) +
      select('sets-required', 'Perfect sets in a row for a reward', st.setsRequired, [1, 2, 3, 4, 5]) +
      select('reward-minutes', 'Minutes of games per reward', st.rewardMinutes, [10, 15, 20, 30, 40, 45, 60, 90, 120]) +
      select('daily-limit', 'Rewards per day, at most', st.dailyLimit, [[0, 'no limit'], 1, 2, 3, 4, 5]) +
      '<fieldset class="field wide"><legend>When a challenge answer is wrong</legend>' +
      '<label class="radio"><input type="radio" name="on-mistake" value="restart"' + (st.onMistake === 'restart' ? ' checked' : '') + '><span><b>The set ends straight away.</b> Your child sees the worked answer and starts a new set. Quicker, and harder to game.</span></label>' +
      '<label class="radio"><input type="radio" name="on-mistake" value="finish"' + (st.onMistake === 'finish' ? ' checked' : '') + '><span><b>The set carries on to the end</b> but doesn’t count. More practice, but longer.</span></label>' +
      '</fieldset>' +
      '<label class="check wide"><input type="checkbox" id="sound"' + (st.sound ? ' checked' : '') + '><span>Sounds for answers</span></label>' +
      '</form>' +
      '<p class="muted small">Changes save straight away and reach every connected device.</p>' +
      '<div class="explain"><p><b>How the challenge works.</b> Each set mixes questions from the topics ticked under Topics. ' +
      'Only sets with no mistakes count, and they must be in a row on the same day. A mistake, stopping a set, or closing the page in the middle of a set resets the run. ' +
      'After a reward your child starts the game timer. Progress shows when that happened.</p>' +
      '<p>Practice on single topics never affects rewards. Mistakes there cost nothing, so it is the place to work on the hard parts.</p></div>';
  }

  bind.challenge = function () {
    const c = pk(), st = c.settings;
    const form = $('rules-form');
    form.addEventListener('change', function () {
      st.setSize = Number($('set-size').value);
      st.setsRequired = Number($('sets-required').value);
      st.rewardMinutes = Number($('reward-minutes').value);
      st.dailyLimit = Number($('daily-limit').value);
      const r = form.querySelector('input[name="on-mistake"]:checked');
      st.onMistake = r ? r.value : 'restart';
      st.sound = $('sound').checked;
      ui.touchSettings(c);
      ui.commit();
      ui.toast('Saved');
    });
  };

  /* ----- topics ----- */

  function topicsTab() {
    const asg = pk().settings.assignment;
    const has = function (t, l) {
      const a = asg.find(function (x) { return x.topic === t; });
      return !!a && a.levels.indexOf(l) !== -1;
    };
    return '<p class="muted">Tick the topics and levels that make up the game-time challenge. All topics stay open for practice either way.</p>' +
      '<form id="topics-form" class="form" novalidate>' +
      SQ.subjects().map(function (subj) {
        return '<div class="subject-block"><h2>' + esc(subj.title) + '</h2>' + subj.topics.map(function (t) {
          return '<fieldset class="topic-set"><legend>' + esc(t.title) + '</legend>' + t.levels.map(function (l) {
            return '<label class="check"><input type="checkbox" data-topic="' + esc(t.id) + '" data-level="' + l.id + '"' +
              (has(t.id, l.id) ? ' checked' : '') + '><span><b>' + l.id + '. ' + esc(l.title) + '</b><span class="muted"> ' + esc(l.description) + '</span></span></label>';
          }).join('') + '</fieldset>';
        }).join('') + '</div>';
      }).join('') + '</form>' +
      '<div class="explain"><p><b>Tip.</b> If it’s hard going, start with one or two levels and add more once the challenge is passed regularly. Progress shows which levels cause the most mistakes.</p></div>';
  }

  bind.topics = function () {
    const c = pk();
    const form = $('topics-form');
    form.addEventListener('change', function (e) {
      const boxes = form.querySelectorAll('input[type="checkbox"]');
      const map = {};
      const order = [];
      Array.prototype.forEach.call(boxes, function (b) {
        if (!b.checked) return;
        const t = b.dataset.topic;
        if (!map[t]) { map[t] = []; order.push(t); }
        map[t].push(Number(b.dataset.level));
      });
      if (!order.length) {
        e.target.checked = true;
        ui.toast('Keep at least one level ticked');
        return;
      }
      c.settings.assignment = order.map(function (t) { return { topic: t, levels: map[t] }; });
      ui.touchSettings(c);
      ui.commit();
      ui.toast('Saved');
    });
  };

  /* ----- family: children and PINs ----- */

  function familyTab(args) {
    const list = kids();
    const rows = list.map(function (c) {
      const sets = c.history.length;
      const editing = args.edit === c.id;
      const row = '<li class="kid-row">' + avatar(c) +
        '<div class="kid-info"><b>' + esc(nameOf(c)) + '</b>' +
        '<span class="muted small">' + (c.settings.childPinHash ? 'PIN on' : 'no PIN') + ' · ' +
        plural(sets, 'set', 'sets') + (c.id === app.childId ? ' · using this device' : '') + '</span></div>' +
        (editing ? '' : '<button class="btn small" data-act="kid-edit" data-id="' + esc(c.id) + '">Edit</button>') + '</li>';
      if (!editing) return row;
      const confirm = args.confirmDelete === c.id;
      return row + '<li class="kid-edit"><form id="kid-form" class="form" data-id="' + esc(c.id) + '" novalidate>' +
        '<label class="field"><span>Name</span><input id="kid-name" maxlength="30" value="' + esc(c.settings.childName) + '"></label>' +
        '<label class="field"><span>' + (c.settings.childPinHash ? 'New child PIN (leave empty to keep it)' : 'Child PIN, 4 digits (optional)') + '</span>' +
        '<input id="kid-pin" type="password" inputmode="numeric" maxlength="4" autocomplete="new-password"></label>' +
        '<p class="muted small">A child PIN helps when children share a device: a brother or sister can’t open someone else’s profile.</p>' +
        '<p class="form-err" id="kid-err" role="alert"></p>' +
        '<div class="btn-row"><button class="btn primary" type="submit">Save</button>' +
        '<button class="btn ghost" type="button" data-act="kid-cancel">Cancel</button>' +
        (c.settings.childPinHash ? '<button class="btn ghost" type="button" data-act="kid-nopin" data-id="' + esc(c.id) + '">Remove PIN</button>' : '') +
        (list.length > 1 ? '<button class="btn danger" type="button" data-act="kid-delete" data-id="' + esc(c.id) + '">' +
          (confirm ? 'Delete ' + esc(nameOf(c)) + '? Click again to confirm' : 'Delete profile') + '</button>' : '') +
        '</div></form></li>';
    }).join('');

    return '<section class="p-sec"><h2>Children</h2>' +
      '<p class="muted">Each child has their own progress, rules and topics. On a device with several profiles, the site asks “Who’s studying?” first.</p>' +
      '<ul class="kids">' + rows + '</ul></section>' +
      '<section class="p-sec"><h2>Add a child</h2>' +
      '<form id="add-kid" class="form inline" novalidate><label class="field"><span>Name</span><input id="new-kid-name" maxlength="30" autocomplete="off"></label>' +
      '<button class="btn" type="submit">Add</button></form>' +
      '<p class="muted small">A new profile starts with the standard rules and topics. Change them under Rules and Topics after picking the child at the top.</p></section>' +
      '<section class="p-sec"><h2>Parent PIN</h2>' +
      '<form id="pin-form" class="form inline" novalidate>' +
      '<label class="field"><span>New PIN</span><input id="new-pin" type="password" inputmode="numeric" maxlength="4" autocomplete="new-password"></label>' +
      '<label class="field"><span>Repeat it</span><input id="new-pin2" type="password" inputmode="numeric" maxlength="4" autocomplete="new-password"></label>' +
      '<button class="btn" type="submit">Change PIN</button></form><p class="form-err" id="pin-form-err" role="alert"></p></section>';
  }

  bind.family = function () {
    const kf = $('kid-form');
    if (kf) kf.addEventListener('submit', function (e) {
      e.preventDefault();
      const c = SQ.family.child(app.state, kf.dataset.id);
      if (!c) return;
      const name = $('kid-name').value.trim();
      const pin = $('kid-pin').value.trim();
      const err = $('kid-err');
      if (!name) { err.textContent = 'Enter a name.'; return; }
      if (pin && !validPin(pin)) { err.textContent = 'The PIN must be 4 digits.'; return; }
      c.settings.childName = name;
      if (pin) c.settings.childPinHash = SQ.hashPin(pin);
      ui.touchSettings(c);
      ui.commit();
      ui.show('parent', { tab: 'family' });
      ui.toast('Saved');
    });

    $('add-kid').addEventListener('submit', function (e) {
      e.preventDefault();
      const name = $('new-kid-name').value.trim();
      if (!name) { ui.toast('Enter a name'); return; }
      const c = SQ.storage.blankChild(name);
      app.state.children.push(c);
      app.parentChild = c.id;
      ui.commit();
      ui.show('parent', { tab: 'family' });
      ui.toast('Profile added');
    });

    $('pin-form').addEventListener('submit', function (e) {
      e.preventDefault();
      const a = $('new-pin').value.trim(), b = $('new-pin2').value.trim();
      const err = $('pin-form-err');
      if (!validPin(a)) { err.textContent = 'The PIN must be 4 digits.'; return; }
      if (a !== b) { err.textContent = 'The PINs don’t match.'; return; }
      app.state.family.pinHash = SQ.hashPin(a);
      ui.touchFamily();
      ui.commit();
      err.textContent = '';
      $('new-pin').value = ''; $('new-pin2').value = '';
      ui.toast('PIN changed');
    });
  };

  actions['kid-edit'] = function (el) { ui.show('parent', { tab: 'family', edit: el.dataset.id }); };
  actions['kid-cancel'] = function () { ui.show('parent', { tab: 'family' }); };
  actions['kid-nopin'] = function (el) {
    const c = SQ.family.child(app.state, el.dataset.id);
    if (!c) return;
    c.settings.childPinHash = null;
    ui.touchSettings(c);
    ui.commit();
    ui.show('parent', { tab: 'family', edit: c.id });
    ui.toast('PIN removed');
  };
  actions['kid-delete'] = function (el) {
    const id = el.dataset.id;
    const args = app.screen.args;
    if (args.confirmDelete !== id) return ui.show('parent', { tab: 'family', edit: id, confirmDelete: id });
    const c = SQ.family.child(app.state, id);
    if (!c || kids().length < 2) return;
    c.deletedAt = Date.now();
    if (app.childId === id) ui.selectChild(null);
    if (app.parentChild === id) app.parentChild = null;
    ui.commit();
    ui.show('parent', { tab: 'family' });
    ui.toast('Profile deleted');
  };

  /* ----- devices ----- */

  function devicesTab(args) {
    const S = SQ.sync;
    if (!S.enabled && !S.family && S.backend === 'firebase') {
      return '<div class="explain"><p><b>Can’t reach the sync service right now.</b> Check the internet connection and reload the page.</p>' +
        '<p>Until then, progress is kept on this device and is shared once the connection is back.</p></div>';
    }
    if (!S.enabled && !S.family) {
      return '<div class="explain"><p><b>Sync isn’t available.</b> This copy of the site has no server, so progress is kept in this browser only.</p>' +
        '<p>To share progress between your child’s phone and computer (and your phone), upload the whole site, including the <code>api</code> folder, to hosting with PHP. Sync then switches on by itself.</p></div>';
    }
    if (!S.family) {
      return '<section class="p-sec"><h2>Sync is off on this device</h2>' +
        '<p class="muted">Turn it on here if this is the first device. If another device already has a family code, enter it below.</p>' +
        '<button class="btn primary" data-act="sync-create">Turn on sync</button></section>' +
        '<section class="p-sec"><h2>Join an existing family</h2>' +
        '<form id="join2-form" class="form inline" novalidate><label class="field"><span>Family code</span>' +
        '<input id="join2-code" class="code-input" maxlength="14" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX-XXXX"></label>' +
        '<button class="btn" type="submit">Connect</button></form><p class="form-err" id="join2-err" role="alert"></p>' +
        '<p class="muted small">This device’s data is combined with the family’s. Nothing is lost.</p></section>';
    }
    const link = joinLink(S.family);
    const status = S.status === 'ok' ? '<span class="pill good">synced</span>'
      : S.status === 'syncing' ? '<span class="pill plain">syncing…</span>'
      : '<span class="pill warn">offline, changes will be sent later</span>';
    return (args.fresh ? '<div class="notice good"><p><b>All set!</b> Now connect your child’s devices: open the link below on their phone and computer. You only need to do this once per device.</p>' +
      '<button class="btn primary" data-act="parent-exit">Go to the home page</button></div>' : '') +
      '<section class="p-sec"><h2>Family code</h2>' +
      '<p class="family-code" id="family-code">' + esc(S.family) + '</p>' +
      '<p>' + status + '</p>' +
      '<div class="copy-row"><input id="join-link" class="link-input" readonly value="' + esc(link) + '" aria-label="Link to connect a device">' +
      '<button class="btn" data-act="copy-link">Copy link</button></div>' +
      '<ol class="howto"><li>Open this link on your child’s phone or computer, for example by sending it to yourself in a messaging app.</li>' +
      '<li>The device connects by itself. Or enter the code by hand under “I have a family code”.</li>' +
      '<li>With several children, the device asks who is using it. Each device remembers the choice.</li>' +
      '<li>To follow progress from your own phone, connect it the same way, then open For parents.</li></ol>' +
      '<p class="muted small">The code works like a password to your family’s progress. Don’t share it publicly.</p></section>' +
      haSection() +
      '<section class="p-sec"><h2>Disconnect this device</h2><p class="muted">The data on this device stays, but it stops syncing.</p>' +
      '<button class="btn ghost" data-act="sync-leave">Turn off sync here</button></section>';
  }

  /* Home Assistant: unlock games only while game time runs (Firebase only). */
  function haSection() {
    if (!SQ.sync.haAvailable()) return '';
    const on = !!app.state.family.homeAssistant;
    if (!on) {
      return '<section class="p-sec" id="ha-sec"><h2>Home Assistant</h2>' +
        '<p>Home Assistant can keep games blocked through Microsoft Family Safety and unlock them only while your child’s game timer is running.</p>' +
        '<p class="muted small">Before turning this on, add the Home Assistant part of the Firestore rules (README → Home Assistant). The link then works for every child in the family.</p>' +
        '<button class="btn" data-act="ha-on">Turn on the Home Assistant link</button></section>';
    }
    const st = SQ.sync.ha;
    const pill = st === 'ok' ? '<span class="pill good">summary up to date</span>'
      : st === 'refused' ? '<span class="pill bad">Firestore refused the summary</span>'
      : st === 'error' ? '<span class="pill warn">can’t reach Firestore, will retry</span>'
      : '<span class="pill plain">sending the summary…</span>';
    return '<section class="p-sec" id="ha-sec"><h2>Home Assistant</h2>' +
      '<p>' + pill + '</p>' +
      (st === 'refused'
        ? '<p class="notice">The Firestore rules don’t include the Home Assistant part yet. Paste the full rules from the README (or <code>firebase/firestore.rules</code>) into Firebase → Firestore → Rules and click Publish, then reload this page.</p>'
        : '') +
      '<p>Copy this into Home Assistant as <code>/config/packages/study_quest.yaml</code>, then replace the <code>CHANGE_ME</code> lines with your Family Safety switches. The README has the steps.</p>' +
      '<textarea id="ha-yaml" class="code-area tall" readonly aria-label="Home Assistant package">Preparing…</textarea>' +
      '<div class="btn-row"><button class="btn" data-act="ha-copy">Copy for Home Assistant</button>' +
      '<button class="btn ghost" data-act="ha-off">Turn off the link</button></div></section>';
  }

  function fillHaYaml() {
    const box = $('ha-yaml');
    if (!box) return;
    SQ.sync.haUrl().then(function (url) {
      if (!url) return;
      box.value = SQ.ha.packageYaml(url, kids().map(function (c) { return { id: c.id, name: c.settings.childName }; }));
    });
  }

  // Keep the status pill fresh while the Devices tab is open.
  let haShown = null;
  SQ.sync.onChange(function () {
    if (!app.screen || app.screen.name !== 'parent' || app.screen.args.tab !== 'devices') return;
    if (haShown === SQ.sync.ha) return;
    const sec = $('ha-sec');
    if (!sec) return;
    haShown = SQ.sync.ha;
    sec.outerHTML = haSection();
    fillHaYaml();
  });

  actions['ha-on'] = function () {
    app.state.family.homeAssistant = true;
    ui.touchFamily();
    ui.commit();
    SQ.sync.writeHaNow();
    ui.show('parent', { tab: 'devices' });
  };
  actions['ha-off'] = function () {
    app.state.family.homeAssistant = false;
    ui.touchFamily();
    ui.commit();
    SQ.sync.writeHaNow();
    ui.show('parent', { tab: 'devices' });
    ui.toast('Home Assistant link is off');
  };
  actions['ha-copy'] = function () {
    const box = $('ha-yaml');
    box.select();
    copy(box.value, 'Copied. Paste it into Home Assistant');
  };

  bind.devices = function () {
    haShown = SQ.sync.ha;
    if (app.state.family.homeAssistant && SQ.sync.haAvailable() && SQ.sync.ha === 'off') SQ.sync.writeHaNow();
    fillHaYaml();
    const f = $('join2-form');
    if (!f) return;
    const inp = $('join2-code');
    inp.addEventListener('input', function () {
      const v = SQ.sync.normaliseCode(inp.value);
      if (v !== inp.value) inp.value = v;
    });
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      const err = $('join2-err');
      err.textContent = 'Checking the code…';
      SQ.sync.join(inp.value).then(function (remote) {
        // The family's PIN and settings win over this device's.
        app.state.family.updatedAt = 0;
        app.state.children.forEach(function (c) { c.settings.updatedAt = 0; });
        app.state = SQ.storage.merge(app.state, remote);
        ui.commit();
        ui.show('parent', { tab: 'devices' });
        ui.toast('Device connected');
      }).catch(function (ex) {
        err.textContent = ex.message === 'invalid' ? 'A family code looks like XXXX-XXXX-XXXX.'
          : ex.message === 'not-found' ? 'That code wasn’t found.' : 'Can’t reach the server.';
      });
    });
  };

  actions['sync-create'] = function () {
    SQ.sync.createFamily();
    ui.commit();
    ui.show('parent', { tab: 'devices', fresh: true });
  };
  actions['sync-leave'] = function () {
    SQ.sync.leave();
    ui.show('parent', { tab: 'devices' });
    ui.toast('Sync is off on this device');
  };
  actions['copy-link'] = function () {
    const inp = $('join-link');
    inp.select();
    copy(inp.value, 'Link copied');
  };

  /* ----- data ----- */

  function dataTab() {
    const list = kids();
    const c = pk();
    return '<section class="p-sec"><h2>Backup</h2>' +
      '<p class="muted">The whole family’s progress and settings as text. Keep it somewhere safe, then restore it later or move it to a device without sync.</p>' +
      '<div class="btn-row"><button class="btn" data-act="backup-show">Show backup</button><button class="btn ghost" data-act="backup-copy">Copy</button></div>' +
      '<textarea id="backup-out" class="code-area" readonly hidden aria-label="Backup"></textarea>' +
      '<label class="field"><span>Restore: paste the backup text here</span><textarea id="backup-in" class="code-area" spellcheck="false"></textarea></label>' +
      '<button class="btn" data-act="backup-restore">Restore from backup</button>' +
      '<p class="muted small">A backup is combined with the current data. Nothing is erased.</p></section>' +
      '<section class="p-sec danger-zone"><h2>Reset progress</h2>' +
      '<form id="reset-form" class="form" novalidate>' +
      (list.length > 1
        ? '<label class="field"><span>Whose progress</span><select id="reset-kid">' + list.map(function (k) {
          return '<option value="' + esc(k.id) + '"' + (k === c ? ' selected' : '') + '>' + esc(nameOf(k)) + '</option>';
        }).join('') + '</select></label>'
        : '') +
      '<p class="muted">Deletes the history, rewards and run of ' + (list.length > 1 ? 'the chosen child' : esc(nameOf(c))) + ' on every connected device. Rules, topics and PINs stay.</p>' +
      '<div class="form inline"><label class="field"><span>Type RESET to confirm</span><input id="reset-word" autocomplete="off"></label>' +
      '<button class="btn danger" type="submit">Reset progress</button></div></form></section>';
  }

  bind.data = function () {
    $('reset-form').addEventListener('submit', function (e) {
      e.preventDefault();
      const w = $('reset-word').value.trim().toUpperCase();
      if (w !== 'RESET') { ui.toast('Type the word RESET'); return; }
      const sel = $('reset-kid');
      const c = sel ? SQ.family.child(app.state, sel.value) : pk();
      if (!c) return;
      c.resetAt = Date.now();
      c.history = [];
      c.rewards = [];
      c.progress = { streak: 0, streakDay: '', run: 0, bestRun: 0, updatedAt: Date.now() };
      if (c.id === app.childId) SQ.storage.setMeta('active', null);
      app.parentChild = c.id;
      ui.commit();
      ui.show('parent', { tab: 'progress' });
      ui.toast('Progress reset for ' + nameOf(c));
    });
  };

  actions['backup-show'] = function () {
    const out = $('backup-out');
    out.value = JSON.stringify(app.state);
    out.hidden = false;
    out.select();
  };
  actions['backup-copy'] = function () {
    const out = $('backup-out');
    out.value = JSON.stringify(app.state);
    out.hidden = false;
    out.select();
    copy(out.value, 'Backup copied');
  };
  actions['backup-restore'] = function () {
    const txt = $('backup-in').value.trim();
    if (!txt) { ui.toast('Paste the backup text first'); return; }
    try {
      const incoming = SQ.storage.parseBackup(txt);
      app.state = SQ.storage.merge(app.state, incoming);
      ui.commit();
      ui.show('parent', { tab: 'progress' });
      ui.toast('Backup restored');
    } catch (e) {
      ui.toast('That doesn’t look like a Study Quest backup');
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
