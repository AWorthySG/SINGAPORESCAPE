// index.html asks for the game's whole static import graph up front
// (tools/modulepreload.mjs), so the modules don't arrive a few levels at a time.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { moduleGraph, listedPreloads, staticImports, withPreloads } from '../tools/modulepreload.mjs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('index.html preloads exactly the modules main.js imports, statically, at any depth', () => {
  const graph = moduleGraph();
  assert.ok(graph.length > 100, 'the whole graph, not just the top');
  assert.equal(graph[0], 'src/main.js');
  assert.deepEqual(listedPreloads(html), graph, 'out of date: run node tools/modulepreload.mjs');
  for (const m of graph) assert.ok(existsSync(new URL(`../${m}`, import.meta.url)), `${m} exists`);
  // Modules loaded later with import() stay out, so they still load on demand.
  assert.ok(!graph.includes('src/ui/accountui.js') && !graph.includes('src/ui/photomode.js'));
  // Regenerating changes nothing.
  assert.equal(withPreloads(html, graph), html);
});

test('the preloads wait for the stylesheets, so the title screen paints first', () => {
  const lastSheet = html.lastIndexOf('<link rel="stylesheet"');
  const block = html.indexOf('<!-- modulepreload:');
  assert.ok(lastSheet > 0 && block > lastSheet, 'the preload script comes after every stylesheet');
  // A plain script (not a module or async one) runs only once the sheets above it are in.
  assert.match(html.slice(block, block + 200), /<script>\n/);
  assert.doesNotMatch(html, /<link rel="modulepreload"/, 'no link tags fetched alongside the styles');
  // The game itself still starts from its module script, after the page is parsed.
  assert.match(html, /<script type="module" src="src\/main.js"><\/script>\s*<\/body>/);
});

test('imports are read the way the browser reads them', () => {
  const src = [
    "import { a,",
    "  b as c } from './one.js';",
    "import './two.js';",
    "export { d } from \"../three.js\";",
    "export * from './four.js';",
    "/* import { x } from './commented.js'; */",
    "const later = () => import('./lazy.js');",
    "const s = 'import fake from \\'./nope.js\\'';",
  ].join('\n');
  assert.deepEqual(staticImports(src), ['./one.js', './two.js', '../three.js', './four.js']);
});
