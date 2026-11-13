// The question bank for tests: the real one when the key is available
// (BQ_BANK_KEY or .bank-key), otherwise the public questions with a made-up
// markscheme, so the tests also run where the secret is not set.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { loadBank } from '../../tools/bank.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function testBank() {
  try {
    return { bank: loadBank(), real: true };
  } catch (e) {
    const ctx = vm.createContext({});
    ctx.window = ctx;
    vm.runInContext(readFileSync(join(root, 'src/subjects/business/questions.js'), 'utf8'), ctx);
    const bank = JSON.parse(JSON.stringify(ctx.BQ_QUESTIONS)).map((q) => ({
      ...q,
      ms: `Model answer for Q${q.n}: a business uses resources to meet needs and wants (test markscheme ${q.n}).`,
      pts: [`First markscheme point for Q${q.n}`, `Second markscheme point for Q${q.n}`],
      notes: q.marks >= 10 ? ['Top band: balanced and applied, with a supported judgement.'] : [],
    }));
    return { bank, real: false };
  }
}
