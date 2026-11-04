/*
 * Study Quest — question engine: building sets, checking answers, rules
 * for streaks and rewards. No DOM code here, so it can be tested in Node.
 *
 * A topic's generate(level) returns a question:
 * {
 *   ask:    'Work out',                 // short instruction above the question
 *   prompt: '(−6) × 4 = [[?]]',         // HTML; [[?]] marks where the answer box goes
 *   text:   '(−6) × 4 = ?',             // plain text for history (and tests)
 *   answer: -24,                        // number | string | choice index
 *   input:  'integer',                  // 'integer' | 'number' | 'fraction' | 'text' | 'choice' (defaults to topic.input)
 *                                       // fraction answers are strings like '3/4', '7/4', '−2' (simplest form);
 *                                       // wantForm: 'mixed' | 'improper' asks for that way of writing it
 *   choices: ['a', 'b'],                // for 'choice'
 *   accept: ['colour', 'color'],        // extra accepted answers for 'text'
 *   steps:  ['HTML', ...],              // worked solution shown after a mistake
 *   key:    '...'                       // optional; used to avoid repeats in a set (defaults to text)
 * }
 */
(function (root) {
  'use strict';
  const SQ = root.SQ;
  const U = SQ.util;

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  const E = (SQ.engine = {});

  /** Local date key, e.g. 2026-11-03. */
  E.dayKey = function (d) {
    d = d ? new Date(d) : new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  };

  /** Turn a parent's assignment [{topic, levels:[..]}] into a flat pool of {topic, level}. */
  E.poolFrom = function (assignment) {
    const pool = [];
    (assignment || []).forEach(function (a) {
      (a.levels || []).forEach(function (l) {
        if (SQ.level(a.topic, l)) pool.push({ topic: a.topic, level: l });
      });
    });
    return pool;
  };

  E.makeQuestion = function (topicId, level) {
    const topic = SQ.topic(topicId);
    if (!topic) throw new Error('Unknown topic ' + topicId);
    const q = topic.generate(level);
    q.topic = topicId;
    q.level = level;
    q.input = q.input || topic.input || 'integer';
    q.ask = q.ask || '';
    q.steps = q.steps || [];
    q.key = q.key || q.text || q.prompt;
    q.id = U.uid();
    return q;
  };

  /**
   * Build a set of `size` questions spread evenly over the pool, in random
   * order, with no exact repeats when it can be helped.
   */
  E.buildSet = function (pool, size) {
    if (!pool.length) return [];
    let slots = [];
    while (slots.length < size) slots = slots.concat(U.shuffle(pool));
    slots = U.shuffle(slots.slice(0, size));
    const seen = {};
    return slots.map(function (slot) {
      let q;
      for (let tries = 0; tries < 40; tries++) {
        q = E.makeQuestion(slot.topic, slot.level);
        if (!seen[q.key]) break;
      }
      seen[q.key] = true;
      return q;
    });
  };

  const DASHES = /[−–—‒]/g;

  /** Clean up what was typed. Returns { ok, value, shown } or { ok:false, reason }. */
  function gcd(a, b) {
    a = Math.abs(a); b = Math.abs(b);
    while (b) { const t = b; b = a % b; a = t; }
    return a || 1;
  }
  E.gcd = gcd;

  /**
   * "3/4", "−3/4", "1 3/4", "2" -> { n, d, form: 'whole'|'fraction'|'mixed', simplest }.
   * Returns null if it isn't a fraction, { zero: true } for a zero denominator.
   */
  E.parseFraction = function (raw) {
    const s = String(raw == null ? '' : raw).replace(DASHES, '-').trim().replace(/\s+/g, ' ');
    let m = /^([+-]?)(\d+)$/.exec(s);
    if (m) return { n: (m[1] === '-' ? -1 : 1) * Number(m[2]), d: 1, form: 'whole', simplest: true };
    m = /^([+-]?)(\d+) ?\/ ?(\d+)$/.exec(s);
    if (m) {
      const n = Number(m[2]), d = Number(m[3]);
      if (!d) return { zero: true };
      return { n: (m[1] === '-' ? -1 : 1) * n, d: d, form: 'fraction', simplest: d !== 1 && gcd(n, d) === 1 };
    }
    m = /^([+-]?)(\d+) (\d+) ?\/ ?(\d+)$/.exec(s);
    if (m) {
      const w = Number(m[2]), n = Number(m[3]), d = Number(m[4]);
      if (!d) return { zero: true };
      const sign = m[1] === '-' ? -1 : 1;
      return { n: sign * (w * d + n), d: d, form: 'mixed', simplest: n > 0 && n < d && gcd(n, d) === 1 };
    }
    return null;
  };

  /** Fraction value as text: 3/4, 1 3/4 (mixed: true), −2 */
  E.fracText = function (n, d, mixed) {
    const g = gcd(n, d), sign = (n < 0) !== (d < 0) && n !== 0 ? '\u2212' : '';
    n = Math.abs(n / g); d = Math.abs(d / g);
    if (d === 1) return sign + n;
    if (mixed && n > d) return sign + Math.floor(n / d) + ' ' + (n % d) + '/' + d;
    return sign + n + '/' + d;
  };

  E.parseAnswer = function (q, raw) {
    if (q.input === 'fraction') {
      const f = E.parseFraction(raw);
      if (String(raw == null ? '' : raw).trim() === '') return { ok: false, reason: 'empty' };
      if (!f) return { ok: false, reason: 'not-a-fraction' };
      if (f.zero) return { ok: false, reason: 'zero-denominator' };
      const shown = String(raw).replace(DASHES, '-').replace(/-/g, '\u2212').trim().replace(/\s+/g, ' ').replace(/ ?\/ ?/, '/');
      return { ok: true, value: f, shown: shown };
    }
    if (q.input === 'choice') {
      const idx = Number(raw);
      if (raw === '' || raw == null || !Number.isInteger(idx)) return { ok: false, reason: 'empty' };
      return { ok: true, value: idx, shown: q.choices ? q.choices[idx] : String(idx) };
    }
    const s = String(raw == null ? '' : raw).trim();
    if (!s) return { ok: false, reason: 'empty' };
    if (q.input === 'text') {
      return { ok: true, value: s, shown: s };
    }
    const clean = s.replace(DASHES, '-').replace(/\s+/g, '').replace(',', '.');
    if (!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(clean)) return { ok: false, reason: 'not-a-number' };
    const value = Number(clean);
    if (!isFinite(value)) return { ok: false, reason: 'not-a-number' };
    const shown = value < 0 ? '−' + String(Math.abs(value)) : String(value);
    return { ok: true, value: value, shown: shown };
  };

  function normText(s) {
    return String(s).trim().toLowerCase().replace(/\s+/g, ' ');
  }

  E.isCorrect = function (q, value) {
    switch (q.input) {
      case 'fraction': {
        const a = E.parseFraction(q.answer);
        return !!(a && value && value.d) && value.n * a.d === a.n * value.d;
      }
      case 'text': {
        const ok = [q.answer].concat(q.accept || []).map(normText);
        return ok.indexOf(normText(value)) !== -1;
      }
      case 'choice':
        return Number(value) === Number(q.answer);
      default:
        return Math.abs(Number(value) - Number(q.answer)) < 1e-9;
    }
  };

  /** Specific hint for a wrong answer, from the topic (or null). */
  E.diagnose = function (q, value) {
    const topic = SQ.topic(q.topic);
    if (!topic || typeof topic.diagnose !== 'function') return null;
    try {
      return topic.diagnose(q, value) || null;
    } catch (e) {
      return null;
    }
  };

  /** How the answer is displayed. */
  /**
   * The right value written the wrong way (not simplified, or not in the form
   * the question asks for). Such an answer is not counted as a mistake: the
   * child is asked to rewrite it. Returns a message or null.
   */
  E.formProblem = function (q, parsed) {
    if (q.input !== 'fraction' || !parsed || !parsed.ok || !E.isCorrect(q, parsed.value)) return null;
    const f = parsed.value;
    const whole = f.n % f.d === 0;
    if (!f.simplest) {
      return whole ? 'Correct value! Now write it as a whole number.' : 'Correct value! Now write it in its simplest form.';
    }
    if (!whole && Math.abs(f.n) > f.d) {
      if (q.wantForm === 'mixed' && f.form !== 'mixed') return 'Correct value! Now write it as a mixed number, like 2 1/3.';
      if (q.wantForm === 'improper' && f.form !== 'fraction') return 'Correct value! Now write it as an improper (top-heavy) fraction, like 7/3.';
    }
    return null;
  };

  E.answerText = function (q) {
    if (q.input === 'fraction') {
      const a = E.parseFraction(q.answer);
      if (!a) return String(q.answer);
      const plain = E.fracText(a.n, a.d), mixed = E.fracText(a.n, a.d, true);
      if (q.wantForm === 'mixed') return mixed;
      return plain === mixed ? plain : plain + ' (= ' + mixed + ')';
    }
    if (q.input === 'choice') return q.choices ? q.choices[q.answer] : String(q.answer);
    if (typeof q.answer === 'number') {
      return q.answer < 0 ? '−' + String(Math.abs(q.answer)) : String(q.answer);
    }
    return String(q.answer);
  };

  /* ---------- streak and reward rules ---------- */

  E.rewardsToday = function (state) {
    const today = E.dayKey();
    return state.rewards.filter(function (r) { return E.dayKey(r.ts) === today; }).length;
  };

  E.canEarnReward = function (state) {
    const limit = state.settings.dailyLimit;
    return !limit || E.rewardsToday(state) < limit;
  };

  /** The streak only counts within one day. */
  E.currentStreak = function (state) {
    return state.progress.streakDay === E.dayKey() ? state.progress.streak : 0;
  };

  /** Rewards earned but not yet turned into a running timer. */
  E.unusedRewards = function (state) {
    return state.rewards.filter(function (r) { return !r.startedAt; });
  };

  /** The reward whose game timer is running right now, if any. */
  E.runningReward = function (state, now) {
    now = now || Date.now();
    return state.rewards.find(function (r) { return r.startedAt && r.endsAt > now; }) || null;
  };

  /** Accuracy over the last n challenge answers, or null if too few. */
  E.recentAccuracy = function (state, n, mode) {
    const items = [];
    for (let i = state.history.length - 1; i >= 0 && items.length < n; i--) {
      const h = state.history[i];
      if (mode && h.mode !== mode) continue;
      for (let j = h.items.length - 1; j >= 0 && items.length < n; j--) items.push(h.items[j]);
    }
    if (items.length < 10) return null;
    const ok = items.filter(function (it) { return it.ok; }).length;
    return { accuracy: ok / items.length, count: items.length };
  };
})(typeof window !== 'undefined' ? window : globalThis);
