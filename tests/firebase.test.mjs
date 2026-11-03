// Sync through Cloud Firestore, tested against an in-process imitation of the
// Firestore REST API (same URLs, preconditions and the security rules from the
// README). The GitHub Pages build is served from localhost/study-quest/.
//   node build.mjs && node tests/firebase.test.mjs [screenshotDir]
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const shots = process.argv[2] || join(root, 'dist', 'screens-firebase');
mkdirSync(shots, { recursive: true });

const PROJECT = 'test-project', KEY = 'test-key', PORT = 8097;
const html = readFileSync(join(root, 'dist', 'pages', 'index.html'), 'utf8')
  .replace(/firebase: (null|\{[^}]*\}),/, `firebase: { projectId: '${PROJECT}', apiKey: '${KEY}' },`);
assert.ok(html.includes(`projectId: '${PROJECT}'`), 'test config injected');
const server = createServer((req, res) => {
  if (req.url.startsWith('/study-quest/')) { res.writeHead(200, { 'content-type': 'text/html' }); res.end(html); return; }
  res.writeHead(404); res.end();
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const URL = `http://localhost:${PORT}/study-quest/`;

/* ---------- Firestore imitation ---------- */
const docs = new Map();
const haDocs = new Map();
let haRefuse = false; // like a database whose rules don't have the Home Assistant part yet
let tick = 0;
const stats = { get: 0, patch: 0, conflicts: 0, denied: 0, bad: 0, ha: 0 };
let refuseAll = false;
const now = () => `2026-11-03T12:00:00.${String(++tick).padStart(6, '0')}Z`;
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, PATCH, OPTIONS', 'access-control-allow-headers': 'content-type' };
const reply = (route, status, body) => route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(body) });
const error = (route, code, status, message) => reply(route, code, { error: { code, status, message } });

