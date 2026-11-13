/*
 * Business Quest — the rules, as plain functions (no screen code), so tests
 * can check them: answer checking, word counts, spaced repetition, choosing
 * the next question, building a quick check and the statistics.
 *
 * Only marked attempts count. A pending attempt (waiting for marking) is never
 * in a score, an average, the review schedule or "needs work", and its
 * question is not offered again until it is marked.
 */
(function (root) {
  'use strict';
  const BQ = (root.BQ = root.BQ || {});
  const DAY = 864e5;
  BQ.DAY = DAY;

  /* ---------- small helpers ---------- */

  BQ.words = function (t) { const m = String(t || '').trim().match(/\S+/g); return m ? m.length : 0; };

  /** Rough length to aim for: AO1/AO2 marks×12…30 words; AO3 or 6+ marks: marks×30…60. */
  BQ.wordRange = function (q) {
    const deep = q.ao === 3 || q.marks >= 6;
    const r = function (x) { return Math.max(10, Math.round(x / 10) * 10); };
    return deep ? [r(q.marks * 30), r(q.marks * 60)] : [r(q.marks * 12), r(q.marks * 30)];
  };

  /** "$1,234.50", "−12", " 3 400 " -> number; NaN if it isn't one. */
  BQ.parseNumber = function (s) {
    const t = String(s == null ? '' : s).trim()
      .replace(/[−–‒—]/g, '-')  // − – ‒ — typed as minus
      .replace(/\s+/g, '')
      .replace(/^(-?)\$/, '$1').replace(/^\$(-)/, '$1')
      .replace(/,(?=\d{3}(\D|$))/g, '');
    if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(t)) return NaN;
    return parseFloat(t);
  };
  BQ.TOLERANCE = 0.006;
  BQ.numberOk = function (given, answer) {
    const v = typeof given === 'number' ? given : BQ.parseNumber(given);
    return isFinite(v) && Math.abs(v - answer) <= BQ.TOLERANCE + 1e-9;
  };

  BQ.ratio = function (a) { return a && a.mark && a.mark.max ? a.mark.score / a.mark.max : 0; };

  /* ---------- spaced repetition ---------- */

  /**
   * Days until the next review, from the marked attempts of one question in
   * time order: last result <50% -> 1 day, <80% -> 3 days, >=80% -> 7×2^(k−1)
   * days where k is the run of results >=80% at the end, at most 60.
   */
  BQ.reviewDays = function (marked) {
    if (!marked.length) return null;
    const p = BQ.ratio(marked[marked.length - 1]);
    if (p < 0.5) return 1;
    if (p < 0.8) return 3;
    let k = 0;
    for (let i = marked.length - 1; i >= 0 && BQ.ratio(marked[i]) >= 0.8; i--) k++;
    return Math.min(60, 7 * Math.pow(2, k - 1));
  };

  /** In scope for this student (HL questions only when HL is on). */
  BQ.inScope = function (q, child) { return !q.hl || !child || child.settings.hl !== false; };

  /**
   * Per question: { n, attempts, marked, pending, last, best, due, isDue }.
   * last = latest marked attempt (used for statistics), best = highest score.
   */
  BQ.questionStatus = function (child, questions, now) {
    now = now || Date.now();
    const st = {};
    questions.forEach(function (q) { st[q.n] = { n: q.n, q: q, attempts: [], marked: [], pending: null, last: null, best: null, due: null, isDue: false }; });
    (child ? child.attempts : []).slice().sort(function (a, b) { return a.ts - b.ts; }).forEach(function (a) {
      const s = st[a.n];
      if (!s) return;
      s.attempts.push(a);
      if (a.status === 'pending') s.pending = a;
      else if (a.status === 'marked' && a.mark) s.marked.push(a);
    });
    Object.keys(st).forEach(function (k) {
      const s = st[k];
      if (!s.marked.length) return;
      s.last = s.marked[s.marked.length - 1];
      s.best = s.marked.reduce(function (b, a) { return !b || BQ.ratio(a) > BQ.ratio(b) ? a : b; }, null);
      s.due = (s.last.mark.at || s.last.ts) + BQ.reviewDays(s.marked) * DAY;
      s.isDue = !s.pending && s.due <= now;
    });
    return st;
  };

  function inSubs(q, subs) { return !subs || !subs.length || subs.indexOf(q.sub) !== -1; }

  /** Questions due for review, worst result first. */
  BQ.dueList = function (child, questions, subs, now) {
    const st = BQ.questionStatus(child, questions, now);
    return questions.filter(function (q) { return BQ.inScope(q, child) && inSubs(q, subs) && st[q.n].isDue; })
      .map(function (q) { return st[q.n]; })
      .sort(function (a, b) { return BQ.ratio(a.last) - BQ.ratio(b.last) || a.due - b.due; });
  };

  /**
   * The next exam question: overdue reviews first (worst first), then ones not
   * tried yet, then the ones practised longest ago. Never a pending one.
   * opts: { subs, skip, now, rand }
   */
  BQ.nextQuestion = function (child, questions, opts) {
    opts = opts || {};
    const rand = opts.rand || Math.random;
    const st = BQ.questionStatus(child, questions, opts.now);
    const pool = questions.filter(function (q) {
      return BQ.inScope(q, child) && inSubs(q, opts.subs) && !st[q.n].pending && q.n !== opts.skip;
    });
    const due = pool.filter(function (q) { return st[q.n].isDue; })
      .sort(function (a, b) { return BQ.ratio(st[a.n].last) - BQ.ratio(st[b.n].last) || st[a.n].due - st[b.n].due; });
    if (due.length) return due[0].n;
    const fresh = pool.filter(function (q) { return !st[q.n].attempts.length; });
    if (fresh.length) return fresh[Math.floor(rand() * fresh.length)].n;
    const old = pool.slice().sort(function (a, b) {
      const la = st[a.n].attempts, lb = st[b.n].attempts;
      return (la.length ? la[la.length - 1].ts : 0) - (lb.length ? lb[lb.length - 1].ts : 0);
    });
    return old.length ? old[0].n : null;
  };

  /* ---------- quick check ---------- */

  /** Item ids whose most recent answer was wrong. */
  BQ.quickMissed = function (child, items) {
    const known = {}, last = {};
    items.forEach(function (it) { known[it.id] = true; });
    (child ? child.quick : []).slice().sort(function (a, b) { return a.ts - b.ts; }).forEach(function (set) {
      (set.items || []).forEach(function (it) { if (known[it.k]) last[it.k] = !!it.ok; });
    });
    return Object.keys(last).filter(function (k) { return last[k] === false; });
  };

  function shuffle(a, rand) {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  BQ.shuffle = shuffle;

  /**
   * A quick check of up to 10 tasks: up to 3 missed last time (first), about 3
   * generated calculations, the rest auto-marked items. opts: { subs, size, rand }
   * -> [{ id, sub, kind: 'choice'|'num', q, opts?, a, why?, steps?, retry? }]
   */
  BQ.makeQuick = function (child, QUICK, opts) {
    opts = opts || {};
    const rand = opts.rand || Math.random, size = opts.size || 10;
    const hl = !child || child.settings.hl !== false;
    const ok = function (x) { return inSubs(x, opts.subs) && (hl || !x.hl); };
    const byId = {};
    QUICK.items.forEach(function (it) { byId[it.id] = it; });
    const missed = shuffle(BQ.quickMissed(child, QUICK.items).map(function (k) { return byId[k]; }).filter(function (x) { return x && ok(x); }), rand).slice(0, 3);
    const out = missed.map(function (x) { return Object.assign({ retry: true }, x); });
    const taken = {};
    missed.forEach(function (x) { taken[x.id] = true; });

    const gens = QUICK.gens.filter(ok);
    const rest = [];
    const nGen = gens.length ? Math.min(3, size - out.length) : 0;
    for (let i = 0; i < nGen; i++) {
      const g = gens[(i + Math.floor(rand() * gens.length)) % gens.length];
      const made = g.make();
      rest.push({ id: g.id, sub: g.sub, kind: 'num', q: made.q, a: made.a, steps: made.steps, unit: made.unit || '$' });
    }
    // Several "Which sector?" style items from one group in a row get dull: at most 2 per group.
    const fam = {};
    shuffle(QUICK.items.filter(function (x) { return ok(x) && !taken[x.id]; }), rand).forEach(function (x) {
      if (out.length + rest.length >= size) return;
      const f = /^c/.test(x.id) ? x.id.replace(/[a-z]$/, '') : x.id;
      if ((fam[f] || 0) >= 2) return;
      fam[f] = (fam[f] || 0) + 1;
      rest.push(x);
    });
    return out.concat(shuffle(rest, rand)).slice(0, size);
  };

  /* ---------- statistics (marked attempts only) ---------- */

  function agg() { return { got: 0, max: 0, n: 0 }; }
  function add(m, a) { m.got += a.mark.score; m.max += a.mark.max; m.n++; }
  function avg(m) { return m.max ? m.got / m.max : null; }

  /**
   * Everything the progress screens show.
   * { practised, total, written, average, quickAcc, quickSets, weekDays, weekMinutes,
   *   pending: [attempt], bySub: [{id,title,total,done,pend,avg}], byCt: [{ct,ao,n,avg}],
   *   byAo: [{ao,n,avg}], needsWork: [status], status }
   */
  BQ.stats = function (child, questions, now) {
    now = now || Date.now();
    const st = BQ.questionStatus(child, questions, now);
    const scoped = questions.filter(function (q) { return BQ.inScope(q, child); });
    const all = agg(), sub = {}, ct = {}, ao = {};
    let practised = 0;
    scoped.forEach(function (q) {
      const s = st[q.n];
      if (!s.last) return;
      practised++;
      add(all, s.last);
      add(sub[q.sub] = sub[q.sub] || agg(), s.last);
      add(ct[q.ct] = ct[q.ct] || agg(), s.last);
      add(ao[q.ao] = ao[q.ao] || agg(), s.last);
    });
    const items = [];
    const quick = child ? child.quick : [];
    quick.slice(-20).forEach(function (set) { (set.items || []).forEach(function (it) { items.push(!!it.ok); }); });
    const week = now - 7 * DAY, days = {};
    let secs = 0;
    const attempts = child ? child.attempts : [];
    attempts.concat(quick).forEach(function (r) {
      if ((r.ts || 0) < week) return;
      const d = new Date(r.ts);
      days[d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate()] = 1;
      secs += Math.min(r.secs || 0, 3600);
    });
    const needs = scoped.map(function (q) { return st[q.n]; })
      .filter(function (s) { return s.last && BQ.ratio(s.last) < 0.75; })
      .sort(function (a, b) { return BQ.ratio(a.last) - BQ.ratio(b.last) || b.last.ts - a.last.ts; })
      .slice(0, 8);
    const ctOrder = Object.keys(BQ.CT || {});
    return {
      status: st,
      practised: practised,
      total: scoped.length,
      written: attempts.length,
      average: avg(all),
      quickAcc: items.length ? items.filter(Boolean).length / items.length : null,
      quickSets: quick.length,
      weekDays: Object.keys(days).length,
      weekMinutes: Math.round(secs / 60),
      pending: attempts.filter(function (a) { return a.status === 'pending'; }).sort(function (a, b) { return a.ts - b.ts; }),
      bySub: (BQ.SUBS || []).map(function (s) {
        const qs = scoped.filter(function (q) { return q.sub === s.id; });
        return {
          id: s.id, title: s.title, total: qs.length,
          done: qs.filter(function (q) { return st[q.n].last; }).length,
          pend: qs.filter(function (q) { return st[q.n].pending; }).length,
          due: qs.filter(function (q) { return st[q.n].isDue; }).length,
          avg: sub[s.id] ? avg(sub[s.id]) : null,
        };
      }),
      byCt: Object.keys(ct).sort(function (a, b) { return ctOrder.indexOf(a) - ctOrder.indexOf(b); })
        .map(function (k) { return { ct: k, ao: (BQ.CT[k] || {}).ao, n: ct[k].n, avg: avg(ct[k]) }; }),
      byAo: Object.keys(ao).sort().map(function (k) { return { ao: Number(k), n: ao[k].n, avg: avg(ao[k]) }; }),
      needsWork: needs,
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
