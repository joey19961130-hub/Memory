// Render the illustrated demo product shots to public/demo/<product>-<view>.webp
//   node tools/product-art/render.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  const root = execSync('npm root -g').toString().trim();
  ({ chromium } = await import(pathToFileURL(path.join(root, 'playwright', 'index.mjs')).href));
}
const out = path.join(here, '..', '..', 'public', 'demo');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(pathToFileURL(path.join(here, 'products.html')).href + '?render=1');
await page.evaluate(() => document.fonts.ready);
const products = await page.evaluate(() => window.PRODUCTS);
for (const [key, n] of Object.entries(products)) {
  for (let v = 0; v < n; v++) {
    const url = await page.evaluate(([k, i]) => window.draw(k, i), [key, v]);
    writeFileSync(path.join(out, `${key}-${v + 1}.webp`), Buffer.from(url.split(',')[1], 'base64'));
  }
}
await browser.close();
console.log('wrote', out);
