/*
 * Study Quest — core namespace and registry.
 *
 * Everything lives on one global object, SQ. Subjects and topics register
 * themselves here, so adding a new topic means adding one file and one
 * <script> line in index.html (see README.md).
 */
(function (root) {
  'use strict';

  const SQ = (root.SQ = root.SQ || {});
  SQ.version = '1.0.0';
  // Which app this page is: 'studyquest' (maths) or another site built on the
  // same core. It names the localStorage keys, so two apps on one domain
  // never read each other's data. Set window.SQ_APP_ID before this file.
  SQ.appId = root.SQ_APP_ID || SQ.appId || 'studyquest';

  const subjects = [];
  const subjectById = {};
  const topicById = {};

  function need(def, keys, what) {
    keys.forEach(function (k) {
      if (def[k] === undefined || def[k] === null || def[k] === '') {
        throw new Error(what + ' "' + (def.id || '?') + '" is missing "' + k + '"');
      }
    });
  }

  /**
   * Register a subject (Maths, Science, French...).
   * { id, title, description?, icon? }
   */
  SQ.registerSubject = function (def) {
    need(def, ['id', 'title'], 'Subject');
    if (subjectById[def.id]) throw new Error('Subject already registered: ' + def.id);
    const s = Object.assign({ description: '', icon: '' }, def, { topics: [] });
    subjects.push(s);
    subjectById[s.id] = s;
    return s;
  };

  /**
   * Register a topic inside a subject.
   * {
   *   id: 'maths.powers',            // unique, "<subject>.<name>"
   *   subject: 'maths',
   *   title: 'Powers & indices',
   *   short: 'Squares, cubes, ...',  // one line for cards
   *   input: 'integer',              // default answer type for its questions
   *   levels: [{ title, description }],
   *   lesson: { intro, sections: [{ title, html }] },   // optional theory
   *   generate(level) -> question,   // see engine.js for the question shape
   *   diagnose(question, value) -> string | null        // optional hint after a wrong answer
   * }
   */
  SQ.registerTopic = function (def) {
    need(def, ['id', 'subject', 'title', 'levels', 'generate'], 'Topic');
    const subject = subjectById[def.subject];
    if (!subject) throw new Error('Unknown subject "' + def.subject + '" for topic ' + def.id);
    if (topicById[def.id]) throw new Error('Topic already registered: ' + def.id);
    if (!Array.isArray(def.levels) || def.levels.length === 0) {
      throw new Error('Topic ' + def.id + ' needs at least one level');
    }
    const t = Object.assign({ input: 'integer', short: '', lesson: null, diagnose: null }, def);
    t.levels = def.levels.map(function (l, i) {
      return Object.assign({ description: '' }, l, { id: i + 1 });
    });
    subject.topics.push(t);
    topicById[t.id] = t;
    return t;
  };

  SQ.subjects = function () { return subjects.slice(); };
  SQ.subject = function (id) { return subjectById[id] || null; };
  SQ.topic = function (id) { return topicById[id] || null; };
  SQ.allTopics = function () {
    return subjects.reduce(function (acc, s) { return acc.concat(s.topics); }, []);
  };
  SQ.level = function (topicId, levelId) {
    const t = topicById[topicId];
    return t ? t.levels.find(function (l) { return l.id === levelId; }) || null : null;
  };

  /* ---------- small utilities shared by topics and UI ---------- */
  const U = (SQ.util = {
    /** Random integer in [a, b] inclusive. */
    int: function (a, b) { return a + Math.floor(Math.random() * (b - a + 1)); },
    pick: function (arr) { return arr[Math.floor(Math.random() * arr.length)]; },
    chance: function (p) { return Math.random() < p; },
    sign: function () { return Math.random() < 0.5 ? -1 : 1; },
    shuffle: function (arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
      }
      return a;
    },
    /** Pick from [[weight, value], ...]. Values may be functions; they are returned, not called. */
    weighted: function (pairs) {
      const total = pairs.reduce(function (s, p) { return s + p[0]; }, 0);
      let r = Math.random() * total;
      for (let i = 0; i < pairs.length; i++) {
        r -= pairs[i][0];
        if (r < 0) return pairs[i][1];
      }
      return pairs[pairs.length - 1][1];
    },
    escape: function (s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },
    uid: function () {
      return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    },
  });

  void U;
})(typeof window !== 'undefined' ? window : globalThis);
