// Study Quest build: turns index.html + src/ into ready-to-upload files.
//
//   node build.mjs
//
// dist/site/            -> upload this folder to the hosting (index.html + api/)
// dist/study-quest.html -> the same app as one file (works offline, no sync)
// dist/artifact.html    -> page body for a claude.ai artifact preview
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(here, p), 'utf8');
const html = read('index.html');

const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
const styles = [...html.matchAll(/<link rel="stylesheet" href="(src\/[^"]+)">/g)].map((m) => m[1]);
const fontLink = (html.match(/<link rel="stylesheet" href="(https:\/\/fonts\.googleapis\.com[^"]+)">/) || [])[1];

const css = styles.map(read).join('\n');
const js = scripts.map((s) => `/* ---- ${s} ---- */\n` + read(s)).join('\n')
  .replace(/<\/script/gi, '<\\/script');

const head = (extra = '') => `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#2346d4">
<meta name="robots" content="noindex">
<title>Study Quest</title>${extra}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${fontLink}">
<style>
${css}
</style>`;

const body = `<div id="root"><noscript>Study Quest needs JavaScript turned on.</noscript></div>
<script>
${js}
</script>`;

const full = `<!doctype html>
<html lang="en">
<head>
${head()}
</head>
<body>
${body}
</body>
</html>
`;

// Artifact pages get their own document skeleton, so only the content goes in.
const artifact = `<title>Study Quest</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="${fontLink}">
<style>
${css}
</style>
${body}
`;

const dist = join(here, 'dist');
rmSync(dist, { recursive: true, force: true });
mkdirSync(join(dist, 'site'), { recursive: true });
writeFileSync(join(dist, 'study-quest.html'), full);
writeFileSync(join(dist, 'artifact.html'), artifact);
writeFileSync(join(dist, 'site', 'index.html'), full);
cpSync(join(here, 'api'), join(dist, 'site', 'api'), {
  recursive: true,
  filter: (src) => !/\/data\/[0-9a-f]{64}\.php/.test(src) && !/\.(lock|tmp)$/.test(src),
});
if (!existsSync(join(dist, 'site', 'api', 'data', '.htaccess'))) throw new Error('api/data/.htaccess missing');

console.log(`Built ${scripts.length} scripts, ${(full.length / 1024).toFixed(0)} KB:`);
console.log('  dist/site/ (index.html + api/)');
console.log('  dist/study-quest.html');
console.log('  dist/artifact.html');
