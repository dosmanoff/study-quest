/*
 * Business Quest — parent screens: first setup, parent PIN, and the parent
 * panel (progress and diagnostics, history, answers waiting for marking,
 * settings, devices, backup). There are no rewards or limits to set.
 */
(function (root) {
  'use strict';
  const SQ = root.SQ, BQ = root.BQ, ui = SQ.ui, app = SQ.app, esc = SQ.util.escape;
  const doc = root.document;
  const screens = ui.screens, actions = ui.actions, ICON = ui.ICON;
  const UNLOCK_MS = 5 * 60 * 1000;
  const QS = ui.questions, BY_N = ui.byN;

  function $(id) { return doc.getElementById(id); }
  function validPin(p) { return /^[0-9]{4}$/.test(p); }
  function joinLink(code) { const l = root.location; return l.origin + l.pathname + '#join-' + code; }
  function copy(text, okMsg) {
    try {
      navigator.clipboard.writeText(text).then(function () { ui.toast(okMsg || 'Copied'); }, function () { ui.toast('Select the text and copy it yourself'); });
    } catch (e) { ui.toast('Select the text and copy it yourself'); }
  }
  function kid() { return ui.kid() || SQ.family.children(app.state)[0] || null; }
  function bindCode(inp) {
    inp.addEventListener('input', function () { const v = SQ.sync.normaliseCode(inp.value); if (v !== inp.value) inp.value = v; });
  }
  function joinError(ex) {
    return ex.message === 'invalid' ? 'A family code looks like XXXX-XXXX-XXXX.'
      : ex.message === 'not-found' ? 'That code wasn’t found. Check the letters and numbers.' : 'Can’t reach the server. Please try again.';
  }

  /* ---------- first setup ---------- */

  screens.setup = function (args) {
    const syncOn = SQ.sync.enabled;
    const mode = syncOn ? (args.mode || (args.join ? 'join' : 'new')) : 'new';
    const seg = syncOn
      ? '<div class="seg" role="tablist">' +
        '<button role="tab" class="seg-btn' + (mode === 'new' ? ' on' : '') + '" aria-selected="' + (mode === 'new') + '" data-act="setup-mode" data-mode="new">First device</button>' +
        '<button role="tab" class="seg-btn' + (mode === 'join' ? ' on' : '') + '" aria-selected="' + (mode === 'join') + '" data-act="setup-mode" data-mode="join">I have a family code</button></div>'
      : '';
    const formNew = '<form id="setup-form" class="form" novalidate>' +
      '<label class="field"><span>Student’s name</span><input id="setup-name" maxlength="30" autocomplete="off" value="Yaroslav"></label>' +
      '<label class="check"><input type="checkbox" id="setup-hl" checked> <span>Higher Level (include the HL questions)</span></label>' +
      '<label class="field"><span>Parent PIN (4 digits)</span><input id="setup-pin" type="password" inputmode="numeric" maxlength="4" autocomplete="new-password"></label>' +
      '<label class="field"><span>Repeat the PIN</span><input id="setup-pin2" type="password" inputmode="numeric" maxlength="4" autocomplete="new-password"></label>' +
      '<p class="form-err" id="setup-err" role="alert"></p>' +
      '<button class="btn primary big" type="submit">Done</button>' +
      '<p class="muted small">The parent PIN opens the statistics and settings under “For parents”.</p></form>';
    const formJoin = '<form id="join-form" class="form" novalidate>' +
      '<label class="field"><span>Family code</span><input id="join-code" class="code-input" maxlength="14" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX-XXXX" value="' + esc(args.join || '') + '"></label>' +
      '<p class="form-err" id="join-err" role="alert"></p>' +
      '<button class="btn primary big" type="submit">Connect this device</button>' +
      '<p class="muted small">The code and a ready link are on the first device: For parents → Devices.</p></form>';
    ui.set('<section class="panel setup"><p class="eyebrow">For parents</p><h1>Set up Business Quest</h1>' +
      '<p class="muted">Practice for IB Business Management, Unit 1: quick checks marked instantly, and exam questions marked against the IB markscheme.</p>' +
      seg + (mode === 'join' ? formJoin : formNew) +
      (!syncOn ? '<p class="notice">Can’t reach the sync service right now, so progress will stay on this device until it can. Check the internet connection and reload to join an existing family. Written answers are only marked once this device syncs.</p>' : '') +
      '</section>');
    const f = $('setup-form');
    if (f) f.addEventListener('submit', function (e) {
      e.preventDefault();
      const name = $('setup-name').value.trim(), pin = $('setup-pin').value.trim(), pin2 = $('setup-pin2').value.trim();
      const err = $('setup-err');
      if (!name) { err.textContent = 'Enter the student’s name.'; return; }
      if (!validPin(pin)) { err.textContent = 'The PIN must be 4 digits.'; return; }
      if (pin !== pin2) { err.textContent = 'The PINs don’t match.'; return; }
      app.state.family.pinHash = SQ.hashPin(pin);
      ui.touchFamily();
      const child = SQ.storage.blankChild(name);
      child.settings.hl = $('setup-hl').checked;
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
      }
    });
    const j = $('join-form');
    if (j) {
      bindCode($('join-code'));
      j.addEventListener('submit', function (e) {
        e.preventDefault();
        $('join-err').textContent = 'Checking the code…';
        SQ.sync.join($('join-code').value).then(function (state) {
          app.state = state;
          SQ.storage.save(state);
          ui.selectChild(null);
          ui.enter({});
          ui.toast('Device connected');
        }).catch(function (ex) { $('join-err').textContent = joinError(ex); });
      });
    }
  };
  actions['setup-mode'] = function (el) { ui.show('setup', { mode: el.dataset.mode }); };

  /* ---------- parent PIN ---------- */

  let pinBuf = '';
  screens.pin = function () {
    pinBuf = '';
    const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (n) { return '<button class="key" data-act="pin-key" data-k="' + n + '">' + n + '</button>'; }).join('');
    ui.set('<section class="panel pin"><p class="eyebrow">For parents</p><h1>Enter the parent PIN</h1>' +
      '<div class="pin-dots" id="pin-dots" aria-label="0 / 4"><span></span><span></span><span></span><span></span></div>' +
      '<p class="form-err" id="pin-err" role="alert"></p>' +
      '<div class="pinpad">' + keys + '<span></span><button class="key" data-act="pin-key" data-k="0">0</button>' +
      '<button class="key fn" data-act="pin-key" data-k="back" aria-label="Delete">' + ICON.del + '</button></div>' +
      '<div class="pin-links"><button class="link" data-act="home">' + ICON.back + 'Back</button>' +
      '<button class="link" data-act="pin-forgot">Forgot the PIN?</button></div>' +
      '<div id="pin-forgot" class="forgot" hidden><p>The PIN can’t be recovered. You can erase the data on this device and set it up again, then join the family with its code. Other devices are not affected.</p>' +
      '<label class="field"><span>Type RESET to erase</span><input id="forgot-word" autocomplete="off"></label>' +
      '<button class="btn danger" data-act="pin-reset">Erase data on this device</button></div></section>');
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
    if (SQ.hashPin(pinBuf) === app.state.family.pinHash) {
      app.parentAt = Date.now();
      return ui.show('parent', { tab: 'progress' });
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
    ui.show('pin');
  };
  actions['pin-key'] = function (el) { pinKey(el.dataset.k); };
  actions['pin-forgot'] = function () { $('pin-forgot').hidden = false; $('forgot-word').focus(); };
  actions['pin-reset'] = function () {
    if ($('forgot-word').value.trim().toUpperCase() !== 'RESET') { ui.toast('Type the word RESET'); return; }
    SQ.sync.leave();
    ui.selectChild(null);
    app.state = SQ.storage.blank();
    SQ.storage.save(app.state);
    app.parentAt = 0;
    ui.show('setup', {});
  };
  doc.addEventListener('keydown', function (e) {
    if (!app.screen || app.screen.name !== 'pin' || (doc.activeElement && doc.activeElement.tagName === 'INPUT')) return;
    if (/^[0-9]$/.test(e.key)) { pinKey(e.key); e.preventDefault(); }
    else if (e.key === 'Backspace') { pinKey('back'); e.preventDefault(); }
  });

  /* ---------- parent panel ---------- */

  const TABS = [['progress', 'Progress'], ['history', 'History'], ['settings', 'Settings'], ['devices', 'Devices'], ['data', 'Data']];
  const bind = {};

  screens.parent = function (args) {
    if (!app.parentAt || Date.now() - app.parentAt > UNLOCK_MS * 6) return ui.show('pin');
    app.parentAt = Date.now();
    const tab = args.tab || 'progress';
    const c = kid();
    const body = { progress: progressTab, history: historyTab, settings: settingsTab, devices: devicesTab, data: dataTab }[tab](args);
    ui.set('<section class="parent"><div class="parent-head"><div><p class="eyebrow">For parents</p>' +
      '<h1>' + (tab === 'progress' || tab === 'history' ? esc(c.settings.childName) + '’s ' + tab : 'Parent panel') + '</h1></div>' +
      '<button class="btn ghost small" data-act="parent-exit">Log out</button></div>' +
      '<nav class="tabs" role="tablist">' + TABS.map(function (t) {
        return '<button role="tab" class="tab' + (t[0] === tab ? ' on' : '') + '" aria-selected="' + (t[0] === tab) + '" data-act="parent-tab" data-tab="' + t[0] + '">' + t[1] + '</button>';
      }).join('') + '</nav><div class="tab-body">' + body + '</div></section>');
    if (bind[tab]) bind[tab](args);
  };
  actions['parent-tab'] = function (el) { ui.show('parent', { tab: el.dataset.tab }); };
  actions['parent-exit'] = function () { app.parentAt = 0; ui.enter(); };

  function tile(label, value, sub) {
    return '<div class="tile"><p class="tile-label">' + label + '</p><p class="tile-value">' + value + '</p>' + (sub ? '<p class="tile-sub">' + sub + '</p>' : '') + '</div>';
  }

  function queueSection(c, s) {
    const m = c.marker || {};
    const url = BQ.config && BQ.config.markNowUrl;
    const status = m.lastError
      ? '<p class="notice warn-note"><b>Last marking run:</b> ' + esc(m.lastError) + (m.lastRun ? ' <span class="muted">(' + ui.when(m.lastRun) + ')</span>' : '') + '</p>'
      : m.lastRun ? '<p class="muted small">Last marking: ' + ui.when(m.lastRun) + (m.day ? ' · ' + ui.plural(m.calls, 'call', 'calls') + ' to Claude on ' + esc(m.day) + ' (UTC)' : '') + '</p>' : '';
    const list = s.pending.length
      ? '<ul class="hist">' + s.pending.map(function (a) {
        const q = BY_N[a.n];
        return '<li><span class="h-when muted">' + ui.when(a.ts) + '</span><span class="h-what"><b>Q' + a.n + '</b> ' + esc(q ? q.ct : '') + ' · ' + ui.plural(a.words, 'word', 'words') +
          (a.tries ? ' <span class="pill bad small">failed ' + a.tries + '×</span>' : '') + (a.lease > Date.now() ? ' <span class="pill plain small">being marked</span>' : '') + '</span>' +
          '<button class="btn small ghost" data-act="review" data-id="' + esc(a.id) + '" data-from="parent">Open</button></li>';
      }).join('') + '</ul>'
      : '<p class="muted">Nothing is waiting. Every answer has been marked.</p>';
    return '<section class="p-sec"><h2>Waiting for marking</h2>' +
      '<p class="muted small">Answers are marked by Claude against the markscheme by a job that runs every 10 minutes. Until then they don’t count anywhere, and the student can’t see the model answer.</p>' +
      list + status +
      (s.pending.length && url ? '<div class="btn-row"><a class="btn primary" href="' + esc(url) + '" target="_blank" rel="noopener">Mark now</a>' +
        '<span class="muted small">Opens GitHub: press “Run workflow”. The marks arrive here within a minute or two.</span></div>' : '') +
      '</section>';
  }

  function progressTab() {
    const c = kid(), s = BQ.stats(c, QS);
    const tiles = '<div class="tiles">' +
      tile('Exam questions practised', s.practised + '<small>/' + s.total + '</small>', ui.plural(s.written, 'answer', 'answers') + ' written') +
      tile('Average mark', s.average == null ? '—' : ui.pct(s.average), 'latest marked attempt per question') +
      tile('Quick-check accuracy', s.quickAcc == null ? '—' : ui.pct(s.quickAcc), ui.plural(s.quickSets, 'set', 'sets') + ' · last 20 sets') +
      tile('This week', ui.plural(s.weekDays, 'day', 'days'), s.weekMinutes + ' min of practice') +
      tile('Waiting for marking', String(s.pending.length), s.pending.length ? 'not counted yet' : 'all marked') + '</div>';
    const subRows = s.bySub.map(function (r) {
      return '<tr><td><button class="link" data-act="sub" data-sub="' + r.id + '">' + r.id + ' ' + esc(r.title) + '</button>' +
        (r.due || r.pend ? '<span class="muted small cell-sub">' + [r.due ? r.due + ' to review' : '', r.pend ? r.pend + ' waiting' : ''].filter(Boolean).join(' · ') + '</span>' : '') + '</td>' +
        '<td class="num">' + r.done + '/' + r.total + '</td><td>' + ui.meter(r.avg) + '</td></tr>';
    }).join('');
    const ctRows = s.byCt.length ? s.byCt.map(function (r) {
      return '<tr><td>' + esc(r.ct) + ' <span class="muted small">AO' + r.ao + '</span></td><td class="num">' + r.n + '</td><td>' + ui.meter(r.avg) + '</td></tr>';
    }).join('') : '<tr><td colspan="3" class="muted">No marked answers yet.</td></tr>';
    const AO = { 1: 'AO1 Knowledge (define, state, outline)', 2: 'AO2 Application (explain, distinguish)', 3: 'AO3 Synthesis & evaluation (analyse, discuss, evaluate)', 4: 'AO4 Skills (calculate, construct, identify)' };
    const aoRows = s.byAo.length ? s.byAo.map(function (r) {
      return '<tr><td>' + esc(AO[r.ao] || 'AO' + r.ao) + '</td><td class="num">' + r.n + '</td><td>' + ui.meter(r.avg) + '</td></tr>';
    }).join('') : '<tr><td colspan="3" class="muted">No marked answers yet.</td></tr>';
    const weak = s.needsWork.length ? '<ul class="hist">' + s.needsWork.map(function (x) {
      return '<li><span class="h-what"><b>Q' + x.n + '</b> ' + esc(x.q.ct) + ' · ' + esc(ui.shortQ(x.q, 70)) + '</span>' + ui.statusPills(x) +
        '<button class="btn small ghost" data-act="review" data-id="' + esc(x.last.id) + '" data-from="parent">Feedback</button></li>';
    }).join('') + '</ul>' : '<p class="muted">Nothing below 75% yet.</p>';
    return tiles + queueSection(kid(), s) +
      '<section class="p-sec"><h2>By subtopic</h2><div class="table-wrap"><table class="stats"><thead><tr><th>Subtopic</th><th class="num">Done</th><th>Average</th></tr></thead><tbody>' + subRows + '</tbody></table></div></section>' +
      '<section class="p-sec"><h2>By type of question</h2><p class="muted small">The main diagnostic: low AO1 means definitions need learning; low AO3 means discuss/evaluate answers need balance and a conclusion. Latest marked attempt per question; answers waiting for marking are not included.</p>' +
      '<div class="table-wrap"><table class="stats"><thead><tr><th>Assessment objective</th><th class="num">Questions</th><th>Average</th></tr></thead><tbody>' + aoRows + '</tbody></table></div>' +
      '<div class="table-wrap"><table class="stats"><thead><tr><th>Command term</th><th class="num">Questions</th><th>Average</th></tr></thead><tbody>' + ctRows + '</tbody></table></div></section>' +
      '<section class="p-sec"><h2>Needs work</h2><p class="muted small">The weakest questions (latest marked attempt under 75%), worst first.</p>' + weak + '</section>';
  }

  function historyTab() {
    const c = kid();
    const rows = c.attempts.map(function (a) { return { ts: a.ts, a: a }; })
      .concat(c.quick.map(function (q) { return { ts: q.ts, quick: q }; }))
      .sort(function (x, y) { return y.ts - x.ts; }).slice(0, 80);
    if (!rows.length) return '<p class="muted">Nothing yet.</p>';
    return '<section class="p-sec"><ul class="hist">' + rows.map(function (r) {
      if (r.quick) {
        const q = r.quick;
        return '<li><span class="h-when muted">' + ui.when(q.ts) + '</span><span class="h-what">Quick check' + (q.subs && q.subs.length ? ' · ' + esc(q.subs.join(', ')) : '') +
          (q.planned && q.total < q.planned ? ' <span class="muted small">(stopped after ' + q.total + ')</span>' : '') + '</span>' +
          '<span class="pill ' + ui.level(q.total ? q.score / q.total : 0) + ' small">' + q.score + '/' + q.total + '</span></li>';
      }
      const a = r.a, q = BY_N[a.n];
      return '<li><span class="h-when muted">' + ui.when(a.ts) + '</span><span class="h-what"><b>Q' + a.n + '</b> ' + esc(q ? q.ct : '') + (a.attempt > 1 ? ' · attempt ' + a.attempt : '') +
        ' · ' + ui.plural(a.words, 'word', 'words') + '</span>' +
        (a.status === 'marked' ? ui.scorePill(a) + (a.mark.flags.length ? ' <span class="pill plain small">' + esc(a.mark.flags.join(', ').replace(/_/g, ' ')) + '</span>' : '') : '<span class="pill warn small">Waiting</span>') +
        '<button class="btn small ghost" data-act="review" data-id="' + esc(a.id) + '" data-from="parent">Open</button></li>';
    }).join('') + '</ul></section>';
  }

  function settingsTab() {
    const c = kid();
    return '<section class="p-sec"><h2>Student</h2><form id="settings-form" class="form" novalidate>' +
      '<label class="field"><span>Name</span><input id="set-name" maxlength="30" value="' + esc(c.settings.childName) + '"></label>' +
      '<label class="check"><input type="checkbox" id="set-hl"' + (c.settings.hl ? ' checked' : '') + '> <span>Higher Level: include HL questions (Q86–87) and expected-value calculations</span></label>' +
      '<label class="check"><input type="checkbox" id="set-sound"' + (c.settings.sound ? ' checked' : '') + '> <span>Sounds in quick checks</span></label>' +
      '<button class="btn primary" type="submit">Save</button></form></section>' +
      '<section class="p-sec"><h2>Parent PIN</h2><form id="pin-form" class="form inline" novalidate>' +
      '<label class="field"><span>New PIN</span><input id="new-pin" type="password" inputmode="numeric" maxlength="4" autocomplete="new-password"></label>' +
      '<label class="field"><span>Repeat</span><input id="new-pin2" type="password" inputmode="numeric" maxlength="4" autocomplete="new-password"></label>' +
      '<button class="btn" type="submit">Change PIN</button></form><p class="form-err" id="pin-form-err" role="alert"></p></section>';
  }
  bind.settings = function () {
    $('settings-form').addEventListener('submit', function (e) {
      e.preventDefault();
      const c = kid();
      c.settings.childName = $('set-name').value.trim() || c.settings.childName;
      c.settings.hl = $('set-hl').checked;
      c.settings.sound = $('set-sound').checked;
      c.settings.updatedAt = Date.now();
      ui.commit();
      ui.chrome();
      ui.toast('Saved');
    });
    $('pin-form').addEventListener('submit', function (e) {
      e.preventDefault();
      const p = $('new-pin').value.trim(), p2 = $('new-pin2').value.trim();
      if (!validPin(p)) { $('pin-form-err').textContent = 'The PIN must be 4 digits.'; return; }
      if (p !== p2) { $('pin-form-err').textContent = 'The PINs don’t match.'; return; }
      app.state.family.pinHash = SQ.hashPin(p);
      ui.touchFamily();
      ui.commit();
      ui.show('parent', { tab: 'settings' });
      ui.toast('PIN changed');
    });
  };

  function devicesTab(args) {
    const code = SQ.sync.family;
    if (!SQ.sync.enabled && !code) {
      return '<p class="notice">Can’t reach the sync service right now. Progress is kept on this device, and written answers wait here until it can sync. Reload the page when the internet is back.</p>';
    }
    if (!code) {
      return '<section class="p-sec"><h2>Sync</h2><p class="muted">This device isn’t connected to a family yet.</p>' +
        '<button class="btn primary" data-act="sync-create">Create a family code</button>' +
        '<form id="join2-form" class="form inline" novalidate><label class="field"><span>Or join with a code</span><input id="join2-code" class="code-input" maxlength="14" placeholder="XXXX-XXXX-XXXX"></label>' +
        '<button class="btn" type="submit">Join</button></form><p class="form-err" id="join2-err" role="alert"></p></section>';
    }
    return (args.fresh ? '<p class="notice good">All set! Next: open the link below on the student’s phone and computer, and add the family code to GitHub so answers get marked (see “Marking”).</p>' : '') +
      '<section class="p-sec"><h2>Family code</h2><p class="family-code">' + esc(code) + '</p>' +
      '<p class="muted">Open this link on every device that should share the progress (the student’s phone, computer, your phone):</p>' +
      '<div class="copy-row"><input id="join-link" class="link-input" readonly value="' + esc(joinLink(code)) + '"><button class="btn" data-act="copy-link">Copy link</button></div>' +
      '<p class="muted small">Sync: ' + esc(SQ.sync.status) + (SQ.sync.lastSync ? ' · last ' + ui.when(SQ.sync.lastSync) : '') + '</p></section>' +
      '<section class="p-sec"><h2>Marking</h2><p>Written answers are marked by a GitHub Actions job (every 10 minutes). It needs these repository secrets: ' +
      '<code>ANTHROPIC_API_KEY</code>, <code>BQ_BANK_KEY</code> and <code>BQ_FAMILY_CODES</code> = this family code. See the README, section “Business Quest”.</p></section>' +
      '<section class="p-sec"><h2>Stop syncing on this device</h2><button class="btn danger" data-act="sync-leave">Disconnect this device</button>' +
      '<p class="muted small">The data on this device stays. Other devices are not affected.</p></section>';
  }
  bind.devices = function () {
    const f = $('join2-form');
    if (!f) return;
    bindCode($('join2-code'));
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      $('join2-err').textContent = 'Checking the code…';
      SQ.sync.join($('join2-code').value).then(function (remote) {
        app.state.family.updatedAt = 0;
        app.state.children.forEach(function (c) { c.settings.updatedAt = 0; });
        app.state = SQ.storage.merge(app.state, remote);
        ui.commit();
        ui.show('parent', { tab: 'devices' });
        ui.toast('Device connected');
      }).catch(function (ex) { $('join2-err').textContent = joinError(ex); });
    });
  };
  actions['sync-create'] = function () { SQ.sync.createFamily(); ui.commit(); ui.show('parent', { tab: 'devices', fresh: true }); };
  actions['sync-leave'] = function () { SQ.sync.leave(); ui.show('parent', { tab: 'devices' }); ui.toast('Sync is off on this device'); };
  actions['copy-link'] = function () { const inp = $('join-link'); inp.select(); copy(inp.value, 'Link copied'); };

  function dataTab() {
    return '<section class="p-sec"><h2>Backup</h2>' +
      '<p class="muted">All answers, marks and settings as a JSON file. Restoring combines the backup with what is here; nothing is erased.</p>' +
      '<div class="btn-row"><button class="btn" data-act="backup-download">Download backup</button>' +
      '<label class="btn ghost">Restore from file<input type="file" id="backup-file" accept="application/json,.json" hidden></label></div>' +
      '<details><summary class="muted small">Or copy and paste the backup as text</summary>' +
      '<div class="btn-row"><button class="btn small" data-act="backup-show">Show backup</button></div>' +
      '<textarea id="backup-out" class="code-area" readonly hidden aria-label="Backup"></textarea>' +
      '<label class="field"><span>Paste a backup here</span><textarea id="backup-in" class="code-area" spellcheck="false"></textarea></label>' +
      '<button class="btn small" data-act="backup-restore">Restore from text</button></details></section>' +
      '<section class="p-sec danger-zone"><h2>Reset progress</h2><form id="reset-form" class="form inline" novalidate>' +
      '<label class="field"><span>Type RESET to delete every answer, mark and quick check on all devices</span><input id="reset-word" autocomplete="off"></label>' +
      '<button class="btn danger" type="submit">Reset progress</button></form></section>';
  }
  function restore(text) {
    try {
      const incoming = SQ.storage.parseBackup(text);
      app.state = SQ.storage.merge(app.state, incoming);
      ui.commit();
      ui.show('parent', { tab: 'progress' });
      ui.toast('Backup restored');
    } catch (e) {
      ui.toast('That isn’t a Business Quest backup');
    }
  }
  bind.data = function () {
    $('backup-file').addEventListener('change', function () {
      const f = this.files && this.files[0];
      if (!f) return;
      f.text().then(restore);
    });
    $('reset-form').addEventListener('submit', function (e) {
      e.preventDefault();
      if ($('reset-word').value.trim().toUpperCase() !== 'RESET') { ui.toast('Type the word RESET'); return; }
      const c = kid();
      c.resetAt = Date.now();
      c.attempts = [];
      c.quick = [];
      c.reveal = {};
      ui.commit();
      ui.show('parent', { tab: 'progress' });
      ui.toast('Progress reset');
    });
  };
  actions['backup-download'] = function () {
    const blob = new Blob([JSON.stringify(app.state)], { type: 'application/json' });
    const a = doc.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'business-quest-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    doc.body.appendChild(a);
    a.click();
    a.remove();
  };
  actions['backup-show'] = function () { const o = $('backup-out'); o.value = JSON.stringify(app.state); o.hidden = false; o.select(); };
  actions['backup-restore'] = function () {
    const t = $('backup-in').value.trim();
    if (!t) { ui.toast('Paste the backup text first'); return; }
    restore(t);
  };
})(typeof window !== 'undefined' ? window : globalThis);
