/*
 * Business Quest — what is stored for the student, and how two copies merge.
 *
 * Plugs into the shared storage (src/core/storage.js) through SQ.model, so the
 * family layer (parent PIN, children list, sync) is the same as Study Quest's,
 * but there are no rewards, timers or limits.
 *
 *   child = {
 *     id, createdAt, deletedAt, resetAt,
 *     settings: { childName, childPinHash, hl, sound, updatedAt },
 *     attempts: [attempt],   // written answers to bank questions, every attempt kept
 *     quick:    [set],       // finished quick checks
 *     reveal:   { n: { ms, notes, at } },   // model answers, filled in by the marker
 *     marker:   { day, calls, lastRun, lastError, updatedAt }   // written by the marker
 *   }
 *   attempt = { id, n, ts, text, words, secs, attempt, status, mark, tries, lease, updatedAt, slim }
 *     status 'pending' -> waiting for marking (never counted anywhere)
 *            'marked'  -> mark = { score, max, band, points, command_term, application,
 *                                   strengths, improve, better_sentence, flags, model, at }
 *   set = { id, ts, subs, score, total, secs, items: [{ k, ok, q }] }
 *
 * Merging (every device and the marker merge, nobody overwrites):
 *   attempts, quick -> joined by id. For the same attempt a marked copy always
 *                      beats a pending one; otherwise the newer updatedAt wins.
 *   reveal          -> joined by question number.
 *   settings, marker-> the newer updatedAt wins.
 *
 * Firestore keeps one document per family under 900 kB, so when attempts grow
 * past BUDGET the oldest ones that are not the latest, best or pending attempt
 * of their question keep only their score ("slim"). Every device does the
 * same, so all copies agree.
 */
