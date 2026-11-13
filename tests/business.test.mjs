// Business Quest: quick-check items and generators, number parser, spaced
// repetition, pending answers left out of statistics, merging and the
// Firestore size limit.
//   node tests/business.test.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'business', 'index.html'), 'utf8');
const files = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1].replace(/^\.\.\//, ''))
  .filter((f) => !f.includes('/ui/') && !f.endsWith('main.js'));

export function loadBusiness() {
  const ctx = vm.createContext({ console, Math, Date, JSON });
  ctx.globalThis = ctx;
  ctx.window = ctx;
  for (const f of files) vm.runInContext(readFileSync(join(root, f), 'utf8'), ctx, { filename: f });
  return ctx;
}

const ctx = loadBusiness();
const { SQ, BQ, QUICK, BQ_QUESTIONS: QS } = ctx;
const DAY = 864e5;
let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks++; };
// values from the vm come from another realm: compare them as plain JSON
const plain = (x) => (x === undefined || typeof x === 'number' ? x : JSON.parse(JSON.stringify(x)));
const eq = (a, b, msg) => { assert.deepStrictEqual(plain(a), plain(b), msg); checks++; };

/* ---------- the bank and the quick items ---------- */
eq(QS.length, 100, '100 questions');
eq(QS.reduce((s, q) => s + q.marks, 0), 435, '435 marks');
ok(QS.every((q) => !('ms' in q) && !('pts' in q) && !('notes' in q)), 'no markscheme in the site');
ok(QS.every((q) => BQ.CT[q.ct]), 'every command term is known');
eq(QS.filter((q) => q.hl).map((q) => q.n), [86, 87], 'HL questions');
ok(QS.filter((q) => BQ.hasCase(q)).length >= 5, 'cases are detected');
ok(BQ.questionText(QS.find((q) => q.n === 73)).includes('Small | 2,000 | $6,000 | $2.00'), 'tables become text rows');

eq(QUICK.items.length, 76, '76 quick items');
eq(QUICK.gens.length, 6, '6 generators');
const ids = new Set();
for (const it of QUICK.items) {
  ok(!ids.has(it.id), 'unique id ' + it.id); ids.add(it.id);
  ok(BQ.SUBS.some((s) => s.id === it.sub), it.id + ' has a known subtopic');
  ok(Array.isArray(it.opts) && it.opts.length >= 2, it.id + ' has options');
  ok(Number.isInteger(it.a) && it.a >= 0 && it.a < it.opts.length, `${it.id}: answer ${it.a} within ${it.opts.length} options`);
  ok(typeof it.why === 'string' && it.why.length > 5, it.id + ' explains');
}
for (const g of QUICK.gens) {
  ok(BQ.SUBS.some((s) => s.id === g.sub), g.id + ' has a subtopic');
  for (let i = 0; i < 1000; i++) {
    const m = g.make();
    if (!(typeof m.a === 'number' && Number.isFinite(m.a))) assert.fail(`${g.id} gave ${m.a} for: ${m.q}`);
    if (/NaN|undefined|Infinity/.test(m.q + m.steps.join(' '))) assert.fail(`${g.id} text: ${m.q} / ${m.steps}`);
    // the answer is the number printed in bold at the end of the working, to the cent
    const shown = BQ.parseNumber(/<b>([^<]+)<\/b>/.exec(m.steps[m.steps.length - 1])[1]);
    if (!BQ.numberOk(shown, m.a)) assert.fail(`${g.id}: working shows ${shown}, answer ${m.a}`);
  }
  checks++;
}

/* ---------- number parser ---------- */
const P = BQ.parseNumber;
eq(P('1234'), 1234); eq(P('$1,234.50'), 1234.5); eq(P(' 12 345 '), 12345); eq(P('−86,000'), -86000);
eq(P('-$5'), -5); eq(P('$-5'), -5); eq(P('–3.5'), -3.5); eq(P('.5'), 0.5); eq(P('+7'), 7); eq(P('2.'), 2);
for (const bad of ['', 'abc', '1,23', '12a', '$', '1.2.3', '--4', '5%']) ok(Number.isNaN(P(bad)), 'rejects ' + bad);
ok(BQ.numberOk('2.505', 2.5), 'within 0.006'); ok(BQ.numberOk('2.506', 2.5), 'edge 0.006');
ok(!BQ.numberOk('2.507', 2.5), 'outside 0.006'); ok(!BQ.numberOk('x', 2.5), 'not a number');

