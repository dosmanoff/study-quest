// Checks every topic's question generator, the answer checker and the merge logic.
//   node tests/generators.test.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const files = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1])
  .filter((f) => !f.includes('/ui/') && !f.endsWith('main.js'));

const ctx = vm.createContext({ console, Math, Date, JSON });
ctx.globalThis = ctx;
for (const f of files) vm.runInContext(readFileSync(join(root, f), 'utf8'), ctx, { filename: f });
const SQ = ctx.SQ;

/* ---- independent evaluator for question text: numbers, + − × ÷ ^ ( ) and unary minus ---- */
function evaluate(src) {
  const s = src.replace(/−/g, '-').replace(/×/g, '*').replace(/÷/g, '/').replace(/\s+/g, '');
  let i = 0;
  const peek = () => s[i];
  function expr() {
    let v = term();
    while (peek() === '+' || peek() === '-') { const op = s[i++]; const r = term(); v = op === '+' ? v + r : v - r; }
    return v;
  }
  function term() {
    let v = unary();
    while (peek() === '*' || peek() === '/') { const op = s[i++]; const r = unary(); v = op === '*' ? v * r : v / r; }
    return v;
  }
  function unary() {
    if (peek() === '-') { i++; return -unary(); }
    if (peek() === '+') { i++; return unary(); }
    return power();
  }
  function power() {
    const b = primary();
    if (peek() === '^') { i++; return Math.pow(b, unary()); }
    return b;
  }
  function primary() {
    if (peek() === '√') { i++; return Math.sqrt(primary()); }
    if (peek() === '∛') { i++; return Math.cbrt(primary()); }
    if (peek() === '(') { i++; const v = expr(); assert.equal(s[i++], ')', 'missing ) in ' + src); return v; }
    const m = /^\d+(\.\d+)?/.exec(s.slice(i));
    assert.ok(m, `bad token at ${i} in "${src}"`);
    i += m[0].length;
    return Number(m[0]);
  }
  const v = expr();
  assert.equal(i, s.length, `trailing input in "${src}"`);
  return v;
}

function checkEquation(q) {
  if (q.verify && typeof q.verify === 'object') {
    // estimates: the answer is the rounded (or floored) value of the expression
    const v = evaluate(q.verify.expr);
    const want = q.verify.mode === 'floor' ? Math.floor(v + 1e-9) : Math.round(v);
    assert.equal(q.answer, want, `${q.verify.expr}: ${q.verify.mode} is ${want}, answer ${q.answer}`);
    return;
  }
  const text = typeof q.verify === 'string' ? q.verify : q.text;
  assert.equal((text.match(/\?/g) || []).length, 1, 'exactly one ? in ' + text);
  const a = q.answer;
  const sub = a < 0 ? '(' + a + ')' : String(a);
  const [lhs, rhs] = text.replace('?', sub).split('=');
  assert.ok(rhs !== undefined, 'no = in ' + text);
  const L = evaluate(lhs), R = evaluate(rhs);
  assert.ok(Math.abs(L - R) < 1e-9, `${text} with ? = ${a}: ${L} ≠ ${R}`);
}