(function (root) {
  'use strict';
  const SQ = root.SQ, BQ = (root.BQ = root.BQ || {});

  const MAX_TEXT = 12000;     // characters in one answer
  const MAX_QUICK = 300;      // quick-check sets kept
  const BUDGET = 600000;      // characters of attempts before old ones are slimmed

  function num(x) { return Number(x) || 0; }
  function str(x, n) { return String(x == null ? '' : x).slice(0, n); }

  function blankChild(name, id) {
    const now = Date.now();
    return {
      id: id || 'c' + SQ.util.uid(),
      createdAt: now,
      deletedAt: 0,
      resetAt: 0,
      settings: { childName: name || '', childPinHash: null, hl: true, sound: true, updatedAt: now },
      attempts: [],
      quick: [],
      reveal: {},
      marker: { day: '', calls: 0, lastRun: 0, lastError: '', updatedAt: 0 },
    };
  }

  function normAttempt(a) {
    if (!a || !a.id || !num(a.n)) return null;
    const out = {
      id: String(a.id), n: num(a.n), ts: num(a.ts), text: str(a.text, MAX_TEXT), words: num(a.words),
      secs: num(a.secs), attempt: num(a.attempt) || 1,
      status: a.status === 'marked' && a.mark ? 'marked' : 'pending',
      mark: a.status === 'marked' && a.mark ? a.mark : null,
      tries: num(a.tries), lease: num(a.lease), updatedAt: num(a.updatedAt) || num(a.ts),
    };
    if (a.slim) out.slim = true;
    return out;
  }

  function normaliseChild(raw) {
    const c = blankChild('', raw && raw.id);
    c.createdAt = 0;
    c.settings.updatedAt = 0;
    if (!raw || typeof raw !== 'object') return c;
    c.id = String(raw.id || c.id);
    c.createdAt = num(raw.createdAt);
    c.deletedAt = num(raw.deletedAt);
    c.resetAt = num(raw.resetAt);
    const s = raw.settings || {};
    c.settings = {
      childName: str(s.childName, 30),
      childPinHash: s.childPinHash || null,
      hl: s.hl !== false,
      sound: s.sound !== false,
      updatedAt: num(s.updatedAt),
    };
    c.attempts = (Array.isArray(raw.attempts) ? raw.attempts : []).map(normAttempt).filter(Boolean);
    c.quick = (Array.isArray(raw.quick) ? raw.quick : []).filter(function (q) { return q && q.id; });
    c.reveal = {};
    if (raw.reveal && typeof raw.reveal === 'object') {
      Object.keys(raw.reveal).forEach(function (k) { if (raw.reveal[k] && raw.reveal[k].ms) c.reveal[k] = raw.reveal[k]; });
    }
    const m = raw.marker || {};
    c.marker = { day: str(m.day, 10), calls: num(m.calls), lastRun: num(m.lastRun), lastError: str(m.lastError, 300), updatedAt: num(m.updatedAt) };
    dropBeforeReset(c);
    return c;
  }

  function dropBeforeReset(c) {
    if (!c.resetAt) return;
    c.attempts = c.attempts.filter(function (a) { return a.ts >= c.resetAt; });
    c.quick = c.quick.filter(function (q) { return (q.ts || 0) >= c.resetAt; });
    const keep = {};
    c.attempts.forEach(function (a) { if (a.status === 'marked') keep[a.n] = true; });
    Object.keys(c.reveal).forEach(function (k) { if (!keep[k]) delete c.reveal[k]; });
  }

  /** Which of two copies of the same attempt to keep. */
  function pickAttempt(a, b) {
    if (a.status !== b.status) return a.status === 'marked' ? a : b;
    if (a.status === 'marked' && a.slim !== b.slim) return a.slim ? b : a; // fuller copy; trim decides again
    return (b.updatedAt || 0) > (a.updatedAt || 0) ? b : a;
  }

  function byTs(x, y) { return (x.ts || 0) - (y.ts || 0) || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0); }

  function mergeChild(a, b) {
    const out = {
      id: a.id,
      createdAt: Math.min(a.createdAt || Infinity, b.createdAt || Infinity),
      deletedAt: Math.max(a.deletedAt || 0, b.deletedAt || 0),
      resetAt: Math.max(a.resetAt || 0, b.resetAt || 0),
    };
    if (!isFinite(out.createdAt)) out.createdAt = 0;
    out.settings = (b.settings.updatedAt || 0) > (a.settings.updatedAt || 0) ? b.settings : a.settings;
    out.marker = (b.marker.updatedAt || 0) > (a.marker.updatedAt || 0) ? b.marker : a.marker;

    const at = {};
    a.attempts.concat(b.attempts).forEach(function (x) { at[x.id] = at[x.id] ? pickAttempt(at[x.id], x) : x; });
    out.attempts = Object.keys(at).map(function (k) { return at[k]; }).sort(byTs);

    const qk = {};
    a.quick.concat(b.quick).forEach(function (x) { qk[x.id] = qk[x.id] || x; });
    out.quick = Object.keys(qk).map(function (k) { return qk[k]; }).sort(byTs);

    out.reveal = Object.assign({}, a.reveal, b.reveal);
    dropBeforeReset(out);
    return trimChild(out);
  }

  function ratio(a) { return a.mark && a.mark.max ? a.mark.score / a.mark.max : 0; }

  /** Keep the stored copy small enough for one Firestore document. */
  function trimChild(c) {
    if (c.quick.length > MAX_QUICK) c.quick = c.quick.slice(-MAX_QUICK);
    let size = JSON.stringify(c.attempts).length;
    if (size <= BUDGET) return c;
    // Protected: pending attempts, and the latest and best marked attempt of each question.
    const keep = {}, latest = {}, best = {};
    c.attempts.forEach(function (a) {
      if (a.status === 'pending') { keep[a.id] = true; return; }
      latest[a.n] = a;
      if (!best[a.n] || ratio(a) > ratio(best[a.n])) best[a.n] = a;
    });
    Object.keys(latest).forEach(function (n) { keep[latest[n].id] = true; keep[best[n].id] = true; });
    const candidates = c.attempts.filter(function (a) { return !keep[a.id] && !a.slim; }); // oldest first
    for (let i = 0; i < candidates.length && size > BUDGET; i++) {
      const a = candidates[i];
      const before = JSON.stringify(a).length;
      a.text = '';
      a.slim = true;
      a.mark = { score: a.mark.score, max: a.mark.max, band: a.mark.band || null, points: [], command_term: { met: false, comment: '' },
        application: { needed: false, met: false, comment: '' }, strengths: [], improve: [], better_sentence: '', flags: (a.mark.flags || []).slice(0, 3), model: a.mark.model || '', at: a.mark.at || 0 };
      size -= before - JSON.stringify(a).length;
    }
    return c;
  }

  BQ.model = { blankChild: blankChild, normaliseChild: normaliseChild, mergeChild: mergeChild, trimChild: trimChild };
  BQ.limits = { MAX_TEXT: MAX_TEXT, MAX_QUICK: MAX_QUICK, BUDGET: BUDGET };
  SQ.model = BQ.model;
})(typeof window !== 'undefined' ? window : globalThis);
