// Keeps index.html's <link rel="modulepreload"> list in step with the game's
// import graph. Without it the browser only finds each module's imports once
// that module has arrived, so the ~190 modules come in about seven round trips
// deep (seconds on a slow phone connection); with every module listed up front
// they are all asked for at once, as soon as the stylesheets are in.
//
//   node tools/modulepreload.mjs           rewrite the list in index.html
//   node tools/modulepreload.mjs --check   exit 1 when the list is out of date
//
// Only static imports count: modules loaded later with import() (the account
// panel, postcard mode, ...) stay out of the list, so they still load on demand.
// tests/modulepreload.test.mjs fails when the list and the graph disagree.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const START = '<!-- modulepreload: the whole static import graph (node tools/modulepreload.mjs) -->';
const END = '<!-- /modulepreload -->';

// `import x from './a.js'`, `import { a,\n b } from '../b.js'`, `import './c.js'`
// and `export { d } from './d.js'`, each at the start of a line. import() is not matched.
const IMPORT_RE = /(?:^|\n)[ \t]*(?:import|export)[ \t]+(?:[\w*{}\s,$]+?[ \t\n]+from[ \t]*)?['"](\.{1,2}\/[^'"]+)['"]/g;

/** The static imports of one module's source, as written. */
export function staticImports(src) {
  // Block comments can hold example code; line comments can't start a line with `import`.
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...code.matchAll(IMPORT_RE)].map((m) => m[1]);
}

/** Every module reachable from `entry` by static imports, paths relative to
 *  the site root, breadth first (so the ones needed soonest come first). */
export function moduleGraph(entry = 'src/main.js', root = ROOT) {
  const seen = new Set([entry]);
  const order = [entry];
  for (let i = 0; i < order.length; i++) {
    const file = order[i];
    for (const spec of staticImports(readFileSync(join(root, file), 'utf8'))) {
      const dep = relative(root, join(root, dirname(file), spec)).split('\\').join('/');
      if (!seen.has(dep)) { seen.add(dep); order.push(dep); }
    }
  }
  return order;
}

/** The block for index.html: a script that adds a modulepreload link per module.
 *  A plain script placed after the stylesheets only runs once they have loaded,
 *  so the title screen's styles get the connection first and it paints sooner;
 *  link tags in the page would be fetched at once alongside the styles. */
export function preloadBlock(mods, indent = '  ') {
  return [START, '<script>',
    '// Ask for every module at once (the browser would otherwise find them a few levels at a time).',
    '[',
    ...mods.map((m) => `  '${m}',`),
    "].forEach((href) => { const l = document.createElement('link'); l.rel = 'modulepreload'; l.href = href; document.head.appendChild(l); });",
    '</script>', END].map((l) => indent + l).join('\n');
}

/** index.html with its marked modulepreload block replaced by one for `mods`. */
export function withPreloads(html, mods) {
  const block = preloadBlock(mods);
  const a = html.indexOf(START), b = html.indexOf(END);
  if (a >= 0 && b > a) return html.slice(0, html.lastIndexOf('\n', a) + 1) + block + html.slice(b + END.length);
  throw new Error('index.html has no modulepreload block');
}

/** The modules index.html preloads now, in order. */
export function listedPreloads(html) {
  const a = html.indexOf(START), b = html.indexOf(END);
  if (a < 0 || b < a) return [];
  return [...html.slice(a, b).matchAll(/^\s*'([^']+\.js)',$/gm)].map((m) => m[1]);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const file = join(ROOT, 'index.html');
  const html = readFileSync(file, 'utf8');
  const next = withPreloads(html, moduleGraph());
  if (process.argv.includes('--check')) {
    if (next !== html) { console.error('index.html modulepreload list is out of date: run node tools/modulepreload.mjs'); process.exit(1); }
    console.log('modulepreload list is up to date');
  } else if (next !== html) { writeFileSync(file, next); console.log(`index.html: ${moduleGraph().length} modules preloaded`); }
  else console.log('index.html already up to date');
}
