/*
 * Shared helpers for maths topics: number formatting with a real minus sign,
 * powers, and a small step-by-step solver for expressions like
 * (−3)² − 4 × 5 that shows the BIDMAS working.
 *
 * Expression pieces are pairs { h: html, t: plain text }.
 */
(function (root) {
  'use strict';
  const SQ = root.SQ;
  const M = (SQ.maths = {});
  const MINUS = '−';

  M.MINUS = MINUS;
  M.BLANK = '[[?]]';
  M.WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
    'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen'];

  /** −5, 7 */
  M.fmt = function (n) { return n < 0 ? MINUS + Math.abs(n) : String(n === 0 ? 0 : n); };
  /** (−5), 7 — negatives in brackets */
  M.br = function (n) { return n < 0 ? '(' + M.fmt(n) + ')' : M.fmt(n); };

  M.piece = function (h, t) { return { h: h, t: t === undefined ? h : t }; };
  M.num = function (n, bracket) { return M.piece(bracket ? M.br(n) : M.fmt(n)); };
  M.op = function (sym) { return M.piece(' ' + sym + ' '); };

  /** base^exp. opts.neg = minus sign outside with no brackets, e.g. −3². exp may be '?'. */
  M.pow = function (base, exp, opts) {
    const b = base < 0 ? '(' + M.fmt(base) + ')' : M.fmt(base);
    const pre = opts && opts.neg ? MINUS : '';
    const e = String(exp);
    const eh = e === '?' ? '<span class="qmark">?</span>' : e;
    return M.piece(pre + b + '<sup>' + eh + '</sup>', pre + b + '^' + e);
  };

  M.join = function () {
    let h = '', t = '';
    for (let i = 0; i < arguments.length; i++) {
      const x = typeof arguments[i] === 'string' ? M.piece(arguments[i]) : arguments[i];
      h += x.h; t += x.t;
    }
    return M.piece(h, t);
  };

  /** "expr = ?" question */
  M.workOut = function (expr) {
    return { prompt: expr.h + ' = ' + M.BLANK, text: expr.t + ' = ?' };
  };

  M.signWord = function (n) { return n < 0 ? 'negative' : 'positive'; };
  M.sameSign = function (a, b) { return (a < 0) === (b < 0); };

  /** One line of working: the maths on the left, an explanation on the right. */
  M.line = function (work, note) {
    return (work ? '<span class="work">' + work + '</span>' : '') +
      (note ? '<span class="note">' + note + '</span>' : '');
  };

  /** √n and ∛n. Negative n gets brackets in the plain text: ∛(−27). */
  M.sqrt = function (n) { return M.piece('√<span class="rad">' + M.fmt(n) + '</span>', '√' + M.br(n)); };
  M.cbrt = function (n) { return M.piece('∛<span class="rad">' + M.fmt(n) + '</span>', '∛' + M.br(n)); };
  /** An algebra letter, in italics. */
  M.v = function (name) { return M.piece('<i>' + name + '</i>', name); };

  /**
   * Topic-specific hints for typical wrong answers: q.traps = [[value, message], ...].
   * Falls back to the sign hint.
   */
  M.trapDiagnose = function (q, v, signMsg) {
    const hit = (q.traps || []).find(function (t) { return t[0] === v && t[0] !== q.answer; });
    if (hit) return hit[1];
    return M.signDiagnose(q, v, signMsg);
  };

  /** Hint for "right number, wrong sign" mistakes. */
  M.signDiagnose = function (q, v, msg) {
    if (typeof q.answer === 'number' && q.answer !== 0 && v === -q.answer) {
      return msg || 'Right number, wrong sign! Same signs give a positive answer. Different signs give a negative answer.';
    }
    return null;
  };

  /** Working for base^exp, e.g. (−2)³ = (−2) × (−2) × (−2) ... */
  M.powSteps = function (base, exp) {
    const steps = [];
    const p = M.pow(base, exp).h;
    const value = Math.pow(base, exp);
    if (exp === 1) {
      steps.push(M.line(p + ' = ' + M.fmt(base), 'A power of 1 means just one ' + M.br(base) + '.'));
      return steps;
    }
    if (base === 1) {
      steps.push(M.line(p + ' = 1', '1 × 1 × 1 × … is always 1.'));
      return steps;
    }
    if (base === -1 && exp > 3) {
      steps.push(M.line(p, 'Each pair (−1) × (−1) makes 1. ' + exp + ' is ' +
        (exp % 2 ? 'odd, so one (−1) is left over.' : 'even, so every (−1) is in a pair.')));
      steps.push(M.line('= ' + M.fmt(value)));
      return steps;
    }
    if (Math.abs(base) === 10 && exp >= 3) {
      steps.push(M.line(p + ' = ' + M.fmt(value),
        '10 to the power ' + exp + ' is 1 followed by ' + exp + ' zeros' +
        (base < 0 ? (exp % 2 ? '. Odd power of a negative → negative.' : '. Even power of a negative → positive.') : '.')));
      return steps;
    }
    const factors = new Array(exp).fill(M.br(base)).join(' × ');
    steps.push(M.line(p + ' = ' + factors,
      'The power ' + exp + ' means ' + (M.WORDS[exp] || exp) + ' ' + M.br(base) + 's multiplied together.'));
    let acc = base;
    for (let k = 2; k <= exp; k++) {
      const next = acc * base;
      steps.push(M.line((k === 2 ? M.br(acc) : M.fmt(acc)) + ' × ' + M.br(base) + ' = ' + M.fmt(next)));
      acc = next;
    }
    if (base < 0) {
      steps.push(M.line('', exp % 2 === 0
        ? 'Even power of a negative number → <b>positive</b> answer.'
        : 'Odd power of a negative number → <b>negative</b> answer.'));
    }
    return steps;
  };

  /* ---------- flat expression solver ----------
   * seq = [term, op, term, op, term ...]
   * term = { n: 5 }
   *      | a power   { base: -3, exp: 2, neg?: true }       (−3² when neg)
   *      | a bracket { g: [3, '−', 7], exp?: 2, neg?: true } ((3 − 7)²)
   * op   = '×' | '÷' | '+' | '−'
   */
  function isPow(t) { return t && t.base !== undefined; }
  function isGroup(t) { return t && t.g !== undefined; }
  function apply(a, op, b) {
    switch (op) {
      case '×': return a * b;
      case '÷': return a / b;
      case '+': return a + b;
      default: return a - b;
    }
  }
  M.apply = apply;
  M.groupInner = function (t) { return apply(t.g[0], t.g[1], t.g[2]); };
  M.termValue = function (t) {
    if (isGroup(t)) {
      const v = M.groupInner(t);
      return (t.neg ? -1 : 1) * (t.exp ? Math.pow(v, t.exp) : v);
    }
    return isPow(t) ? (t.neg ? -1 : 1) * Math.pow(t.base, t.exp) : t.n;
  };

  function groupPiece(t) {
    const inner = M.fmt(t.g[0]) + ' ' + t.g[1] + ' ' + M.br(t.g[2]);
    const pre = t.neg ? MINUS : '';
    if (!t.exp) return M.piece(pre + '(' + inner + ')');
    return M.piece(pre + '(' + inner + ')<sup>' + t.exp + '</sup>', pre + '(' + inner + ')^' + t.exp);
  }

  M.seqPiece = function (seq) {
    const parts = seq.map(function (x, i) {
      if (i % 2) return M.op(x);
      if (isGroup(x)) return groupPiece(x);
      return isPow(x) ? M.pow(x.base, x.exp, { neg: x.neg }) : M.num(x.n, i > 0);
    });
    return M.join.apply(null, parts);
  };

  /** The same calculation with the brackets left out (for spotting that mistake). */
  M.withoutBrackets = function (seq) {
    const out = [];
    for (let i = 0; i < seq.length; i++) {
      const x = seq[i];
      if (i % 2 === 0 && isGroup(x)) {
        if (x.exp || x.neg) return null;
        out.push({ n: x.g[0] }, x.g[1], { n: x.g[2] });
      } else out.push(x);
    }
    return out;
  };

  function signHint(a, b) {
    if (a >= 0 && b >= 0) return '';
    return M.sameSign(a, b) ? ' (same signs → +)' : ' (different signs → −)';
  }

  /** Solve with BIDMAS, recording each step. Returns { value, steps: [{seq, note}] }. */
  M.solveSeq = function (seq) {
    let cur = seq.slice();
    const steps = [];
    const groups = cur.filter(function (x, i) { return i % 2 === 0 && isGroup(x); });
    if (groups.length) {
      const notes = groups.map(function (t) {
        return M.fmt(t.g[0]) + ' ' + t.g[1] + ' ' + M.br(t.g[2]) + ' = ' + M.fmt(M.groupInner(t));
      });
      cur = cur.map(function (x, i) {
        if (i % 2 || !isGroup(x)) return x;
        const v = M.groupInner(x);
        return x.exp ? { base: v, exp: x.exp, neg: x.neg } : { n: (x.neg ? -1 : 1) * v };
      });
      steps.push({ seq: cur.slice(), note: 'Brackets first: ' + notes.join(', ') });
    }
    const powers = cur.filter(function (x, i) { return i % 2 === 0 && isPow(x); });
    if (powers.length) {
      const notes = powers.map(function (t) {
        return M.pow(t.base, t.exp, { neg: t.neg }).h + ' = ' + M.fmt(M.termValue(t));
      });
      cur = cur.map(function (x, i) { return i % 2 === 0 && isPow(x) ? { n: M.termValue(x) } : x; });
      if (cur.length > 1) steps.push({ seq: cur.slice(), note: 'Indices first: ' + notes.join(', ') });
      else steps.push({ seq: cur.slice(), note: notes.join(', ') });
    }
    let i;
    const findMulDiv = function (x, k) { return k % 2 === 1 && (x === '×' || x === '÷'); };
    while ((i = cur.findIndex(findMulDiv)) !== -1) {
      const a = cur[i - 1].n, op = cur[i], b = cur[i + 1].n;
      const v = op === '×' ? a * b : a / b;
      cur.splice(i - 1, 3, { n: v });
      steps.push({
        seq: cur.slice(),
        note: (op === '×' ? 'Multiply: ' : 'Divide: ') + M.fmt(a) + ' ' + op + ' ' + M.br(b) + ' = ' + M.fmt(v) + signHint(a, b),
      });
    }
    while (cur.length > 1) {
      const a = cur[0].n, op = cur[1], b = cur[2].n;
      const v = op === '+' ? a + b : a - b;
      cur.splice(0, 3, { n: v });
      let note;
      if (op === '−' && b < 0) {
        note = 'Subtracting a negative is adding: ' + M.fmt(a) + ' − ' + M.br(b) + ' = ' + M.fmt(a) + ' + ' + M.fmt(-b) + ' = ' + M.fmt(v);
      } else if (op === '+' && b < 0) {
        note = 'Adding a negative is subtracting: ' + M.fmt(a) + ' + ' + M.br(b) + ' = ' + M.fmt(a) + ' − ' + M.fmt(-b) + ' = ' + M.fmt(v);
      } else {
        note = (op === '+' ? 'Add: ' : 'Subtract: ') + M.fmt(a) + ' ' + op + ' ' + M.fmt(b) + ' = ' + M.fmt(v);
      }
      steps.push({ seq: cur.slice(), note: note });
    }
    return { value: cur[0].n, steps: steps };
  };

  /** Steps as HTML lines: the expression, then "= ..." for each step. */
  M.seqSteps = function (seq) {
    const solved = M.solveSeq(seq);
    const lines = [M.line(M.seqPiece(seq).h)];
    solved.steps.forEach(function (s) {
      lines.push(M.line('= ' + M.seqPiece(s.seq).h, s.note));
    });
    return { value: solved.value, steps: lines };
  };

  /** Value if someone (wrongly) worked strictly left to right after the powers. */
  M.seqLeftToRight = function (seq) {
    let acc = M.termValue(seq[0]);
    for (let i = 1; i < seq.length; i += 2) {
      const b = M.termValue(seq[i + 1]);
      switch (seq[i]) {
        case '×': acc = acc * b; break;
        case '÷': acc = acc / b; break;
        case '+': acc = acc + b; break;
        default: acc = acc - b;
      }
    }
    return acc;
  };

  /** Divisors of n between lo and hi. */
  M.divisors = function (n, lo, hi) {
    const out = [];
    n = Math.abs(n);
    for (let d = lo; d <= hi; d++) if (n % d === 0) out.push(d);
    return out;
  };
})(typeof window !== 'undefined' ? window : globalThis);
