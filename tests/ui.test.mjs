// End-to-end test in a real browser with the PHP sync server.
//   node build.mjs && node tests/ui.test.mjs [screenshotDir]
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const site = join(root, 'dist', 'site');
const shots = process.argv[2] || join(root, 'dist', 'screens');
mkdirSync(shots, { recursive: true });
const PORT = 8093;
const URL = `http://127.0.0.1:${PORT}/`;

// fresh server data
rmSync(join(site, 'api', 'data'), { recursive: true, force: true });
mkdirSync(join(site, 'api', 'data'), { recursive: true });
const php = spawn('php', ['-S', `127.0.0.1:${PORT}`, '-t', site], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));

const errors = [];
const browser = await chromium.launch();
const shot = (page, name) => page.screenshot({ path: join(shots, name + '.png'), fullPage: true });
const step = (msg) => console.log('•', msg);

function watch(page, label) {
  page.on('pageerror', (e) => errors.push(`${label}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${label} console: ${m.text()}`); });
}

async function answer(page, correct = true) {
  const q = await page.evaluate(() => {
    const s = window.SQ.app.session;
    const q = s.questions[s.index];
    return { answer: q.answer, index: s.index };
  });
  const value = correct ? q.answer : q.answer + 1;
  await page.fill('#answer', String(value).replace('-', '−'));
  await page.press('#answer', 'Enter');
  return q;
}

async function perfectSet(page) {
  for (let i = 0; i < 10; i++) {
    const q = await answer(page, true);
    if (i < 9) await page.waitForFunction((n) => window.SQ.app.session && window.SQ.app.session.index === n + 1, q.index);
  }
  await page.waitForFunction(() => !window.SQ.app.session);
}

