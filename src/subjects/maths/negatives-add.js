/* Adding and subtracting negative (directed) numbers. */
(function (root) {
  'use strict';
  const SQ = root.SQ, U = SQ.util, M = SQ.maths;

  function nz(lo, hi) { return U.int(lo, hi) * U.sign(); }

  /** Number-line explanation for a + b or a − b where b is positive. */
  function lineSteps(a, op, b) {
    const v = op === '+' ? a + b : a - b;
    const dir = op === '+' ? 'up (to the right)' : 'down (to the left)';
    const steps = [
      M.line('', 'Start at <b>' + M.fmt(a) + '</b> on the number line. ' +
        (op === '+' ? 'Adding' : 'Subtracting') + ' ' + b + ' means moving ' + b + ' ' + dir + '.'),
    ];
    if (op === '+' && a < 0 && v > 0) {
      steps.push(M.line('', Math.abs(a) + ' steps up gets you to 0, then ' + v + ' more.'));
    } else if (op === '−' && a > 0 && v < 0) {
      steps.push(M.line('', a + ' steps down gets you to 0, then ' + Math.abs(v) + ' more.'));
    }
    steps.push(M.line(M.fmt(a) + ' ' + op + ' ' + b + ' = <b>' + M.fmt(v) + '</b>'));
    return steps;
  }

  /** a ± b with a positive b: no double signs. */
  function simple(a, op, b) {
    const v = op === '+' ? a + b : a - b;
    const q = M.workOut(M.join(M.num(a), M.op(op), M.num(b)));
    q.ask = 'Work out';
    q.answer = v;
    q.steps = lineSteps(a, op, b);
    q.traps = [[op === '+' ? a - b : a + b, 'You moved the wrong way on the number line. + moves up (right), − moves down (left).']];
    return q;
  }

  /** a − (−b) or a + (−b): two signs next to each other. */
  function doubleSign(a, op, b) {
    // b > 0; the question shows a op (−b)
    const v = op === '−' ? a + b : a - b;
    const plain = op === '−' ? '+' : '−';
    const q = M.workOut(M.join(M.num(a), M.op(op), M.num(-b, true)));
    q.ask = 'Work out';
    q.answer = v;
    q.steps = [
      M.line(M.fmt(a) + ' ' + op + ' ' + M.br(-b) + ' = ' + M.fmt(a) + ' ' + plain + ' ' + b,
        op === '−' ? 'Two minus signs next to each other make a plus: − (−) = +.' : 'Adding a negative is the same as subtracting: + (−) = −.'),
    ].concat(lineSteps(a, plain, b));
    q.traps = [[op === '−' ? a - b : a + b, op === '−'
      ? 'Watch the two minus signs: subtracting a negative is adding. ' + M.fmt(a) + ' − ' + M.br(-b) + ' = ' + M.fmt(a) + ' + ' + b + '.'
      : 'Adding a negative number makes the answer smaller: ' + M.fmt(a) + ' + ' + M.br(-b) + ' = ' + M.fmt(a) + ' − ' + b + '.']];
    return q;
  }

  function twoTerms(max) {
    const a = nz(1, max), b = U.int(1, max);
    if (U.chance(0.45)) return doubleSign(a, U.chance(0.5) ? '−' : '+', b);
    return simple(a, U.chance(0.5) ? '+' : '−', b);
  }

  function threeTerms() {
    const seq = [{ n: nz(1, 15) }, U.chance(0.5) ? '+' : '−', { n: nz(1, 15) }, U.chance(0.5) ? '+' : '−', { n: nz(1, 15) }];
    const w = M.seqSteps(seq);
    const q = M.workOut(M.seqPiece(seq));
    q.ask = 'Work out';
    q.answer = w.value;
    q.steps = [M.line('', 'Only + and − here, so work from left to right, one step at a time.')].concat(w.steps);
    return q;
  }

  /** ? ± b = c  or  a ± ? = c */
  function missing() {
    const a = nz(1, 15), b = nz(1, 15), op = U.chance(0.5) ? '+' : '−';
    const c = op === '+' ? a + b : a - b;
    if (U.chance(0.5)) {
      // ? op b = c  ->  ? = c (inverse op) b
      const inv = op === '+' ? '−' : '+';
      const lhs = M.join(M.piece(M.BLANK, '?'), M.op(op), M.num(b, true));
      return {
        ask: 'Find the missing number', prompt: lhs.h + ' = ' + M.fmt(c), text: lhs.t + ' = ' + M.fmt(c), answer: a,
        steps: [
          M.line('? ' + op + ' ' + M.br(b) + ' = ' + M.fmt(c), 'Undo the ' + op + ' by doing the opposite.'),
          M.line('? = ' + M.fmt(c) + ' ' + inv + ' ' + M.br(b) + ' = <b>' + M.fmt(a) + '</b>'),
          M.line('', 'Check: ' + M.fmt(a) + ' ' + op + ' ' + M.br(b) + ' = ' + M.fmt(c) + ' ✓'),
        ],
      };
    }
    // a op ? = c  ->  ? = c − a  (for +)  or  ? = a − c  (for −)
    const lhs = M.join(M.num(a), M.op(op), M.piece(M.BLANK, '?'));
    const how = op === '+'
      ? M.line('? = ' + M.fmt(c) + ' − ' + M.br(a) + ' = <b>' + M.fmt(b) + '</b>', 'Subtract ' + M.fmt(a) + ' from both sides.')
      : M.line('? = ' + M.fmt(a) + ' − ' + M.br(c) + ' = <b>' + M.fmt(b) + '</b>', 'Swap the missing number and the answer.');
    return {
      ask: 'Find the missing number', prompt: lhs.h + ' = ' + M.fmt(c), text: lhs.t + ' = ' + M.fmt(c), answer: b,
      steps: [M.line(M.fmt(a) + ' ' + op + ' ? = ' + M.fmt(c)), how,
        M.line('', 'Check: ' + M.fmt(a) + ' ' + op + ' ' + M.br(b) + ' = ' + M.fmt(c) + ' ✓')],
    };
  }

  /** Temperature questions: real numbers below zero. */
  function temperature() {
    const start = U.int(-12, 8);
    const change = U.int(2, 15);
    const rises = start < 0 ? U.chance(0.6) : U.chance(0.3);
    const end = rises ? start + change : start - change;
    return {
      ask: 'Temperature',
      prompt: '<span class="words">It is ' + M.fmt(start) + '&nbsp;°C. The temperature ' + (rises ? 'rises' : 'falls') + ' by ' + change + '&nbsp;°C.<br>Now it is</span> [[?]]&nbsp;°C',
      text: M.fmt(start) + ' °C ' + (rises ? 'rises' : 'falls') + ' by ' + change + ' °C = ? °C',
      verify: M.fmt(start) + ' ' + (rises ? '+' : '−') + ' ' + change + ' = ?',
      answer: end,
      steps: lineSteps(start, rises ? '+' : '−', change),
      traps: [[rises ? start - change : start + change, 'Check the direction: rises means up (add), falls means down (subtract).']],
    };
  }

  SQ.registerTopic({
    id: 'maths.negatives-add',
    subject: 'maths',
    title: 'Negative numbers: + and −',
    short: 'Adding and subtracting with negative numbers',
    input: 'integer',
    levels: [
      { title: 'Number line', description: 'Like −7 + 3, 4 − 9 and −2 − 5. Numbers up to 10.' },
      { title: 'Two signs together', description: 'Like 5 − (−8) and −3 + (−6), plus temperatures.' },
      { title: 'Mixed challenge', description: 'Bigger numbers, three numbers at once, and missing numbers.' },
    ],
    generate: function (level) {
      if (level === 1) {
        let a, b, op, v;
        do {
          a = U.chance(0.7) ? -U.int(1, 10) : U.int(1, 10);
          b = U.int(1, 10);
          op = U.chance(0.5) ? '+' : '−';
          v = op === '+' ? a + b : a - b;
        } while (a > 0 && v >= 0); // something negative every time
        return simple(a, op, b);
      }
      if (level === 2) {
        return U.weighted([
          [5, function () { return doubleSign(nz(1, 12), U.chance(0.55) ? '−' : '+', U.int(1, 12)); }],
          [2, temperature],
        ])();
      }
      return U.weighted([
        [3, function () { return twoTerms(50); }],
        [3, threeTerms],
        [3, missing],
        [1, temperature],
      ])();
    },
    diagnose: function (q, v) {
      return M.trapDiagnose(q, v, 'Right number, wrong sign! Picture the number line: which side of 0 do you end up?');
    },
    lesson: {
      intro: 'Adding and subtracting negative numbers is all about the number line: up for adding, down for subtracting.',
      sections: [
        {
          title: 'Use the number line',
          html: '<div class="number-line" aria-hidden="true">' +
            [-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6].map(function (n) {
              return '<span' + (n === 0 ? ' class="zero"' : '') + '>' + M.fmt(n) + '</span>';
            }).join('') + '</div>' +
            '<p><b>+ moves up</b> (right). <b>− moves down</b> (left).</p>' +
            '<p class="example">−4 + 6: start at −4, move 6 up → <b>2</b></p>' +
            '<p class="example">3 − 7: start at 3, move 7 down → <b>−4</b></p>',
        },
        {
          title: 'Two signs next to each other',
          html: '<div class="sign-grid">' +
            '<div><span class="s">− (−)</span><span class="r">+</span></div>' +
            '<div><span class="s">+ (−)</span><span class="r neg">−</span></div>' +
            '</div>' +
            '<p class="example">5 − (−8) = 5 + 8 = <b>13</b></p>' +
            '<p class="example">−3 + (−6) = −3 − 6 = <b>−9</b></p>',
        },
        {
          title: 'Temperatures',
          html: '<p>Below zero works the same way. It is −4 °C and it gets 9 °C warmer: −4 + 9 = <b>5 °C</b>.</p>',
        },
      ],
    },
  });
})(typeof window !== 'undefined' ? window : globalThis);
