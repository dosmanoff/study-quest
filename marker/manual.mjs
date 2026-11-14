// Business Quest: marking by a Claude Code session instead of the API.
// For when there is no API credit: the session reads the waiting answers,
// marks them by the same examiner prompt and stores the marks through the
// same checks (cleanMark, too-short cap, injection flag, lease).
//
//   BQ_FAMILY_CODES=... node marker/manual.mjs pending > pending.json
//   BQ_FAMILY_CODES=... node marker/manual.mjs submit marks.json
//       marks.json = [{ "id": "<answer id>", "mark": { model JSON } }]
//
// Run it only where the output stays private (never in GitHub Actions):
// "pending" prints the markscheme and the student's answers.
import { readFileSync } from 'node:fs';
import { loadConfig, firestore, listPending, submitMark } from './lib.mjs';
import { loadBank } from '../tools/bank.mjs';

const [cmd, file] = process.argv.slice(2);
const codes = String(process.env.BQ_FAMILY_CODES || '').split(/[\s,;]+/).map((c) => c.trim().toUpperCase()).filter(Boolean);
if (!codes.length || !['pending', 'submit'].includes(cmd) || (cmd === 'submit' && !file)) {
  console.error('Usage: BQ_FAMILY_CODES=... node marker/manual.mjs pending | submit <marks.json>');
  process.exit(1);
}
const cfg = loadConfig();
const db = firestore(cfg);
const bank = loadBank();

if (cmd === 'pending') {
  console.log(JSON.stringify(await listPending(db, codes, bank), null, 1));
} else {
  const items = JSON.parse(readFileSync(file, 'utf8'));
  for (const it of items) {
    const r = await submitMark(db, codes, bank, it.id, it.mark, process.env.BQ_MARKED_BY || 'claude-code-session');
    console.log(r.ok ? `Q${r.n}: ${r.mark.score}/${r.mark.max}${r.mark.band ? ' (' + r.mark.band + ')' : ''}${r.mark.flags.length ? ' [' + r.mark.flags.join(', ') + ']' : ''}` : `${it.id}: not stored (${r.why})`);
  }
}
