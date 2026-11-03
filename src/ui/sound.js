/* Study Quest — short sounds made with WebAudio (no audio files needed). */
(function (root) {
  'use strict';
  const SQ = root.SQ;
  let ctx = null;

  function context() {
    if (ctx) return ctx;
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch (e) { ctx = null; }
    return ctx;
  }

  function tone(freq, start, dur, type, vol) {
    const c = context();
    if (!c) return;
    const t0 = c.currentTime + start;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.18, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(c.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  const SOUNDS = {
    ok: function () { tone(660, 0, 0.12, 'triangle'); tone(990, 0.08, 0.18, 'triangle'); },
    bad: function () { tone(220, 0, 0.25, 'sine', 0.15); tone(185, 0.12, 0.3, 'sine', 0.12); },
    set: function () { [523, 659, 784].forEach(function (f, i) { tone(f, i * 0.1, 0.22, 'triangle'); }); },
    win: function () {
      [523, 659, 784, 1047, 784, 1047].forEach(function (f, i) { tone(f, i * 0.11, 0.28, 'square', 0.08); });
    },
    end: function () { [880, 660, 880, 660].forEach(function (f, i) { tone(f, i * 0.35, 0.3, 'sine', 0.2); }); },
  };

  SQ.sound = {
    enabled: function () { return !SQ.app || !SQ.app.state || SQ.app.state.settings.sound !== false; },
    /** Call from a click so browsers allow audio later. */
    unlock: function () {
      const c = context();
      if (c && c.state === 'suspended') c.resume().catch(function () {});
    },
    play: function (name) {
      if (!SQ.sound.enabled() || !SOUNDS[name]) return;
      try { SOUNDS[name](); } catch (e) { /* sound is optional */ }
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
