// Render the vertical launch video and mux the beat-synced score.
//   node tools/launch/render.mjs                      -> media/launch-video.mp4
//   node tools/launch/render.mjs --stills dir 0,4.1   -> PNG stills (seconds)
//   BRAND_JSON='{"name":"…","url":"…"}' node tools/launch/render.mjs   (override brand copy)
// Prereqs: node tools/launch/capture.mjs (UI screenshots) and node tools/launch/music.mjs (score).
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..', '..');
const args = process.argv.slice(2);
const SAMPLES = Number(process.env.SAMPLES || 4);
const BRAND = {
  name: '品牌名稱',
  tagline: '把日常的溫度，做成隨身的小物',
  cta: '加入 LINE 詢問',
  url: 'yourbrand.com',
  ...(process.env.BRAND_JSON ? JSON.parse(process.env.BRAND_JSON) : {}),
};
const TIMELINE = JSON.parse(readFileSync(path.join(here, 'timeline.json'), 'utf8'));
const RECTS = JSON.parse(readFileSync(path.join(here, 'assets', 'rects.json'), 'utf8'));

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  const g = execSync('npm root -g').toString().trim();
  ({ chromium } = await import(pathToFileURL(path.join(g, 'playwright', 'index.mjs')).href));
}
const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
page.on('pageerror', (e) => console.error('page error:', e.message));
await page.addInitScript(([t, r, b]) => { window.TIMELINE = t; window.RECTS = r; window.BRAND = b; }, [TIMELINE, RECTS, BRAND]);
await page.goto(pathToFileURL(path.join(here, 'launch.html')).href);
await page.evaluate(() => window.ready);
const grab = async (t, s = SAMPLES) => Buffer.from((await page.evaluate(([t, s]) => window.frameData(t, s), [t, s])).split(',')[1], 'base64');

const si = args.indexOf('--stills');
if (si >= 0) {
  const dir = args[si + 1];
  mkdirSync(dir, { recursive: true });
  for (const t of args[si + 2].split(',').map(Number)) writeFileSync(path.join(dir, `l-${t.toFixed(2)}.jpg`), await grab(t, 1));
  await browser.close();
  process.exit(0);
}

const out = args.find((a) => a.endsWith('.mp4')) ?? path.join(root, 'media', 'launch-video.mp4');
mkdirSync(path.dirname(out), { recursive: true });
const wav = path.join(here, 'assets', 'music.wav');
const ff = spawn('ffmpeg', [
  '-y', '-loglevel', 'error',
  '-f', 'image2pipe', '-framerate', String(TIMELINE.fps), '-c:v', 'mjpeg', '-i', '-',
  '-i', wav,
  '-map', '0:v', '-map', '1:a',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-g', '15',
  '-c:a', 'aac', '-b:a', '192k', '-af', 'volume=-2.6dB', // ≈ -14 LUFS for social platforms
  '-shortest', '-movflags', '+faststart', out,
], { stdio: ['pipe', 'inherit', 'inherit'] });
const total = Math.round((TIMELINE.beats * 60) / TIMELINE.bpm * TIMELINE.fps);
for (let f = 0; f < total; f++) {
  const buf = await grab(f / TIMELINE.fps);
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  if (f % 60 === 0) process.stdout.write(`frame ${f}/${total}\n`);
}
ff.stdin.end();
await new Promise((r, j) => ff.on('close', (c) => (c === 0 ? r() : j(new Error(`ffmpeg exit ${c}`)))));
await browser.close();
console.log(`wrote ${out}`);
