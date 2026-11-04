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

  /** A bracket (a ± b) with a small, non-zero value. */
  function bracket() {
    let g, v, tries = 0;
    do {
      g = [nz(1, 9), pm(), nz(1, 9)];
      v = M.apply(g[0], g[1], g[2]);
      tries++;
    } while ((v === 0 || Math.abs(v) > 12) && tries < 40);
    return { g: g };
  }

  function level3() {
    const G = bracket();
    const v = M.groupInner(G);
    return U.weighted([
      [3, function () { return [G, '×', { n: nz(2, 6) }]; }],
      [2, function () { return [{ n: nz(2, 9) }, '×', G]; }],
      [2, function () { return [{ n: nz(1, 20) }, '−', G]; }],
      [3, function () { G.exp = Math.abs(v) <= 4 && U.chance(0.3) ? 3 : 2; return [G, pm(), { n: nz(1, 12) }]; }],
      [2, function () { G.exp = 2; return [{ n: nz(2, 5) }, '×', G]; }],
      [2, function () {
        const ds = M.divisors(v, 2, 9).filter(function (d) { return d !== Math.abs(v); });
        if (!ds.length) return [G, '×', { n: nz(2, 6) }];
        return [G, '÷', { n: U.pick(ds) * U.sign() }];
      }],
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
      { title: 'Brackets', description: 'Like (3 − 7) × 2, 10 − (−4 + 9) and (−2 − 3)² − 5.' },
    ],
    generate: function (level) {
      let seq, value, tries = 0;
      do {
        seq = level === 1 ? level1() : level === 2 ? level2() : level3();
        value = M.solveSeq(seq).value;
        tries++;
      } while ((!Number.isInteger(value) || Math.abs(value) > 300) && tries < 50);
      return build(seq);
    },
    diagnose: function (q, v) {
      const flat = q.seq && M.withoutBrackets(q.seq);
      if (flat && flat.length !== q.seq.length) {
        const wrong = M.solveSeq(flat).value;
        if (Number.isInteger(wrong) && wrong !== q.answer && v === wrong) {
          return 'Brackets come first! Work out what is inside the bracket before anything else.';
        }
      }
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
          title: 'Brackets first',
          html: '<div class="working-demo">' +
            '<div>(3 − 7) × 2</div>' +
            '<div>= (−4) × 2 <span>brackets first</span></div>' +
            '<div>= −8</div></div>' +
            '<p class="example">(−2 − 3)<sup>2</sup> = (−5)<sup>2</sup> = <b>25</b>: the bracket first, then the power.</p>',
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
