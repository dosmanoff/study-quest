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
 *   input:  'integer',                  // 'integer' | 'number' | 'text' | 'choice' (defaults to topic.input)
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
  E.parseAnswer = function (q, raw) {
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
  E.answerText = function (q) {
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
