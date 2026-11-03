/* Times tables and division facts — a warm-up topic. */
(function (root) {
  'use strict';
  const SQ = root.SQ, U = SQ.util, M = SQ.maths;

  /** A friendly way to work out a × b (both 1–12). */
  function mulTip(a, b) {
    const p = a * b;
    const has = function (n) { return a === n || b === n; };
    const other = function (n) { return a === n ? b : a; };
    let o;
    if (has(1)) return 'Anything × 1 stays the same: ' + a + ' × ' + b + ' = ' + p + '.';
    if (has(10)) { o = other(10); return '× 10 moves the digits one place left: ' + o + ' × 10 = ' + p + '.'; }
    if (has(9)) { o = other(9); return o + ' × 9 = ' + o + ' × 10 − ' + o + ' = ' + (o * 10) + ' − ' + o + ' = ' + p + '.'; }
    if (has(11)) { o = other(11); return o + ' × 11 = ' + o + ' × 10 + ' + o + ' = ' + (o * 10) + ' + ' + o + ' = ' + p + '.'; }
    if (has(12)) { o = other(12); return o + ' × 12 = ' + o + ' × 10 + ' + o + ' × 2 = ' + (o * 10) + ' + ' + (o * 2) + ' = ' + p + '.'; }
    if (has(5)) { o = other(5); return o + ' × 5 is half of ' + o + ' × 10. Half of ' + (o * 10) + ' is ' + p + '.'; }
    if (has(2)) { o = other(2); return o + ' × 2 is double ' + o + ' = ' + p + '.'; }
    if (has(4)) { o = other(4); return '× 4 means double, then double again: ' + o + ' → ' + (o * 2) + ' → ' + p + '.'; }
    if (has(8)) { o = other(8); return '× 8 means double three times: ' + o + ' → ' + (o * 2) + ' → ' + (o * 4) + ' → ' + p + '.'; }
    const big = Math.max(a, b), small = Math.min(a, b);
    if (big >= 6) {
      return small + ' × ' + big + ' = ' + small + ' × 5 + ' + small + ' × ' + (big - 5) + ' = ' +
        (small * 5) + ' + ' + (small * (big - 5)) + ' = ' + p + '.';
    }
    return a + ' × ' + b + ' = ' + new Array(b).fill(a).join(' + ') + ' = ' + p + '.';
  }

  function multiply(a, b) {
    const q = M.workOut(M.piece(a + ' × ' + b));
    q.ask = 'Work out';
    q.answer = a * b;
    q.steps = [M.line(a + ' × ' + b + ' = ' + (a * b), mulTip(a, b))];
    q.factors = [a, b];
    return q;
  }

  function divide(p, d) {
    const ans = p / d;
    const q = M.workOut(M.piece(p + ' ÷ ' + d));
    q.ask = 'Work out';
    q.answer = ans;
    q.steps = [
      M.line(p + ' ÷ ' + d, 'Division asks: what number × ' + d + ' makes ' + p + '?'),
      M.line(ans + ' × ' + d + ' = ' + p, mulTip(ans, d)),
      M.line('So ' + p + ' ÷ ' + d + ' = ' + ans),
    ];
    return q;
  }

  function tens() {
    const a = U.int(2, 9), b = U.int(2, 9);
    return U.weighted([
      [3, function () {
        const q = M.workOut(M.piece((a * 10) + ' × ' + b));
        q.answer = a * 10 * b;
        q.steps = [M.line(a + ' × ' + b + ' = ' + (a * b), 'First ignore the zero.'),
          M.line((a * b) + ' × 10 = ' + q.answer, 'Then put the zero back (× 10).')];
        return q;
      }],
      [2, function () {
        const q = M.workOut(M.piece((a * 10) + ' × ' + (b * 10)));
        q.answer = a * b * 100;
        q.steps = [M.line(a + ' × ' + b + ' = ' + (a * b), 'Ignore both zeros.'),
          M.line((a * b) + ' × 100 = ' + q.answer, 'Two zeros taken away, so put two zeros back (× 100).')];
        return q;
      }],
      [3, function () {
        const p = a * b * 10;
        const q = M.workOut(M.piece(p + ' ÷ ' + a));
        q.answer = b * 10;
        q.steps = [M.line((a * b) + ' ÷ ' + a + ' = ' + b, 'Ignore the zero: ' + b + ' × ' + a + ' = ' + (a * b) + '.'),
          M.line(b + ' × 10 = ' + q.answer, 'Put the zero back.')];
        return q;
      }],
      [2, function () {
        const p = a * b * 10;
        const q = M.workOut(M.piece(p + ' ÷ ' + (a * 10)));
        q.answer = b;
        q.steps = [M.line(p + ' ÷ ' + (a * 10) + ' = ' + (a * b) + ' ÷ ' + a,
          'Both numbers end in 0, so take one zero off each.'),
          M.line('= ' + b, b + ' × ' + a + ' = ' + (a * b) + '.')];
        return q;
      }],
    ])();
  }

  SQ.registerTopic({
    id: 'maths.times-tables',
    subject: 'maths',
    title: 'Times tables',
    short: 'Quick × and ÷ facts up to 12 × 12',
    input: 'integer',
    levels: [
      { title: 'Tables 2–10', description: 'Multiplication facts from 2 × 2 to 10 × 10.' },
      { title: 'Up to 12 × 12, with ÷', description: 'Multiplication and division facts up to 12 × 12.' },
      { title: 'Tens', description: 'Like 30 × 7, 40 × 50 and 240 ÷ 6.' },
    ],
    generate: function (level) {
      let q;
      if (level === 1) {
        q = multiply(U.int(2, 10), U.int(2, 10));
      } else if (level === 2) {
        const a = U.int(2, 12), b = U.int(2, 12);
        q = U.chance(0.5) ? multiply(a, b) : divide(a * b, a);
      } else {
        q = tens();
      }
      q.ask = q.ask || 'Work out';
      return q;
    },
    diagnose: function (q, v) {
      if (q.factors) {
        const a = q.factors[0], b = q.factors[1], p = a * b;
        if (Math.abs(v - p) === a || Math.abs(v - p) === b) {
          return 'So close! You are exactly one step of ' + (Math.abs(v - p) === a ? a : b) +
            ' away. Count on or back once to check.';
        }
      }
      return null;
    },
    lesson: {
      intro: 'Times tables are the tools for everything else: negative numbers, powers and fractions all use them. The tricks below help you work out a fact you have forgotten.',
      sections: [
        {
          title: 'Tricks for tricky tables',
          html:
            '<table class="facts"><tbody>' +
            '<tr><th>× 2</th><td>Double it. 7 × 2 = 14</td></tr>' +
            '<tr><th>× 4</th><td>Double, then double again. 7 → 14 → 28</td></tr>' +
            '<tr><th>× 8</th><td>Double three times. 7 → 14 → 28 → 56</td></tr>' +
            '<tr><th>× 5</th><td>Half of × 10. 7 × 10 = 70, half is 35</td></tr>' +
            '<tr><th>× 9</th><td>× 10, then take one lot away. 70 − 7 = 63</td></tr>' +
            '<tr><th>× 11</th><td>× 10, then add one lot. 70 + 7 = 77</td></tr>' +
            '<tr><th>× 12</th><td>× 10 plus × 2. 70 + 14 = 84</td></tr>' +
            '<tr><th>× 6, × 7</th><td>Split into 5 + the rest. 7 × 6 = 7 × 5 + 7 × 1 = 35 + 7 = 42</td></tr>' +
            '</tbody></table>',
        },
        {
          title: 'Division is multiplication backwards',
          html: '<p>56 ÷ 7 asks: <em>what number × 7 makes 56?</em> You know 8 × 7 = 56, so 56 ÷ 7 = 8.</p>',
        },
        {
          title: 'Numbers ending in zero',
          html: '<p>Take the zeros off, work it out, then put the zeros back.</p>' +
            '<p class="example">30 × 40 → 3 × 4 = 12 → put back two zeros → <b>1200</b></p>' +
            '<p class="example">240 ÷ 6 → 24 ÷ 6 = 4 → put back the zero → <b>40</b></p>',
        },
      ],
    },
  });
})(typeof window !== 'undefined' ? window : globalThis);