/* ---------- word ranges ---------- */
const q = (n) => QS.find((x) => x.n === n);
eq(BQ.wordRange({ marks: 2, ao: 1 }), [20, 60]);
eq(BQ.wordRange({ marks: 4, ao: 2 }), [50, 120]);
eq(BQ.wordRange({ marks: 4, ao: 3 }), [120, 240]);
eq(BQ.wordRange({ marks: 10, ao: 3 }), [300, 600]);
eq(BQ.wordRange({ marks: 6, ao: 2 }), [180, 360]);
eq(BQ.words('  one two\nthree  '), 3);

/* ---------- spaced repetition ---------- */
const mk = (score, max = 10) => ({ status: 'marked', mark: { score, max } });
eq(BQ.reviewDays([mk(4)]), 1, '<50% -> 1 day');
eq(BQ.reviewDays([mk(7)]), 3, '<80% -> 3 days');
eq(BQ.reviewDays([mk(8)]), 7, 'first >=80% -> 7');
eq(BQ.reviewDays([mk(8), mk(9)]), 14, 'second -> 14');
eq(BQ.reviewDays([mk(9), mk(8), mk(10)]), 28, 'third -> 28');
eq(BQ.reviewDays([mk(9), mk(9), mk(9), mk(9)]), 56, 'fourth -> 56');
eq(BQ.reviewDays([mk(9), mk(9), mk(9), mk(9), mk(10)]), 60, 'capped at 60');
eq(BQ.reviewDays([mk(9), mk(9), mk(3), mk(9)]), 7, 'run restarts after a weak result');
eq(BQ.reviewDays([mk(9), mk(9), mk(6)]), 3, 'latest result decides');

/* ---------- a student with history ---------- */
const NOW = Date.UTC(2026, 10, 13, 12);
function child() { return SQ.storage.blankChild('Yaroslav'); }
let seq = 0;
function attempt(n, ts, score, opts = {}) {
  const qq = q(n);
  const a = { id: 'a' + (++seq), n, ts, text: opts.text || 'Answer text '.repeat(10), words: 20, secs: 300, attempt: opts.attempt || 1,
    status: score == null ? 'pending' : 'marked', tries: 0, lease: 0, updatedAt: ts };
  a.mark = score == null ? null : { score, max: qq.marks, band: null, points: [], command_term: { met: true, comment: '' },
    application: { needed: false, met: true, comment: '' }, strengths: [], improve: [], better_sentence: '', flags: [], model: 'test', at: ts + 60000 };
  return a;
}

const c = child();
c.attempts.push(attempt(1, NOW - 10 * DAY, 2));          // 2/2, due in 7 days -> overdue
c.attempts.push(attempt(2, NOW - 5 * DAY, 1));           // 1/4 -> 1 day -> overdue, worst
c.attempts.push(attempt(3, NOW - 2 * DAY, 3));           // 3/4 -> 3 days -> not due yet
c.attempts.push(attempt(4, NOW - 1 * DAY, null));        // pending
c.attempts.push(attempt(5, NOW - 3 * DAY, 4));           // 4/4 -> 7 days -> not due
c.attempts.push(attempt(5, NOW - 1 * DAY, null, { attempt: 2 })); // resubmitted, pending

