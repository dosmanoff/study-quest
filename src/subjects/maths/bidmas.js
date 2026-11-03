/* Order of operations (BIDMAS) with powers and negative numbers. */
(function (root) {
  'use strict';
  const SQ = root.SQ, U = SQ.util, M = SQ.maths;

  function nz(lo, hi) { return U.int(lo, hi) * U.sign(); }

  function powTerm() {
    const exp = U.chance(0.65) ? 2 : 3;
    const max = exp === 2 ? 6 : 4;
    let base = U.int(1, max);
    if (base === 1 && U.chance(0.7)) base = U.int(2, max);
    if (U.chance(0.6)) base = -base;
    return { base: base, exp: exp };
  }

  function pm() { return U.chance(0.5) ? '+' : '−'; }

  function level1() {
    const P = powTerm();
    const pv = M.termValue(P);
    return U.weighted([
      [3, function () { return [P, '×', { n: nz(2, 6) }]; }],
      [3, function () { return [{ n: nz(2, 6) }, '×', P]; }],
      [3, function () {
        if (Math.abs(pv) < 2) return [P, '×', { n: nz(2, 9) }];
        return [{ n: pv * nz(1, 5) }, '÷', P];
      }],
      [2, function () {
        const ds = M.divisors(pv, 2, 9).filter(function (d) { return d !== Math.abs(pv); });
        if (!ds.length) return [{ n: nz(2, 6) }, '×', P];
        return [P, '÷', { n: U.pick(ds) * U.sign() }];
      }],
    ])();
  }

  function level2() {
    const P = powTerm();
    return U.weighted([
      [2, function () { return [P, pm(), { n: nz(2, 9) }, '×', { n: nz(2, 6) }]; }],
      [2, function () { return [{ n: nz(2, 9) }, '×', { n: nz(2, 6) }, pm(), P]; }],
      [2, function () {
        const d = nz(2, 6);
        return [{ n: d * nz(2, 9) }, '÷', { n: d }, pm(), P];
      }],
      [2, function () { return [P, '×', { n: nz(2, 5) }, pm(), { n: nz(1, 20) }]; }],
      [2, function () { return [{ n: nz(1, 20) }, pm(), P, '×', { n: nz(2, 5) }]; }],
    ])();
  }

  function build(seq) {
    const w = M.seqSteps(seq);
    const q = M.workOut(M.seqPiece(seq));
    q.ask = 'Work out';
    q.answer = w.value;
    q.steps = w.steps;
    q.seq = seq;
    return q;
  }

  SQ.registerTopic({
    id: 'maths.bidmas',
    subject: 'maths',
    title: 'BIDMAS with powers',
    short: 'Order of operations with powers and negatives',
    input: 'integer',
    levels: [
      { title: 'Power and one more step', description: 'Like (−3)² × 2 and 36 ÷ (−2)².' },
      { title: 'Three-step questions', description: 'Like (−3)² − 4 × 5 and 20 ÷ (−5) + 2³.' },
    ],
    generate: function (level) {
      let seq, value, tries = 0;
      do {
        seq = level === 1 ? level1() : level2();
        value = M.solveSeq(seq).value;
        tries++;
      } while ((!Number.isInteger(value) || Math.abs(value) > 300) && tries < 50);
      return build(seq);
    },
    diagnose: function (q, v) {
      if (q.seq && q.seq.length > 3) {
        const ltr = M.seqLeftToRight(q.seq);
        if (Number.isInteger(ltr) && ltr !== q.answer && v === ltr) {
          return 'It looks like you worked from left to right. BIDMAS: powers first, then × and ÷, and only then + and −.';
        }
      }
      return M.signDiagnose(q, v, 'Right number, wrong sign! Check the sign at each step, especially the powers of negative numbers.');
    },
    lesson: {
      intro: 'When a calculation has several operations, the order matters. BIDMAS tells you which part to do first.',
      sections: [
        {
          title: 'BIDMAS',
          html: '<ol class="bidmas">' +
            '<li><b>B</b>rackets</li><li><b>I</b>ndices (powers)</li>' +
            '<li><b>D</b>ivision and <b>M</b>ultiplication, left to right</li>' +
            '<li><b>A</b>ddition and <b>S</b>ubtraction, left to right</li></ol>',
        },
        {
          title: 'Write one line per step',
          html: '<div class="working-demo">' +
            '<div>(−3)<sup>2</sup> − 4 × 5</div>' +
            '<div>= 9 − 4 × 5 <span>powers first</span></div>' +
            '<div>= 9 − 20 <span>then multiply</span></div>' +
            '<div>= −11 <span>then subtract</span></div></div>',
        },
        {
          title: 'Adding and subtracting negatives',
          html: '<p class="example">7 + (−3) = 7 − 3 = 4</p>' +
            '<p class="example">7 − (−3) = 7 + 3 = 10</p>' +
            '<p>Two minus signs next to each other make a plus.</p>',
        },
      ],
    },
  });
})(typeof window !== 'undefined' ? window : globalThis);