try {
  /* ---------- PC: parent setup ---------- */
  const pc = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const A = await pc.newPage();
  watch(A, 'PC');
  await A.goto(URL);
  await A.waitForSelector('#setup-form');
  assert.ok(await A.isVisible('.seg'), 'sync detected, so the join option is shown');
  await shot(A, '01-setup');
  await A.fill('#setup-name', 'Sam');
  await A.fill('#setup-pin', '1234');
  await A.fill('#setup-pin2', '4321');
  await A.click('#setup-form button[type=submit]');
  assert.match(await A.textContent('#setup-err'), /не совпадают/);
  await A.fill('#setup-pin2', '1234');
  await A.click('#setup-form button[type=submit]');
  await A.waitForSelector('#family-code');
  const code = (await A.textContent('#family-code')).trim();
  assert.match(code, /^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
  await A.waitForFunction(() => window.SQ.sync.status === 'ok');
  await shot(A, '02-parent-devices');
  step('setup done, family code ' + code);

  await A.click('text=Перейти на главную');
  await A.waitForSelector('.challenge');
  await shot(A, '03-home');

  /* ---------- challenge: perfect set, then a mistake ---------- */
  await A.click('[data-act="start-challenge"]');
  await A.waitForSelector('#answer');
  await shot(A, '04-quiz');
  await perfectSet(A);
  await A.waitForSelector('text=Perfect set!');
  await shot(A, '05-set-done');
  step('perfect set 1');

  await A.click('[data-act="start-challenge"]');
  await A.waitForSelector('#answer');
  for (let i = 0; i < 3; i++) {
    const q = await answer(A, true);
    await A.waitForFunction((n) => window.SQ.app.session.index === n + 1, q.index);
  }
  const wrong = await answer(A, false);
  await A.waitForSelector('.feedback');
  const fbText = await A.textContent('.feedback');
  const shown = wrong.answer < 0 ? '−' + Math.abs(wrong.answer) : String(wrong.answer);
  assert.ok(fbText.includes('The answer is ' + shown), 'feedback shows the right answer');
  assert.ok(await A.isVisible('.work-lines li'), 'worked solution is shown');
  await shot(A, '06-mistake');
  assert.equal(await A.evaluate(() => window.SQ.app.state.progress.streak), 0, 'mistake resets the streak');
  step('mistake shows working and resets streak');

  /* ---------- two perfect sets -> reward ---------- */
  await A.waitForTimeout(500);
  await A.click('[data-act="new-set"]');
  await A.waitForSelector('#answer');
  await perfectSet(A);
  await A.click('[data-act="start-challenge"]');
  await A.waitForSelector('#answer');
  await perfectSet(A);
  await A.waitForSelector('.reward');
  await shot(A, '07-reward');
  await A.click('text=Start the timer now');
  await A.waitForSelector('.timer-card');
  assert.ok(await A.isVisible('.timer-chip'));
  await shot(A, '08-timer');
  step('reward earned and timer started');

  /* ---------- abandoning a set breaks the run ---------- */
  await A.click('[data-act="start-challenge"]').catch(() => {});
  // the start button is still there while the timer runs
  await A.waitForSelector('#answer');
  const q1 = await answer(A, true);
  await A.waitForFunction((n) => window.SQ.app.session.index === n + 1, q1.index);
  await A.reload();
  await A.waitForSelector('.challenge');
  const last = await A.evaluate(() => window.SQ.app.state.history.slice(-1)[0]);
  assert.equal(last.abandoned, true, 'reload in the middle of a set is recorded as abandoned');
  step('reload mid-set counts as abandoned');

  /* ---------- phone joins with the link ---------- */
  const phone = await browser.newContext({ ...devices['iPhone 13'] });
  const B = await phone.newPage();
  watch(B, 'Phone');
  await B.goto(URL + '#join-' + code);
  await B.waitForSelector('#join-form');
  assert.equal(await B.inputValue('#join-code'), code, 'code taken from the link');
  await B.click('#join-form button[type=submit]');
  await B.waitForSelector('.challenge');
  assert.equal((await B.textContent('.who')).trim(), 'Sam');
  assert.ok(await B.isVisible('.timer-card'), 'phone sees the running game timer');
  await shot(B, '09-phone-home');
  step('phone joined and sees the same progress');

  await B.click('[data-act="topic"][data-topic="maths.powers"]');
  await B.waitForSelector('.level-list');
  await shot(B, '10-phone-topic');
  await B.click('[data-act="practise"][data-level="2"]');
  await B.waitForSelector('.keypad');
  // answer with the on-screen keypad
  const pq = await B.evaluate(() => { const s = window.SQ.app.session; return s.questions[s.index].answer; });
  if (pq < 0) await B.click('[data-k="minus"]');
  for (const ch of String(Math.abs(pq))) await B.click(`.keypad [data-k="${ch}"]`);
  await shot(B, '11-phone-quiz');
  await B.click('.keypad [data-act="check"]');
  await B.waitForFunction(() => window.SQ.app.session.results.length === 1 && window.SQ.app.session.results[0].ok);
  await B.waitForFunction(() => window.SQ.app.session.index === 1);
  // a wrong one on the phone
  const pq2 = await B.evaluate(() => { const s = window.SQ.app.session; return s.questions[s.index].answer; });
  for (const ch of String(Math.abs(pq2) + 1)) await B.click(`.keypad [data-k="${ch}"]`);
  await B.click('.keypad [data-act="check"]');
  await B.waitForSelector('.feedback');
  await shot(B, '12-phone-mistake');
  // finish the practice set
  await B.waitForTimeout(500);
  await B.click('[data-act="next"]');
  for (let i = 2; i < 10; i++) {
    await B.waitForFunction((n) => window.SQ.app.session && window.SQ.app.session.index === n && !window.SQ.app.session.locked, i);
    const v = await B.evaluate(() => { const s = window.SQ.app.session; return s.questions[s.index].answer; });
    await B.fill('#answer', String(v).replace('-', '−'));
    await B.press('#answer', 'Enter');
  }
  await B.waitForSelector('.result');
  await shot(B, '13-phone-practice-done');
  await B.waitForFunction(() => window.SQ.sync.status === 'ok' && window.SQ.app.state.history.some((h) => h.mode === 'practice'));
  await B.evaluate(() => window.SQ.sync.flushNow());
  await B.waitForTimeout(2500);
  step('practice on the phone with the keypad');

  /* ---------- parent panel on the PC sees the phone's practice ---------- */
  await A.evaluate(() => window.SQ.sync.pull());
  await A.click('[data-act="parent"]');
  await A.waitForSelector('.pinpad');
  await A.keyboard.type('1111');
  await A.waitForSelector('text=Неверный PIN');
  await A.keyboard.type('1234');
  await A.waitForSelector('.tiles');
  const hasPractice = await A.evaluate(() => window.SQ.app.state.history.some((h) => h.mode === 'practice'));
  assert.ok(hasPractice, 'PC sees the practice set done on the phone');
  assert.ok((await A.textContent('.tab-body')).includes('Практика: Powers & indices'));
  await shot(A, '14-parent-progress');
  await A.emulateMedia({ colorScheme: 'dark' });
  await shot(A, '15-parent-progress-dark');
  await A.emulateMedia({ colorScheme: 'light' });

  await A.click('[data-tab="challenge"]');
  await A.selectOption('#set-size', '8');
  await A.waitForFunction(() => window.SQ.app.state.settings.setSize === 8);
  await shot(A, '16-parent-rules');
  await A.click('[data-tab="topics"]');
  await A.check('input[data-topic="maths.bidmas"][data-level="1"]');
  await A.waitForFunction(() => window.SQ.app.state.settings.assignment.some((a) => a.topic === 'maths.bidmas'));
  await shot(A, '17-parent-topics');
  await A.waitForFunction(() => window.SQ.sync.status === 'ok');
  await A.waitForTimeout(2000);
  await B.evaluate(() => window.SQ.sync.pull());
  await B.waitForFunction(() => window.SQ.app.state.settings.setSize === 8, null, { timeout: 5000 });
  step('parent settings reach the phone');

  await B.emulateMedia({ colorScheme: 'dark' });
  await B.click('[data-act="home"]').catch(() => B.evaluate(() => window.SQ.ui.show('home')));
  await B.waitForSelector('.challenge');
  await shot(B, '18-phone-home-dark');

  /* ---------- standalone file without a server ---------- */
  const solo = await browser.newContext({ viewport: { width: 420, height: 860 } });
  const C = await solo.newPage();
  watch(C, 'File');
  await C.goto('file://' + join(root, 'dist', 'study-quest.html'));
  await C.waitForSelector('#setup-form');
  assert.ok(!(await C.isVisible('.seg')), 'no sync option without a server');
  assert.ok((await C.textContent('.setup')).includes('только в этом браузере'));
  await C.fill('#setup-name', 'Sam'); await C.fill('#setup-pin', '0000'); await C.fill('#setup-pin2', '0000');
  await C.click('#setup-form button[type=submit]');
  await C.waitForSelector('.challenge');
  step('single-file version works offline');

  /* ---------- the server never shows stored data directly ---------- */
  const res = await A.request.get(URL + 'api/sync.php?family=' + code);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.ok(body.rev >= 3);
  const bad = await A.request.get(URL + 'api/sync.php?family=../../etc');
  assert.equal(bad.status(), 400);

  await browser.close();
  assert.deepEqual(errors, [], 'no page errors');
  console.log('\nOK: end-to-end flow passed. Screenshots in ' + shots);
} catch (e) {
  console.error(e);
  if (errors.length) console.error('Page errors:\n' + errors.join('\n'));
  await browser.close().catch(() => {});
  process.exitCode = 1;
} finally {
  php.kill();
}
