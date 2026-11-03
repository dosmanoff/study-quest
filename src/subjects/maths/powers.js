/* Powers (indices) of positive and negative numbers. */
(function (root) {
  'use strict';
  const SQ = root.SQ, U = SQ.util, M = SQ.maths;

  function basic(base, exp) {
    const q = M.workOut(M.pow(base, exp));
    q.ask = 'Work out';
    q.answer = Math.pow(base, exp);
    q.steps = M.powSteps(base, exp);
    q.pow = { base: base, exp: exp };
    return q;
  }

  /** −n² (no brackets): the power belongs to n only. */
  function minusOutside(n, exp) {
    const v = -Math.pow(n, exp);
    const q = M.workOut(M.pow(n, exp, { neg: true }));
    q.ask = 'Work out';
    q.answer = v;
    q.trap = Math.pow(-n, exp); // what you get if you (wrongly) power the minus too
    q.steps = [
      M.line(M.pow(n, exp, { neg: true }).h + ' = −(' + M.pow(n, exp).h + ')',
        'No brackets, so the power belongs only to the ' + n + '. The minus waits outside.'),
      M.line('= −(' + new Array(exp).fill(n).join(' × ') + ')'),
      M.line('= <b>' + M.fmt(v) + '</b>'),
    ];
    if (exp % 2 === 0) {
      q.steps.push(M.line('', 'Compare: ' + M.pow(-n, exp).h + ' = ' + M.fmt(Math.pow(-n, exp)) +
        ', because there the brackets include the minus.'));
    }
    return q;
  }

  /** −(−n)² */
  function minusOfBracket(n, exp) {
    const inner = Math.pow(-n, exp);
    const v = -inner;
    const p = M.pow(-n, exp);
    const q = M.workOut(M.piece('−' + p.h, '−' + p.t));
    q.ask = 'Work out';
    q.answer = v;
    q.steps = [M.line(p.h + ' = ' + M.fmt(inner), 'Work out the power first.')]
      .concat([M.line('−(' + M.fmt(inner) + ') = <b>' + M.fmt(v) + '</b>', 'Then the minus in front changes the sign.')]);
    return q;
  }

  /** base^? = value */
  function missingPower() {
    const options = [[2, 2, 6], [3, 2, 4], [5, 2, 3], [10, 2, 6], [-2, 2, 6], [-3, 2, 4], [4, 2, 3]];
    const o = U.pick(options);
    const base = o[0], exp = U.int(o[1], o[2]);
    const v = Math.pow(base, exp);
    const p = M.pow(base, '?');
    const factors = new Array(exp).fill(M.br(base)).join(' × ');
    return {
      ask: 'Find the missing power',
      missing: 'power',
      prompt: p.h + ' = ' + M.fmt(v),
      text: p.t + ' = ' + M.fmt(v),
      answer: exp,
      steps: [
        M.line('', 'How many ' + M.br(base) + 's do you multiply together to get ' + M.fmt(v) + '?'),
        M.line(factors + ' = ' + M.fmt(v), 'Count them: ' + (M.WORDS[exp] || exp) + '.'),
        M.line('So the power is <b>' + exp + '</b>: ' + M.pow(base, exp).h + ' = ' + M.fmt(v)),
      ],
    };
  }

  /** ?³ = value (cube roots are unique, so negatives are fine) */
  function missingCubeBase() {
    const n = U.int(1, 5) * U.sign();
    const v = Math.pow(n, 3);
    return {
      ask: 'Find the missing number',
      prompt: M.BLANK + '<sup>3</sup> = ' + M.fmt(v),
      text: '?^3 = ' + M.fmt(v),
      answer: n,
      steps: [
        M.line('', 'Which number × itself × itself makes ' + M.fmt(v) + '?' +
          (v < 0 ? ' The answer is negative, so the number must be negative (odd power).' : '')),
        M.line(M.br(n) + ' × ' + M.br(n) + ' × ' + M.br(n) + ' = ' + M.fmt(v)),
        M.line('? = <b>' + M.fmt(n) + '</b>'),
      ],
    };
  }

  function positiveBase() {
    return U.weighted([
      [8, function () { return basic(U.chance(0.15) ? U.int(13, 15) : U.int(2, 12), 2); }],
      [5, function () { return basic(U.pick([1, 2, 3, 4, 5, 10]), 3); }],
      [3, function () { return basic(2, U.int(4, 7)); }],
      [1, function () { return basic(3, 4); }],
      [2, function () { return basic(10, U.int(2, 6)); }],
      [1, function () { return basic(U.int(2, 20), 1); }],
      [1, function () { return basic(1, U.int(3, 9)); }],
    ])();
  }

  function negativeBase() {
    return U.weighted([
      [7, function () { return basic(-U.int(1, 12), 2); }],
      [5, function () { return basic(-U.int(1, 5), 3); }],
      [3, function () { return basic(-1, U.int(2, 12)); }],
      [2, function () { return basic(-2, U.int(4, 6)); }],
      [1, function () { return basic(-3, 4); }],
      [1, function () { return basic(-10, U.int(2, 4)); }],
      [3, positiveBase],
    ])();
  }

  SQ.registerTopic({
    id: 'maths.powers',
    subject: 'maths',
    title: 'Powers & indices',
    short: 'Squares, cubes and powers of negative numbers',
    input: 'integer',
    levels: [
      { title: 'Positive numbers', description: 'Squares, cubes, powers of 2 and 10. Like 5³ and 2⁵.' },
      { title: 'Negative numbers', description: 'Brackets and signs, like (−3)², (−2)³ and (−1)⁷.' },
      { title: 'Tricky ones', description: '−3² versus (−3)², missing powers like 2^? = 32, and cube roots.' },
    ],
    generate: function (level) {
      if (level === 1) return positiveBase();
      if (level === 2) return negativeBase();
      return U.weighted([
        [3, function () { return minusOutside(U.int(2, 10), 2); }],
        [1, function () { return minusOutside(U.int(2, 4), 3); }],
        [2, function () { return basic(-U.int(2, 10), 2); }],
        [1, function () { return basic(-U.int(2, 4), 3); }],
        [1, function () { return minusOfBracket(U.int(2, 6), U.pick([2, 2, 3])); }],
        [3, missingPower],
        [2, missingCubeBase],
      ])();
    },
    diagnose: function (q, v) {
      if (q.trap !== undefined && v === q.trap) {
        return 'Watch the brackets! Without brackets only the number is raised to the power, and the minus stays outside.';
      }
      if (q.pow && v === q.pow.base * q.pow.exp && q.pow.exp > 1) {
        return 'Careful: ' + M.pow(q.pow.base, q.pow.exp).h + ' is not ' + M.br(q.pow.base) + ' × ' + q.pow.exp +
          '. The power tells you how many ' + M.br(q.pow.base) + 's to multiply together.';
      }
      if (q.missing === 'power' && v === -q.answer) {
        return 'The power counts how many numbers are multiplied together, so here it is a positive number.';
      }
      if (q.pow && q.pow.base > 0) {
        return M.signDiagnose(q, v, 'Right number, wrong sign! ' + q.pow.base + ' is positive, and a positive number to any power stays positive.');
      }
      return M.signDiagnose(q, v,
        'Right number, wrong sign! A negative number to an even power is positive; to an odd power it is negative.');
    },
    lesson: {
      intro: 'A power (also called an index) is a short way to write a number multiplied by itself again and again.',
      sections: [
        {
          title: 'What the power means',
          html: '<p class="big-example">5<sup>3</sup> = 5 × 5 × 5 = 125</p>' +
            '<p>The small number says <b>how many 5s</b> to multiply. It does <b>not</b> mean 5 × 3.</p>' +
            '<p>Power 2 is called <b>squared</b>, power 3 is <b>cubed</b>.</p>',
        },
        {
          title: 'Square and cube numbers to know',
          html: '<div class="num-grid">' +
            [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(function (n) {
              return '<span>' + n + '<sup>2</sup> = ' + n * n + '</span>';
            }).join('') + '</div><div class="num-grid">' +
            [1, 2, 3, 4, 5, 10].map(function (n) {
              return '<span>' + n + '<sup>3</sup> = ' + n * n * n + '</span>';
            }).join('') + '</div>',
        },
        {
          title: 'Negative numbers and powers',
          html: '<p class="example">(−2)<sup>2</sup> = (−2) × (−2) = <b>4</b></p>' +
            '<p class="example">(−2)<sup>3</sup> = (−2) × (−2) × (−2) = 4 × (−2) = <b>−8</b></p>' +
            '<p><b>Even power → positive. Odd power → negative.</b> Every pair of negatives makes a positive.</p>',
        },
        {
          title: 'Brackets change everything',
          html: '<p class="example">(−3)<sup>2</sup> = (−3) × (−3) = <b>9</b></p>' +
            '<p class="example">−3<sup>2</sup> = −(3 × 3) = <b>−9</b></p>' +
            '<p>Without brackets, the power belongs only to the 3. The minus is applied at the end.</p>',
        },
      ],
    },
  });
})(typeof window !== 'undefined' ? window : globalThis);
