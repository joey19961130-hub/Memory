// Original score for the launch video, synthesised sample-by-sample from timeline.json.
// Every cut / accent in the timeline triggers its listed sounds exactly on its beat, so picture and music share one grid.
//   node tools/launch/music.mjs [out.wav]
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const T = JSON.parse(readFileSync(path.join(here, 'timeline.json'), 'utf8'));
const OUT = process.argv[2] ?? path.join(here, 'assets', 'music.wav');

const SR = 44100;
const SPB = 60 / T.bpm;
const DUR = T.beats * SPB;
const N = Math.round(DUR * SR);
const at = (beat) => beat * SPB;

// ---------- seeded noise ----------
let seed = 1337;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
const noise = () => rnd() * 2 - 1;

// ---------- buses ----------
const mk = () => [new Float32Array(N), new Float32Array(N)];
const BUS = { drums: mk(), bass: mk(), music: mk(), fx: mk(), send: mk() };

/** Render a mono voice `fn(t)` from `start` seconds for `dur` seconds into a bus, equal-power panned. */
function voice(bus, start, dur, fn, gain = 1, pan = 0, send = 0) {
  const i0 = Math.round(start * SR);
  const n = Math.round(dur * SR);
  const gl = Math.cos(((pan + 1) * Math.PI) / 4) * gain;
  const gr = Math.sin(((pan + 1) * Math.PI) / 4) * gain;
  const [L, R] = BUS[bus];
  const [SL, SRr] = BUS.send;
  for (let k = 0; k < n; k++) {
    const i = i0 + k;
    if (i < 0) continue;
    if (i >= N) break;
    const s = fn(k / SR, k);
    L[i] += s * gl;
    R[i] += s * gr;
    if (send) {
      SL[i] += s * gl * send;
      SRr[i] += s * gr * send;
    }
  }
}

