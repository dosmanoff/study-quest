/* Substitution: putting numbers (often negative) in place of letters. */
(function (root) {
  'use strict';
  const SQ = root.SQ, U = SQ.util, M = SQ.maths;

  function nz(lo, hi) { return U.int(lo, hi) * U.sign(); }
  const x = M.v('x'), a = M.v('a'), b = M.v('b');

  /** "2x" written as coefficient + letter */
  function coef(c, letter) { return M.piece((c === 1 ? '' : c) + letter.h, (c === 1 ? '' : c) + letter.t); }
  function pm(n) { return n < 0 ? ' − ' + Math.abs(n) : ' + ' + n; }

  /**
   * Build a substitution question.
   * expr: {h, t} with letters; values: { x: -3 } ; seq: the expression with numbers put in.
   */
  function build(expr, values, seq, traps) {
    const given = Object.keys(values).map(function (k) { return '<i>' + k + '</i> = ' + M.fmt(values[k]); }).join(', ');
    const givenText = Object.keys(values).map(function (k) { return k + ' = ' + M.fmt(values[k]); }).join(', ');
    const w = M.seqSteps(seq);
    return {
      ask: 'Work out the value',
      given: 'When ' + given,
      prompt: expr.h + ' = ' + M.BLANK,
      text: expr.t + ' = ? (' + givenText + ')',
      verify: M.seqPiece(seq).t + ' = ?',
      answer: w.value,
      steps: [M.line('', 'Put ' + Object.keys(values).map(function (k) { return M.br(values[k]); }).join(' and ') +
        ' in place of the letter' + (Object.keys(values).length > 1 ? 's' : '') + '. Use brackets for negative numbers.')]
        .concat(w.steps),
      traps: (traps || []).filter(function (t) { return Number.isInteger(t[0]) && t[1]; }),
      key: expr.t + '|' + givenText,
    };
  }

  /* ----- level 1: one letter, no powers ----- */
  function linear() {
    const xv = nz(1, 9);
    const c = U.int(2, 9), d = nz(1, 12);
    return U.weighted([
      [3, function () { // cx + d
        const e = M.join(coef(c, x), M.piece(pm(d)));
        const q = build(e, { x: xv }, [{ n: c }, '×', { n: xv }, d < 0 ? '−' : '+', { n: Math.abs(d) }]);
        if (xv > 0) q.traps.push([c * 10 + xv + d, c + x.h + ' means ' + c + ' × ' + x.h + ', not the digits ' + c + ' and ' + xv + ' side by side.']);
        return q;
      }],
      [2, function () { // d − cx
        const e0 = Math.abs(d) + 3;
        const e = M.join(M.piece(String(e0)), M.op('−'), coef(c, x));
        return build(e, { x: xv }, [{ n: e0 }, '−', { n: c }, '×', { n: xv }]);
      }],
      [2, function () { // c(x + d)
        const e = M.piece(c + '(' + x.h + pm(d) + ')', c + '(' + x.t + pm(d) + ')');
        return build(e, { x: xv }, [{ n: c }, '×', { g: [xv, d < 0 ? '−' : '+', Math.abs(d)] }],
          [[c * xv + d, 'Multiply the whole bracket: ' + c + '(' + x.h + pm(d) + ') = ' + c + ' × (' + x.h + pm(d) + '). Work out the bracket first.']]);
      }],
    ])();
  }

  /* ----- level 2: powers ----- */
  function powers() {
    const xv = nz(1, 6);
    const sq = xv * xv;
    const neg = xv < 0 ? [[-sq, 'A negative number squared is positive: ' + M.br(xv) + '<sup>2</sup> = ' + sq + '.']] : [];
    const c = U.int(2, 5), d = nz(1, 12);
    const x2 = M.piece(x.h + '<sup>2</sup>', x.t + '^2');
    return U.weighted([
      [2, function () { // x² + d
        return build(M.join(x2, M.piece(pm(d))), { x: xv },
          [{ base: xv, exp: 2 }, d < 0 ? '−' : '+', { n: Math.abs(d) }], neg.map(function (t) { return [t[0] + d, t[1]]; }));
      }],
      [3, function () { // c x²
        return build(M.piece(c + x2.h, c + x2.t), { x: xv }, [{ n: c }, '×', { base: xv, exp: 2 }],
          [[(c * xv) * (c * xv), 'Only ' + x.h + ' is squared: ' + c + x2.h + ' = ' + c + ' × ' + x2.h + '. Square first, then multiply by ' + c + '.'],
            [-c * sq, neg.length ? neg[0][1] : '']]);
      }],
      [3, function () { // x² − c x
        return build(M.join(x2, M.op('−'), coef(c, x)), { x: xv },
          [{ base: xv, exp: 2 }, '−', { n: c }, '×', { n: xv }], neg.map(function (t) { return [-sq - c * xv, t[1]]; }));
      }],
      [2, function () { // −x²
        return build(M.piece('−' + x2.h, '−' + x2.t), { x: xv }, [{ base: xv, exp: 2, neg: true }],
          [[sq, '−' + x2.h + ' means −(' + x2.h + '): square first, then make it negative. So the answer is ' + M.fmt(-sq) + '.']]);
      }],
      [2, function () { // x³ + d, small x
        const xs = nz(1, 4);
        const x3 = M.piece(x.h + '<sup>3</sup>', x.t + '^3');
        return build(M.join(x3, M.piece(pm(d))), { x: xs }, [{ base: xs, exp: 3 }, d < 0 ? '−' : '+', { n: Math.abs(d) }]);
      }],
      [1, function () { // 10 − x²
        return build(M.join(M.piece('10'), M.op('−'), x2), { x: xv }, [{ n: 10 }, '−', { base: xv, exp: 2 }],
          neg.map(function (t) { return [10 + sq, t[1]]; }));
      }],
    ])();
  }

  /* ----- level 3: two letters ----- */
  function twoLetters() {
    const av = nz(1, 8), bv = nz(1, 8);
    const vals = { a: av, b: bv };
    const c = U.int(2, 5), d = U.int(2, 4);
    const a2 = M.piece(a.h + '<sup>2</sup>', a.t + '^2'), b2 = M.piece(b.h + '<sup>2</sup>', b.t + '^2');
    return U.weighted([
      [3, function () { // c a − d b
        return build(M.join(coef(c, a), M.op('−'), coef(d, b)), vals, [{ n: c }, '×', { n: av }, '−', { n: d }, '×', { n: bv }]);
      }],
      [2, function () { // ab + c
        return build(M.join(M.piece(a.h + b.h, a.t + b.t), M.piece(pm(c))), vals, [{ n: av }, '×', { n: bv }, '+', { n: c }],
          [[av + bv + c, a.h + b.h + ' means ' + a.h + ' × ' + b.h + '.']]);
      }],
      [2, function () { // a² − b²
        return build(M.join(a2, M.op('−'), b2), vals, [{ base: av, exp: 2 }, '−', { base: bv, exp: 2 }]);
      }],
      [2, function () { // c(a − b)
        const e = M.piece(c + '(' + a.h + ' − ' + b.h + ')', c + '(' + a.t + ' − ' + b.t + ')');
        return build(e, vals, [{ n: c }, '×', { g: [av, '−', bv] }]);
      }],
      [2, function () { // (a + b)²
        const e = M.piece('(' + a.h + ' + ' + b.h + ')<sup>2</sup>', '(' + a.t + ' + ' + b.t + ')^2');
        return build(e, vals, [{ g: [av, '+', bv], exp: 2 }],
          [[av * av + bv * bv, 'Work out the bracket first, then square it. (' + a.h + ' + ' + b.h + ')<sup>2</sup> is not ' + a.h + '<sup>2</sup> + ' + b.h + '<sup>2</sup>.']]);
      }],
      [1, function () { // a² + c b
        return build(M.join(a2, M.op('+'), coef(c, b)), vals, [{ base: av, exp: 2 }, '+', { n: c }, '×', { n: bv }]);
      }],
    ])();
  }

  SQ.registerTopic({
    id: 'maths.substitution',
    subject: 'maths',
    title: 'Substitution',
    short: 'Putting numbers, often negative, in place of letters',
    input: 'integer',
    levels: [
      { title: 'One letter', description: 'Like 3x + 2 and 5(x − 4) when x = −3.' },
      { title: 'Powers', description: 'Like x², 2x² and x² − 3x when x = −2.' },
      { title: 'Two letters', description: 'Like 2a − 3b, (a + b)² and a² − b² when a = 4 and b = −1.' },
    ],
    generate: function (level) {
      if (level === 1) return linear();
      if (level === 2) return powers();
      return twoLetters();
    },
    diagnose: function (q, v) {
      return M.trapDiagnose(q, v, 'Right number, wrong sign! Put negative numbers in brackets and check each step’s sign.');
    },
    lesson: {
      intro: 'Substitution means replacing each letter with its number, then working out the answer with BIDMAS.',
      sections: [
        {
          title: 'How algebra is written',
          html: '<table class="facts"><tbody>' +
            '<tr><th>3<i>x</i></th><td>3 × <i>x</i></td></tr>' +
            '<tr><th><i>ab</i></th><td><i>a</i> × <i>b</i></td></tr>' +
            '<tr><th><i>x</i><sup>2</sup></th><td><i>x</i> × <i>x</i></td></tr>' +
            '<tr><th>2<i>x</i><sup>2</sup></th><td>2 × <i>x</i> × <i>x</i> (only <i>x</i> is squared)</td></tr>' +
            '<tr><th>5(<i>x</i> + 1)</th><td>5 × (<i>x</i> + 1)</td></tr>' +
            '</tbody></table>',
        },
        {
          title: 'Use brackets for negative numbers',
          html: '<div class="working-demo">' +
            '<div>When <i>x</i> = −3: <i>x</i><sup>2</sup> − 2<i>x</i></div>' +
            '<div>= (−3)<sup>2</sup> − 2 × (−3) <span>put the number in</span></div>' +
            '<div>= 9 − (−6) <span>powers, then ×</span></div>' +
            '<div>= 15 <span>two minuses make +</span></div></div>' +
            '<p>Without brackets it is easy to square only the 3 and get −9 instead of 9.</p>',
        },
      ],
    },
  });
})(typeof window !== 'undefined' ? window : globalThis);
