// Fraction answers in a real browser on a phone-sized screen.
//   node build.mjs && node tests/fractions-ui.test.cjs
const { chromium, devices } = require('playwright');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const SP = path.join(ROOT, 'dist', 'screens-fractions') + path.sep;
require('fs').mkdirSync(SP, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'dist', 'study-quest.html'));
  await p.waitForSelector('#setup-form');
  await p.fill('#setup-name', 'Sasha'); await p.fill('#setup-pin', '1111'); await p.fill('#setup-pin2', '1111');
  await p.click('#setup-form button[type=submit]');
  await p.waitForSelector('.challenge');
  await p.waitForTimeout(2800); // let the setup toast go
  const open = async (level, test) => {
    for (let k = 0; k < 80; k++) {
      await p.evaluate(() => window.SQ.ui.show('topic', { topic: 'maths.fractions' }));
      await p.click(`[data-act="practise"][data-level="${level}"]`);
      await p.waitForSelector('.qcard');
      const q = await p.evaluate(() => { const s = window.SQ.app.session; return s.questions[s.index]; });
      if (new Function('q', 'return ' + test)(q)) return q;
    }
    throw new Error('no question for ' + test);
  };
  const keys = async (s) => { for (const ch of s) await p.click(`.keypad [data-k="${ch === '>' ? 'next' : ch}"]`); };
  const msg = () => p.textContent('#qmsg');
  const out = {};

  // 1) improper answer typed on the keypad, first unsimplified then simplified
  let q = await open(2, "q.input === 'fraction' && /\\//.test(q.answer) && q.text.includes('+')");
  const [n, d] = q.answer.split('/').map(Number);
  await p.screenshot({ path: SP + 'frac-1-empty.png' });
  await keys(String(n * 2)); await keys('>'); await keys(String(d * 2));
  await p.click('.keypad [data-act="check"]');
  out.unsimplified = await msg();
  await p.screenshot({ path: SP + 'frac-2-simplify.png' });
  await p.fill('#ans-n', String(n)); await p.fill('#ans-d', String(d));
  await p.click('.keypad [data-act="check"]');
  await p.waitForFunction(() => window.SQ.app.session.results.length === 1);
  out.firstOk = await p.evaluate(() => window.SQ.app.session.results[0].ok);

  // 2) "write as a mixed number": typing the improper form is asked again, the mixed form is right
  q = await open(4, "q.wantForm === 'mixed'");
  const [N, D] = q.answer.split('/').map(Number);
  await p.fill('#ans-n', String(N)); await p.fill('#ans-d', String(D));
  await p.press('#ans-d', 'Enter');
  out.mixedAsk = await msg();
  await p.fill('#ans-w', String(Math.floor(N / D))); await p.fill('#ans-n', String(N % D)); await p.fill('#ans-d', String(D));
  await p.screenshot({ path: SP + 'frac-3-mixed.png' });
  await p.press('#ans-d', 'Enter');
  await p.waitForFunction(() => window.SQ.app.session.results.length === 1);
  out.mixedOk = await p.evaluate(() => window.SQ.app.session.results[0].ok);

  // 3) a typical mistake: adding the bottoms
  q = await open(2, "q.ftraps && q.ftraps.length && q.text.includes('+')");
  const [tn, td] = q.ftraps[0][0].split('/');
  await p.fill('#ans-n', tn); await p.fill('#ans-d', td || '1');
  await p.press('#ans-d', 'Enter');
  await p.waitForSelector('.feedback');
  out.trap = await p.textContent('.pen-note');
  await p.screenshot({ path: SP + 'frac-4-trap.png', fullPage: true });

  // 4) physical keyboard: "3/4" typed with "/" jumping to the bottom box
  q = await open(1, "q.input === 'fraction'");
  await p.click('#ans-n');
  await p.keyboard.type(q.answer.includes('/') ? q.answer : q.answer + '/1');
  out.keyboard = await p.evaluate(() => [document.getElementById('ans-n').value, document.getElementById('ans-d').value]);
  await b.close();
  const assert = require('assert');
  assert.equal(out.unsimplified, 'Correct value! Now write it in its simplest form.');
  assert.equal(out.firstOk, true, 'simplified answer accepted');
  assert.match(out.mixedAsk, /mixed number/);
  assert.equal(out.mixedOk, true, 'mixed number accepted');
  assert.ok(out.trap && out.trap.length > 10, 'typical-mistake hint shown');
  assert.ok(out.keyboard[1] !== '', '"/" moves to the bottom box');
  assert.deepEqual(errors, []);
  console.log('OK: fraction answers work on a phone (keypad, simplify, mixed numbers, hints, keyboard).');
})().catch((e) => { console.error(e); process.exit(1); });
