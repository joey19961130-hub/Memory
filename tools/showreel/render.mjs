// Render showreel.html to MP4 with headless Chromium + ffmpeg.
//   node tools/showreel/render.mjs                          -> public/hero-showreel.mp4 (website background, no titles)
//   node tools/showreel/render.mjs --titles out.mp4         -> standalone showreel with kinetic type
//   node tools/showreel/render.mjs --stills dir 0,3.5,7     -> PNG stills at the given seconds
// Requires: playwright (Chromium) and ffmpeg on PATH.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const titles = args.includes('--titles');
const stillsIdx = args.indexOf('--stills');
const positional = args.filter((a, i) => !a.startsWith('--') && i !== stillsIdx + 1 && !(stillsIdx >= 0 && i === stillsIdx + 2));
const SAMPLES = Number(process.env.SAMPLES || 6);

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  const { execSync } = await import('node:child_process');
  const root = execSync('npm root -g').toString().trim();
  ({ chromium } = await import(pathToFileURL(path.join(root, 'playwright', 'index.mjs')).href));
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const url = pathToFileURL(path.join(here, 'showreel.html')).href + `?render=1${titles ? '&titles=1' : ''}`;
await page.goto(url);
await page.evaluate(() => document.fonts.ready);
const { DUR, FPS } = await page.evaluate(() => ({ DUR: window.DUR, FPS: window.FPS }));

const grab = async (t) =>
  Buffer.from((await page.evaluate(([t, s]) => window.frameDataURL(t, s), [t, SAMPLES])).split(',')[1], 'base64');

if (stillsIdx >= 0) {
  const dir = args[stillsIdx + 1];
  const times = args[stillsIdx + 2].split(',').map(Number);
  mkdirSync(dir, { recursive: true });
  for (const t of times) writeFileSync(path.join(dir, `still-${t.toFixed(2)}${titles ? '-titles' : ''}.png`), await grab(t));
  await browser.close();
  process.exit(0);
}

const out = positional[0] ?? path.join(here, '..', '..', 'public', 'hero-showreel.mp4');
mkdirSync(path.dirname(out), { recursive: true });
const ff = spawn('ffmpeg', [
  '-y', '-loglevel', 'error',
  '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', process.env.CRF || '20', '-tune', 'animation',
  '-pix_fmt', 'yuv420p', '-g', '15', '-bf', '0', '-movflags', '+faststart', out,
], { stdio: ['pipe', 'inherit', 'inherit'] });

const total = Math.round(DUR * FPS);
for (let f = 0; f < total; f++) {
  const buf = await grab(f / FPS);
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  if (f % 30 === 0) process.stdout.write(`frame ${f}/${total}\n`);
}
ff.stdin.end();
await new Promise((r, j) => ff.on('close', (c) => (c === 0 ? r() : j(new Error(`ffmpeg exit ${c}`)))));
await browser.close();
console.log(`wrote ${out}`);
