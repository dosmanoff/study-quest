/*
 * Study Quest — keeping devices in step through api/sync.php.
 *
 * Each family has a code like K7P2-9XQM-4HDT. The server stores one copy of
 * the state per code. Devices pull, merge (storage.merge) and push back.
 * If the site is opened from a file or a host without PHP, sync stays off
 * and everything still works on that one device.
 */
(function (root) {
  'use strict';
  const SQ = root.SQ;
  const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

  const S = (SQ.sync = {
    /** 'off' (no server) | 'checking' | 'ready' (server, no code yet) | 'syncing' | 'ok' | 'offline' */
    status: 'off',
    enabled: false,
    family: null,
    rev: 0,
    lastSync: 0,
  });

  const listeners = [];
  let getState = function () { return null; };
  let adopt = function () {};
  let pushing = false, dirty = false, timer = null;

  function endpoint() { return (SQ.config && SQ.config.syncUrl) || 'api/sync.php'; }

  function setStatus(s) {
    S.status = s;
    listeners.forEach(function (fn) { try { fn(s); } catch (e) { /* ignore */ } });
  }

  function saveMeta() { SQ.storage.setMeta('sync', { family: S.family, rev: S.rev }); }

  function request(method, query, body, timeoutMs) {
    if (typeof fetch !== 'function' || !root.location || !/^https?:$/.test(root.location.protocol)) {
      return Promise.reject(new Error('no-server'));
    }
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const t = setTimeout(function () { if (ctrl) ctrl.abort(); }, timeoutMs || 10000);
    return fetch(endpoint() + '?' + query, {
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

  /** Is there a sync server next to this page? */
  S.init = function () {
    const meta = SQ.storage.getMeta('sync') || {};
    S.family = meta.family || null;
    S.rev = meta.rev || 0;
    setStatus('checking');
    return request('GET', 'ping=1', null, 6000).then(function (r) {
      S.enabled = !!(r.data && r.data.ok && r.data.app === 'studyquest');
      setStatus(S.enabled ? (S.family ? 'ok' : 'ready') : 'off');
      return S.enabled;
    }).catch(function () {
      S.enabled = false;
      setStatus(S.family ? 'offline' : 'off');
      return false;
    });
  };

  /** Download the server copy and merge it in. Resolves true if anything was merged. */
  S.pull = function () {
    if (!S.family || pushing) return Promise.resolve(false);
    return request('GET', 'family=' + encodeURIComponent(S.family)).then(function (r) {
      if (r.status !== 200 || !r.data || !r.data.ok) throw new Error('pull failed');
      S.enabled = true;
      S.rev = r.data.rev || 0;
      saveMeta();
      S.lastSync = Date.now();
      setStatus('ok');
      if (!r.data.state) { dirty = true; schedule(0); return false; }
      const local = getState();
      const remote = SQ.storage.normalise(r.data.state);
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
    return request('POST', 'family=' + encodeURIComponent(S.family), { baseRev: S.rev, state: state })
      .then(function (r) {
        if (r.status === 200 && r.data && r.data.ok) {
          S.rev = r.data.rev;
          saveMeta();
          S.lastSync = Date.now();
          return state;
        }
        if (r.status === 409 && r.data && attempt < 4) {
          S.rev = r.data.rev || 0;
          const merged = SQ.storage.merge(state, r.data.state);
          return push(merged, attempt + 1);
        }
        throw new Error('push failed: ' + r.status);
      });
  }

  function flush() {
    timer = null;
    if (pushing || !dirty || !S.family) return;
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
    return request('GET', 'family=' + encodeURIComponent(code)).then(function (r) {
      if (r.status !== 200 || !r.data || !r.data.ok) throw new Error('network');
      if (!r.data.state) throw new Error('not-found');
      S.family = code;
      S.rev = r.data.rev || 0;
      saveMeta();
      S.enabled = true;
      setStatus('ok');
      S.lastSync = Date.now();
      return SQ.storage.normalise(r.data.state);
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
