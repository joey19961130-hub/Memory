// Draft vector logo for memorycollector (stand-in until the official files are uploaded in the admin).
//   node tools/brand/make-logo.mjs  -> public/brand/{mark,wordmark,logo}.svg
// mark.svg: the upright drop (rotated -90° it becomes the nose silhouette). Wordmark: Inter Black glyphs as paths.
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..', '..');
const out = path.join(root, 'public', 'brand');
mkdirSync(out, { recursive: true });
const INK = '#1A1514';

// Upright drop, traced from the supplied logo: small round head, pinched neck, long bulb that swells to the lower left.
export const MARK_VIEWBOX = '0 0 60 222';
export const MARK_PATH = [
  'M 28.6 2',
  'C 40 1.5, 49 7, 47.5 17',
  'C 46 27, 39 30, 37 40',
  'C 35.5 50, 38 70, 42 95',
  'C 46 120, 55 150, 57.5 180',
  'C 59.5 205, 46 221, 28 220.5',
  'C 10 220, 0 207, 2 185',
  'C 4 160, 10 130, 14 100',
  'C 17 78, 19 60, 17 45',
  'C 15.5 36, 8.5 28, 9.5 17',
  'C 10.5 6, 18 2.5, 28.6 2 Z',
].join(' ');

const markSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MARK_VIEWBOX}"><path fill="${INK}" d="${MARK_PATH}"/></svg>\n`;
writeFileSync(path.join(out, 'mark.svg'), markSvg);

const font = opentype.loadSync(path.join(root, 'node_modules/@fontsource/inter/files/inter-latin-900-normal.woff'));
const SIZE = 100, TRACK = -0.045 * SIZE, TEXT = 'memorycollector';
let x = 0;
const glyphPaths = [];
for (const g of font.stringToGlyphs(TEXT)) {
  const p = g.getPath(x, SIZE, SIZE);
  glyphPaths.push(p.toPathData(2));
  x += (g.advanceWidth / font.unitsPerEm) * SIZE + TRACK;
}
const word = new opentype.Path();
const bb = (() => {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  let cx = 0;
  for (const g of font.stringToGlyphs(TEXT)) {
    const b = g.getPath(cx, SIZE, SIZE).getBoundingBox();
    if (b.x1 < b.x2) { x1 = Math.min(x1, b.x1); y1 = Math.min(y1, b.y1); x2 = Math.max(x2, b.x2); y2 = Math.max(y2, b.y2); }
    cx += (g.advanceWidth / font.unitsPerEm) * SIZE + TRACK;
  }
  return { x1, y1, x2, y2 };
})();
void word;
const pad = 2;
const ww = bb.x2 - bb.x1 + pad * 2, wh = bb.y2 - bb.y1 + pad * 2;
const wordGroup = `<g transform="translate(${(-bb.x1 + pad).toFixed(2)} ${(-bb.y1 + pad).toFixed(2)})" fill="${INK}"><path d="${glyphPaths.join(' ')}"/></g>`;
writeFileSync(path.join(out, 'wordmark.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ww.toFixed(1)} ${wh.toFixed(1)}">${wordGroup}</svg>\n`);

// stacked lockup like the supplied artwork: mark centred above the wordmark
const markH = ww * 0.29, markW = (markH * 60) / 222, gap = ww * 0.22;
const LW = ww, LH = markH + gap + wh;
const logo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LW.toFixed(1)} ${LH.toFixed(1)}">` +
  `<svg x="${((LW - markW) / 2).toFixed(1)}" y="0" width="${markW.toFixed(1)}" height="${markH.toFixed(1)}" viewBox="${MARK_VIEWBOX}"><path fill="${INK}" d="${MARK_PATH}"/></svg>` +
  `<g transform="translate(0 ${(markH + gap).toFixed(1)})">${wordGroup}</g></svg>\n`;
writeFileSync(path.join(out, 'logo.svg'), logo);
console.log('wrote', out, { wordmark: [ww.toFixed(0), wh.toFixed(0)], logo: [LW.toFixed(0), LH.toFixed(0)] });
