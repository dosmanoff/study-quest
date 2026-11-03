/*
 * TEMPLATE for a new topic (and, if needed, a new subject).
 * This file is NOT loaded by the site. To use it:
 *
 *   1. Copy it to src/subjects/<subject>/<topic>.js and change it.
 *   2. Add a line to index.html, after the subject's other files:
 *        <script src="src/subjects/french/animals.js"></script>
 *   3. Run:  node build.mjs   and upload the dist/site folder again.
 *   4. In For parents -> Topics, tick the new levels for the challenge.
 *
 * The example below is a French vocabulary topic. It shows the two answer
 * types maths doesn't use: typed text ('text') and multiple choice ('choice').
 */
(function (root) {
  'use strict';
  const SQ = root.SQ, U = SQ.util;

  // A new subject is registered once. Skip this if the subject already exists.
  if (!SQ.subject('french')) {
    SQ.registerSubject({ id: 'french', title: 'French', description: 'Year 7 French vocabulary.' });
  }

  const WORDS = [
    ['dog', 'le chien'], ['cat', 'le chat'], ['horse', 'le cheval'], ['bird', "l'oiseau"],
    ['fish', 'le poisson'], ['rabbit', 'le lapin'], ['mouse', 'la souris'], ['cow', 'la vache'],
  ];

  SQ.registerTopic({
    id: 'french.animals',          // unique: "<subject>.<topic>"
    subject: 'french',
    title: 'Animals',
    short: 'Pets and farm animals',
    input: 'text',                 // default answer type for this topic
    levels: [
      { title: 'English → French', description: 'Type the French word, like le chien.' },
      { title: 'Pick the meaning', description: 'Choose the English word for a French one.' },
    ],

    // Return one question. [[?]] in the prompt is where the answer box goes.
    generate: function (level) {
      const pair = U.pick(WORDS);
      const en = pair[0], fr = pair[1];
      if (level === 1) {
        return {
          ask: 'Translate into French',
          prompt: '<i>' + en + '</i> = [[?]]',
          text: en + ' = ?',
          answer: fr,
          accept: [fr.replace(/^(le |la |les |l')/, '')], // also accept the word without le/la
          steps: ['<b>' + en + '</b> in French is <b>' + fr + '</b>.'],
        };
      }
      const wrong = U.shuffle(WORDS.filter(function (w) { return w[0] !== en; })).slice(0, 3).map(function (w) { return w[0]; });
      const choices = U.shuffle(wrong.concat([en]));
      return {
        ask: 'What does this mean?',
        prompt: '<i>' + fr + '</i>',
        text: fr + ' = ?',
        input: 'choice',
        choices: choices,
        answer: choices.indexOf(en),   // index of the right choice
        steps: ['<b>' + fr + '</b> means <b>' + en + '</b>.'],
      };
    },

    // Optional: a hint after a wrong answer. Return a string or null.
    diagnose: function (q, value) {
      if (q.input === 'text' && String(value).trim().toLowerCase() === q.answer.replace(/^(le |la |l')/, '')) {
        return 'Nearly! Remember the little word in front: le, la or l’.';
      }
      return null;
    },

    // Optional: the "How it works" page for the topic.
    lesson: {
      intro: 'Every French noun is masculine (le) or feminine (la). Learn the word together with le or la.',
      sections: [
        { title: 'Words to learn', html: '<p>' + WORDS.map(function (w) { return w[1] + ' = ' + w[0]; }).join('<br>') + '</p>' },
      ],
    },
  });
})(typeof window !== 'undefined' ? window : globalThis);