const st = BQ.questionStatus(c, QS, NOW);
ok(st[4].pending && !st[4].last && !st[4].isDue, 'pending only: no score, not due');
ok(st[5].pending && st[5].last.mark.score === 4 && !st[5].isDue, 'pending resubmission: the marked one is still the last, but not due');
eq(BQ.dueList(c, QS, null, NOW).map((s) => s.n), [2, 1], 'due: worst first');
eq(BQ.nextQuestion(c, QS, { now: NOW }), 2, 'next question: the worst overdue review');
eq(BQ.nextQuestion(c, QS, { now: NOW, skip: 2 }), 1, 'Different question skips it');
const subs11 = BQ.nextQuestion(c, QS, { now: NOW, subs: ['1.2'], rand: () => 0 });
eq(q(subs11).sub, '1.2', 'subtopic filter');
for (let i = 0; i < 300; i++) {
  const n = BQ.nextQuestion(c, QS, { now: NOW, skip: 2, rand: Math.random });
  ok(n !== 4 && n !== 5, 'a pending question is never offered');
}
// with nothing due and nothing new, the least recently practised comes first
const c2 = child();
QS.forEach((x, i) => c2.attempts.push(attempt(x.n, NOW - DAY + i * 1000, x.marks))); // all full marks, recent
eq(BQ.nextQuestion(c2, QS, { now: NOW }), 1, 'oldest practised next');
c2.settings.hl = false;
ok(BQ.stats(c2, QS, NOW).total === 98, 'HL off: 98 questions in scope');

/* ---------- statistics leave pending answers out ---------- */
const s = BQ.stats(c, QS, NOW);
eq(s.practised, 4, 'practised = questions with a marked answer');
eq(s.pending.length, 2, 'two answers waiting');
eq(Math.round(s.average * 1000), Math.round(((2 + 1 + 3 + 4) / (2 + 4 + 4 + 4)) * 1000), 'average over latest marked only');
eq(s.needsWork.map((x) => x.n), [2], 'needs work: below 75%');
const def = s.byCt.find((x) => x.ct === 'Define');
ok(def && def.n === 1, 'by command term');
ok(s.byAo.every((x) => x.n > 0), 'by AO');
const sub11 = s.bySub.find((x) => x.id === '1.1');
eq([sub11.done, sub11.pend], [4, 2], 'subtopic counts');
// marking the pending answers changes the numbers, before that nothing moves
const before = JSON.stringify([s.average, s.practised, s.needsWork.map((x) => x.n)]);
c.attempts.push(attempt(6, NOW - 1000, null));
const s2 = BQ.stats(c, QS, NOW);
eq(JSON.stringify([s2.average, s2.practised, s2.needsWork.map((x) => x.n)]), before, 'a new pending answer changes nothing');

/* ---------- quick check ---------- */
const kid = child();
for (let i = 0; i < 200; i++) {
  const set = BQ.makeQuick(kid, QUICK, {});
  eq(set.length, 10, 'ten tasks');
  const nums = set.filter((t) => t.kind === 'num').length;
  ok(nums === 3, '3 calculations, got ' + nums);
  ok(new Set(set.filter((t) => t.kind !== 'num').map((t) => t.id)).size === set.filter((t) => t.kind !== 'num').length, 'no repeats');
}
kid.settings.hl = false;
for (let i = 0; i < 200; i++) ok(!BQ.makeQuick(kid, QUICK, {}).some((t) => t.id === 'g-ev'), 'no HL generator with HL off');
kid.settings.hl = true;
// mistakes come back first, at most three
kid.quick.push({ id: 'q1', ts: NOW - 2 * DAY, items: ['m1', 'm2', 'm3', 'm4', 'c10a'].map((k) => ({ k, ok: false })) });
kid.quick.push({ id: 'q2', ts: NOW - DAY, items: [{ k: 'm1', ok: true }] }); // m1 put right since
eq(BQ.quickMissed(kid, QUICK.items).sort(), ['c10a', 'm2', 'm3', 'm4'], 'last answer per item decides');
for (let i = 0; i < 100; i++) {
  const set = BQ.makeQuick(kid, QUICK, {});
  const retry = set.filter((t) => t.retry);
  eq(retry.length, 3, 'three missed items');
  ok(set.slice(0, 3).every((t) => t.retry), 'missed items come first');
  ok(retry.every((t) => ['c10a', 'm2', 'm3', 'm4'].includes(t.id)), 'the right ones');
}
const only16 = BQ.makeQuick(child(), QUICK, { subs: ['1.6'] });
ok(only16.length === 8 && only16.every((t) => t.sub === '1.6'), 'subtopic quick check uses what there is');

