/*
 * Study Quest — saving, loading and merging.
 *
 * The state is always kept in this browser's localStorage. When the site runs
 * on a server with api/sync.php, sync.js also keeps a copy on the server so
 * the phone, the PC and a parent's phone all see the same progress.
 *
 * Every part of the state can be merged, so two devices never overwrite
 * each other's work:
 *   settings, progress  -> the copy with the newer updatedAt wins
 *   history, rewards    -> joined by id (rewards: newer updatedAt wins)
 *   resetAt             -> the latest reset wins; older history is dropped
 */
(function (root) {
  'use strict';
  const SQ = root.SQ;
  const KEY = 'studyquest.v1';
  const MAX_HISTORY = 250; // sets kept in history
  const MAX_REWARDS = 250;

  let memoryCopy = null;
  let available = true;

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function blankState() {
    const d = SQ.defaults || {};
    return {
      schema: 1,
      settings: Object.assign(
        {
          childName: '',
          pinHash: null,
          setSize: 10,
          setsRequired: 2,
          rewardMinutes: 30,
          dailyLimit: 0,
          onMistake: 'restart',
          sound: true,
          updatedAt: 0,
        },
        clone(d.settings || {}),
        { assignment: clone(d.assignment || []) }
      ),
      progress: { streak: 0, streakDay: '', run: 0, bestRun: 0, updatedAt: 0 },
      history: [],
      rewards: [],
      resetAt: 0, // progress reset by a parent: anything older is dropped on every device
    };
  }

  /** Keep only assignment entries whose topic and levels still exist. */
  function cleanAssignment(list) {
    if (!Array.isArray(list)) return [];
    return list
      .map(function (a) {
        const t = a && SQ.topic(a.topic);
        if (!t) return null;
        const levels = (a.levels || []).filter(function (l) {
          return t.levels.some(function (x) { return x.id === l; });
        });
        return levels.length ? { topic: t.id, levels: levels } : null;
      })
      .filter(Boolean);
  }

  function normalise(raw) {
    const base = blankState();
    if (!raw || typeof raw !== 'object') return base;
    const s = {
      schema: 1,
      settings: Object.assign(base.settings, raw.settings || {}),
      progress: Object.assign(base.progress, raw.progress || {}),
      history: Array.isArray(raw.history) ? raw.history.filter(function (h) { return h && h.id; }) : [],
      rewards: Array.isArray(raw.rewards) ? raw.rewards.filter(function (r) { return r && r.id; }) : [],
      resetAt: Number(raw.resetAt) || 0,
    };
    if (s.resetAt) {
      s.history = s.history.filter(function (h) { return (h.ts || 0) >= s.resetAt; });
      s.rewards = s.rewards.filter(function (r) { return (r.ts || 0) >= s.resetAt; });
    }
    s.settings.assignment = cleanAssignment(s.settings.assignment);
    if (!s.settings.assignment.length) s.settings.assignment = clone((SQ.defaults || {}).assignment || []);
    return s;
  }

  function byTs(a, b) { return (a.ts || 0) - (b.ts || 0); }

  function trim(state) {
    if (state.history.length > MAX_HISTORY) state.history = state.history.slice(-MAX_HISTORY);
    if (state.rewards.length > MAX_REWARDS) state.rewards = state.rewards.slice(-MAX_REWARDS);
    return state;
  }

  /** Merge two states (e.g. this device and the server). Pure function. */
  function merge(a, b) {
    if (!b) return normalise(a);
    if (!a) return normalise(b);
    a = normalise(a);
    b = normalise(b);
    const out = blankState();
    out.resetAt = Math.max(a.resetAt || 0, b.resetAt || 0);

    out.settings = (b.settings.updatedAt || 0) > (a.settings.updatedAt || 0) ? b.settings : a.settings;
    // A parent PIN set on any device must never be lost.
    if (!out.settings.pinHash) out.settings.pinHash = a.settings.pinHash || b.settings.pinHash;

    out.progress = (b.progress.updatedAt || 0) > (a.progress.updatedAt || 0) ? b.progress : a.progress;
    out.progress.bestRun = Math.max(a.progress.bestRun || 0, b.progress.bestRun || 0);

    const hist = {};
    a.history.concat(b.history).forEach(function (h) { hist[h.id] = hist[h.id] || h; });
    out.history = Object.keys(hist).map(function (k) { return hist[k]; }).sort(byTs);

    const rew = {};
    a.rewards.concat(b.rewards).forEach(function (r) {
      const have = rew[r.id];
      if (!have || (r.updatedAt || 0) > (have.updatedAt || 0)) rew[r.id] = r;
    });
    out.rewards = Object.keys(rew).map(function (k) { return rew[k]; }).sort(byTs);

    if (out.resetAt) {
      out.history = out.history.filter(function (h) { return (h.ts || 0) >= out.resetAt; });
      out.rewards = out.rewards.filter(function (r) { return (r.ts || 0) >= out.resetAt; });
    }
    return trim(out);
  }

  function read(key) {
    try {
      const txt = root.localStorage.getItem(key);
      return txt ? JSON.parse(txt) : null;
    } catch (e) {
      available = false;
      return null;
    }
  }

  function write(key, value) {
    try {
      root.localStorage.setItem(key, JSON.stringify(value));
      available = true;
    } catch (e) {
      available = false;
    }
  }

  SQ.storage = {
    get available() { return available; },

    load: function () {
      const raw = read(KEY);
      return normalise(raw || memoryCopy);
    },

    save: function (state) {
      trim(state);
      memoryCopy = clone(state);
      write(KEY, state);
    },

    /** Small key/value store for device-only things (sync code, etc.). */
    getMeta: function (name) { return read('studyquest.meta.' + name); },
    setMeta: function (name, value) { write('studyquest.meta.' + name, value); },

    /** Validate and normalise an imported backup. Throws on garbage. */
    parseBackup: function (text) {
      const raw = JSON.parse(text);
      if (!raw || typeof raw !== 'object' || !raw.settings) {
        throw new Error('Not a Study Quest backup');
      }
      return normalise(raw);
    },

    blank: blankState,
    normalise: normalise,
    merge: merge,
  };

  /** Tiny non-cryptographic hash for the parent PIN (FNV-1a). */
  SQ.hashPin = function (pin) {
    let h = 0x811c9dc5;
    const s = 'sq-pin:' + pin;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16);
  };
})(typeof window !== 'undefined' ? window : globalThis);
