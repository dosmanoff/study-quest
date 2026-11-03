/* Multiplying and dividing negative (directed) numbers. */
(function (root) {
  'use strict';
  const SQ = root.SQ, U = SQ.util, M = SQ.maths;

  /** Numbers 2..max, with an occasional 1. */
  function size(max) { return U.chance(0.08) ? 1 : U.int(2, max); }

  /** Signs for two numbers, never both positive. */
  function signs() { return U.pick([[-1, 1], [1, -1], [-1, -1]]); }

  function signLine(a, b, sym) {
    const same = M.sameSign(a, b);
    return M.line('', 'Signs: ' + M.signWord(a) + ' ' + sym + ' ' + M.signWord(b) + ' → <b>' +
      (same ? 'positive' : 'negative') + '</b> (' + (same ? 'same signs' : 'different signs') + ').');
  }

  function mul(a, b) {
    const p = a * b;
    const q = M.workOut(M.join(M.num(a), M.op('×'), M.num(b, true)));
    q.ask = 'Work out';
    q.answer = p;
    q.steps = [
      signLine(a, b, '×'),
      M.line(Math.abs(a) + ' × ' + Math.abs(b) + ' = ' + Math.abs(p), 'Now multiply the numbers without the signs.'),
      M.line(M.fmt(a) + ' × ' + M.br(b) + ' = <b>' + M.fmt(p) + '</b>', 'Put the sign in front.'),
    ];
    return q;
  }

  function div(p, d) {
    const ans = p / d;
    const q = M.workOut(M.join(M.num(p), M.op('÷'), M.num(d, true)));
    q.ask = 'Work out';
    q.answer = ans;
    q.steps = [
      signLine(p, d, '÷'),
      M.line(Math.abs(p) + ' ÷ ' + Math.abs(d) + ' = ' + Math.abs(ans), 'Now divide the numbers without the signs.'),
      M.line(M.fmt(p) + ' ÷ ' + M.br(d) + ' = <b>' + M.fmt(ans) + '</b>', 'Put the sign in front.'),
    ];
    return q;
  }

  function threeFactors() {
    let xs;
    do {
      xs = [U.int(1, 6), U.int(2, 6), U.int(2, 5)].map(function (n) { return n * U.sign(); });
    } while (xs.every(function (n) { return n > 0; }));
    const negs = xs.filter(function (n) { return n < 0; }).length;
    const p = xs[0] * xs[1] * xs[2];
    const q = M.workOut(M.join(M.num(xs[0]), M.op('×'), M.num(xs[1], true), M.op('×'), M.num(xs[2], true)));
    q.ask = 'Work out';
    q.answer = p;
    q.steps = [
      M.line('', 'Count the negative numbers: <b>' + negs + '</b>. ' +
        (negs % 2 === 0 ? 'Even number of negatives → <b>positive</b>.' : 'Odd number of negatives → <b>negative</b>.')),
      M.line(xs.map(Math.abs).join(' × ') + ' = ' + Math.abs(p), 'Multiply the numbers without the signs.'),
      M.line('Answer: <b>' + M.fmt(p) + '</b>'),
    ];
    return q;
  }

  /** ? × b = p  or  a × ? = p */
  function missingFactor() {
    const s = signs();
    const a = size(10) * s[0], b = size(10) * s[1];
    const p = a * b;
    const first = U.chance(0.5);
    const known = first ? b : a, ans = first ? a : b;
    const lhs = first
      ? M.join(M.piece(M.BLANK, '?'), M.op('×'), M.num(b, true))
      : M.join(M.num(a), M.op('×'), M.piece(M.BLANK, '?'));
    const showLhs = first ? '? × ' + M.br(b) : M.fmt(a) + ' × ?';
    return {
      ask: 'Find the missing number',
      prompt: lhs.h + ' = ' + M.fmt(p),
      text: lhs.t + ' = ' + M.fmt(p),
      answer: ans,
      steps: [
        M.line(showLhs + ' = ' + M.fmt(p), 'Undo the × by dividing.'),
        M.line('? = ' + M.fmt(p) + ' ÷ ' + M.br(known), M.signWord(p) + ' ÷ ' + M.signWord(known) + ' → ' +
          (M.sameSign(p, known) ? 'positive' : 'negative') + '.'),
        M.line('? = <b>' + M.fmt(ans) + '</b>', 'Check: ' + M.br(a) + ' × ' + M.br(b) + ' = ' + M.fmt(p) + ' ✓'),
      ],
    };
  }

  /** p ÷ ? = c  or  ? ÷ d = c */
  function missingDivision() {
    const s = signs();
    const d = size(10) * s[0], c = size(10) * s[1];
    const p = d * c;
    if (U.chance(0.5)) {
      // p ÷ ? = c  ->  ? = p ÷ c = d
      const lhs = M.join(M.num(p), M.op('÷'), M.piece(M.BLANK, '?'));
      return {
        ask: 'Find the missing number',
        prompt: lhs.h + ' = ' + M.fmt(c),
        text: lhs.t + ' = ' + M.fmt(c),
        answer: d,
        steps: [
          M.line(M.fmt(p) + ' ÷ ? = ' + M.fmt(c), 'Which number can you divide ' + M.fmt(p) + ' by to get ' + M.fmt(c) + '?'),
          M.line('? = ' + M.fmt(p) + ' ÷ ' + M.br(c), M.signWord(p) + ' ÷ ' + M.signWord(c) + ' → ' +
            (M.sameSign(p, c) ? 'positive' : 'negative') + '.'),
          M.line('? = <b>' + M.fmt(d) + '</b>', 'Check: ' + M.fmt(p) + ' ÷ ' + M.br(d) + ' = ' + M.fmt(c) + ' ✓'),
        ],
      };
    }
    // ? ÷ d = c  ->  ? = c × d
    const lhs = M.join(M.piece(M.BLANK, '?'), M.op('÷'), M.num(d, true));
    return {
      ask: 'Find the missing number',
      prompt: lhs.h + ' = ' + M.fmt(c),
      text: lhs.t + ' = ' + M.fmt(c),
      answer: p,
      steps: [
        M.line('? ÷ ' + M.br(d) + ' = ' + M.fmt(c), 'Undo the ÷ by multiplying.'),
        M.line('? = ' + M.fmt(c) + ' × ' + M.br(d), M.signWord(c) + ' × ' + M.signWord(d) + ' → ' +
          (M.sameSign(c, d) ? 'positive' : 'negative') + '.'),
        M.line('? = <b>' + M.fmt(p) + '</b>', 'Check: ' + M.fmt(p) + ' ÷ ' + M.br(d) + ' = ' + M.fmt(c) + ' ✓'),
      ],
    };
  }

  /** a × b ÷ c, worked left to right. */
  function mulThenDiv() {
    let a, b, c, tries = 0;
    do {
      a = U.int(2, 9) * U.sign();
      b = U.int(2, 9) * U.sign();
      const ds = M.divisors(a * b, 2, 9).filter(function (d) { return d !== Math.abs(a) && d !== Math.abs(b); });
      c = ds.length ? U.pick(ds) * U.sign() : 0;
      tries++;
    } while ((!c || (a > 0 && b > 0 && c > 0)) && tries < 50);
    if (!c) return mul(-6, 4);
    const seq = [{ n: a }, '×', { n: b }, '÷', { n: c }];
    const w = M.seqSteps(seq);
    const q = M.workOut(M.seqPiece(seq));
    q.ask = 'Work out';
    q.answer = w.value;
    q.steps = [M.line('', 'Only × and ÷ here, so work from left to right.')].concat(w.steps);
    return q;
  }

  SQ.registerTopic({
    id: 'maths.negatives',
    subject: 'maths',
    title: 'Negative numbers: × and ÷',
    short: 'Multiplying and dividing with negative numbers',
    input: 'integer',
    levels: [
      { title: 'Multiply', description: 'Like −6 × 4 and −7 × (−3). Numbers up to 10.' },
      { title: 'Divide', description: 'Like −24 ÷ 6 and −35 ÷ (−7).' },
      { title: 'Mixed challenge', description: 'Bigger numbers, three numbers at once, and missing numbers.' },
    ],
    generate: function (level) {
      if (level === 1) {
        const s = signs();
        return mul(size(10) * s[0], size(10) * s[1]);
      }
      if (level === 2) {
        const s = signs();
        const d = U.int(2, 10) * s[0], ans = size(10) * s[1];
        return div(d * ans, d);
      }
      return U.weighted([
        [2, function () { const s = signs(); return mul(U.int(11, 15) * s[0], U.int(2, 9) * s[1]); }],
        [2, function () { const s = signs(); const d = U.int(2, 12) * s[0]; return div(d * U.int(11, 15) * s[1], d); }],
        [2, threeFactors],
        [2, missingFactor],
        [1, missingDivision],
        [1, mulThenDiv],
      ])();
    },
    diagnose: function (q, v) {
      return M.signDiagnose(q, v);
    },
    lesson: {
      intro: 'Multiplying and dividing with negative numbers is just normal times tables plus one extra job: working out the sign.',
      sections: [
        {
          title: 'The sign rules',
          html:
            '<div class="sign-grid">' +
            '<div><span class="s">+ × +</span><span class="r">+</span></div>' +
            '<div><span class="s">− × −</span><span class="r">+</span></div>' +
            '<div><span class="s">+ × −</span><span class="r neg">−</span></div>' +
            '<div><span class="s">− × +</span><span class="r neg">−</span></div>' +
            '</div>' +
            '<p><b>Same signs → positive. Different signs → negative.</b> Division follows exactly the same rules.</p>',
        },
        {
          title: 'Three steps every time',
          html:
            '<ol class="steps-list"><li>Decide the sign first.</li><li>Multiply or divide the numbers, ignoring the signs.</li><li>Write the sign in front of your answer.</li></ol>' +
            '<p class="example">−6 × (−4): same signs → +. 6 × 4 = 24. Answer <b>24</b></p>' +
            '<p class="example">−35 ÷ 7: different signs → −. 35 ÷ 7 = 5. Answer <b>−5</b></p>',
        },
        {
          title: 'Three or more numbers',
          html: '<p>Count the negatives. An <b>even</b> number of negatives gives a positive answer; an <b>odd</b> number gives a negative answer.</p>' +
            '<p class="example">−2 × 3 × (−5): two negatives (even) → +. 2 × 3 × 5 = 30. Answer <b>30</b></p>',
        },
        {
          title: 'Missing numbers',
          html: '<p>Use the opposite operation. If ? × (−4) = 28, then ? = 28 ÷ (−4) = <b>−7</b>. Check: −7 × (−4) = 28 ✓</p>',
        },
      ],
    },
  });
})(typeof window !== 'undefined' ? window : globalThis);