/* ---------- merging ---------- */
const famA = SQ.storage.blank();
famA.family.pinHash = SQ.hashPin('1234');
const y = child();
y.attempts.push(attempt(7, NOW - 5000, null));
famA.children.push(y);
const famB = JSON.parse(JSON.stringify(famA));
// the marker marks it in copy B; meanwhile copy A writes a new answer and a quick check
const yB = famB.children[0];
Object.assign(yB.attempts[0], { status: 'marked', mark: attempt(7, NOW, 3).mark, updatedAt: NOW });
yB.reveal['7'] = { ms: 'Model answer', notes: [], at: NOW };
yB.marker = { day: '2026-11-13', calls: 1, lastRun: NOW, lastError: '', updatedAt: NOW };
y.attempts.push(attempt(8, NOW - 1000, null));
y.attempts[0].updatedAt = NOW + 5000; // a newer but still pending copy must not win
y.quick.push({ id: 'qq', ts: NOW, items: [] });
const m1 = SQ.storage.merge(famA, famB), m2 = SQ.storage.merge(famB, famA);
eq(JSON.stringify(m1), JSON.stringify(m2), 'merge is symmetric');
const mc = m1.children[0];
eq(mc.attempts.map((a) => [a.n, a.status]), [[7, 'marked'], [8, 'pending']], 'marked beats pending; new answer kept');
eq(mc.reveal['7'].ms, 'Model answer', 'model answer kept');
eq(mc.quick.length, 1, 'quick sets joined');
eq(mc.marker.calls, 1, 'marker counters kept');
ok(!('rewards' in mc) && !('dailyLimit' in mc.settings) && !('setsRequired' in mc.settings) && !('onMistake' in mc.settings) && !('rewardMinutes' in mc.settings), 'no game-time fields');
eq(SQ.storage.merge(m1, m1), m1, 'merging with itself changes nothing');
// a reset on any device drops older work everywhere
const famR = JSON.parse(JSON.stringify(m1));
famR.children[0].resetAt = NOW + 10;
famR.children[0].attempts = []; famR.children[0].reveal = {};
const mr = SQ.storage.merge(m1, famR).children[0];
eq([mr.attempts.length, mr.quick.length, Object.keys(mr.reveal).length], [0, 0, 0], 'reset wins');

/* ---------- size limit for one Firestore document ---------- */
const big = child();
const long = 'x'.repeat(3000);
QS.forEach((x) => { for (let k = 0; k < 4; k++) big.attempts.push(attempt(x.n, NOW - (40 - k) * DAY + x.n, k % x.marks, { text: long, attempt: k + 1 })); });
big.attempts.push(attempt(1, NOW, null, { text: long, attempt: 5 }));
const fam = SQ.storage.blank(); fam.children.push(big);
const merged = SQ.storage.merge(fam, fam);
const size = JSON.stringify(merged).length;
ok(size < 800000, 'whole state fits in one Firestore document: ' + size);
const mb = merged.children[0];
eq(mb.attempts.length, 401, 'every attempt is kept (old ones slimmed to their score)');
ok(mb.attempts.some((a) => a.slim) && mb.attempts.filter((a) => a.slim).every((a) => a.text === '' && a.mark && Number.isFinite(a.mark.score)), 'slimmed attempts keep their score');
const stB = BQ.questionStatus(mb, QS, NOW);
ok(QS.every((x) => stB[x.n].last && !stB[x.n].last.slim && stB[x.n].last.text === long), 'the latest marked answer keeps its text and feedback');
ok(QS.every((x) => !stB[x.n].best.slim), 'the best answer keeps its text');
ok(stB[1].pending && stB[1].pending.text === long, 'pending answers are never slimmed');
eq(JSON.stringify(SQ.storage.merge(merged, fam)), JSON.stringify(merged), 'devices agree after slimming');

console.log(`\nOK: Business Quest logic, ${checks} checks (items, 6000 generated calculations, parser, schedule, stats, merge, size).`);
