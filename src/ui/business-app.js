/*
 * Business Quest — the student's screens: home, subtopics, quick check, exam
 * question, saved / waiting for marking, feedback, command terms.
 * Parent screens (setup, PIN, statistics, settings) are in business-parent.js.
 *
 * Written answers are never marked here: they are saved as "pending" and the
 * marking job (marker/, run by GitHub Actions) marks them with Claude against
 * the markscheme. The mark arrives through sync. Until then the answer counts
 * nowhere and the model answer stays hidden.
 */
(function (root) {
  'use strict';
  const SQ = root.SQ, BQ = root.BQ, U = SQ.util, esc = U.escape;
  const doc = root.document;
  const QS = root.BQ_QUESTIONS || [];
  const QUICK = root.QUICK || { items: [], gens: [] };
  const BY_N = {};
  QS.forEach(function (q) { BY_N[q.n] = q; });

  const ICON = {
    tick: '<svg class="ico tick" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 13.5 9.5 19 20 5.5"/></svg>',
    cross: '<svg class="ico cross" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    half: '<svg class="ico half" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>',
    back: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    bolt: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>',
    pen: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L20 8l-4-4L4 16z"/><path d="M14 6l4 4"/></svg>',
    clock: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
    repeat: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/></svg>',
    star: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>',
    del: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h11v12H9l-6-6z"/><path d="M12.5 9.5l5 5M17.5 9.5l-5 5"/></svg>',
  };

  const app = (SQ.app = { state: null, childId: null, screen: null, session: null });
  const ui = (SQ.ui = { ICON: ICON, screens: {}, actions: {}, esc: esc });
  const screens = ui.screens, actions = ui.actions;
  let $screen, $who, $sync;

  /* ---------- helpers ---------- */

  function kid() { return app.state ? SQ.family.child(app.state, app.childId) : null; }
  ui.kid = kid;
  ui.$ = function (sel) { return doc.querySelector(sel); };
  ui.questions = QS;
  ui.byN = BY_N;
  ui.commit = function () { SQ.storage.save(app.state); SQ.sync.changed(); };
  ui.selectChild = function (id) { app.childId = id; SQ.storage.setMeta('child', id); };
  ui.touchFamily = function () { app.state.family.updatedAt = Date.now(); };
  ui.set = function (html) { $screen.innerHTML = html; };
  function set(html) { ui.set(html); }
  function pct(x) { return Math.round(x * 100) + '%'; }
  ui.pct = pct;
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  ui.plural = plural;
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function when(ts) {
    const d = new Date(ts), now = new Date();
    const hm = (d.getHours() < 10 ? '0' : '') + d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
    if (d.toDateString() === now.toDateString()) return 'Today, ' + hm;
    if (d.toDateString() === new Date(now - 864e5).toDateString()) return 'Yesterday, ' + hm;
    return d.getDate() + ' ' + MONTHS[d.getMonth()] + ', ' + hm;
  }
  ui.when = when;
  function level(p) { return p >= 0.75 ? 'good' : p >= 0.5 ? 'warn' : 'bad'; }
  ui.level = level;
  ui.meter = function (p) {
    if (p == null) return '<span class="muted small">—</span>';
    return '<span class="acc"><span class="acc-num">' + pct(p) + '</span><span class="meter ' + level(p) + '" role="img" aria-label="' + pct(p) + '"><span style="width:' + Math.max(2, Math.round(p * 100)) + '%"></span></span></span>';
  };
  function scorePill(a) {
    return '<span class="pill ' + level(BQ.ratio(a)) + ' small">' + a.mark.score + '/' + a.mark.max + '</span>';
  }
  ui.scorePill = scorePill;
  /** Status of one bank question for lists. */
  ui.statusPills = function (s) {
    if (s.pending) return '<span class="pill warn small">Waiting for marking</span>';
    if (!s.last) return '<span class="pill plain small">Not tried</span>';
    return scorePill(s.last) + (s.isDue ? ' <span class="pill plain small">Review due</span>' : '');
  };
  function shortQ(q, n) {
    const t = q.q.filter(function (l) { return l.indexOf('<table') !== 0; }).join(' ');
    return t.length > n ? t.slice(0, n - 1) + '…' : t;
  }
  ui.shortQ = shortQ;
  /** Question lines: tables come from the bank build and are trusted; all other text is escaped. */
  function qHtml(q) {
    return q.q.map(function (l) {
      if (l.indexOf('<table') === 0) return '<div class="table-wrap q-table">' + l + '</div>';
      return '<p' + (/^\([a-z]\)/.test(l) ? ' class="part"' : '') + '>' + esc(l) + '</p>';
    }).join('');
  }
  ui.qHtml = qHtml;
  function subTitle(id) { const s = BQ.SUBS.find(function (x) { return x.id === id; }); return s ? s.title : id; }
  function subsAttr(subs) { return subs && subs.length ? subs.join(',') : ''; }
  function subsArg(el) { const s = el.getAttribute('data-subs'); return s ? s.split(',') : null; }
  function attemptById(id) { const c = kid(); return c ? c.attempts.find(function (a) { return a.id === id; }) || null : null; }
  ui.attemptById = attemptById;
  function status() { return BQ.questionStatus(kid(), QS); }

  ui.toast = function (msg) {
    let box = doc.getElementById('toast');
    if (!box) {
      box = doc.createElement('div');
      box.id = 'toast';
      box.className = 'toast';
      box.setAttribute('role', 'status');
      doc.body.appendChild(box);
    }
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

  /** Re-render screens that only show data (not one being typed in). */
  const PASSIVE = ['home', 'sub', 'saved', 'review'];
  ui.refresh = function () {
    const s = app.screen;
    if (!s) return;
    if (PASSIVE.indexOf(s.name) !== -1 || (s.name === 'parent' && ['progress', 'history'].indexOf(s.args.tab || 'progress') !== -1)) {
      const y = root.scrollY;
      screens[s.name](s.args);
      try { root.scrollTo(0, y); } catch (e) { /* ignore */ }
    }
    ui.chrome();
  };

  ui.enter = function (args) {
    if (!SQ.family.isSetUp(app.state)) return ui.show('setup', args || {});
    if (!kid()) ui.selectChild(SQ.family.children(app.state)[0].id);
    ui.show('home');
  };

  ui.chrome = function () {
    if (!$who) return;
    const c = kid();
    $who.hidden = !c;
    $who.textContent = c ? c.settings.childName : '';
    const st = SQ.sync.status;
    $sync.hidden = st === 'off' || st === 'ready' || st === 'checking';
    $sync.className = 'sync-dot ' + st;
    $sync.title = st === 'ok' ? 'Synced' : st === 'syncing' ? 'Syncing…' : 'Offline: your work will sync later';
  };

  function adopt(next) {
    const before = pendingIds();
    app.state = next;
    SQ.storage.save(next);
    if (!SQ.family.isSetUp(next)) return;
    if (!kid()) { ui.selectChild(null); return ui.enter(); }
    // An answer this device is showing as "waiting" just got its mark.
    const s = app.screen;
    if (s && s.name === 'saved') {
      const a = attemptById(s.args.id);
      if (a && a.status === 'marked') return ui.show('review', { id: a.id, fresh: true });
    }
    const after = pendingIds();
    if (before.some(function (id) { return after.indexOf(id) === -1; })) ui.toast('New marks are in');
    ui.refresh();
  }
  function pendingIds() {
    const c = kid();
    return c ? c.attempts.filter(function (a) { return a.status === 'pending'; }).map(function (a) { return a.id; }) : [];
  }

  /* ---------- shell ---------- */

  function buildShell(rootEl) {
    rootEl.innerHTML =
      '<div class="app biz">' +
      '<header class="bar"><div class="bar-in">' +
      '<button class="brand" data-act="home" aria-label="Business Quest, home">' +
      '<span class="brand-mark" aria-hidden="true">B</span><span class="brand-name">Business Quest</span></button>' +
      '<div class="bar-right"><span class="sync-dot" hidden></span><span class="who" hidden></span></div>' +
      '</div></header>' +
      '<main id="screen" class="screen" tabindex="-1"></main>' +
      '<footer class="foot"><button class="link" data-act="parent">For parents</button>' +
      '<button class="link" data-act="terms">Command terms</button>' +
      '<span class="foot-note">IB Business Management · Unit 1</span></footer>' +
      '</div>';
    $screen = doc.getElementById('screen');
    $who = rootEl.querySelector('.who');
    $sync = rootEl.querySelector('.sync-dot');
  }

  screens.loading = function () {
    set('<section class="loading"><span class="spinner" aria-hidden="true"></span><p>Loading…</p></section>');
  };

  /* ---------- home ---------- */

  function waitingNotice(c, compact) {
    const pend = c.attempts.filter(function (a) { return a.status === 'pending'; });
    if (!pend.length) return '';
    return '<div class="notice wait-note"><p>' + ICON.clock + ' <b>' + plural(pend.length, 'answer is', 'answers are') + ' waiting for marking.</b>' +
      (compact ? '' : ' Marks usually arrive within about 10–20 minutes. Until then they don’t count anywhere.') + '</p></div>';
  }

  function seenMarks() { return SQ.storage.getMeta('seen') || {}; }
  function newMarks(c) {
    const seen = seenMarks(), perQ = {};
    return c.attempts.filter(function (a) { return a.status === 'marked' && !a.slim && !seen[a.id] && (a.mark.at || 0) > Date.now() - 14 * 864e5; })
      .sort(function (a, b) { return (b.mark.at || 0) - (a.mark.at || 0); })
      .filter(function (a) { if (perQ[a.n]) return false; perQ[a.n] = true; return true; }); // latest attempt per question
  }
  function markSeen(id) {
    const seen = seenMarks();
    if (seen[id]) return;
    seen[id] = 1;
    const keys = Object.keys(seen);
    if (keys.length > 400) keys.slice(0, keys.length - 400).forEach(function (k) { delete seen[k]; });
    SQ.storage.setMeta('seen', seen);
  }

  screens.home = function () {
    const c = kid();
    const st = BQ.stats(c, QS);
    const due = BQ.dueList(c, QS);
    const fresh = newMarks(c);
    let html = '<section class="hello"><p class="eyebrow">IB Business Management · Unit 1</p><h1>Hi ' + esc(c.settings.childName || 'there') + '!</h1>' +
      '<p>' + (st.practised ? st.practised + ' of ' + st.total + ' exam questions practised' + (st.average != null ? ' · average ' + pct(st.average) : '') + '.' : 'Warm up with a quick check, or try a real exam question.') + '</p></section>';
    html += waitingNotice(c);
    if (fresh.length) {
      html += '<section class="bank-card marks-card"><div class="bank-icon">' + ICON.star + '</div><div class="bank-text"><p class="eyebrow">New marks</p>' +
        '<ul class="new-marks">' + fresh.slice(0, 4).map(function (a) {
          const q = BY_N[a.n];
          return '<li><button class="link" data-act="review" data-id="' + esc(a.id) + '">Q' + a.n + ' · ' + esc(q ? q.ct : '') + '</button> ' + scorePill(a) + '</li>';
        }).join('') + '</ul></div></section>';
    }
    if (due.length) {
      html += '<section class="bank-card"><div class="bank-icon">' + ICON.repeat + '</div><div class="bank-text"><p class="eyebrow">Review due</p>' +
        '<p class="bank-mins"><b>' + plural(due.length, 'question', 'questions') + '</b> to look at again</p></div>' +
        '<button class="btn primary" data-act="write-next" data-subs="">Start review</button></section>';
    }
    html += '<section class="modes">' +
      '<div class="challenge"><div class="ch-head"><div class="ch-icon">' + ICON.bolt + '</div><div><p class="eyebrow">10 questions · marked instantly</p><h2>Quick check</h2></div></div>' +
      '<p class="rule">Key terms, sectors, Ansoff, integration, costs and short calculations. What you get wrong comes back first next time.</p>' +
      '<button class="btn big primary" data-act="quick" data-subs="">Start quick check</button></div>' +
      '<div class="challenge"><div class="ch-head"><div class="ch-icon pen">' + ICON.pen + '</div><div><p class="eyebrow">Written answer · marked against the markscheme</p><h2>Exam question</h2></div></div>' +
      '<p class="rule">One question from the question bank. Write your answer; it is marked point by point against the IB markscheme, with feedback.</p>' +
      '<button class="btn big primary" data-act="write-next" data-subs="">Answer a question</button></div></section>';
    html += '<section class="learn"><div class="sec-head"><h2>Subtopics</h2><p class="muted">Practise one part of Unit 1.</p></div><div class="topic-grid">' +
      st.bySub.map(function (s) {
        return '<button class="topic-card" data-act="sub" data-sub="' + s.id + '"><span class="t-sub">Unit ' + s.id + '</span>' +
          '<span class="t-title">' + esc(s.title) + '</span>' +
          '<span class="t-meta">' + s.done + ' of ' + s.total + ' practised' + (s.pend ? ' · ' + s.pend + ' waiting' : '') + (s.due ? ' · ' + s.due + ' to review' : '') + '</span>' +
          (s.avg != null ? ui.meter(s.avg) : '') + '</button>';
      }).join('') + '</div></section>';
    set(html);
  };

  /* ---------- subtopic ---------- */

  screens.sub = function (args) {
    const c = kid(), id = args.sub;
    const st = BQ.questionStatus(c, QS);
    const row = BQ.stats(c, QS).bySub.find(function (s) { return s.id === id; });
    const qs = QS.filter(function (q) { return q.sub === id && BQ.inScope(q, c); });
    set('<button class="back" data-act="home">' + ICON.back + 'Home</button>' +
      '<section class="topic-head"><p class="eyebrow">Subtopic ' + esc(id) + '</p><h1>' + esc(subTitle(id)) + '</h1>' +
      '<p class="muted">' + row.done + ' of ' + row.total + ' questions practised' + (row.avg != null ? ' · average ' + pct(row.avg) : '') + '</p></section>' +
      waitingNotice(c, true) +
      '<div class="actions"><button class="btn primary" data-act="quick" data-subs="' + esc(id) + '">' + ICON.bolt + 'Quick check</button>' +
      '<button class="btn primary" data-act="write-next" data-subs="' + esc(id) + '">' + ICON.pen + 'Exam question</button></div>' +
      '<section class="levels"><h2>All questions</h2><ul class="level-list q-list">' + qs.map(function (q) {
        const s = st[q.n];
        return '<li class="level-row"><div class="level-info"><span class="level-name"><span class="level-no">Q' + q.n + '</span> ' + esc(q.ct) + ' · ' + plural(q.marks, 'mark', 'marks') + (q.hl ? ' <span class="chip">HL</span>' : '') + '</span>' +
          '<span class="level-acc">' + esc(shortQ(q, 140)) + '</span><span class="q-status">' + ui.statusPills(s) + '</span></div>' +
          '<div class="row-btns">' +
          (s.pending ? '' : '<button class="btn small" data-act="write" data-n="' + q.n + '" data-subs="' + esc(id) + '">' + (s.attempts.length ? 'Try again' : 'Answer') + '</button>') +
          (s.last ? '<button class="btn small ghost" data-act="review" data-id="' + esc(s.last.id) + '">Feedback</button>' : '') +
          '</div></li>';
      }).join('') + '</ul></section>');
  };

  /* ---------- quick check ---------- */

  function startQuick(subs) {
    app.session = { kind: 'quick', subs: subs || null, list: BQ.makeQuick(kid(), QUICK, { subs: subs }), i: 0, res: [], answered: false, started: Date.now() };
    ui.show('quick');
  }

  function fmtMoney(n) {
    const neg = n < 0, v = Math.abs(n);
    return (neg ? '−' : '') + '$' + v.toLocaleString('en-US', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });
  }

  screens.quick = function () {
    const s = app.session;
    if (!s || s.kind !== 'quick' || !s.list.length) return ui.show('home');
    const it = s.list[s.i];
    const r = s.res[s.i];
    const track = s.list.map(function (_, i) {
      const x = s.res[i];
      return '<li class="' + (i === s.i && !s.answered ? 'now' : x ? (x.ok ? 'ok' : 'bad') : '') + '">' + (x ? (x.ok ? ICON.tick : ICON.cross) : '') + '</li>';
    }).join('');
    let body;
    if (it.kind === 'num') {
      body = '<form class="num-form" id="num-form" novalidate><label class="money"><span aria-hidden="true">$</span>' +
        '<input id="num" inputmode="decimal" autocomplete="off" spellcheck="false" aria-label="Your answer in dollars" placeholder="your answer"' +
        (s.answered ? ' disabled value="' + esc(r.given) + '"' : '') + '></label>' +
        (s.answered ? '' : '<button class="btn primary big" type="submit">Check</button>') + '</form>';
    } else {
      body = '<div class="choices col">' + it.opts.map(function (o, i) {
        let cls = 'btn choice';
        if (s.answered) { if (i === it.a) cls += ' right'; else if (r.given === i) cls += ' wrong'; }
        return '<button class="' + cls + '" data-act="choose" data-i="' + i + '"' + (s.answered ? ' disabled' : '') + '>' + esc(o) + '</button>';
      }).join('') + '</div>';
    }
    let fb = '';
    if (s.answered) {
      fb = '<div class="feedback' + (r.ok ? ' good' : '') + '" role="status"><div class="fb-head"><span class="fb-title">' + (r.ok ? 'Correct!' : 'Not quite') + '</span>' +
        (it.kind === 'num' && !r.ok ? '<span class="fb-ans">You wrote <s>' + esc(r.given) + '</s> · answer <b>' + fmtMoney(it.a) + '</b></span>' : '') + '</div>' +
        (it.kind === 'num'
          ? '<div class="working"><p class="working-title">Working</p><ul class="work-lines">' + it.steps.map(function (x) { return '<li><span class="note">' + x + '</span></li>'; }).join('') + '</ul></div>'
          : '<p class="fb-sub">' + esc(it.why) + '</p>') +
        '<div class="fb-actions"><button class="btn primary big" data-act="quick-next" id="next">' + (s.i === s.list.length - 1 ? 'See result' : 'Next') + '</button></div></div>';
    }
    set('<section class="quiz"><div class="quiz-top"><button class="link stop" data-act="quick-stop">Stop</button>' +
      '<span class="quiz-label">Quick check' + (s.subs ? ' · ' + esc(s.subs.join(', ')) : '') + '</span>' +
      '<span class="quiz-count">' + (s.i + 1) + '/' + s.list.length + '</span></div>' +
      '<ol class="qtrack">' + track + '</ol>' +
      '<div class="qtext-card"><p class="ask">' + (it.retry ? 'You missed this last time · ' : '') + esc(it.sub) + '</p><p class="qtext">' + esc(it.q) + '</p></div>' +
      body + fb + '</section>');
    const f = doc.getElementById('num-form');
    if (f) f.addEventListener('submit', function (e) { e.preventDefault(); answerQuick(doc.getElementById('num').value); });
    const inp = doc.getElementById('num');
    if (inp && !s.answered) inp.focus();
    const nx = doc.getElementById('next');
    if (nx) nx.focus();
  };

  function answerQuick(given) {
    const s = app.session, it = s.list[s.i];
    let ok;
    if (it.kind === 'num') {
      if (!isFinite(BQ.parseNumber(given))) { ui.toast('Type a number, for example 1,250.50'); return; }
      ok = BQ.numberOk(given, it.a);
    } else {
      ok = given === it.a;
    }
    s.res[s.i] = { k: it.id, ok: ok, given: given };
    s.answered = true;
    SQ.sound.play(ok ? 'ok' : 'bad');
    screens.quick();
  }

  function recordQuick(s) {
    const items = s.res.map(function (r, i) { return { k: r.k, ok: r.ok, q: String(s.list[i].q).slice(0, 140) }; }).filter(Boolean);
    if (!items.length) return null;
    const rec = {
      id: 'q' + U.uid(), ts: Date.now(), subs: s.subs || [], score: items.filter(function (x) { return x.ok; }).length,
      total: items.length, planned: s.list.length, secs: Math.min(3600, Math.round((Date.now() - s.started) / 1000)), items: items,
    };
    kid().quick.push(rec);
    ui.commit();
    return rec;
  }

  function finishQuick() {
    const s = app.session;
    recordQuick(s);
    app.session = null;
    const right = s.res.filter(function (r) { return r.ok; }).length;
    const wrong = s.list.map(function (x, i) { return { it: x, r: s.res[i] }; }).filter(function (x) { return x.r && !x.r.ok; });
    SQ.sound.play(right === s.list.length ? 'win' : 'set');
    set('<section class="result"><div class="stamp' + (right >= s.list.length * 0.7 ? '' : ' bad') + '">' + right + '/' + s.list.length + '</div>' +
      '<h1>' + (right === s.list.length ? 'Perfect!' : right >= 8 ? 'Great work!' : right >= 5 ? 'Good effort' : 'Keep going') + '</h1>' +
      (wrong.length ? '<div class="review"><h2>To remember</h2><ul>' + wrong.map(function (w) {
        return '<li><span class="rq">' + esc(w.it.q) + '</span><span class="ra"><b>' + (w.it.kind === 'num' ? fmtMoney(w.it.a) : esc(w.it.opts[w.it.a])) + '</b></span></li>';
      }).join('') + '</ul><p class="muted small">These come back first in your next quick check.</p></div>' : '') +
      '<div class="actions"><button class="btn primary big" data-act="quick" data-subs="' + esc(subsAttr(s.subs)) + '">Another quick check</button>' +
      '<button class="btn big" data-act="write-next" data-subs="' + esc(subsAttr(s.subs)) + '">Exam question</button>' +
      '<button class="btn big ghost" data-act="home">Home</button></div></section>');
    doc.body.dataset.screen = 'quick-result';
    app.screen = { name: 'quick-result', args: {} };
  }

  /* ---------- exam question ---------- */

  function draftKey(n) { return 'draft.' + n; }
  function getDraft(n) { const d = SQ.storage.getMeta(draftKey(n)); return d && typeof d.text === 'string' ? d.text : ''; }
  function setDraft(n, text) { SQ.storage.setMeta(draftKey(n), text ? { text: text, at: Date.now() } : null); }

  screens.write = function (args) {
    const c = kid(), q = BY_N[args.n];
    if (!q) return ui.show('home');
    const st = status()[q.n];
    if (st.pending) return ui.show('saved', { id: st.pending.id });
    const ct = BQ.ct(q.ct);
    const wr = BQ.wordRange(q);
    const n = st.attempts.length + 1;
    if (args.prefill != null && !getDraft(q.n)) setDraft(q.n, args.prefill);
    const text = getDraft(q.n);
    app.session = { kind: 'write', n: q.n, subs: args.subs || null, started: Date.now(), attempt: n };
    set('<button class="back" data-act="' + (args.subs && args.subs.length === 1 ? 'sub" data-sub="' + esc(args.subs[0]) : 'home') + '">' + ICON.back + 'Back</button>' +
      '<section class="qpaper">' +
      '<div class="q-meta"><span class="pill plain">' + esc(q.sub) + '</span><span class="pill plain">Q' + q.n + '</span>' +
      '<span class="pill plain">' + plural(q.marks, 'mark', 'marks') + '</span><span class="pill ct">' + esc(q.ct) + '</span>' +
      (q.hl ? '<span class="pill warn">HL</span>' : '') + (n > 1 ? '<span class="pill plain">Attempt ' + n + '</span>' : '') + '</div>' +
      '<div class="qbody">' + qHtml(q) + (q.any ? '<p class="muted small">Markscheme: ' + esc(q.any) + '.</p>' : '') + '</div>' +
      '<div class="ct-box"><p class="ct-name"><b>' + esc(q.ct) + '</b> <span class="muted small">AO' + ct.ao + '</span></p>' +
      '<p>' + esc(ct.what) + '</p><p class="ct-tip">' + esc(ct.tip) + '</p>' +
      '<p class="muted small">Aim for roughly ' + wr[0] + '–' + wr[1] + ' words for ' + plural(q.marks, 'mark', 'marks') + '.</p></div>' +
      '<label class="answer-box"><span class="eyebrow">Your answer</span>' +
      '<textarea id="ans" rows="' + Math.min(18, 6 + q.marks) + '" spellcheck="true" placeholder="Write your answer in full sentences…">' + esc(text) + '</textarea></label>' +
      '<div class="ans-foot"><span class="small" id="wc"></span><span class="muted small" id="saved-note"></span></div>' +
      '<div class="actions"><button class="btn primary big" data-act="submit">Submit for marking</button>' +
      '<button class="btn ghost" data-act="write-next" data-subs="' + esc(subsAttr(args.subs)) + '" data-skip="' + q.n + '">Different question</button></div>' +
      '</section>');
    const ta = doc.getElementById('ans');
    let t = null;
    const upd = function (save) {
      const w = BQ.words(ta.value);
      const wc = doc.getElementById('wc');
      if (!wc) return;
      wc.textContent = plural(w, 'word', 'words') + ' · aim for ' + wr[0] + '–' + wr[1];
      wc.className = 'small ' + (w >= wr[0] ? 'ok-count' : 'muted');
      if (save) {
        clearTimeout(t);
        t = setTimeout(function () {
          const note = doc.getElementById('saved-note');
          if (!note || !doc.body.contains(ta)) return; // already submitted or left the screen
          setDraft(q.n, ta.value);
          note.textContent = 'Draft saved';
        }, 400);
      }
    };
    ta.addEventListener('blur', function () { if (doc.body.contains(ta) && ta.value.trim()) setDraft(q.n, ta.value); });
    ta.addEventListener('input', function () { upd(true); });
    upd(false);
    if (text) doc.getElementById('saved-note').textContent = 'Draft restored';
    if (args.prefill == null) ta.focus();
  };

  function submitWritten() {
    const s = app.session, c = kid();
    if (!s || s.kind !== 'write') return;
    const q = BY_N[s.n], ta = doc.getElementById('ans');
    const text = ta.value.trim().slice(0, BQ.limits.MAX_TEXT);
    if (BQ.words(text) < 3) { ui.toast('Write a bit more first'); ta.focus(); return; }
    if (status()[q.n].pending) return ui.show('saved', { id: status()[q.n].pending.id });
    const now = Date.now();
    const rec = {
      id: 'w' + U.uid(), n: q.n, ts: now, text: text, words: BQ.words(text),
      secs: Math.min(3600 * 2, Math.round((now - s.started) / 1000)), attempt: s.attempt,
      status: 'pending', mark: null, tries: 0, lease: 0, updatedAt: now,
    };
    c.attempts.push(rec);
    setDraft(q.n, '');
    ui.commit();
    SQ.sync.flushNow();
    app.session = { kind: 'saved', subs: s.subs };
    ui.show('saved', { id: rec.id, subs: s.subs });
  }

  screens.saved = function (args) {
    const a = attemptById(args.id);
    if (!a) return ui.show('home');
    if (a.status === 'marked') return ui.show('review', { id: a.id, fresh: true });
    const c = kid();
    const offline = SQ.sync.status === 'offline' || SQ.sync.status === 'off';
    const problem = c.marker && c.marker.lastError && /not set up/.test(c.marker.lastError);
    set('<section class="result"><div class="stamp wait" aria-hidden="true">' + ICON.clock + '</div>' +
      '<h1>Saved — waiting for marking</h1>' +
      '<p class="lead">Your answer to Q' + a.n + ' (' + plural(a.words, 'word', 'words') + ') is saved. ' +
      (offline ? 'This device is offline right now; it will send the answer when it is back online. '
        : problem ? 'Marking isn’t switched on yet, so it will be marked as soon as it is. '
          : 'It is marked against the markscheme, usually within about 10–20 minutes. ') +
      'Your score, feedback and the model answer appear here and on the home page once it is marked.</p>' +
      '<p class="muted small">Until then this answer doesn’t count in your scores, and this question won’t come up again.</p>' +
      '<details class="ms"><summary>Your answer</summary><p class="yours">' + esc(a.text).replace(/\n/g, '<br>') + '</p></details>' +
      '<div class="actions"><button class="btn primary big" data-act="write-next" data-subs="' + esc(subsAttr(args.subs)) + '">Next question</button>' +
      '<button class="btn big" data-act="quick" data-subs="' + esc(subsAttr(args.subs)) + '">Quick check</button>' +
      '<button class="btn big ghost" data-act="home">Home</button></div></section>');
  };

  /* ---------- feedback ---------- */

  function headline(p) { return p >= 0.9 ? 'Excellent!' : p >= 0.7 ? 'Good answer' : p >= 0.4 ? 'Getting there' : 'Let’s fix this'; }

  screens.review = function (args) {
    const c = kid(), a = attemptById(args.id);
    if (!a) return ui.show('home');
    const q = BY_N[a.n];
    if (a.status !== 'marked') {
      if (args.from === 'parent') return screens.pendingView(args);
      return ui.show('saved', { id: a.id });
    }
    if (args.from !== 'parent') markSeen(a.id);
    const m = a.mark, p = BQ.ratio(a);
    const st = status()[a.n];
    const others = st.marked.filter(function (x) { return x.id !== a.id; });
    const best = st.best && st.best.id !== a.id && BQ.ratio(st.best) > p ? st.best : null;
    const rv = c.reveal[String(a.n)];
    const ic = { hit: ICON.tick, partial: ICON.half, miss: ICON.cross };
    const back = args.from === 'parent'
      ? '<button class="back" data-act="parent-tab" data-tab="history">' + ICON.back + 'History</button>'
      : '<button class="back" data-act="sub" data-sub="' + esc(q.sub) + '">' + ICON.back + esc(q.sub + ' ' + subTitle(q.sub)) + '</button>';
    set(back +
      '<section class="mark-head"><div class="stamp' + (p >= 0.5 ? '' : ' bad') + '">' + m.score + '/' + m.max + '</div><div class="mark-title">' +
      '<p class="eyebrow">Q' + a.n + ' · ' + esc(q.ct) + ' · ' + when(a.ts) + (a.attempt > 1 ? ' · attempt ' + a.attempt : '') + '</p>' +
      '<h1>' + headline(p) + '</h1>' +
      (m.band ? '<p class="band">Markband <b>' + esc(m.band) + '</b></p>' : '') +
      (best ? '<p class="muted small">Your best: <button class="link" data-act="review" data-id="' + esc(best.id) + '" data-from="' + esc(args.from || '') + '">' + best.mark.score + '/' + best.mark.max + '</button></p>' : '') +
      '</div></section>' +
      (a.slim ? '<p class="notice">Only the score of this older attempt is kept.</p>' : '') +
      (m.flags.indexOf('too_short') !== -1 ? '<p class="notice">The answer was very short for ' + plural(m.max, 'mark', 'marks') + ', so the score was capped. Aim for at least ' + BQ.wordRange(q)[0] + ' words.</p>' : '') +
      (m.flags.indexOf('instructions_in_answer') !== -1 ? '<p class="notice">Only the business content of the answer was marked: notes to the marker are ignored.</p>' : '') +
      '<details class="qrecap"><summary>Question</summary><div class="qbody">' + qHtml(q) + '</div></details>' +
      (m.points.length ? '<section class="p-sec"><h2>Markscheme points</h2><ul class="pts">' + m.points.map(function (x) {
        return '<li class="' + esc(x.status) + '"><span class="pt-ic" aria-label="' + esc(x.status) + '">' + (ic[x.status] || ICON.cross) + '</span><span><b>' + esc(x.point) + '</b>' +
          (x.note ? '<span class="pt-note">' + esc(x.note) + '</span>' : '') + '</span></li>';
      }).join('') + '</ul></section>' : '') +
      (a.slim ? '' : '<section class="checks"><div class="check-card ' + (m.command_term.met ? 'ok' : 'no') + '"><p class="eyebrow">Command term: ' + esc(q.ct) + '</p><p>' + (m.command_term.met ? ICON.tick : ICON.cross) + ' ' + esc(m.command_term.comment || (m.command_term.met ? 'You did what “' + q.ct + '” asks.' : 'Check what “' + q.ct + '” asks for.')) + '</p></div>' +
        (m.application.needed ? '<div class="check-card ' + (m.application.met ? 'ok' : 'no') + '"><p class="eyebrow">Using the case</p><p>' + (m.application.met ? ICON.tick : ICON.cross) + ' ' + esc(m.application.comment || (m.application.met ? 'You used the case.' : 'Use details from the case.')) + '</p></div>' : '') + '</section>') +
      (m.strengths.length ? '<section class="p-sec"><h2>What went well</h2><ul class="plain-list">' + m.strengths.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></section>' : '') +
      (m.improve.length || m.better_sentence ? '<section class="p-sec"><h2>To get more marks</h2>' +
        (m.improve.length ? '<ol class="plain-list">' + m.improve.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol>' : '') +
        (m.better_sentence ? '<div class="red-pen"><p class="eyebrow">A better sentence</p><p class="pen-note">' + esc(m.better_sentence) + '</p></div>' : '') + '</section>' : '') +
      (a.text ? '<details class="ms"><summary>' + (args.from === 'parent' ? 'The answer' : 'Your answer') + ' (' + plural(a.words, 'word', 'words') + ')</summary><p class="yours">' + esc(a.text).replace(/\n/g, '<br>') + '</p></details>' : '') +
      (rv ? '<details class="ms"><summary>Model answer from the markscheme</summary><p>' + esc(rv.ms) + '</p>' +
        (rv.notes && rv.notes.length ? '<p class="muted small">' + esc(rv.notes.join(' ')) + '</p>' : '') + '</details>' : '') +
      (others.length ? '<p class="muted small other-attempts">Other attempts: ' + others.map(function (x) {
        return '<button class="link" data-act="review" data-id="' + esc(x.id) + '" data-from="' + esc(args.from || '') + '">' + x.mark.score + '/' + x.mark.max + ' · ' + when(x.ts) + '</button>';
      }).join(' ') + '</p>' : '') +
      (args.from === 'parent' ? '' : '<div class="actions">' +
        (p < 1 && !st.pending && !a.slim ? '<button class="btn primary big" data-act="rewrite" data-id="' + esc(a.id) + '">Improve and resubmit</button>' : '') +
        (st.pending ? '<span class="pill warn">Attempt ' + st.pending.attempt + ' is waiting for marking</span>' : '') +
        '<button class="btn big' + (p < 1 ? '' : ' primary') + '" data-act="write-next" data-subs="">Next question</button></div>'));
  };

  /** A parent opening an answer that is still waiting. */
  screens.pendingView = function (args) {
    const a = attemptById(args.id), q = BY_N[a.n];
    set('<button class="back" data-act="parent-tab" data-tab="history">' + ICON.back + 'History</button>' +
      '<section class="mark-head"><div class="stamp wait" aria-hidden="true">' + ICON.clock + '</div><div class="mark-title">' +
      '<p class="eyebrow">Q' + a.n + ' · ' + esc(q.ct) + ' · ' + when(a.ts) + (a.attempt > 1 ? ' · attempt ' + a.attempt : '') + '</p>' +
      '<h1>Waiting for marking</h1>' + (a.tries ? '<p class="muted small">Marking failed ' + plural(a.tries, 'time', 'times') + ' so far.</p>' : '') + '</div></section>' +
      '<details class="qrecap" open><summary>Question</summary><div class="qbody">' + qHtml(q) + '</div></details>' +
      '<section class="p-sec"><h2>The answer (' + plural(a.words, 'word', 'words') + ')</h2><p class="yours">' + esc(a.text).replace(/\n/g, '<br>') + '</p></section>');
  };

  /* ---------- command terms ---------- */

  screens.terms = function () {
    set('<button class="back" data-act="home">' + ICON.back + 'Home</button>' +
      '<section class="topic-head"><p class="eyebrow">How to answer</p><h1>Command terms</h1>' +
      '<p class="lead">The first word of the question says how deep to go. The marking checks it too.</p></section>' +
      '<div class="table-wrap"><table class="facts terms"><tbody>' + Object.keys(BQ.CT).map(function (k) {
        const t = BQ.CT[k];
        return '<tr><th>' + esc(k) + '<span class="muted small">AO' + t.ao + '</span></th><td>' + esc(t.what) + '<span class="ct-tip">' + esc(t.tip) + '</span></td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<section class="lesson-sec"><h2>10-mark questions: markbands</h2>' +
      '<p>Examiners first choose the band that fits the whole answer, then the mark inside it.</p>' +
      '<div class="table-wrap"><table class="stats bands"><thead><tr><th>Marks</th><th>What the answer looks like</th></tr></thead><tbody>' +
      BQ.MARKBANDS.map(function (b) { return '<tr><td class="num">' + esc(b.band) + '</td><td>' + esc(b.text) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      '<p class="example">Plan: define the key terms → arguments for, applied to the case → arguments against → “it depends on…” → a conclusion that answers the question.</p>' +
      '<p class="muted small">One-sided answers stay at 5–6 at most; without a conclusion or judgement, 7–8 at most.</p></section>');
  };

  /* ---------- actions ---------- */

  actions.home = function () { app.session = null; ui.show('home'); };
  actions.terms = function () { app.session = null; ui.show('terms'); };
  actions.sub = function (el) { app.session = null; ui.show('sub', { sub: el.dataset.sub }); };
  actions.quick = function (el) { startQuick(subsArg(el)); };
  actions.choose = function (el) { const s = app.session; if (s && s.kind === 'quick' && !s.answered) answerQuick(Number(el.dataset.i)); };
  actions['quick-next'] = function () {
    const s = app.session;
    if (!s || s.kind !== 'quick') return ui.show('home');
    if (s.i >= s.list.length - 1) return finishQuick();
    s.i++;
    s.answered = false;
    screens.quick();
    try { root.scrollTo(0, 0); } catch (e) { /* ignore */ }
  };
  actions['quick-stop'] = function () {
    const s = app.session;
    if (s && s.kind === 'quick') recordQuick(s); // what was answered still counts, mistakes come back
    app.session = null;
    ui.show('home');
  };
  actions.write = function (el) { ui.show('write', { n: Number(el.dataset.n), subs: subsArg(el) }); };
  actions['write-next'] = function (el) {
    const subs = subsArg(el);
    const skip = Number(el.dataset.skip) || null;
    let n = BQ.nextQuestion(kid(), QS, { subs: subs, skip: skip });
    if (!n && skip) n = BQ.nextQuestion(kid(), QS, { subs: subs });
    if (!n) { ui.toast('Every question here is waiting for marking'); return; }
    ui.show('write', { n: n, subs: subs });
  };
  actions.submit = function () { submitWritten(); };
  actions.review = function (el) { ui.show('review', { id: el.dataset.id, from: el.dataset.from || undefined }); };
  actions.rewrite = function (el) {
    const a = attemptById(el.dataset.id);
    if (!a) return;
    setDraft(a.n, '');
    ui.show('write', { n: a.n, prefill: a.text });
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
    const s = app.session;
    if (!s || s.kind !== 'quick' || !app.screen || app.screen.name !== 'quick') return;
    if (e.key === 'Enter' && s.answered) {
      const b = doc.getElementById('next');
      if (b && doc.activeElement !== b) { e.preventDefault(); b.click(); }
    } else if (!s.answered && /^[1-9]$/.test(e.key) && s.list[s.i].kind === 'choice' && doc.activeElement.tagName !== 'INPUT') {
      const i = Number(e.key) - 1;
      if (i < s.list[s.i].opts.length) { e.preventDefault(); answerQuick(i); }
    }
  }

  function joinCodeFromHash() {
    const m = /^#join-([0-9A-Za-z-]{12,20})$/.exec(root.location.hash || '');
    if (!m) return null;
    try { root.history.replaceState(null, '', root.location.pathname + root.location.search); } catch (e) { /* ignore */ }
    return SQ.sync.normaliseCode(m[1]);
  }

  function hasPending() { return pendingIds().length > 0; }
  function busy() { return app.screen && (app.screen.name === 'write' || app.screen.name === 'quick'); }

  app.boot = function (rootEl) {
    buildShell(rootEl);
    app.state = SQ.storage.load();
    app.childId = SQ.storage.getMeta('child');
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
    // New marks arrive through sync: check often while answers are waiting.
    let last = Date.now();
    setInterval(function () {
      if (doc.visibilityState !== 'visible' || !SQ.sync.family || busy()) return;
      const every = hasPending() ? (BQ.config && BQ.config.pollPendingMs) || 30000 : 45000;
      if (Date.now() - last < every) return;
      last = Date.now();
      SQ.sync.pull();
    }, 5000);
    doc.addEventListener('visibilitychange', function () {
      if (doc.visibilityState === 'hidden') SQ.sync.flushNow();
      else if (SQ.sync.family && !busy()) { last = Date.now(); SQ.sync.pull(); }
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
