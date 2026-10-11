// Capture real UI screenshots of the running site for the launch video, plus element rects.
//   (npm run build && npx vite preview --port 4173) then: node tools/launch/capture.mjs [--video path/to/vp9.mp4]
// --video swaps the hero clip for a VP9 copy, since Playwright's Chromium cannot decode H.264.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, 'assets');
mkdirSync(out, { recursive: true });
const BASE = process.env.BASE || 'http://localhost:4173/';
const vIdx = process.argv.indexOf('--video');
const videoBody = vIdx > 0 ? readFileSync(process.argv[vIdx + 1]) : null;

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  const root = execSync('npm root -g').toString().trim();
  ({ chromium } = await import(pathToFileURL(path.join(root, 'playwright', 'index.mjs')).href));
}
const browser = await chromium.launch();
const rects = {};
const rectOf = async (loc, dpr) => {
  const b = await loc.boundingBox();
  return b && { x: b.x * dpr, y: b.y * dpr, w: b.width * dpr, h: b.height * dpr };
};
async function context(viewport, dpr, mobile) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: dpr, hasTouch: mobile, isMobile: mobile });
  if (videoBody) await ctx.route('**/hero-showreel.mp4', (r) => r.fulfill({ status: 200, headers: { 'content-type': 'video/mp4' }, body: videoBody }));
  return ctx;
}

// ---------- phone ----------
{
  const dpr = 2;
  const ctx = await context({ width: 390, height: 844 }, dpr, true);
  const page = await ctx.newPage();
  await page.goto(BASE);
  await page.waitForSelector('[aria-label="載入中"]', { state: 'detached', timeout: 15000 });
  await page.waitForTimeout(videoBody ? 4000 : 1800);
  await page.screenshot({ path: path.join(out, 'phone-hero.png') });

  const pinCard = page.locator('.focus-card', { hasText: '琺瑯徽章 Pin' });
  await pinCard.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await page.waitForTimeout(2200);
  await page.screenshot({ path: path.join(out, 'phone-products.png') });
  rects.phoneProducts = {
    pinCard: await rectOf(pinCard, dpr),
    pinImage: await rectOf(pinCard.locator('.cursor-zoom'), dpr),
  };

  await pinCard.locator('h3').tap();
  await page.waitForTimeout(1400);
  await page.screenshot({ path: path.join(out, 'phone-modal.png') });
  const panel = page.locator('.modal-panel');
  rects.phoneModal = {
    price: await rectOf(panel.locator('p', { hasText: 'NT$' }), dpr),
    line: await rectOf(panel.locator('a', { hasText: 'LINE 詢問' }), dpr),
    gallery: await rectOf(panel.locator('[aria-roledescription=carousel]'), dpr),
    title: await rectOf(panel.locator('h3'), dpr),
  };
  rects.lineHref = await panel.locator('a', { hasText: 'LINE 詢問' }).getAttribute('href');
  await ctx.close();
}

// ---------- admin (desktop) ----------
{
  const dpr = 1.5;
  const ctx = await context({ width: 1280, height: 800 }, dpr, false);
  const page = await ctx.newPage();
  await page.goto(BASE + '#/admin');
  await page.waitForSelector('text=商品管理');
  await page.locator('li', { hasText: '琺瑯徽章 Pin' }).locator('button', { hasText: '編輯' }).click();
  await page.waitForSelector('text=編輯商品');
  await page.locator('[aria-label="上傳商品照片"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(out, 'admin-editor.png') });
  const thumbs = page.locator('[aria-label="商品照片（拖曳排序）"] li');
  rects.admin = {
    dropzone: await rectOf(page.locator('[aria-label="上傳商品照片"]'), dpr),
    thumbs: await Promise.all([0, 1, 2].map((i) => rectOf(thumbs.nth(i), dpr))),
    preview: await rectOf(page.locator('iframe[title="網站預覽"]'), dpr),
    save: await rectOf(page.locator('form button[type=submit]'), dpr),
  };
  await ctx.close();
}

writeFileSync(path.join(out, 'rects.json'), JSON.stringify(rects, null, 2));
await browser.close();
console.log(JSON.stringify(rects, null, 2));