/* ---- every topic, every level ---- */
const N = 4000;
let total = 0;
const summary = [];
for (const topic of SQ.allTopics()) {
  for (const level of topic.levels) {
    const keys = new Set();
    let maxAbs = 0;
    for (let k = 0; k < N; k++) {
      const q = SQ.engine.makeQuestion(topic.id, level.id);
      const where = `${topic.id} L${level.id}: ${q.text}`;
      assert.equal(typeof q.prompt, 'string', where);
      assert.ok(q.prompt.length > 0, where);
      assert.ok(!/undefined|NaN|null|\[object/.test(q.prompt + q.text + q.steps.join('')), 'bad text in ' + where);
      assert.ok(Number.isInteger(q.answer), 'non-integer answer in ' + where + ' → ' + q.answer);
      assert.ok(Array.isArray(q.steps) && q.steps.length > 0, 'no steps for ' + where);
      (q.traps || []).forEach((t) => {
        assert.ok(Number.isFinite(t[0]) && typeof t[1] === 'string', 'bad trap in ' + where);
        if (t[0] !== q.answer && Number.isInteger(t[0]) && t[1]) assert.equal(SQ.engine.diagnose(q, t[0]), t[1], 'trap not used in ' + where);
      });
      assert.ok(q.ask, 'no ask for ' + where);
      const hasBlank = q.prompt.includes('[[?]]');
      const hasQmark = q.prompt.includes('class="qmark"');
      assert.ok(hasBlank || hasQmark, 'no answer place in prompt: ' + where);
      checkEquation(q);
      // diagnose must never throw, for a few typical wrong answers
      for (const wrong of [-q.answer, q.answer + 1, q.answer - 1, 0, 999]) {
        if (wrong === q.answer) continue;
        const d = SQ.engine.diagnose(q, wrong);
        assert.ok(d === null || typeof d === 'string', where);
      }
      // the checker accepts the right answer typed in different ways
      const typed = q.answer < 0 ? '−' + Math.abs(q.answer) : String(q.answer);
      const p = SQ.engine.parseAnswer(q, typed);
      assert.ok(p.ok && SQ.engine.isCorrect(q, p.value), 'checker rejects ' + typed + ' for ' + where);
      const p2 = SQ.engine.parseAnswer(q, ' ' + String(q.answer) + ' ');
      assert.ok(p2.ok && SQ.engine.isCorrect(q, p2.value), 'checker rejects ascii form for ' + where);
      assert.ok(!SQ.engine.isCorrect(q, SQ.engine.parseAnswer(q, String(q.answer + 1)).value), where);
      keys.add(q.key);
      maxAbs = Math.max(maxAbs, Math.abs(q.answer));
      total++;
    }
    assert.ok(keys.size >= 20, `${topic.id} L${level.id} has only ${keys.size} different questions`);
    summary.push(`${topic.id} L${level.id}: ${keys.size} distinct, max |answer| ${maxAbs}`);
  }
}

/* ---- a set has the right size, comes from the pool and has no repeats ---- */
const pool = SQ.engine.poolFrom([{ topic: 'maths.negatives', levels: [1, 2] }, { topic: 'maths.powers', levels: [1, 2] }]);
assert.equal(pool.length, 4);
for (let k = 0; k < 300; k++) {
  const set = SQ.engine.buildSet(pool, 10);
  assert.equal(set.length, 10);
  assert.equal(new Set(set.map((q) => q.key)).size, 10, 'repeat in set');
  const counts = {};
  set.forEach((q) => { const key = q.topic + q.level; counts[key] = (counts[key] || 0) + 1; });
  Object.values(counts).forEach((c) => assert.ok(c >= 2 && c <= 3, 'uneven mix ' + JSON.stringify(counts)));
}

/* ---- answer parsing ---- */
const q = { input: 'integer', answer: -24 };
const P = (raw) => SQ.engine.parseAnswer(q, raw);
assert.equal(P('−24').value, -24);
assert.equal(P('-24').value, -24);
assert.equal(P(' - 24 ').value, -24);
assert.equal(P('–24').value, -24);
assert.equal(P('').ok, false);
assert.equal(P('−').ok, false);
assert.equal(P('2-4').ok, false);
assert.equal(P('abc').ok, false);
assert.equal(P('+24').value, 24);
assert.equal(SQ.engine.isCorrect(q, P('−24').value), true);
assert.equal(SQ.engine.isCorrect(q, P('24').value), false);
const tq = { input: 'text', answer: 'Colour', accept: ['color'] };
assert.equal(SQ.engine.isCorrect(tq, '  colour '), true);
assert.equal(SQ.engine.isCorrect(tq, 'COLOR'), true);
assert.equal(SQ.engine.isCorrect(tq, 'colur'), false);
const cq = { input: 'choice', answer: 2, choices: ['a', 'b', 'c'] };
assert.equal(SQ.engine.isCorrect(cq, SQ.engine.parseAnswer(cq, 2).value), true);
assert.equal(SQ.engine.isCorrect(cq, SQ.engine.parseAnswer(cq, 1).value), false);

/* ---- diagnosis of typical mistakes ---- */
const signQ = { topic: 'maths.negatives', answer: 24, input: 'integer' };
assert.match(SQ.engine.diagnose(signQ, -24), /wrong sign/);
const powQ = { topic: 'maths.powers', answer: 125, pow: { base: 5, exp: 3 }, input: 'integer' };
assert.match(SQ.engine.diagnose(powQ, 15), /is not/);
const trapQ = { topic: 'maths.powers', answer: -9, trap: 9, input: 'integer' };
assert.match(SQ.engine.diagnose(trapQ, 9), /brackets/);

/* ---- BIDMAS solver ---- */
const seq = [{ base: -3, exp: 2 }, '−', { n: 4 }, '×', { n: 5 }];
assert.equal(SQ.maths.solveSeq(seq).value, -11);
assert.equal(SQ.maths.seqLeftToRight(seq), 25);
assert.equal(SQ.maths.seqPiece(seq).t, '(−3)^2 − 4 × 5');
assert.equal(SQ.maths.seqPiece([{ n: 9 }, '−', { n: -20 }]).t, '9 − (−20)');
assert.equal(SQ.maths.solveSeq([{ n: 9 }, '−', { n: -20 }]).value, 29);

/* ---- merging two devices ---- */
const plain = (x) => JSON.parse(JSON.stringify(x));
const S = SQ.storage;
// the same child seen by two devices
const kidA = S.blankChild('Old', 'k1'), kidB = S.blankChild('New', 'k1');
kidA.createdAt = 1; kidB.createdAt = 1;
kidA.settings.updatedAt = 100; kidB.settings.updatedAt = 200;
kidA.history.push({ id: 'h1', ts: 10, items: [] }, { id: 'h2', ts: 30, items: [] });
kidB.history.push({ id: 'h2', ts: 30, items: [] }, { id: 'h3', ts: 20, items: [] });
kidA.rewards.push({ id: 'r1', ts: 5, minutes: 30, startedAt: null, updatedAt: 5 });
kidB.rewards.push({ id: 'r1', ts: 5, minutes: 30, startedAt: 50, endsAt: 99, updatedAt: 50 });
kidA.progress = { streak: 1, streakDay: 'x', run: 3, bestRun: 9, updatedAt: 300 };
kidB.progress = { streak: 0, streakDay: 'x', run: 0, bestRun: 12, updatedAt: 200 };
const a = S.blank(), b = S.blank();
a.family = { pinHash: 'abc', updatedAt: 100 };
b.family = { pinHash: null, updatedAt: 200 };
a.children.push(kidA);
b.children.push(kidB);
// a second child that only device B knows about
const kid2 = S.blankChild('Alex', 'k2'); kid2.createdAt = 2;
b.children.push(kid2);

const m = S.merge(a, b);
assert.equal(m.family.pinHash, 'abc', 'parent PIN must survive a merge');
assert.deepEqual(plain(m.children.map((c) => c.id)), ['k1', 'k2'], 'children joined by id');
const k1 = SQ.family.child(m, 'k1');
assert.equal(k1.settings.childName, 'New');
assert.deepEqual(plain(k1.history.map((h) => h.id)), ['h1', 'h3', 'h2']);
assert.equal(k1.rewards.length, 1);
assert.equal(k1.rewards[0].startedAt, 50);
assert.equal(k1.progress.streak, 1);
assert.equal(k1.progress.bestRun, 12);
assert.deepEqual(plain(S.merge(m, m)), plain(m), 'merge is idempotent');
assert.deepEqual(plain(S.merge(b, a)), plain(S.merge(a, b)), 'merge order does not matter');

// a reset on one device wins over old history on another
const r = plain(m);
r.children[0].resetAt = 25;
const c = S.merge(m, r);
assert.deepEqual(plain(SQ.family.child(c, 'k1').history.map((h) => h.id)), ['h2']);
assert.equal(SQ.family.child(c, 'k1').rewards.length, 0);
assert.equal(SQ.family.child(c, 'k2').history.length, 0);

// deleting a child on one device removes it everywhere
const d = plain(m);
d.children[1].deletedAt = 500;
const md = S.merge(m, d);
assert.equal(SQ.family.children(md).length, 1);
assert.equal(SQ.family.child(md, 'k2'), null);
assert.equal(SQ.family.isSetUp(md), true);

// a child's PIN never leaks into the parent PIN and vice versa
const withPin = plain(m);
withPin.children[0].settings.childPinHash = 'kidpin';
withPin.children[0].settings.updatedAt = 999;
const mp = S.merge(m, withPin);
assert.equal(SQ.family.child(mp, 'k1').settings.childPinHash, 'kidpin');
assert.equal(mp.family.pinHash, 'abc');

// upgrade from the one-child version (schema 1)
const v1 = {
  schema: 1,
  settings: { childName: 'Sam', pinHash: 'p1', setSize: 8, updatedAt: 50, assignment: [{ topic: 'maths.powers', levels: [1] }] },
  progress: { streak: 1, streakDay: 'x', run: 2, bestRun: 5, updatedAt: 60 },
  history: [{ id: 'old', ts: 40, items: [] }],
  rewards: [],
};
const up = S.normalise(v1);
assert.equal(up.schema, 2);
assert.equal(up.family.pinHash, 'p1');
assert.equal(up.children.length, 1);
assert.equal(up.children[0].id, 'main', 'stable id, so two upgraded devices merge into one child');
assert.equal(up.children[0].settings.childName, 'Sam');
assert.equal(up.children[0].settings.setSize, 8);
assert.equal(up.children[0].settings.pinHash, undefined);
assert.equal(up.children[0].history.length, 1);
assert.equal(S.merge(S.normalise(v1), S.normalise(v1)).children.length, 1);
assert.equal(S.normalise({ schema: 1, settings: { pinHash: null } }).children.length, 0, 'never set up');
assert.equal(SQ.family.isSetUp(S.blank()), false);
assert.ok(S.parseBackup(JSON.stringify(v1)).children.length === 1, 'old backups can be restored');

// unknown topics in a saved assignment are dropped, empty falls back to defaults
const n = S.normalise({ schema: 2, family: {}, children: [{ id: 'x', settings: { assignment: [{ topic: 'maths.nope', levels: [1] }, { topic: 'maths.powers', levels: [1, 9] }] } }] });
assert.deepEqual(plain(n.children[0].settings.assignment), [{ topic: 'maths.powers', levels: [1] }]);
const n2 = S.normalise({ schema: 2, family: {}, children: [{ id: 'y', settings: { assignment: [] } }] });
assert.ok(n2.children[0].settings.assignment.length > 0);

console.log(summary.join('\n'));
console.log(`\nOK: ${total} generated questions checked, plus engine, parser and merge tests.`);
