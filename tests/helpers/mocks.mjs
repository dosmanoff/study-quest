// Test doubles for Business Quest: a Firestore REST imitation (same URLs,
// preconditions and security rules as firebase/firestore.rules) and a fake
// Claude Messages API. Both are plain HTTP servers on localhost.
import { createServer } from 'node:http';

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, PATCH, POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
};

function listen(handler) {
  const server = createServer(handler);
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function body(req) {
  return new Promise((resolve) => { let b = ''; req.on('data', (c) => { b += c; }); req.on('end', () => resolve(b)); });
}

export async function startFirestore(project = 'test-project') {
  const docs = new Map();
  const stats = { get: 0, patch: 0, conflicts: 0, denied: 0 };
  let tick = 0;
  const now = () => `2026-11-13T12:00:00.${String(++tick).padStart(6, '0')}Z`;
  const send = (res, status, obj) => { res.writeHead(status, { ...cors, 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
  const error = (res, code, status, message) => send(res, code, { error: { code, status, message } });

  const server = await listen(async (req, res) => {
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
    const u = new URL(req.url, 'http://x');
    const raw = await body(req);
    const m = u.pathname.match(/^\/v1\/projects\/([^/]+)\/databases\/\(default\)\/documents\/(families|ha)\/([^/]+)$/);
    if (!m || m[1] !== project) return error(res, 404, 'NOT_FOUND', 'bad path ' + u.pathname);
    if (m[2] === 'ha') return error(res, 403, 'PERMISSION_DENIED', 'not used by Business Quest');
    const id = decodeURIComponent(m[3]);
    const idOk = /^[0-9a-f]{64}$/.test(id);
    const doc = docs.get(id);
    const name = `projects/${project}/databases/(default)/documents/families/${id}`;
    if (req.method === 'GET') {
      stats.get++;
      if (!idOk) { stats.denied++; return error(res, 403, 'PERMISSION_DENIED', 'denied'); }
      return doc ? send(res, 200, { name, ...doc }) : error(res, 404, 'NOT_FOUND', 'Document not found');
    }
    if (req.method !== 'PATCH') return error(res, 400, 'INVALID_ARGUMENT', 'method');
    stats.patch++;
    const exists = u.searchParams.get('currentDocument.exists');
    const updateTime = u.searchParams.get('currentDocument.updateTime');
    if (exists === 'false' && doc) { stats.conflicts++; return error(res, 409, 'ALREADY_EXISTS', 'exists'); }
    if (updateTime && !doc) { stats.conflicts++; return error(res, 404, 'NOT_FOUND', 'Document not found'); }
    if (updateTime && doc.updateTime !== updateTime) { stats.conflicts++; return error(res, 400, 'FAILED_PRECONDITION', 'stale'); }
    const fields = (JSON.parse(raw || '{}').fields) || {};
    const keysOk = Object.keys(fields).every((k) => ['rev', 'state', 'updated'].includes(k));
    const typesOk = fields.rev && 'integerValue' in fields.rev && fields.updated && 'integerValue' in fields.updated &&
      fields.state && typeof fields.state.stringValue === 'string' && fields.state.stringValue.length < 900000;
    const rev = Number(fields.rev && fields.rev.integerValue);
    const revOk = doc ? rev === Number(doc.fields.rev.integerValue) + 1 : rev === 1;
    if (!idOk || !keysOk || !typesOk || !revOk) { stats.denied++; return error(res, 403, 'PERMISSION_DENIED', 'Missing or insufficient permissions.'); }
    const t = now();
    const saved = { fields, createTime: doc ? doc.createTime : t, updateTime: t };
    docs.set(id, saved);
    return send(res, 200, { name, ...saved });
  });
  const url = `http://127.0.0.1:${server.address().port}`;
  return {
    url: url + '/v1',
    project,
    stats,
    docs,
    /** The stored state of the only (or given) family. */
    state(id) {
      const d = id ? docs.get(id) : [...docs.values()][0];
      return d ? JSON.parse(d.fields.state.stringValue) : null;
    },
    /** Put a state straight in (like a device that saved it). */
    seed(id, state) {
      const t = now();
      const old = docs.get(id);
      docs.set(id, { fields: { rev: { integerValue: String(old ? Number(old.fields.rev.integerValue) + 1 : 1) }, state: { stringValue: JSON.stringify(state) }, updated: { integerValue: String(Date.now()) } }, createTime: t, updateTime: t });
    },
    close: () => new Promise((r) => server.close(r)),
  };
}

/**
 * Fake Claude: handler(requestBody, n) -> { status, json?, text?, headers?, delay? }
 * where text becomes the reply's text block. Every request is kept in .requests.
 */
export async function startClaude(handler) {
  const requests = [];
  const server = await listen(async (req, res) => {
    const raw = await body(req);
    if (!req.url.startsWith('/v1/messages')) { res.writeHead(404); return res.end(); }
    const b = JSON.parse(raw || '{}');
    requests.push({ url: req.url, headers: req.headers, body: b });
    const r = (await handler(b, requests.length)) || {};
    if (r.delay) await new Promise((ok) => setTimeout(ok, r.delay));
    const status = r.status || 200;
    const json = r.json || (status === 200
      ? { id: 'msg_test_' + requests.length, type: 'message', role: 'assistant', model: b.model,
        content: [{ type: 'thinking', thinking: '', signature: 'x' }, { type: 'text', text: r.text || '' }],
        stop_reason: r.stop_reason || 'end_turn', stop_sequence: null, usage: { input_tokens: 1000, output_tokens: 300 } }
      : { type: 'error', error: { type: status === 429 ? 'rate_limit_error' : 'api_error', message: 'mock ' + status } });
    res.writeHead(status, { 'content-type': 'application/json', 'request-id': 'req_' + requests.length, ...(r.headers || {}) });
    res.end(JSON.stringify(json));
  });
  return { url: `http://127.0.0.1:${server.address().port}`, requests, close: () => new Promise((r) => server.close(r)) };
}

/** A mark the way a careful examiner model would reply. */
export function markJson(score, extra = {}) {
  return JSON.stringify({
    score, band: null,
    points: [{ point: 'Uses resources to meet needs and wants', status: score ? 'hit' : 'miss', note: 'You said it uses inputs to make goods.' },
      { point: 'Profit is not part of the definition', status: 'miss', note: 'Missing.' }],
    command_term: { met: true, comment: 'A clear, precise meaning.' },
    application: { needed: false, met: true, comment: '' },
    strengths: ['You used the word “resources” correctly.'],
    improve: ['Say that profit is a common aim, not part of the definition.'],
    better_sentence: 'A business is an organisation that uses resources to provide goods or services that meet people’s needs and wants.',
    flags: [], ...extra,
  });
}