// ---------- RBJ biquad ----------
class Biquad {
  constructor(type, f, q = 0.707) {
    this.x1 = this.x2 = this.y1 = this.y2 = 0;
    this.type = type;
    this.set(f, q);
  }
  set(f, q = this.q) {
    this.q = q;
    const w = (2 * Math.PI * Math.min(f, SR * 0.45)) / SR, c = Math.cos(w), a = Math.sin(w) / (2 * q);
    let b0, b1, b2;
    if (this.type === 'lp') [b0, b1, b2] = [(1 - c) / 2, 1 - c, (1 - c) / 2];
    else if (this.type === 'hp') [b0, b1, b2] = [(1 + c) / 2, -(1 + c), (1 + c) / 2];
    else [b0, b1, b2] = [a, 0, -a];
    const a0 = 1 + a;
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = (-2 * c) / a0; this.a2 = (1 - a) / a0;
  }
  run(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
const saw = (ph) => 2 * (ph - Math.floor(ph + 0.5));

// ---------- instruments ----------
const kickTimes = [];
function kick(beat, g = 1) {
  kickTimes.push(at(beat));
  let ph = 0;
  voice('drums', at(beat), 0.45, (t) => {
    const f = 45 + 115 * Math.exp(-t * 30);
    ph += (2 * Math.PI * f) / SR;
    let s = Math.sin(ph) * Math.exp(-t * 7.5);
    if (t < 0.004) s += noise() * 0.5 * (1 - t / 0.004);
    return Math.tanh(1.8 * s);
  }, 0.95 * g);
}
function tom(beat, g = 1) {
  let ph = 0;
  voice('drums', at(beat), 0.35, (t) => {
    ph += (2 * Math.PI * (95 + 80 * Math.exp(-t * 20))) / SR;
    return Math.sin(ph) * Math.exp(-t * 9);
  }, 0.6 * g, -0.2, 0.15);
}
function snare(beat, g = 1, pan = 0) {
  const bp = new Biquad('bp', 1900, 0.7);
  voice('drums', at(beat), 0.3, (t) => {
    const tone = Math.sin(2 * Math.PI * 185 * t) * Math.exp(-t * 22) * 0.5;
    return tone + bp.run(noise()) * Math.exp(-t * 16) * 1.6;
  }, 0.55 * g, pan, 0.18);
}
function clap(beat, g = 1) {
  const bp = new Biquad('bp', 1300, 1.1);
  voice('drums', at(beat), 0.4, (t) => {
    let env = 0;
    for (const k of [0, 0.011, 0.022]) if (t >= k) env = Math.max(env, Math.exp(-(t - k) * 180));
    if (t > 0.03) env = Math.max(env, 0.7 * Math.exp(-(t - 0.03) * 13));
    return bp.run(noise()) * env * 2.2;
  }, 0.5 * g, 0.05, 0.3);
}
function hat(beat, g = 1, open = false) {
  const hp = new Biquad('hp', 7500, 0.8);
  voice('drums', at(beat), open ? 0.35 : 0.06, (t) => hp.run(noise()) * Math.exp(-t * (open ? 13 : 75)), 0.22 * g, 0.25);
}
function crash(beat, g = 1) {
  const hp = new Biquad('hp', 4800, 0.6);
  voice('drums', at(beat), 1.8, (t) => hp.run(noise()) * Math.exp(-t * 3.2), 0.22 * g, -0.15, 0.2);
}
function impact(beat, g = 1) {
  let ph = 0;
  const lp = new Biquad('lp', 700, 0.8);
  voice('fx', at(beat), 1.7, (t) => {
    ph += (2 * Math.PI * (32 + 40 * Math.exp(-t * 6))) / SR;
    return Math.sin(ph) * Math.exp(-t * 4) * 0.9 + lp.run(noise()) * Math.exp(-t * 14) * 0.8;
  }, 0.8 * g, 0, 0.15);
  kick(beat, 0.8 * g);
}
function click(beat, g = 1) {
  voice('fx', at(beat), 0.03, (t) => Math.sin(2 * Math.PI * 2400 * t) * Math.exp(-t * 300) + (t < 0.003 ? noise() * 0.6 : 0), 0.5 * g, 0.1);
}
/** Short bright transient laid on every cut so the edit reads as a hit, even under pads and tails. */
function snap(beat, g = 1) {
  const hp = new Biquad('hp', 3000, 0.7);
  voice('fx', at(beat), 0.05, (t) => hp.run(noise()) * Math.exp(-t * 140) * 1.4 + Math.sin(2 * Math.PI * 3200 * t) * Math.exp(-t * 220) * 0.4, 0.55 * g, 0);
}
function tick(beat, g = 1) {
  const bp = new Biquad('bp', 3600, 2);
  voice('fx', at(beat), 0.025, (t) => bp.run(noise()) * Math.exp(-t * 260) * 3 + Math.sin(2 * Math.PI * 1800 * t) * Math.exp(-t * 400) * 0.3, 0.35 * g, rnd() * 0.4 - 0.2);
}
function pop(beat, g = 1) {
  snap(beat, 0.6 * g);
  let ph = 0;
  voice('fx', at(beat), 0.12, (t) => {
    ph += (2 * Math.PI * (500 + 1100 * Math.min(1, t / 0.05))) / SR;
    return Math.sin(ph) * Math.exp(-t * 38);
  }, 0.5 * g, 0.15, 0.25);
}
function bell(beat, g = 1) {
  snap(beat, 0.5 * g);
  voice('fx', at(beat), 1.2, (t) =>
    (Math.sin(2 * Math.PI * 1760 * t) + 0.6 * Math.sin(2 * Math.PI * 2637 * t) + 0.3 * Math.sin(2 * Math.PI * 3520 * t)) * Math.exp(-t * 5) * 0.4,
  0.35 * g, 0.3, 0.5);
}
function whoosh(beat, g = 1) {
  // swells into the cut and dies instantly after it, so the cut itself carries the transient
  const pre = 0.3, bp = new Biquad('bp', 500, 1.4);
  voice('fx', at(beat) - pre, pre, (t, k) => {
    const x = t / pre;
    if (k % 32 === 0) bp.set(400 + 5200 * Math.min(1, x) ** 2, 1.4);
    // swell, then clear out 40 ms before the cut so the hit on the beat stays a clean transient
    const env = t < pre - 0.04 ? x * x : Math.max(0, 1 - (t - (pre - 0.04)) / 0.03) * 0.9;
    return bp.run(noise()) * env * 1.6;
  }, 0.35 * g, -0.3, 0.2);
}
function riser(fromBeat, toBeat) {
  const dur = at(toBeat) - at(fromBeat), bp = new Biquad('bp', 300, 2);
  let ph = 0;
  voice('fx', at(fromBeat), dur, (t, k) => {
    const x = t / dur;
    if (k % 32 === 0) bp.set(300 * Math.pow(30, x), 2);
    ph += (2 * Math.PI * (150 * Math.pow(6, x))) / SR;
    return (bp.run(noise()) * 2.2 + saw(ph / (2 * Math.PI)) * 0.15) * x * x;
  }, 0.45, 0, 0.3);
}

const CHORDS = [
  { notes: [62, 65, 69], bass: 38 }, // Dm
  { notes: [58, 62, 65], bass: 34 }, // Bb
  { notes: [57, 60, 65], bass: 41 }, // F
  { notes: [55, 60, 64], bass: 36 }, // C
];
const chordAt = (beat) => CHORDS[Math.floor(beat / 4) % 4];

function stab(beat, g = 1, big = false, len = 0.22) {
  const ch = chordAt(beat);
  const notes = big ? [...ch.notes.map((n) => n + 12), ch.notes[0] + 24, ch.notes[0]] : ch.notes.map((n) => n + 12);
  notes.forEach((n, vi) => {
    for (const det of [-0.08, 0.08]) {
      const f = midi(n + det);
      const lp = new Biquad('lp', 5000, 0.9);
      let ph = rnd();
      voice('music', at(beat), len + 0.25, (t, k) => {
        if (k % 32 === 0) lp.set(900 + (big ? 7000 : 4500) * Math.exp(-t * 14), 0.9);
        ph += f / SR;
        const env = Math.min(1, t / 0.003) * Math.exp(-t * (big ? 5 : 11));
        return lp.run(saw(ph)) * env;
      }, (0.075 * g) / Math.sqrt(notes.length), (vi / (notes.length - 1)) * 0.8 - 0.4 + det, big ? 0.35 : 0.22);
    }
  });
}
function pad(beat, lenBeats, g = 1) {
  const ch = chordAt(beat), dur = at(lenBeats);
  ch.notes.forEach((n, vi) => {
    for (const det of [-0.12, 0.12]) {
      const lp = new Biquad('lp', 1400, 0.7);
      let ph = rnd();
      const f = midi(n + det);
      voice('music', at(beat), dur + 0.6, (t) => {
        ph += f / SR;
        const env = Math.min(1, t / 0.25) * (t > dur ? Math.exp(-(t - dur) * 6) : 1);
        return lp.run(saw(ph)) * env;
      }, 0.035 * g, vi * 0.5 - 0.5 + det, 0.6);
    }
  });
}
function bassNote(note, beat, lenBeats, g = 1) {
  const f = midi(note), lp = new Biquad('lp', 600, 1.1), dur = at(lenBeats);
  let p1 = 0, p2 = 0.37, p3 = 0;
  voice('bass', at(beat), dur + 0.03, (t, k) => {
    if (k % 32 === 0) lp.set(220 + 900 * Math.exp(-t * 18), 1.1);
    p1 += (f * 1.003) / SR; p2 += (f * 0.997) / SR; p3 += f / 2 / SR;
    const env = Math.min(1, t / 0.004) * (t > dur ? Math.max(0, 1 - (t - dur) / 0.03) : 1);
    return (lp.run(saw(p1) + saw(p2)) * 0.5 + Math.sin(2 * Math.PI * p3) * 0.6) * env;
  }, 0.5 * g);
}
function pluck(note, beat, g = 1) {
  const f = midi(note), lp = new Biquad('lp', 6000, 1);
  let ph = rnd();
  voice('music', at(beat), 0.35, (t, k) => {
    if (k % 32 === 0) lp.set(400 + 6000 * Math.exp(-t * 18), 1);
    ph += f / SR;
    return lp.run(saw(ph)) * Math.exp(-t * 9);
  }, 0.07 * g, Math.sin(beat * 3) * 0.5, 0.35);
}

// ---------- arrangement (grooves between the timeline hits) ----------
const SOUNDS = {
  impact: (b) => impact(b), impactLite: (b) => { snare(b, 1.2); tom(b, 1.2); },
  crash: (b) => crash(b), crashSoft: (b) => crash(b, 0.55), kick: (b) => kick(b),
  clap: (b) => clap(b), snare: (b) => snare(b, 1.1), tom: (b) => tom(b),
  stab: (b) => stab(b, 1), stabBig: (b) => stab(b, 1.4, true, 0.3),
  click: (b) => click(b), pop: (b) => pop(b), bell: (b) => bell(b), whoosh: (b) => whoosh(b),
  riserStart: (b) => riser(b, T.events.find((e) => e.name === 'breath').beat),
};
const kicksFromTimeline = new Set();
for (const e of T.events) if (e.cut) snap(e.beat, e.beat === 0 || e.beat === 32 || e.beat === 36 ? 1.3 : 1);
for (const e of T.events) for (const s of e.sound) {
  if (!SOUNDS[s]) throw new Error(`unknown sound ${s}`);
  SOUNDS[s](e.beat);
  if (s === 'kick' || s === 'impact') kicksFromTimeline.add(e.beat);
}
const kickIfFree = (b, g) => !kicksFromTimeline.has(b) && kick(b, g);
const BREATH = T.events.find((e) => e.name === 'breath').beat;
const DROP = T.events.find((e) => e.name === 'drop1').beat;

// hook bar: pad bed + 16th snare fill into the categories
pad(0, 3.5, 0.8);
[3.25, 3.5, 3.75].forEach((b, i) => snare(b, 0.5 + i * 0.2));
// categories bar
for (const b of [4.5, 5.5, 6.5]) hat(b, 1.2, true);
// grooves: product proof, LINE, admin  (beats 8 → 30)
for (let b = 8; b < 30; b++) {
  kickIfFree(b, 1);
  if (b % 2 === 1 && !T.events.some((e) => e.beat === b && e.sound.includes('clap'))) clap(b, 0.9);
  for (let s = 0; s < 4; s++) hat(b + s * 0.25, s === 2 ? 1.1 : 0.45, s === 2 && b % 2 === 1);
  if (!T.events.some((e) => e.beat === b + 0.5)) stab(b + 0.5, 0.55);
}
for (let b = 8; b < 30; b += 0.5) {
  const ch = chordAt(b);
  const pattern = [0, 0, 12, 0, 0, 12, 0, 7];
  bassNote(ch.bass + pattern[Math.round((b % 4) * 2) % 8], b, 0.42);
}
// LINE section: pluck arpeggio
for (let b = 16; b < 24; b += 0.25) {
  const ch = chordAt(b), seq = [...ch.notes, ...ch.notes.map((n) => n + 12)];
  pluck(seq[Math.round(b * 4) % seq.length] + 12, b, 0.9);
}
// typing ticks, exactly one per typed character (32nd notes)
T.typing.text.split('').forEach((_, i) => tick(T.typing.start + i * T.typing.step));
// build: kick drops out, snare roll 16ths → 32nds, riser comes from the timeline
for (let b = 30; b < 31; b += 0.25) snare(b, 0.35 + (b - 30) * 0.4, 0.2);
for (let b = 31; b < 31.75; b += 0.125) snare(b, 0.6 + (b - 31) * 0.6, -0.2);
// drop: four-on-the-floor + offbeat clap + rolling bass, stabs come from the timeline cuts
for (let b = 32; b < 36; b++) {
  kickIfFree(b, 1.1);
  for (let s = 0; s < 4; s++) hat(b + s * 0.25, s % 2 ? 1 : 0.6);
  if (b % 2 === 1) clap(b, 1.1);
}
for (let b = 32; b < 36; b += 0.25) bassNote(chordAt(b).bass + (Math.round(b * 4) % 4 === 3 ? 12 : 0), b, 0.2, 1.1);
// end card: sustained chord, no drums after the CTA
pad(36, 3.5, 1.2);
bassNote(chordAt(36).bass, 36, 3, 0.9);

// ---------- mix ----------
// sidechain: bass + music duck under every kick
const duck = new Float32Array(N).fill(1);
for (const tk of kickTimes) {
  const i0 = Math.round(tk * SR);
  for (let k = 0; k < SR * 0.4 && i0 + k < N; k++) {
    duck[i0 + k] = Math.min(duck[i0 + k], 1 - 0.55 * Math.exp(-(k / SR) / 0.09));
  }
}
// Schroeder reverb on the send
function reverb([L, R]) {
  const combs = [1557, 1617, 1491, 1422, 1277, 1356], aps = [225, 556];
  const out = [new Float32Array(N), new Float32Array(N)];
  [L, R].forEach((x, ch) => {
    const y = out[ch];
    combs.forEach((d0) => {
      const d = d0 + ch * 23, buf = new Float32Array(d);
      let idx = 0, lp = 0;
      for (let i = 0; i < N; i++) {
        const o = buf[idx];
        lp = o * 0.7 + lp * 0.3;
        buf[idx] = x[i] + lp * 0.8;
        idx = (idx + 1) % d;
        y[i] += o / combs.length;
      }
    });
    aps.forEach((d) => {
      const buf = new Float32Array(d);
      let idx = 0;
      for (let i = 0; i < N; i++) {
        const b = buf[idx], v = y[i] + b * 0.5;
        buf[idx] = v;
        y[i] = b - v * 0.5;
        idx = (idx + 1) % d;
      }
    });
  });
  return out;
}
const wet = reverb(BUS.send);
const master = [new Float32Array(N), new Float32Array(N)];
for (let c = 0; c < 2; c++) {
  const hp = new Biquad('hp', 28, 0.7);
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    let s = BUS.drums[c][i] + (BUS.bass[c][i] + BUS.music[c][i]) * duck[i] + BUS.fx[c][i] + wet[c][i] * 0.35;
    // build: low-pass the music bed into the drop (cheap tilt: blend in less of the bass/music)
    s = hp.run(s);
    s = Math.tanh(1.15 * s) / Math.tanh(1.15);
    // the breath: a 1/16 of near-silence right before the drop makes beat 32 hit
    const g0 = at(BREATH), g1 = at(DROP);
    if (t >= g0 && t < g1) s *= 0.08;
    // gentle fade in the last half second
    if (t > DUR - 0.5) s *= Math.max(0, (DUR - t) / 0.5);
    master[c][i] = s;
  }
}
let peak = 0;
for (const ch of master) for (const v of ch) peak = Math.max(peak, Math.abs(v));
const norm = 0.89 / peak;

// ---------- WAV ----------
const data = Buffer.alloc(N * 4);
for (let i = 0; i < N; i++) {
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, master[0][i] * norm)) * 32767), i * 4);
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, master[1][i] * norm)) * 32767), i * 4 + 2);
}
const hdr = Buffer.alloc(44);
hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + data.length, 4); hdr.write('WAVE', 8);
hdr.write('fmt ', 12); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(2, 22);
hdr.writeUInt32LE(SR, 24); hdr.writeUInt32LE(SR * 4, 28); hdr.writeUInt16LE(4, 32); hdr.writeUInt16LE(16, 34);
hdr.write('data', 36); hdr.writeUInt32LE(data.length, 40);
writeFileSync(OUT, Buffer.concat([hdr, data]));
console.log(`wrote ${OUT} (${DUR.toFixed(2)}s, ${T.bpm} BPM, peak norm ${norm.toFixed(2)})`);
