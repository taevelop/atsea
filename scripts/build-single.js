import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { build } from 'vite';
import { MODEL_IDS } from '../src/render/model-library.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const outputPath = resolve(root, 'dist-single/atsea3d.html');
const embeddedModels = {};
let modelBytes = 0;
let compressedBytes = 0;

for (const id of MODEL_IDS) {
  const bytes = await readFile(resolve(root, 'public/models', `${id}.glb`));
  // parseAsync cannot resolve separate textures or buffers from a copied HTML file.
  if (bytes.toString('ascii', 0, 4) !== 'glTF' || bytes.readUInt32LE(16) !== 0x4e4f534a) {
    throw new Error(`Invalid GLB: ${id}`);
  }
  const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
  if ([...(gltf.buffers || []), ...(gltf.images || [])].some(item => item.uri && !item.uri.startsWith('data:'))) {
    throw new Error(`${id}.glb references an external file; embed it in the GLB before building`);
  }
  const compressed = gzipSync(bytes, { level: 9 });
  embeddedModels[id] = compressed.toString('base64');
  modelBytes += bytes.length;
  compressedBytes += compressed.length;
}

const result = await build({
  root,
  configFile: false,
  publicDir: false,
  base: './',
  build: {
    write: false,
    target: 'es2022',
    minify: true,
    cssCodeSplit: false,
    lib: { entry: resolve(root, 'src/main.js'), name: 'AtSea', formats: ['iife'] },
    rolldownOptions: { output: { codeSplitting: false } },
  },
});
const outputs = (Array.isArray(result) ? result : [result]).flatMap(bundle => bundle.output);
const scripts = outputs.filter(output => output.type === 'chunk');
const styles = outputs.filter(output => output.type === 'asset' && output.fileName.endsWith('.css'));
// Inlined dynamic imports can retain a self-edge in Rolldown's metadata.
// Reject every external edge; the offline browser tests also exercise both views.
if (scripts.length !== 1 || scripts[0].imports.length || scripts[0].dynamicImports.some(id => id !== scripts[0].fileName) || outputs.length !== scripts.length + styles.length) {
  throw new Error('Single HTML build produced external assets or script chunks');
}

let html = (await readFile(resolve(root, 'index.html'), 'utf8')).replace(/<!--[\s\S]*?-->/g, '');
const cssTag = '<link rel="stylesheet" href="/src/styles.css">';
const scriptTag = '<script type="module" src="/src/main.js"></script>';
if (!html.includes(cssTag) || !html.includes(scriptTag)) {
  throw new Error('The HTML entry tags changed; update the single-file builder');
}
// Offline copies use the existing system-font fallbacks and do not install a PWA.
html = html
  .replace(/<link\b[^>]*\brel="(?:preconnect|canonical|manifest)"[^>]*>\s*/g, '')
  .replace(/<link\b[^>]*\bhref="https:\/\/fonts\.googleapis\.com[^"]*"[^>]*>\s*/g, '');
for (const [filename, mime] of [
  ['favicon.svg', 'image/svg+xml'],
  ['favicon-32.png', 'image/png'],
  ['apple-touch-icon.png', 'image/png'],
]) {
  const data = (await readFile(resolve(root, 'public', filename))).toString('base64');
  html = html.replaceAll(`href="/${filename}"`, `href="data:${mime};base64,${data}"`);
}
html = html.replace(cssTag, () => `<style>${styles.map(style => String(style.source)).join('\n').replace(/<\/style/gi, '<\\/style')}</style>`);
html = html.replace(scriptTag, () => `<script type="application/json" id="sea-embedded-models">${JSON.stringify(embeddedModels)}</script>
<script>${scripts[0].code.replace(/<\/script/gi, '<\\/script')}</script>`);

await mkdir(resolve(root, 'dist-single'), { recursive: true });
await writeFile(outputPath, html, 'utf8');
const htmlBytes = Buffer.byteLength(html);
const mib = bytes => `${(bytes / 1024 ** 2).toFixed(2)} MiB`;
console.log(`\nCreated ${outputPath}`);
console.log(`${MODEL_IDS.length} models: ${mib(modelBytes)} -> ${mib(compressedBytes)} gzip (before Base64)`);
console.log(`Single HTML: ${htmlBytes.toLocaleString('en-US')} bytes (${mib(htmlBytes)})`);

async function directoryBytes(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const sizes = await Promise.all(entries.map(async entry => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? directoryBytes(path) : (await stat(path)).size;
  }));
  return sizes.reduce((sum, size) => sum + size, 0);
}
try {
  const distBytes = await directoryBytes(resolve(root, 'dist'));
  console.log(`Existing dist/: ${mib(distBytes)}; HTML size change: ${(100 * (htmlBytes / distBytes - 1)).toFixed(1)}%`);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