async function firestore(route) {
  const req = route.request();
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
  const u = new globalThis.URL(req.url());
  const h = u.pathname.match(/^\/v1\/projects\/([^/]+)\/databases\/\(default\)\/documents\/ha\/([^/]+)$/);
  if (h) {
    if (h[1] !== PROJECT || u.searchParams.get('key') !== KEY) { stats.bad++; return error(route, 400, 'INVALID_ARGUMENT', 'bad'); }
    const id = decodeURIComponent(h[2]);
    const ok = /^[0-9a-f]{64}$/.test(id);
    if (req.method() === 'GET') return haDocs.has(id) ? reply(route, 200, haDocs.get(id)) : error(route, 404, 'NOT_FOUND', 'nope');
    if (req.method() !== 'PATCH') return error(route, 400, 'INVALID_ARGUMENT', 'method');
    const f = JSON.parse(req.postData() || '{}').fields || {};
    const valid = ok && !haRefuse && Object.keys(f).every((k) => ['game', 'updated'].includes(k)) &&
      f.game && typeof f.game.stringValue === 'string' && f.game.stringValue.length < 20000 && f.updated && 'integerValue' in f.updated;
    if (!valid) { stats.denied++; return error(route, 403, 'PERMISSION_DENIED', 'Missing or insufficient permissions.'); }
    stats.ha++;
    const t = now();
    haDocs.set(id, { name: 'ha/' + id, fields: f, createTime: t, updateTime: t });
    return reply(route, 200, haDocs.get(id));
  }
  const m = u.pathname.match(/^\/v1\/projects\/([^/]+)\/databases\/\(default\)\/documents\/families\/([^/]+)$/);
  if (!m || m[1] !== PROJECT) { stats.bad++; return error(route, 404, 'NOT_FOUND', 'bad path ' + u.pathname); }
  if (u.searchParams.get('key') !== KEY) { stats.bad++; return error(route, 400, 'INVALID_ARGUMENT', 'API key not valid'); }
  if (refuseAll) { stats.denied++; return error(route, 403, 'PERMISSION_DENIED', 'Missing or insufficient permissions.'); }
  const id = decodeURIComponent(m[2]);
  const name = `projects/${PROJECT}/databases/(default)/documents/families/${id}`;
  const doc = docs.get(id);
  const idOk = /^[0-9a-f]{64}$/.test(id);

  if (req.method() === 'GET') {
    stats.get++;
    if (!idOk) { stats.denied++; return error(route, 403, 'PERMISSION_DENIED', 'Missing or insufficient permissions.'); }
    if (!doc) return error(route, 404, 'NOT_FOUND', 'Document not found');
    return reply(route, 200, { name, ...doc });
  }
  if (req.method() === 'PATCH') {
    stats.patch++;
    const exists = u.searchParams.get('currentDocument.exists');
    const updateTime = u.searchParams.get('currentDocument.updateTime');
    if (exists === 'false' && doc) { stats.conflicts++; return error(route, 409, 'ALREADY_EXISTS', 'Document already exists'); }
    if (updateTime && !doc) { stats.conflicts++; return error(route, 404, 'NOT_FOUND', 'Document not found'); }
    if (updateTime && doc.updateTime !== updateTime) { stats.conflicts++; return error(route, 400, 'FAILED_PRECONDITION', 'the stored version does not match the required base version'); }
    const fields = JSON.parse(req.postData() || '{}').fields || {};
    // the security rules from the README
    const keysOk = Object.keys(fields).every((k) => ['rev', 'state', 'updated'].includes(k));
    const typesOk = fields.rev && 'integerValue' in fields.rev && fields.updated && 'integerValue' in fields.updated &&
      fields.state && typeof fields.state.stringValue === 'string' && fields.state.stringValue.length < 900000;
    const rev = Number(fields.rev && fields.rev.integerValue);
    const revOk = doc ? rev === Number(doc.fields.rev.integerValue) + 1 : rev === 1;
    if (!idOk || !keysOk || !typesOk || !revOk) { stats.denied++; return error(route, 403, 'PERMISSION_DENIED', 'Missing or insufficient permissions.'); }
    const t = now();
    const saved = { fields, createTime: doc ? doc.createTime : t, updateTime: t };
    docs.set(id, saved);
    return reply(route, 200, { name, ...saved });
  }
  return error(route, 400, 'INVALID_ARGUMENT', 'method');
}

const stateOf = () => { const d = [...docs.values()][0]; return d ? JSON.parse(d.fields.state.stringValue) : null; };

