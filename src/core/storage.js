/*
 * Study Quest — saving, loading and merging.
 *
 * The state is always kept in this browser's localStorage. When the site runs
 * on a server with api/sync.php, sync.js also keeps a copy on the server so
 * the phone, the PC and a parent's phone all see the same progress.
 *
 * State of one family (schema 2):
 *   {
 *     schema: 2,
 *     family:   { pinHash, updatedAt },   // parent PIN
 *     children: [child, ...]
 *   }
 *   child = { id, createdAt, deletedAt, settings, progress, history, rewards, resetAt }
 *   child.settings holds the child's name, optional child PIN, rules and topics.
 *
 * Every part can be merged, so two devices never overwrite each other's work:
 *   family, settings, progress -> the copy with the newer updatedAt wins
 *   children                   -> joined by id (deleting sets deletedAt)
 *   history, rewards           -> joined by id (rewards: newer updatedAt wins)
 *   resetAt                    -> the latest reset wins; older history is dropped
 */
(function (root) {
  'use strict';
  const SQ = root.SQ;
  const KEY = 'studyquest.v1';
  const MAX_HISTORY = 250; // sets kept in history, per child
  const MAX_REWARDS = 250;

  let memoryCopy = null;
  let available = true;

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function defaultSettings() {
    const d = SQ.defaults || {};
    return Object.assign(
      {
        childName: '',
        childPinHash: null,
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
    );
  }

  function blankChild(name, id) {
    const now = Date.now();
    const c = {
      id: id || 'c' + SQ.util.uid(),
      createdAt: now,
      deletedAt: 0,
      settings: defaultSettings(),
      progress: { streak: 0, streakDay: '', run: 0, bestRun: 0, updatedAt: 0 },
      history: [],
      rewards: [],
      resetAt: 0, // progress reset by a parent: anything older is dropped on every device
    };
    c.settings.childName = name || '';
    c.settings.updatedAt = now;
    return c;
  }

  function blankState() {
    return { schema: 2, family: { pinHash: null, updatedAt: 0 }, children: [] };
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

  function normaliseChild(raw) {
    const base = blankChild('', raw && raw.id);
    base.createdAt = 0;
    base.settings.updatedAt = 0;
    if (!raw || typeof raw !== 'object') return base;
    const c = {
      id: String(raw.id || base.id),
      createdAt: Number(raw.createdAt) || 0,
      deletedAt: Number(raw.deletedAt) || 0,
      settings: Object.assign(base.settings, raw.settings || {}),
      progress: Object.assign(base.progress, raw.progress || {}),
      history: Array.isArray(raw.history) ? raw.history.filter(function (h) { return h && h.id; }) : [],
      rewards: Array.isArray(raw.rewards) ? raw.rewards.filter(function (r) { return r && r.id; }) : [],
      resetAt: Number(raw.resetAt) || 0,
    };
    delete c.settings.pinHash; // the parent PIN lives in family, never in a child
    if (c.resetAt) {
      c.history = c.history.filter(function (h) { return (h.ts || 0) >= c.resetAt; });
      c.rewards = c.rewards.filter(function (r) { return (r.ts || 0) >= c.resetAt; });
    }
    c.settings.assignment = cleanAssignment(c.settings.assignment);
    if (!c.settings.assignment.length) c.settings.assignment = clone((SQ.defaults || {}).assignment || []);
    return c;
  }

  function normalise(raw) {
    const s = blankState();
    if (!raw || typeof raw !== 'object') return s;
    if (raw.schema !== 2 && raw.settings) {
      // Version 1 had one child and the parent PIN in settings.
      s.family = { pinHash: raw.settings.pinHash || null, updatedAt: raw.settings.updatedAt || 0 };
      if (raw.settings.pinHash) {
        const c = normaliseChild(Object.assign({}, raw, { id: 'main' }));
        c.createdAt = 1;
        s.children = [c];
      }
      return s;
    }
    s.family = {
      pinHash: (raw.family && raw.family.pinHash) || null,
      updatedAt: (raw.family && Number(raw.family.updatedAt)) || 0,
    };
    s.children = Array.isArray(raw.children) ? raw.children.filter(Boolean).map(normaliseChild) : [];
    return s;
  }

  function byTs(a, b) { return (a.ts || 0) - (b.ts || 0); }

  function trimChild(c) {
    if (c.history.length > MAX_HISTORY) c.history = c.history.slice(-MAX_HISTORY);
    if (c.rewards.length > MAX_REWARDS) c.rewards = c.rewards.slice(-MAX_REWARDS);
    return c;
  }

  function mergeChild(a, b) {
    const out = {
      id: a.id,
      createdAt: Math.min(a.createdAt || Infinity, b.createdAt || Infinity),
      deletedAt: Math.max(a.deletedAt || 0, b.deletedAt || 0),
      resetAt: Math.max(a.resetAt || 0, b.resetAt || 0),
    };
    if (!isFinite(out.createdAt)) out.createdAt = 0;

    out.settings = (b.settings.updatedAt || 0) > (a.settings.updatedAt || 0) ? b.settings : a.settings;
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
    return trimChild(out);
  }

  /** Merge two family states (e.g. this device and the server). Pure function. */
  function merge(a, b) {
    if (!b) return normalise(a);
    if (!a) return normalise(b);
    a = normalise(a);
    b = normalise(b);
    const out = blankState();

    out.family = (b.family.updatedAt || 0) > (a.family.updatedAt || 0) ? b.family : a.family;
    // A parent PIN set on any device must never be lost.
    if (!out.family.pinHash) out.family.pinHash = a.family.pinHash || b.family.pinHash;

    const byId = {};
    a.children.forEach(function (c) { byId[c.id] = c; });
    b.children.forEach(function (c) { byId[c.id] = byId[c.id] ? mergeChild(byId[c.id], c) : c; });
    out.children = Object.keys(byId).map(function (k) { return trimChild(byId[k]); })
      .sort(function (x, y) { return (x.createdAt || 0) - (y.createdAt || 0) || (x.id < y.id ? -1 : 1); });
    return out;
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
      state.children.forEach(trimChild);
      memoryCopy = clone(state);
      write(KEY, state);
    },

    /** Small key/value store for device-only things (sync code, chosen child, etc.). */
    getMeta: function (name) { return read('studyquest.meta.' + name); },
    setMeta: function (name, value) { write('studyquest.meta.' + name, value); },

    /** Validate and normalise an imported backup. Throws on garbage. */
    parseBackup: function (text) {
      const raw = JSON.parse(text);
      if (!raw || typeof raw !== 'object' || !(raw.settings || Array.isArray(raw.children))) {
        throw new Error('Not a Study Quest backup');
      }
      return normalise(raw);
    },

    blank: blankState,
    blankChild: blankChild,
    normalise: normalise,
    merge: merge,
  };

  /* ---------- family helpers ---------- */
  SQ.family = {
    /** Children that are not deleted, oldest first. */
    children: function (state) {
      return state.children.filter(function (c) { return !c.deletedAt; });
    },
    child: function (state, id) {
      return state.children.find(function (c) { return c.id === id && !c.deletedAt; }) || null;
    },
    isSetUp: function (state) {
      return !!state.family.pinHash && SQ.family.children(state).length > 0;
    },
  };

  /** Tiny non-cryptographic hash for PINs (FNV-1a). */
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
