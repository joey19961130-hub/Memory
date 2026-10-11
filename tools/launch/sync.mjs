// Verify that music and picture land on the beat grid.
//   node tools/launch/sync.mjs <music.wav> [video.mp4]
// Audio: onset detection (energy flux of the high-passed signal) → every timeline event with a sound must have an
//        onset within ±TOL, and every strong onset must sit on the 1/8-beat grid.
// Video: per-frame scene-change score from ffmpeg → every hard cut in the timeline must be detected on its exact frame,
//        and no unplanned hard cut may appear.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const T = JSON.parse(readFileSync(path.join(here, 'timeline.json'), 'utf8'));
const [wavPath, videoPath] = process.argv.slice(2);
const SPB = 60 / T.bpm;
const TOL = 0.025; // 25 ms ≈ less than one video frame
let failures = 0;
const report = (ok, msg) => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`);
};

// ---------- audio ----------
const wav = readFileSync(wavPath);
const SR = wav.readUInt32LE(24), ch = wav.readUInt16LE(22);
const raw = (wav.length - 44) / (2 * ch);
// analyse with 50 ms of leading silence so a hit on beat 0 is measurable like any other
const PAD = Math.round(0.05 * SR);
const n = raw + PAD;
const mono = new Float32Array(n);
for (let i = 0; i < raw; i++) {
  let s = 0;
  for (let c = 0; c < ch; c++) s += wav.readInt16LE(44 + (i * ch + c) * 2) / 32768;
  mono[i + PAD] = s / ch;
}
const HOP = 128, WIN = 512;
const frames = Math.floor((n - WIN) / HOP);
const env = new Float32Array(frames);
for (let f = 0; f < frames; f++) {
  let e = 0;
  for (let k = 1; k < WIN; k++) {
    const d = mono[f * HOP + k] - mono[f * HOP + k - 1]; // first difference ≈ high-pass, favours transients
    e += d * d;
  }
  env[f] = Math.log(1e-9 + e);
}
const flux = new Float32Array(frames);
for (let f = 2; f < frames; f++) flux[f] = Math.max(0, env[f] - env[f - 2]);
// adaptive threshold: local median + constant
const onsets = [];
for (let f = 8; f < frames - 8; f++) {
  const win = Array.from(flux.slice(f - 8, f + 9)).sort((a, b) => a - b);
  const thr = win[8] + 1.2;
  if (flux[f] > thr && flux[f] === Math.max(...flux.slice(f - 4, f + 5))) {
    // attack time: centre of the hop window where energy jumped
    onsets.push({ t: (f * HOP + WIN / 2 - PAD) / SR, s: flux[f] });
  }
}
const nearest = (t) => onsets.reduce((best, o) => (Math.abs(o.t - t) < Math.abs(best.t - t) ? o : best), { t: Infinity });
let maxErr = 0;
const voiced = T.events.filter((e) => e.sound.some((s) => s !== 'riserStart'));
for (const e of voiced) {
  const t = e.beat * SPB, o = nearest(t), err = Math.abs(o.t - t);
  maxErr = Math.max(maxErr, err);
  if (err > TOL) report(false, `audio: "${e.name}" @ beat ${e.beat} (${t.toFixed(3)}s) nearest onset ${o.t.toFixed(3)}s (${(err * 1000).toFixed(0)} ms off)`);
}
report(true, `audio: ${voiced.length} timeline hits checked, worst offset ${(maxErr * 1000).toFixed(1)} ms (tolerance ${TOL * 1000} ms)`);
const strong = onsets.filter((o) => o.s > 2.0);
const offGrid = strong.filter((o) => {
  const g = SPB / 8;
  return Math.abs(o.t - Math.round(o.t / g) * g) > TOL;
});
report(offGrid.length === 0, `audio: ${strong.length} strong onsets, ${offGrid.length} off the 1/8-beat grid${offGrid.length ? ' → ' + offGrid.map((o) => o.t.toFixed(3)).join(', ') : ''}`);

// ---------- video ----------
if (videoPath) {
  const out = execFileSync('ffmpeg', ['-hide_banner', '-i', videoPath, '-vf', "select='gte(scene,0)',metadata=print:file=-", '-an', '-f', 'null', '-'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const scores = [];
  let frame = -1;
  for (const line of out.split('\n')) {
    const m = line.match(/^frame:(\d+)/);
    if (m) frame = +m[1];
    const s = line.match(/lavfi\.scene_score=([\d.]+)/);
    if (s) scores[frame] = +s[1];
  }
  const fpb = T.fps * SPB;
  const cutFrames = T.events.filter((e) => e.cut && e.beat > 0).map((e) => Math.round(e.beat * fpb));
  const THR = 0.12;
  for (const f of cutFrames) {
    const ok = (scores[f] ?? 0) >= THR;
    if (!ok) report(false, `video: planned cut at frame ${f} (beat ${f / fpb}) scene score ${(scores[f] ?? 0).toFixed(3)}`);
  }
  // every other large change must be motion that starts on a timeline event: within 0–3 frames (≤100 ms) after one
  const detected = scores.map((s, f) => [f, s]).filter(([, s]) => s >= THR).map(([f]) => f);
  const eventFrames = T.events.map((e) => Math.ceil(e.beat * fpb - 1e-6));
  const unplanned = detected.filter((f) => !cutFrames.includes(f));
  const offBeat = unplanned.filter((f) => !eventFrames.some((ef) => f - ef >= 0 && f - ef <= 3));
  report(
    cutFrames.every((f) => (scores[f] ?? 0) >= THR),
    `video: ${cutFrames.length} planned hard cuts all detected on their exact frame`,
  );
  report(
    offBeat.length === 0,
    `video: ${detected.length} large visual changes; ${unplanned.length} are animations, ${offBeat.length} not starting on a beat event${
      offBeat.length ? ' → frames ' + offBeat.map((f) => `${f} (beat ${(f / fpb).toFixed(2)})`).join(', ') : ''
    }`,
  );
}
console.log(failures ? `\n${failures} sync problem(s)` : '\nall in sync');
process.exit(failures ? 1 : 0);
