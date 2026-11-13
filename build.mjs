// Study Quest build: turns index.html + src/ into ready-to-upload files.
//
//   node build.mjs
//
// dist/site/            -> upload this folder to PHP hosting (index.html + api/)
// dist/pages/           -> GitHub Pages version (no server, no sync)
// dist/study-quest.html -> the same app as one file (works offline, no sync)
// dist/artifact.html    -> page body for a claude.ai artifact preview
// dist/pages/business/  -> Business Quest (business/index.html), GitHub Pages only:
//                          its marking runs as a GitHub Actions job (see README)
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

const bodyWith = (code) => `<div id="root"><noscript>Study Quest needs JavaScript turned on.</noscript></div>
<script>
${code}
</script>`;
const body = bodyWith(js);

// GitHub Pages has no PHP, so that build never asks for the sync server.
const SYNC_LINE = "syncUrl: 'api/sync.php',";
if (js.split(SYNC_LINE).length !== 2) throw new Error('syncUrl line not found exactly once in config.js');
const jsNoSync = js.replace(SYNC_LINE, 'syncUrl: null,');

const page = (b) => `<!doctype html>
<html lang="en">
<head>
${head()}
</head>
<body>
${b}
</body>
</html>
`;
const full = page(body);
const pages = page(bodyWith(jsNoSync));

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
mkdirSync(join(dist, 'pages'), { recursive: true });
writeFileSync(join(dist, 'pages', 'index.html'), pages);
writeFileSync(join(dist, 'pages', '.nojekyll'), '');
writeFileSync(join(dist, 'study-quest.html'), full);
writeFileSync(join(dist, 'artifact.html'), artifact);
writeFileSync(join(dist, 'site', 'index.html'), full);
cpSync(join(here, 'api'), join(dist, 'site', 'api'), {
  recursive: true,
  filter: (src) => !/\/data\/[0-9a-f]{64}\.php/.test(src) && !/\.(lock|tmp)$/.test(src),
});
if (!existsSync(join(dist, 'site', 'api', 'data', '.htaccess'))) throw new Error('api/data/.htaccess missing');

/* ---------- Business Quest: its own page on the same core ---------- */
const bizHtml = read('business/index.html');
const fromBiz = (p) => p.replace(/^\.\.\//, '');
const bizScripts = [...bizHtml.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => fromBiz(m[1]));
const bizStyles = [...bizHtml.matchAll(/<link rel="stylesheet" href="(\.\.\/src\/[^"]+)">/g)].map((m) => fromBiz(m[1]));
const bizJs = bizScripts.map((s) => `/* ---- ${s} ---- */\n` + read(s)).join('\n').replace(/<\/script/gi, '<\\/script');
if (/"ms":|"pts":|"notes":/.test(bizJs)) throw new Error('markscheme content must not be in the Business Quest page');
const bizPage = `<!doctype html>
<html lang="en">
<head>
${head().replace('<title>Study Quest</title>', '<title>Business Quest</title>').replace(/<style>[\s\S]*<\/style>/, () => '<style>\n' + bizStyles.map(read).join('\n') + '\n</style>')}
</head>
<body>
<div id="root"><noscript>Business Quest needs JavaScript turned on.</noscript></div>
<script>
${bizJs}
</script>
</body>
</html>
`;
mkdirSync(join(dist, 'pages', 'business'), { recursive: true });
writeFileSync(join(dist, 'pages', 'business', 'index.html'), bizPage);

console.log(`Built ${scripts.length} scripts, ${(full.length / 1024).toFixed(0)} KB:`);
console.log('  dist/site/ (index.html + api/)');
console.log('  dist/pages/ (GitHub Pages)');
console.log('  dist/study-quest.html');
console.log('  dist/artifact.html');
console.log(`Business Quest: ${bizScripts.length} scripts, ${(bizPage.length / 1024).toFixed(0)} KB -> dist/pages/business/`);
