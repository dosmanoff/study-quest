// Business Quest: mark the answers that are waiting.
//
//   node marker/mark.mjs --drain            every pending answer (cron, every 10 min)
//   node marker/mark.mjs --drain --only ID  just one answer ("Mark now" for one)
//
// Settings: marker/config.json (model, daily limit...). Secrets come from the
// environment (GitHub Actions secrets), never from files in the repository:
//   ANTHROPIC_API_KEY  Claude API key. Without it nothing is marked and answers
//                      stay pending.
//   BQ_BANK_KEY        key that decrypts marker/bank.enc (the markscheme)
//   BQ_FAMILY_CODES    family code(s) to mark, comma-separated
// Optional overrides: BQ_MODEL, BQ_DAILY_LIMIT, BQ_EFFORT, BQ_FALLBACKS=off.
import { loadConfig, drain } from './lib.mjs';
import { loadBank } from '../tools/bank.mjs';

const args = process.argv.slice(2);
if (!args.includes('--drain')) {
  console.log('Usage: node marker/mark.mjs --drain [--only <answer id>]');
  process.exit(1);
}
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : (process.env.BQ_ONLY || null);
const cfg = loadConfig();
const codes = String(process.env.BQ_FAMILY_CODES || '').split(/[\s,;]+/).map((c) => c.trim().toUpperCase()).filter(Boolean);
if (!codes.length) {
  console.log('No BQ_FAMILY_CODES: nothing to mark. Add the family code as a GitHub secret (see README).');
  process.exit(0);
}
if (cfg.apiMarking === false && !process.env.BQ_FORCE_API) {
  console.log('API marking is off (marker/config.json "apiMarking": false): answers are marked by a Claude Code session with marker/manual.mjs.');
  process.exit(0);
}
const bank = loadBank(); // throws without BQ_BANK_KEY
const apiKey = process.env.ANTHROPIC_API_KEY || '';
console.log(`Business Quest marking: model ${cfg.model}, daily limit ${cfg.dailyLimit}, ${codes.length} family code(s)${apiKey ? '' : ', NO API KEY'}`);

const res = await drain({ codes, apiKey, bank, cfg, only, log: (m) => console.log(m) });
console.log(`Done: ${res.marked} marked, ${res.invalid} unusable replies, ${res.skipped} skipped${res.stopped ? ', stopped: ' + res.stopped : ''}.`);
// Rate limits and outages are normal: the answers stay pending and the next run
// picks them up, so the job itself still succeeds.
process.exit(0);