/* ---------- browser ---------- */
const browser = await chromium.launch();
const errors = [];
const step = (msg) => console.log('•', msg);
const shot = (page, name) => page.screenshot({ path: join(shots, name + '.png'), fullPage: true });
async function open(ctxOpts, label) {
  const ctx = await browser.newContext(ctxOpts);
  await ctx.route('https://firestore.googleapis.com/**', firestore);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${label}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${label} console: ${m.text()}`); });
  return page;
}
async function answerSet(page, n) {
  for (let i = 0; i < n; i++) {
    await page.waitForFunction((k) => window.SQ.app.session && window.SQ.app.session.index === k && !window.SQ.app.session.locked, i);
    const a = await page.evaluate(() => { const s = window.SQ.app.session; return s.questions[s.index].answer; });
    await page.fill('#answer', String(a).replace('-', '−'));
    await page.press('#answer', 'Enter');
  }
  await page.waitForFunction(() => !window.SQ.app.session);
}
const settled = (page) => page.waitForFunction(() => window.SQ.sync.status === 'ok' && !document.querySelector('.sync-dot.syncing'));

try {
  /* PC: first setup creates the family in Firestore */
  const A = await open({ viewport: { width: 1280, height: 900 } }, 'PC');
  await A.goto(URL);
  await A.waitForSelector('.seg');
  assert.equal(await A.evaluate(() => window.SQ.sync.backend), 'firebase');
  await A.fill('#setup-name', 'Sam'); await A.fill('#setup-pin', '1234'); await A.fill('#setup-pin2', '1234');
  await A.click('#setup-form button[type=submit]');
  await A.waitForSelector('#family-code');
  const code = (await A.textContent('#family-code')).trim();
  await settled(A);
  assert.equal(docs.size, 1, 'one family document');
  const [docId] = docs.keys();
  assert.match(docId, /^[0-9a-f]{64}$/, 'document id is a hash, not the code');
  assert.ok(!docId.includes(code.replace(/-/g, '')));
  assert.equal(stateOf().children[0].settings.childName, 'Sam');
  await shot(A, '01-pc-devices');
  step('setup on the PC creates the family in Firestore (' + code + ')');

  /* Phone joins with the link */
  const B = await open({ ...devices['iPhone 13'] }, 'Phone');
  await B.goto(URL + '#join-' + code);
  await B.waitForSelector('#join-form');
  await B.click('#join-form button[type=submit]');
  await B.waitForSelector('.challenge');
  assert.match(await B.textContent('.hello h1'), /Sam/);
  step('phone joins by link and sees Sam');

  /* A perfect set on the phone shows up on the PC */
  await B.click('[data-act="start-challenge"]');
  await answerSet(B, 10);
  await B.waitForSelector('text=Perfect set!');
  await settled(B);
  await B.waitForTimeout(1600);
  await settled(B);
  await A.evaluate(() => window.SQ.ui.show('home'));
  await A.evaluate(() => window.SQ.sync.pull());
  await A.waitForFunction(() => window.SQ.ui.kid().progress.streak === 1);
  assert.match(await A.textContent('.challenge .btn.primary'), /Start set 2/);
  step('a perfect set on the phone moves the PC to set 2');

  /* Both devices save at the same moment: nothing is lost */
  await A.evaluate(() => { const c = window.SQ.ui.kid(); c.settings.setSize = 8; window.SQ.ui.touchSettings(c); window.SQ.ui.commit(); });
  await B.evaluate(() => window.SQ.ui.show('topic', { topic: 'maths.powers' }));
  await B.click('[data-act="practise"][data-level="1"]');
  await answerSet(B, 10);
  await Promise.all([A.evaluate(() => window.SQ.sync.flushNow()), B.evaluate(() => window.SQ.sync.flushNow())]);
  await A.waitForTimeout(2500);
  await settled(A); await settled(B);
  await A.evaluate(() => window.SQ.sync.pull());
  await B.evaluate(() => window.SQ.sync.pull());
  await A.waitForTimeout(1500);
  const final = stateOf().children[0];
  assert.equal(final.settings.setSize, 8, 'the PC\'s rule change survived');
  assert.ok(final.history.some((h) => h.mode === 'practice'), 'the phone\'s practice set survived');
  const [ha, hb] = await Promise.all([A, B].map((p) => p.evaluate(() => window.SQ.ui.kid().history.length)));
  assert.equal(ha, final.history.length); assert.equal(hb, final.history.length);
  assert.equal(await B.evaluate(() => window.SQ.ui.kid().settings.setSize), 8);
  step(`simultaneous saves merge (${stats.conflicts} conflict(s) resolved), both devices agree`);

  /* Parent on the PC sees the phone's work */
  await A.click('[data-act="parent"]');
  await A.waitForSelector('.pinpad, .tiles');
  if (await A.isVisible('.pinpad')) for (const k of '1234') await A.click(`.pinpad [data-k="${k}"]`);
  await A.waitForSelector('.tiles');
  assert.ok((await A.textContent('.tab-body')).includes('Practice: Powers & indices'));
  await A.click('[data-tab="devices"]');
  assert.ok((await A.textContent('.tab-body')).includes('synced'));
  await shot(A, '02-pc-parent-devices');
  step('parent panel on the PC shows the phone\'s practice');

  /* Home Assistant link: off by default, refused while the rules lack it, then on */
  const haGame = () => { const d = [...haDocs.values()][0]; return d ? JSON.parse(d.fields.game.stringValue) : null; };
  assert.equal(stats.ha, 0, 'no summary is written until the parent turns the link on');
  assert.ok(await A.isVisible('[data-act="ha-on"]'));
  haRefuse = true;
  await A.click('[data-act="ha-on"]');
  await A.waitForSelector('#ha-sec .pill.bad');
  assert.ok((await A.textContent('#ha-sec')).includes('rules don’t include the Home Assistant part'));
  await settled(A);
  assert.equal(await A.evaluate(() => window.SQ.app.state.family.homeAssistant), true);
  haRefuse = false;
  await A.evaluate(() => window.SQ.sync.writeHaNow());
  await A.waitForSelector('#ha-sec .pill.good');
  const yamlText = await A.inputValue('#ha-yaml');
  const [haId] = haDocs.keys();
  assert.equal(haId, docId, 'the summary uses the same hashed id as the family');
  assert.ok(yamlText.includes(`/documents/ha/${haId}`), 'the package reads the summary document');
  assert.ok(yamlText.includes('binary_sensor.study_quest_sam_game_time'));
  const samId = await A.evaluate(() => window.SQ.ui.kid().id);
  assert.deepEqual(haGame().children[samId], { name: 'Sam', until: 0, saved: 0 });
  await shot(A, '03-pc-home-assistant');
  step('Home Assistant link: refused without the rules, then on; package shows the right document');

  /* The phone starts game time -> the summary says until when; stopping clears it */
  await B.evaluate(() => window.SQ.sync.pull());
  await B.waitForFunction(() => window.SQ.app.state.family.homeAssistant === true);
  const endsAt = await B.evaluate(() => {
    const c = window.SQ.ui.kid(), t = Date.now();
    c.rewards.push({ id: 'r-test', ts: t, minutes: 30, startedAt: t, endsAt: t + 30 * 60000, updatedAt: t });
    window.SQ.ui.commit();
    window.SQ.ui.show('home');
    return t + 30 * 60000;
  });
  await B.waitForFunction(() => window.SQ.sync.ha === 'ok', null, { timeout: 15000 });
  await B.waitForTimeout(500);
  assert.equal(haGame().children[samId].until, endsAt, 'summary carries the end of the running timer');
  await B.click('[data-act="stop-timer"]');
  await B.waitForTimeout(3000);
  assert.equal(haGame().children[samId].until, 0, 'stopping the timer clears it for Home Assistant');
  step('starting and stopping game time on the phone updates the Home Assistant summary');

  /* A wrong code and a refused database are handled */
  const C = await open({ viewport: { width: 420, height: 860 } }, 'Tablet');
  await C.goto(URL);
  await C.click('[data-act="setup-mode"][data-mode="join"]');
  await C.fill('#join-code', 'ZZZZ-ZZZZ-ZZZZ');
  await C.click('#join-form button[type=submit]');
  await C.waitForSelector('#join-err:has-text("wasn’t found")');
  refuseAll = true;
  const D = await open({ viewport: { width: 420, height: 860 } }, 'Refused');
  await D.goto(URL);
  await D.waitForSelector('#setup-form');
  assert.ok(!(await D.isVisible('.seg')), 'no join option when the database refuses access');
  assert.ok((await D.textContent('.setup')).includes('Can’t reach the sync service'));
  refuseAll = false;
  step('unknown code and refused database show clear messages');

  assert.equal(stats.bad, 0, 'every request used the right project, path and key');
  await browser.close();
  assert.deepEqual(errors.filter((e) => !/status of (403|404|409|400)/.test(e)), [], 'no page errors');
  console.log(`\nOK: Firestore sync passed. Requests: ${stats.get} reads, ${stats.patch} writes, ${stats.conflicts} conflicts, ${stats.denied} refused, ${stats.ha} Home Assistant summaries.`);
} catch (e) {
  console.error(e);
  if (errors.length) console.error('Page errors:\n' + errors.join('\n'));
  await browser.close().catch(() => {});
  process.exitCode = 1;
} finally {
  server.close();
}
