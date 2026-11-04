/* Square roots and cube roots: the opposite of squaring and cubing. */
(function (root) {
  'use strict';
  const SQ = root.SQ, U = SQ.util, M = SQ.maths;

  function square(n) {
    const v = n * n;
    const q = M.workOut(M.sqrt(v));
    q.ask = 'Work out';
    q.answer = n;
    q.steps = [
      M.line(M.sqrt(v).h, 'The square root asks: which positive number × itself makes ' + v + '?'),
      M.line(n + ' × ' + n + ' = ' + v, 'So ' + M.sqrt(v).h + ' = <b>' + n + '</b>.'),
    ];
    q.traps = [[v / 2, 'A square root isn’t half. ' + M.sqrt(v).h + ' = ' + n + ' because ' + n + ' × ' + n + ' = ' + v + '.']];
    return q;
  }

  function cube(n) {
    const v = n * n * n;
    const q = M.workOut(M.cbrt(v));
    q.ask = 'Work out';
    q.answer = n;
    q.steps = [
      M.line(M.cbrt(v).h, 'The cube root asks: which number × itself × itself makes ' + M.fmt(v) + '?'),
      M.line(M.br(n) + ' × ' + M.br(n) + ' × ' + M.br(n) + ' = ' + M.fmt(v),
        n < 0 ? 'Three negatives multiplied give a negative, so the cube root of a negative number is negative.' : ''),
      M.line(M.cbrt(v).h + ' = <b>' + M.fmt(n) + '</b>'),
    ];
    q.traps = [[v / 3, 'A cube root isn’t a third. ' + M.cbrt(v).h + ' = ' + M.fmt(n) + ' because ' + M.br(n) + ' × ' + M.br(n) + ' × ' + M.br(n) + ' = ' + M.fmt(v) + '.']];
    if (n < 0) q.traps.push([-n, 'The answer must be negative: a positive number cubed is positive, but ' + M.fmt(v) + ' is negative.']);
    return q;
  }

  /** −√49: the minus waits outside the root. */
  function minusRoot() {
    const n = U.int(2, 12), v = n * n;
    const r = M.sqrt(v);
    const q = M.workOut(M.piece('−' + r.h, '−' + r.t));
    q.ask = 'Work out';
    q.answer = -n;
    q.steps = [M.line(r.h + ' = ' + n, 'First the square root.'), M.line('−' + r.h + ' = <b>' + M.fmt(-n) + '</b>', 'Then the minus in front.')];
    return q;
  }

  /** √a ± √b, √a × ∛b */
  function combined() {
    const a = U.int(1, 12), b = U.int(1, 10);
    const op = U.pick(['+', '−', '×']);
    const left = M.sqrt(a * a);
    const useCube = op === '×' && U.chance(0.5);
    const cb = U.pick([1, 2, 3, 4, 5]);
    const right = useCube ? M.cbrt(cb * cb * cb) : M.sqrt(b * b);
    const rv = useCube ? cb : b;
    const v = M.apply(a, op, rv);
    const q = M.workOut(M.join(left, M.op(op), right));
    q.ask = 'Work out';
    q.answer = v;
    q.steps = [
      M.line(left.h + ' = ' + a + ', ' + right.h + ' = ' + rv, 'Work out each root first.'),
      M.line(a + ' ' + op + ' ' + rv + ' = <b>' + M.fmt(v) + '</b>'),
    ];
    return q;
  }

  /** √(n²) and (√n)²: squaring and square-rooting undo each other. */
  function undo() {
    const n = U.int(2, 15);
    if (U.chance(0.5)) {
      const p = M.piece('√<span class="rad">' + n + '<sup>2</sup></span>', '√(' + n + '^2)');
      const q = M.workOut(p);
      q.ask = 'Work out';
      q.answer = n;
      q.steps = [M.line(n + '<sup>2</sup> = ' + n * n), M.line(M.sqrt(n * n).h + ' = <b>' + n + '</b>', 'Squaring then square-rooting gets you back where you started.')];
      return q;
    }
    const v = U.pick([4, 9, 16, 25, 36, 49, 64, 81, 100]);
    const p = M.piece('(' + M.sqrt(v).h + ')<sup>2</sup>', '(' + M.sqrt(v).t + ')^2');
    const q = M.workOut(p);
    q.ask = 'Work out';
    q.answer = v;
    q.steps = [M.line(M.sqrt(v).h + ' = ' + Math.sqrt(v)), M.line(Math.sqrt(v) + '<sup>2</sup> = <b>' + v + '</b>', 'Square-rooting then squaring gets you back to ' + v + '.')];
    return q;
  }

  /** √n to the nearest whole number (n not a square number). */
  function nearest() {
    let n;
    do { n = U.int(3, 200); } while (Number.isInteger(Math.sqrt(n)));
    const k = Math.floor(Math.sqrt(n));
    const half = (k + 0.5) * (k + 0.5);
    const ans = n < half ? k : k + 1;
    return {
      ask: 'Round to the nearest whole number',
      prompt: M.sqrt(n).h + ' ≈ ' + M.BLANK,
      text: M.sqrt(n).t + ' ≈ ?',
      verify: { expr: M.sqrt(n).t, mode: 'round' },
      answer: ans,
      steps: [
        M.line(k + '<sup>2</sup> = ' + k * k + ' and ' + (k + 1) + '<sup>2</sup> = ' + (k + 1) * (k + 1),
          'So ' + M.sqrt(n).h + ' is between ' + k + ' and ' + (k + 1) + '.'),
        M.line(String(k + 0.5) + '<sup>2</sup> = ' + half, 'Check the halfway number. ' + n + (n < half ? ' is less' : ' is more') + ' than ' + half + '.'),
        M.line(M.sqrt(n).h + ' ≈ <b>' + ans + '</b>'),
      ],
      traps: [[ans === k ? k + 1 : k, 'Close! Compare ' + n + ' with the halfway number ' + (k + 0.5) + '<sup>2</sup> = ' + half + ' to see which whole number is nearer.']],
    };
  }

  /** "√90 is between ? and 10" and the same for cube roots. */
  function between() {
    const useCube = U.chance(0.35);
    let n, k;
    if (useCube) {
      do { n = U.int(2, 130); } while (Number.isInteger(Math.round(Math.cbrt(n))) && Math.round(Math.cbrt(n)) ** 3 === n);
      k = Math.floor(Math.cbrt(n) + 1e-9);
    } else {
      do { n = U.int(3, 200); } while (Number.isInteger(Math.sqrt(n)));
      k = Math.floor(Math.sqrt(n));
    }
    const r = useCube ? M.cbrt(n) : M.sqrt(n);
    const pw = useCube ? 3 : 2;
    return {
      ask: 'Fill in the whole number just below',
      prompt: M.BLANK + ' &lt; ' + r.h + ' &lt; ' + (k + 1),
      text: '? < ' + r.t + ' < ' + (k + 1),
      verify: { expr: r.t, mode: 'floor' },
      answer: k,
      steps: [
        M.line(k + '<sup>' + pw + '</sup> = ' + Math.pow(k, pw) + ' and ' + (k + 1) + '<sup>' + pw + '</sup> = ' + Math.pow(k + 1, pw),
          n + ' is between them, so ' + r.h + ' is between ' + k + ' and ' + (k + 1) + '.'),
        M.line('Answer: <b>' + k + '</b>'),
      ],
    };
  }

  SQ.registerTopic({
    id: 'maths.roots',
    subject: 'maths',
    title: 'Square & cube roots',
    short: 'Undoing squares and cubes, and estimating roots',
    input: 'integer',
    levels: [
      { title: 'Roots of square and cube numbers', description: 'Like √49, √144 and ∛64.' },
      { title: 'Negatives and mixed', description: 'Like ∛−27, −√36, √25 + √16 and (√9)².' },
      { title: 'Estimating', description: 'Like √50 to the nearest whole number, and which two numbers √90 is between.' },
    ],
    generate: function (level) {
      if (level === 1) {
        return U.weighted([
          [3, function () { return square(U.int(1, 15)); }],
          [1, function () { return cube(U.pick([1, 2, 3, 4, 5, 10])); }],
        ])();
      }
      if (level === 2) {
        return U.weighted([
          [3, function () { return cube(-U.int(1, 5)); }],
          [2, minusRoot],
          [3, combined],
          [2, undo],
          [1, function () { return square(U.int(11, 15)); }],
        ])();
      }
      return U.weighted([[3, nearest], [2, between]])();
    },
    diagnose: function (q, v) {
      return M.trapDiagnose(q, v, 'Right number, wrong sign! A square root is never negative; the cube root of a negative number is negative.');
    },
    lesson: {
      intro: 'A root undoes a power. Squaring 7 gives 49, so the square root of 49 is 7.',
      sections: [
        {
          title: 'Square roots',
          html: '<p class="big-example">√<span class="rad">49</span> = 7 because 7 × 7 = 49</p>' +
            '<p>The √ sign means the <b>positive</b> square root. Learn the square numbers: they are your table of square roots.</p>' +
            '<div class="num-grid">' + [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(function (n) {
              return '<span>√' + n * n + ' = ' + n + '</span>';
            }).join('') + '</div>',
        },
        {
          title: 'Cube roots',
          html: '<p class="example">∛<span class="rad">64</span> = 4 because 4 × 4 × 4 = 64</p>' +
            '<p class="example">∛<span class="rad">−27</span> = −3 because (−3) × (−3) × (−3) = −27</p>' +
            '<p>A negative number has a cube root, and it is negative. It has no square root you can find this year.</p>',
        },
        {
          title: 'Estimating',
          html: '<p>Find the square numbers either side. 49 < 50 < 64, so √50 is between 7 and 8.</p>' +
            '<p>To round, check the halfway number: 7.5² = 56.25. 50 is less, so <b>√50 ≈ 7</b>.</p>',
        },
      ],
    },
  });
})(typeof window !== 'undefined' ? window : globalThis);
