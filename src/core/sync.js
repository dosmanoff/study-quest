/*
 * Study Quest — keeping devices in step.
 *
 * Each family has a code like K7P2-9XQM-4HDT. A server stores one copy of the
 * state per code. Devices pull, merge (storage.merge) and push back, so the
 * phone, the PC and a parent's phone all share one progress.
 *
 * Two kinds of server ("backends"), chosen in config.js:
 *   firebase  SQ.config.firebase = { projectId, apiKey }  -> Cloud Firestore
 *             (works from any host, including GitHub Pages)
 *   php       SQ.config.syncUrl = 'api/sync.php'           -> api/sync.php
 * Firebase wins when both are set. With neither, or when the page is opened
 * from a file, sync stays off and everything works on that one device.
 *
 * A backend has three calls:
 *   ping()                        -> true if it answers
 *   get(code)                     -> { rev, state|null }
 *   put(code, baseRev, state)     -> { ok: true, rev } | { conflict: true, rev, state }
 * A put only succeeds if nobody else saved since baseRev; otherwise the device
 * merges with the newer copy and tries again.
 */
(function (root) {
  'use strict';
  const SQ = root.SQ;
  const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

  const S = (SQ.sync = {
    /** 'off' (no server) | 'checking' | 'ready' (server, no code yet) | 'syncing' | 'ok' | 'offline' */
    status: 'off',
    enabled: false,
    backend: null, // 'firebase' | 'php' | null
    family: null,
    rev: 0,
    lastSync: 0,
  });

  const listeners = [];
  let getState = function () { return null; };
  let adopt = function () {};
  let pushing = false, dirty = false, timer = null;

  function setStatus(s) {
    S.status = s;
    listeners.forEach(function (fn) { try { fn(s); } catch (e) { /* ignore */ } });
  }

  function saveMeta() { SQ.storage.setMeta('sync', { family: S.family, rev: S.rev }); }

  /** fetch + JSON with a timeout. Resolves { status, data }. */
  function fetchJson(method, url, body, timeoutMs) {
    if (typeof fetch !== 'function' || !root.location || !/^https?:$/.test(root.location.protocol)) {
      return Promise.reject(new Error('no-server'));
    }
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const t = setTimeout(function () { if (ctrl) ctrl.abort(); }, timeoutMs || 15000);
    return fetch(url, {
      method: method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
      signal: ctrl ? ctrl.signal : undefined,
    }).then(function (res) {
      return res.text().then(function (txt) {
        let data = null;
        try { data = JSON.parse(txt); } catch (e) { data = null; }
        return { status: res.status, data: data };
      });
    }).then(function (r) { clearTimeout(t); return r; }, function (e) { clearTimeout(t); throw e; });
  }

  /* ---------- backend: api/sync.php ---------- */

  function phpBackend(url) {
    const q = function (s) { return url + '?' + s; };
    return {
      name: 'php',
      ping: function () {
        return fetchJson('GET', q('ping=1'), null, 6000).then(function (r) {
          return !!(r.data && r.data.ok && r.data.app === 'studyquest');
        });
      },
      get: function (code) {
        return fetchJson('GET', q('family=' + encodeURIComponent(code))).then(function (r) {
          if (r.status !== 200 || !r.data || !r.data.ok) throw new Error('get failed');
          return { rev: r.data.rev || 0, state: r.data.state || null };
        });
      },
      put: function (code, baseRev, state) {
        return fetchJson('POST', q('family=' + encodeURIComponent(code)), { baseRev: baseRev, state: state }).then(function (r) {
          if (r.status === 200 && r.data && r.data.ok) return { ok: true, rev: r.data.rev };
          if (r.data && (r.status === 409 || r.data.error === 'conflict')) {
            return { conflict: true, rev: r.data.rev || 0, state: r.data.state || null };
          }
          throw new Error('put failed: ' + r.status);
        });
      },
    };
  }

  /* ---------- backend: Cloud Firestore (REST, no SDK) ----------
   * Document families/<sha256("studyquest:" + code)> with fields
   *   rev (int), state (JSON string), updated (int, ms).
   * Saves use a precondition on the document's updateTime, so two devices
   * saving at once can't overwrite each other: the second one gets a
   * conflict, merges and saves again. The security rules (README) also
   * require rev to go up by exactly one.
   */
  function firebaseBackend(cfg) {
    const base = (cfg.baseUrl || 'https://firestore.googleapis.com/v1') + '/projects/' +
      encodeURIComponent(cfg.projectId) + '/databases/(default)/documents/families/';
    const times = {}; // code -> updateTime of the copy we last saw
    const ids = {};

    function docId(code) {
      if (ids[code]) return Promise.resolve(ids[code]);
      const subtle = root.crypto && root.crypto.subtle;
      if (!subtle || typeof TextEncoder === 'undefined') return Promise.reject(new Error('no-crypto'));
      return subtle.digest('SHA-256', new TextEncoder().encode('studyquest:' + code)).then(function (buf) {
        const hex = Array.prototype.map.call(new Uint8Array(buf), function (b) { return (b < 16 ? '0' : '') + b.toString(16); }).join('');
        ids[code] = hex;
        return hex;
      });
    }

    function url(id, params) {
      const q = [];
      if (cfg.apiKey) q.push('key=' + encodeURIComponent(cfg.apiKey));
      Object.keys(params || {}).forEach(function (k) { q.push(k + '=' + encodeURIComponent(params[k])); });
      return base + id + (q.length ? '?' + q.join('&') : '');
    }

    function get(code) {
      return docId(code).then(function (id) { return fetchJson('GET', url(id)); }).then(function (r) {
        if (r.status === 404) { delete times[code]; return { rev: 0, state: null }; }
        if (r.status !== 200 || !r.data || !r.data.fields) throw new Error('get failed: ' + r.status);
        times[code] = r.data.updateTime;
        const f = r.data.fields;
        let state = null;
        try { state = f.state && f.state.stringValue ? JSON.parse(f.state.stringValue) : null; } catch (e) { state = null; }
        return { rev: Number(f.rev && f.rev.integerValue) || 0, state: state };
      });
    }

    function asConflict(code) {
      return get(code).then(function (cur) { return { conflict: true, rev: cur.rev, state: cur.state }; });
    }

    return {
      name: 'firebase',
      ping: function () {
        // A made-up document: "not found" means the database is there and readable.
        return fetchJson('GET', url(new Array(65).join('0')), null, 8000).then(function (r) {
          if (r.status === 403 && root.console) root.console.warn('Study Quest: Firestore rules refuse access. Paste the rules from the README.');
          return r.status === 404 || r.status === 200;
        });
      },
      get: get,
      put: function (code, baseRev, state) {
        const known = times[code];
        if (baseRev > 0 && !known) return asConflict(code); // learn the current copy first
        const pre = baseRev > 0 ? { 'currentDocument.updateTime': known } : { 'currentDocument.exists': 'false' };
        const now = Date.now();
        const body = {
          fields: {
            rev: { integerValue: String(baseRev + 1) },
            state: { stringValue: JSON.stringify(state) },
            updated: { integerValue: String(now) },
          },
        };
        return docId(code).then(function (id) { return fetchJson('PATCH', url(id, pre), body); }).then(function (r) {
          if (r.status === 200 && r.data && r.data.updateTime) {
            times[code] = r.data.updateTime;
            return { ok: true, rev: baseRev + 1 };
          }
          const err = r.data && r.data.error ? r.data.error.status : '';
          if (/FAILED_PRECONDITION|ALREADY_EXISTS|ABORTED|NOT_FOUND|PERMISSION_DENIED/.test(err) ||
              [400, 403, 404, 409, 412].indexOf(r.status) !== -1) {
            return asConflict(code);
          }
          throw new Error('put failed: ' + r.status);
        });
      },
    };
  }

  function pickBackend() {
    // A page opened from a file can't reach any server.
    if (!root.location || !/^https?:$/.test(root.location.protocol)) return null;
    const c = SQ.config || {};
    if (c.firebase && c.firebase.projectId) return firebaseBackend(c.firebase);
    const php = Object.prototype.hasOwnProperty.call(c, 'syncUrl') ? c.syncUrl : 'api/sync.php';
    return php ? phpBackend(php) : null;
  }

  let backend = null;

  /* ---------- codes ---------- */

  S.onChange = function (fn) { listeners.push(fn); };

  S.normaliseCode = function (code) {
    return String(code || '').toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 12).replace(/(.{4})(?=.)/g, '$1-');
  };
  S.isValidCode = function (code) { return /^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/.test(code); };

  S.newCode = function () {
    const bytes = new Uint8Array(12);
    if (root.crypto && root.crypto.getRandomValues) root.crypto.getRandomValues(bytes);
    else for (let i = 0; i < 12; i++) bytes[i] = Math.floor(Math.random() * 256);
    let s = '';
    for (let i = 0; i < 12; i++) s += ALPHABET[bytes[i] % ALPHABET.length];
    return S.normaliseCode(s);
  };

  /** Connect the sync to the app: how to read the current state and how to accept a merged one. */
  S.bind = function (getter, adopter) { getState = getter; adopt = adopter; };

  /** Is there a sync server for this page? */
  S.init = function () {
    const meta = SQ.storage.getMeta('sync') || {};
    S.family = meta.family || null;
    S.rev = meta.rev || 0;
    backend = pickBackend();
    S.backend = backend ? backend.name : null;
    if (!backend) {
      S.enabled = false;
      setStatus('off');
      return Promise.resolve(false);
    }
    setStatus('checking');
    return backend.ping().then(function (ok) {
      S.enabled = ok;
      setStatus(ok ? (S.family ? 'ok' : 'ready') : (S.family ? 'offline' : 'off'));
      return ok;
    }).catch(function () {
      S.enabled = false;
      setStatus(S.family ? 'offline' : 'off');
      return false;
    });
  };

  /* ---------- pull and push ---------- */

  /** Download the server copy and merge it in. Resolves true if anything was merged. */
  S.pull = function () {
    if (!S.family || pushing || !backend) return Promise.resolve(false);
    return backend.get(S.family).then(function (r) {
      S.enabled = true;
      S.rev = r.rev || 0;
      saveMeta();
      S.lastSync = Date.now();
      setStatus('ok');
      if (!r.state) { dirty = true; schedule(0); return false; }
      const local = getState();
      const remote = SQ.storage.normalise(r.state);
      const merged = SQ.storage.merge(local, remote);
      adopt(merged);
      if (JSON.stringify(merged) !== JSON.stringify(SQ.storage.merge(remote, remote))) {
        dirty = true; // this device has something the server does not
        schedule(500);
      }
      return true;
    }).catch(function () {
      setStatus('offline');
      return false;
    });
  };

  function push(state, attempt) {
    return backend.put(S.family, S.rev, state).then(function (r) {
      if (r.ok) {
        S.rev = r.rev;
        saveMeta();
        S.lastSync = Date.now();
        return state;
      }
      if (r.conflict && attempt < 4) {
        S.rev = r.rev || 0;
        return push(SQ.storage.merge(state, r.state), attempt + 1);
      }
      throw new Error('push failed');
    });
  }

  function flush() {
    timer = null;
    if (pushing || !dirty || !S.family || !backend) return;
    pushing = true;
    dirty = false;
    setStatus('syncing');
    push(getState(), 0).then(function (saved) {
      adopt(SQ.storage.merge(getState(), saved));
      setStatus('ok');
    }).catch(function () {
      dirty = true;
      setStatus('offline');
    }).then(function () {
      pushing = false;
      if (dirty) schedule(S.status === 'ok' ? 1000 : 30000);
    });
  }

  function schedule(ms) {
    if (!S.family) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, ms);
  }

  /** Call after every local change. */
  S.changed = function () {
    dirty = true;
    schedule(1200);
  };

  /** Send now (e.g. when the page is being hidden). */
  S.flushNow = function () { if (dirty) flush(); };

  /** Start a new family on the server with this device's data. */
  S.createFamily = function () {
    S.family = S.newCode();
    S.rev = 0;
    saveMeta();
    dirty = true;
    schedule(0);
    return S.family;
  };

  /** Join an existing family. Resolves with the server state; rejects with 'invalid' | 'not-found' | 'network'. */
  S.join = function (code) {
    code = S.normaliseCode(code);
    if (!S.isValidCode(code)) return Promise.reject(new Error('invalid'));
    if (!backend) return Promise.reject(new Error('network'));
    return backend.get(code).then(function (r) {
      if (!r.state) throw new Error('not-found');
      S.family = code;
      S.rev = r.rev || 0;
      saveMeta();
      S.enabled = true;
      setStatus('ok');
      S.lastSync = Date.now();
      return SQ.storage.normalise(r.state);
    }, function () { throw new Error('network'); });
  };

  /** Stop syncing on this device (data on this device stays). */
  S.leave = function () {
    S.family = null;
    S.rev = 0;
    saveMeta();
    setStatus(S.enabled ? 'ready' : 'off');
  };
})(typeof window !== 'undefined' ? window : globalThis);
