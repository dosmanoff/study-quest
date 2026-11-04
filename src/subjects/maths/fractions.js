/* Fractions: equivalent fractions, simplifying, the four operations, mixed numbers. */
(function (root) {
  'use strict';
  const SQ = root.SQ, U = SQ.util, M = SQ.maths;
  const F = M.fracHtml;
  const DENOMS = [2, 3, 4, 5, 6, 8, 9, 10, 12];

  /** Random proper fraction p/q in lowest terms with q from the list. */
  function proper(maxDen) {
    let p, q;
    do {
      q = U.pick(DENOMS.filter(function (d) { return d <= (maxDen || 12); }));
      p = U.int(1, q - 1);
    } while (M.gcd(p, q) !== 1);
    return [p, q];
  }

  function result(n, d, mixed) { return '<b>' + M.fracValueHtml(n, d, mixed) + '</b>'; }

  /** "Simplify: 12/18 = 2/3" line, if it simplifies at all. */
  function simplifyStep(n, d) {
    const g = M.gcd(n, d);
    if (g === 1) return [];
    const s = M.simplify(n, d);
    return [M.line(F(n, d) + ' = ' + result(n, d), 'Simplify: divide the top and the bottom by ' + g + '.')];
  }

  /** "17/12 = 1 5/12" line for top-heavy answers. */
  function mixedNote(n, d) {
    const s = M.simplify(n, d);
    if (s[0] <= s[1] || s[1] === 1) return [];
    return [M.line('', 'As a mixed number: ' + M.fracValueHtml(n, d, true) + '. Either way is right.')];
  }

  /** "3/4 = 9/12 (× 3), 1/6 = 2/12 (× 2)", leaving out fractions that already have the bottom L. */
  function convertLine(parts, L) {
    const changed = parts.filter(function (p) { return p[1] !== L; });
    return M.line(changed.map(function (p) { return F(p[0], p[1]) + ' = ' + F(p[2], L); }).join(', &nbsp;'),
      'Multiply the top and the bottom by the same number: ' +
      changed.map(function (p) { return '× ' + L / p[1]; }).join(' and ') + '.');
  }

  function fq(o) {
    o.input = 'fraction';
    o.ftraps = (o.ftraps || []).filter(function (t) { return t[0] && t[1]; });
    return o;
  }

  /* ----- level 1: equivalent fractions, simplifying, fraction of an amount ----- */

  function simplify() {
    const pq = proper(12), k = U.int(2, 9);
    const N = pq[0] * k, D = pq[1] * k;
    return fq({
      ask: 'Simplify fully',
      prompt: F(N, D) + ' = ' + M.BLANK,
      text: N + '/' + D + ' = ?',
      verify: M.fv(N, D) + ' = ?',
      answer: M.fracAnswer(N, D),
      steps: [
        M.line('', 'Find the highest common factor (HCF) of ' + N + ' and ' + D + '. It is <b>' + k + '</b>.'),
        M.line(F(N, D) + ' = ' + F(N + ' ÷ ' + k, D + ' ÷ ' + k) + ' = ' + result(N, D), 'Divide the top and the bottom by ' + k + '.'),
        M.line('', 'Smaller steps are fine too, as long as you keep going until nothing else divides both numbers.'),
      ],
    });
  }

  function missing() {
    const pq = proper(12), k = U.int(2, 9);
    const p = pq[0], q = pq[1];
    const top = U.chance(0.6);
    const right = top ? F(M.BLANK, q * k) : F(p * k, M.BLANK);
    return {
      ask: 'Find the missing number',
      prompt: F(p, q) + ' = ' + right,
      text: p + '/' + q + ' = ' + (top ? '?/' + q * k : p * k + '/?'),
      verify: M.fv(p, q) + ' = ' + (top ? '(?/' + q * k + ')' : '(' + p * k + '/?)'),
      answer: top ? p * k : q * k,
      input: 'integer',
      steps: top
        ? [M.line(q + ' × ' + k + ' = ' + q * k, 'The bottom was multiplied by ' + k + '.'),
          M.line(p + ' × ' + k + ' = <b>' + p * k + '</b>', 'Do the same to the top.')]
        : [M.line(p + ' × ' + k + ' = ' + p * k, 'The top was multiplied by ' + k + '.'),
          M.line(q + ' × ' + k + ' = <b>' + q * k + '</b>', 'Do the same to the bottom.')],
      traps: [[top ? p + (q * k - q) : q + (p * k - p), 'Multiply, don’t add: whatever you multiply the bottom by, multiply the top by the same number.']],
    };
  }

  function ofAmount() {
    const pq = proper(10), m = U.int(2, 12);
    const p = pq[0], q = pq[1], amount = q * m;
    const traps = [];
    if ((amount * q) % p === 0) traps.push([amount * q / p, 'Other way round: divide by the bottom number (' + q + '), then multiply by the top (' + p + ').']);
    if (p > 1) traps.push([m, 'That’s ' + F(1, q) + ' of ' + amount + '. Now multiply by the top number, ' + p + '.']);
    return {
      ask: 'Work out',
      prompt: F(p, q) + ' of ' + amount + ' = ' + M.BLANK,
      text: p + '/' + q + ' of ' + amount + ' = ?',
      verify: M.fv(p, q) + ' × ' + amount + ' = ?',
      answer: p * m,
      input: 'integer',
      steps: [
        M.line(amount + ' ÷ ' + q + ' = ' + m, 'Divide by the bottom: that gives ' + F(1, q) + ' of ' + amount + '.'),
        M.line(m + ' × ' + p + ' = <b>' + p * m + '</b>', 'Multiply by the top.'),
      ],
      traps: traps,
    };
  }

  /* ----- level 2: adding and subtracting ----- */

  function sameDen() {
    const d = U.pick([3, 4, 5, 6, 7, 8, 9, 10, 12]);
    const op = U.chance(0.5) ? '+' : '−';
    let a, b;
    do { a = U.int(1, d - 1); b = U.int(1, d - 1); } while (op === '−' && a <= b);
    const c = op === '+' ? a + b : a - b;
    return fq({
      ask: 'Work out. Simplify if you can',
      prompt: F(a, d) + ' ' + op + ' ' + F(b, d) + ' = ' + M.BLANK,
      text: a + '/' + d + ' ' + op + ' ' + b + '/' + d + ' = ?',
      verify: M.fv(a, d) + ' ' + op + ' ' + M.fv(b, d) + ' = ?',
      answer: M.fracAnswer(c, d),
      steps: [M.line(F(a, d) + ' ' + op + ' ' + F(b, d) + ' = ' + F(a + ' ' + op + ' ' + b, d) + ' = ' + F(c, d),
        'The bottoms are the same, so ' + (op === '+' ? 'add' : 'subtract') + ' the tops. The bottom stays ' + d + '.')]
        .concat(simplifyStep(c, d), mixedNote(c, d)),
      ftraps: op === '+' ? [[M.fracAnswer(c, 2 * d), 'Keep the bottom the same: ' + F(a, d) + ' + ' + F(b, d) + ' is ' + c + ' lots of ' + F(1, d) + '. Only add the tops.']] : [],
    });
  }

  function diffDen() {
    let x, y, L;
    do { x = proper(12); y = proper(12); L = M.lcm(x[1], y[1]); } while (x[1] === y[1] || L > 36);
    let op = U.chance(0.55) ? '+' : '−';
    if (op === '−' && x[0] * y[1] < y[0] * x[1]) { const t = x; x = y; y = t; }
    if (op === '−' && x[0] * y[1] === y[0] * x[1]) op = '+';
    const A = x[0] * (L / x[1]), B = y[0] * (L / y[1]);
    const R = op === '+' ? A + B : A - B;
    return fq({
      ask: 'Work out. Simplify if you can',
      prompt: F(x[0], x[1]) + ' ' + op + ' ' + F(y[0], y[1]) + ' = ' + M.BLANK,
      text: x[0] + '/' + x[1] + ' ' + op + ' ' + y[0] + '/' + y[1] + ' = ?',
      verify: M.fv(x[0], x[1]) + ' ' + op + ' ' + M.fv(y[0], y[1]) + ' = ?',
      answer: M.fracAnswer(R, L),
      steps: [
        M.line('', 'Make the bottoms the same. The lowest common multiple of ' + x[1] + ' and ' + y[1] + ' is <b>' + L + '</b>.'),
        convertLine([[x[0], x[1], A], [y[0], y[1], B]], L),
        M.line(F(A, L) + ' ' + op + ' ' + F(B, L) + ' = ' + F(R, L), (op === '+' ? 'Add' : 'Subtract') + ' the tops.'),
      ].concat(simplifyStep(R, L), mixedNote(R, L)),
      ftraps: op === '+'
        ? [[M.fracAnswer(x[0] + y[0], x[1] + y[1]), 'Don’t add the bottoms. First change both fractions to the same bottom number, then add the tops.']]
        : [],
    });
  }

  function fromWhole() {
    const pq = proper(12), w = U.chance(0.7) ? 1 : U.int(2, 3);
    const R = w * pq[1] - pq[0];
    return fq({
      ask: 'Work out',
      prompt: w + ' − ' + F(pq[0], pq[1]) + ' = ' + M.BLANK,
      text: w + ' − ' + pq[0] + '/' + pq[1] + ' = ?',
      verify: w + ' − ' + M.fv(pq[0], pq[1]) + ' = ?',
      answer: M.fracAnswer(R, pq[1]),
      steps: [
        M.line(w + ' = ' + F(w * pq[1], pq[1]), 'Write the whole number with the same bottom: ' + (w === 1 ? '1 whole is ' : w + ' wholes are ') + w * pq[1] + ' ' + (pq[1] === 2 ? 'halves' : 'pieces of ' + F(1, pq[1])) + '.'),
        M.line(F(w * pq[1], pq[1]) + ' − ' + F(pq[0], pq[1]) + ' = ' + result(R, pq[1])),
      ].concat(mixedNote(R, pq[1])),
    });
  }

  /* ----- level 3: multiplying and dividing ----- */

  function mul() {
    const x = proper(10), y = proper(10);
    const n = x[0] * y[0], d = x[1] * y[1];
    return fq({
      ask: 'Work out. Simplify fully',
      prompt: F(x[0], x[1]) + ' × ' + F(y[0], y[1]) + ' = ' + M.BLANK,
      text: x[0] + '/' + x[1] + ' × ' + y[0] + '/' + y[1] + ' = ?',
      verify: M.fv(x[0], x[1]) + ' × ' + M.fv(y[0], y[1]) + ' = ?',
      answer: M.fracAnswer(n, d),
      steps: [M.line(F(x[0], x[1]) + ' × ' + F(y[0], y[1]) + ' = ' + F(x[0] + ' × ' + y[0], x[1] + ' × ' + y[1]) + ' = ' + F(n, d),
        'Multiply the tops together and the bottoms together.')].concat(simplifyStep(n, d)),
      ftraps: [[M.fracAnswer(x[0] * y[1] + y[0] * x[1], x[1] * y[1]), 'That’s adding. For × just multiply top × top and bottom × bottom.']],
    });
  }

  function intMul() {
    const x = proper(12), k = U.int(2, 12);
    const n = k * x[0], d = x[1];
    return fq({
      ask: 'Work out. Simplify fully',
      prompt: k + ' × ' + F(x[0], x[1]) + ' = ' + M.BLANK,
      text: k + ' × ' + x[0] + '/' + x[1] + ' = ?',
      verify: k + ' × ' + M.fv(x[0], x[1]) + ' = ?',
      answer: M.fracAnswer(n, d),
      steps: [M.line(k + ' × ' + F(x[0], x[1]) + ' = ' + F(k + ' × ' + x[0], x[1]) + ' = ' + F(n, d), 'Multiply only the top. ' + k + ' lots of ' + F(x[0], x[1]) + '.')]
        .concat(simplifyStep(n, d), mixedNote(n, d)),
      ftraps: [[M.fracAnswer(x[0], x[1]), 'Only the top is multiplied: ' + k + ' × ' + F(x[0], x[1]) + ' = ' + F(k + ' × ' + x[0], x[1]) + '. Multiplying the bottom too changes nothing.']],
    });
  }

  function div() {
    const x = proper(10), y = proper(10);
    const n = x[0] * y[1], d = x[1] * y[0];
    return fq({
      ask: 'Work out. Simplify fully',
      prompt: F(x[0], x[1]) + ' ÷ ' + F(y[0], y[1]) + ' = ' + M.BLANK,
      text: x[0] + '/' + x[1] + ' ÷ ' + y[0] + '/' + y[1] + ' = ?',
      verify: M.fv(x[0], x[1]) + ' ÷ ' + M.fv(y[0], y[1]) + ' = ?',
      answer: M.fracAnswer(n, d),
      steps: [
        M.line(F(x[0], x[1]) + ' ÷ ' + F(y[0], y[1]) + ' = ' + F(x[0], x[1]) + ' × ' + F(y[1], y[0]),
          '<b>Keep</b> the first fraction, <b>change</b> ÷ to ×, <b>flip</b> the second fraction.'),
        M.line('= ' + F(n, d), 'Multiply the tops and the bottoms.'),
      ].concat(simplifyStep(n, d), mixedNote(n, d)),
      ftraps: [
        [M.fracAnswer(x[0] * y[0], x[1] * y[1]), 'Keep, change, flip: turn ÷ into × and flip the second fraction before multiplying.'],
        [M.fracAnswer(x[1] * y[0], x[0] * y[1]), 'Flip only the second fraction, not the first.'],
      ],
    });
  }

  function divInt() {
    const x = proper(10), k = U.int(2, 6);
    const n = x[0], d = x[1] * k;
    return fq({
      ask: 'Work out. Simplify fully',
      prompt: F(x[0], x[1]) + ' ÷ ' + k + ' = ' + M.BLANK,
      text: x[0] + '/' + x[1] + ' ÷ ' + k + ' = ?',
      verify: M.fv(x[0], x[1]) + ' ÷ ' + k + ' = ?',
      answer: M.fracAnswer(n, d),
      steps: [
        M.line(F(x[0], x[1]) + ' ÷ ' + k + ' = ' + F(x[0], x[1]) + ' × ' + F(1, k), 'Dividing by ' + k + ' is the same as multiplying by ' + F(1, k) + '.'),
        M.line('= ' + F(x[0], x[1] + ' × ' + k) + ' = ' + F(n, d)),
      ].concat(simplifyStep(n, d)),
      ftraps: [[M.fracAnswer(x[0] * k, x[1]), 'Dividing makes it smaller: ÷ ' + k + ' multiplies the bottom by ' + k + ', not the top.']],
    });
  }

  /* ----- level 4: mixed numbers ----- */

  function toMixed() {
    let D, r;
    do { D = U.int(2, 12); r = U.int(1, D - 1); } while (M.gcd(r, D) !== 1);
    const w = U.int(1, 9), N = w * D + r;
    return fq({
      ask: 'Write as a mixed number',
      wantForm: 'mixed',
      prompt: F(N, D) + ' = ' + M.BLANK,
      text: N + '/' + D + ' = ? (mixed number)',
      verify: M.fv(N, D) + ' = ?',
      answer: N + '/' + D,
      steps: [
        M.line(D + ' × ' + w + ' = ' + D * w, 'How many whole ' + D + 's fit into ' + N + '? ' + w + ', with ' + r + ' left over.'),
        M.line(F(N, D) + ' = <b>' + w + F(r, D) + '</b>'),
      ],
    });
  }

  function toImproper() {
    let D, r;
    do { D = U.int(2, 12); r = U.int(1, D - 1); } while (M.gcd(r, D) !== 1);
    const w = U.int(1, 9), N = w * D + r;
    return fq({
      ask: 'Write as an improper (top-heavy) fraction',
      wantForm: 'improper',
      prompt: w + F(r, D) + ' = ' + M.BLANK,
      text: w + ' ' + r + '/' + D + ' = ? (improper fraction)',
      verify: M.mv(w, r, D) + ' = ?',
      answer: N + '/' + D,
      steps: [
        M.line(w + ' × ' + D + ' + ' + r + ' = ' + N, 'Each whole is ' + D + ' pieces: ' + w + ' wholes are ' + w * D + ' pieces, plus ' + r + ' more.'),
        M.line(w + F(r, D) + ' = <b>' + F(N, D) + '</b>'),
      ],
      ftraps: [[M.fracAnswer(w * r, D) === N + '/' + D ? '' : M.fracAnswer(w * r, D), 'Multiply the whole number by the bottom, then add the top: ' + w + ' × ' + D + ' + ' + r + '.']],
    });
  }

  function addMixed() {
    let x, y;
    do { x = proper(8); y = proper(8); } while (M.lcm(x[1], y[1]) > 24);
    const w1 = U.int(1, 5), w2 = U.int(1, 4);
    let op = U.chance(0.6) ? '+' : '−';
    const N1 = w1 * x[1] + x[0], N2 = w2 * y[1] + y[0];
    let a = [w1, x, N1], b = [w2, y, N2];
    if (op === '−' && N1 * y[1] <= N2 * x[1]) { const t = a; a = b; b = t; }
    if (op === '−' && a[2] * b[1][1] === b[2] * a[1][1]) op = '+';
    const L = M.lcm(a[1][1], b[1][1]);
    const A = a[2] * (L / a[1][1]), B = b[2] * (L / b[1][1]);
    const R = op === '+' ? A + B : A - B;
    return fq({
      ask: 'Work out',
      prompt: a[0] + F(a[1][0], a[1][1]) + ' ' + op + ' ' + b[0] + F(b[1][0], b[1][1]) + ' = ' + M.BLANK,
      text: a[0] + ' ' + a[1][0] + '/' + a[1][1] + ' ' + op + ' ' + b[0] + ' ' + b[1][0] + '/' + b[1][1] + ' = ?',
      verify: M.mv(a[0], a[1][0], a[1][1]) + ' ' + op + ' ' + M.mv(b[0], b[1][0], b[1][1]) + ' = ?',
      answer: M.fracAnswer(R, L),
      steps: [
        M.line(a[0] + F(a[1][0], a[1][1]) + ' = ' + F(a[2], a[1][1]) + ', &nbsp;' + b[0] + F(b[1][0], b[1][1]) + ' = ' + F(b[2], b[1][1]),
          'Turn both into improper fractions.'),
        M.line('= ' + F(A, L) + ' ' + op + ' ' + F(B, L), 'Make the bottoms the same: ' + L + '.'),
        M.line('= ' + F(R, L) + ' = <b>' + M.fracValueHtml(R, L, true) + '</b>', (op === '+' ? 'Add' : 'Subtract') + ' the tops, simplify, and turn it back into a mixed number.'),
      ],
    });
  }

  SQ.registerTopic({
    id: 'maths.fractions',
    subject: 'maths',
    title: 'Fractions',
    short: 'Simplifying, the four operations and mixed numbers',
    input: 'fraction',
    levels: [
      { title: 'Equivalent fractions', description: 'Simplify 12/18, find 3/4 = ?/20, and work out 3/5 of 40.' },
      { title: 'Add & subtract', description: 'Like 2/7 + 3/7, 3/4 + 1/6 and 1 − 3/8.' },
      { title: 'Multiply & divide', description: 'Like 2/3 × 3/5, 4 × 3/8, 2/3 ÷ 4/5 and 3/4 ÷ 2.' },
      { title: 'Mixed numbers', description: 'Like 17/5 as a mixed number, 2 1/3 as a top-heavy fraction, and 1 1/2 + 2 3/4.' },
    ],
    generate: function (level) {
      if (level === 1) return U.weighted([[3, simplify], [3, missing], [3, ofAmount]])();
      if (level === 2) return U.weighted([[3, sameDen], [5, diffDen], [1, fromWhole]])();
      if (level === 3) return U.weighted([[3, mul], [2, intMul], [3, div], [2, divInt]])();
      return U.weighted([[2, toMixed], [2, toImproper], [4, addMixed]])();
    },
    diagnose: function (q, v) {
      if (v && typeof v === 'object' && v.d) {
        const hit = (q.ftraps || []).find(function (t) {
          const f = SQ.engine.parseFraction(t[0]);
          return f && f.d && f.n * v.d === v.n * f.d;
        });
        return hit ? hit[1] : null;
      }
      return M.trapDiagnose(q, v);
    },
    lesson: {
      intro: 'A fraction is a number of equal parts: the bottom says how many parts make a whole, the top says how many you have.',
      sections: [
        {
          title: 'How to type a fraction',
          html: '<p>Fill in the top and the bottom box. For a mixed number like 2' + F(1, 3) + ', put the whole number in the small box in front.</p>' +
            '<p>Always give the <b>simplest form</b>. If your answer is right but can still be simplified, you’ll be asked to simplify it. That doesn’t count as a mistake.</p>',
        },
        {
          title: 'Equivalent fractions and simplifying',
          html: '<p>Multiply or divide the top and the bottom by the same number and the fraction stays the same size.</p>' +
            '<p class="example">' + F(3, 4) + ' = ' + F(15, 20) + ' (× 5) &nbsp;&nbsp; ' + F(12, 18) + ' = ' + F(2, 3) + ' (÷ 6, the HCF)</p>' +
            '<p class="example">' + F(3, 5) + ' of 40: 40 ÷ 5 = 8, then 8 × 3 = <b>24</b></p>',
        },
        {
          title: 'Adding and subtracting',
          html: '<p>The bottoms must be the same. Then add or subtract the tops; the bottom stays.</p>' +
            '<p class="example">' + F(3, 4) + ' + ' + F(1, 6) + ' = ' + F(9, 12) + ' + ' + F(2, 12) + ' = <b>' + F(11, 12) + '</b></p>' +
            '<p>Never add the bottoms: ' + F(1, 2) + ' + ' + F(1, 2) + ' is 1, not ' + F(2, 4) + '.</p>',
        },
        {
          title: 'Multiplying and dividing',
          html: '<p class="example">× : top × top, bottom × bottom. ' + F(2, 3) + ' × ' + F(3, 5) + ' = ' + F(6, 15) + ' = <b>' + F(2, 5) + '</b></p>' +
            '<p class="example">÷ : keep, change, flip. ' + F(2, 3) + ' ÷ ' + F(4, 5) + ' = ' + F(2, 3) + ' × ' + F(5, 4) + ' = ' + F(10, 12) + ' = <b>' + F(5, 6) + '</b></p>',
        },
        {
          title: 'Mixed numbers',
          html: '<p class="example">' + F(17, 5) + ' = 3' + F(2, 5) + ' because 5 × 3 = 15 and 2 are left over.</p>' +
            '<p class="example">2' + F(1, 3) + ' = ' + F(7, 3) + ' because 2 × 3 + 1 = 7.</p>' +
            '<p>To add or subtract mixed numbers, turn them into top-heavy fractions first.</p>',
        },
      ],
    },
  });
})(typeof window !== 'undefined' ? window : globalThis);
