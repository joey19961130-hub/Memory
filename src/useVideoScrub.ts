import { useEffect, useRef, useState } from 'react';
import { demuxVideo } from '@/lib/mp4demux';

const LERP_TAU = 8;
const SNAP = 0.002;
const LRU_MAX = 24;
const LEAD = 24;
const WATCHDOG = 60000;
/** Longest edge of stored frames; keeps the bank's memory bounded for 4K sources. */
const MAX_FRAME_WIDTH = 1920;

interface BankFrame {
  /** Presentation timestamp in microseconds */
  ts: number;
  blob: Blob;
}

interface ScrubState {
  bank: BankFrame[];
  lru: Map<number, ImageBitmap | null>;
  current: number;
  target: number;
  ready: boolean;
  reverted: boolean;
  painted: boolean;
  building: boolean;
  dur: number;
  lastDrawn: number;
}

const freshState = (): ScrubState => ({
  bank: [],
  lru: new Map(),
  current: 0,
  target: 0,
  ready: false,
  reverted: false,
  painted: false,
  building: false,
  dur: 0,
  lastDrawn: -1,
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function nearestIndex(bank: BankFrame[], t: number): number {
  const us = t * 1e6;
  let lo = 0;
  let hi = bank.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (bank[mid].ts < us) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && Math.abs(bank[lo - 1].ts - us) <= Math.abs(bank[lo].ts - us)) lo--;
  return lo;
}

/** Decode every frame of the clip into a sorted bank of WebP blobs. */
async function decodeToBank(
  buffer: ArrayBuffer,
  hardwareAcceleration: HardwareAcceleration,
  signal: AbortSignal,
): Promise<{ frames: BankFrame[]; duration: number; width: number; height: number }> {
  const track = demuxVideo(buffer);
  const config: VideoDecoderConfig = {
    codec: track.codec,
    codedWidth: track.width,
    codedHeight: track.height,
    description: track.description,
    hardwareAcceleration,
  };
  const support = await VideoDecoder.isConfigSupported(config);
  if (!support.supported) throw new Error(`decoder config unsupported (${hardwareAcceleration})`);

  const scale = Math.min(1, MAX_FRAME_WIDTH / track.width);
  const width = Math.round(track.width * scale);
  const height = Math.round(track.height * scale);
  const off = document.createElement('canvas');
  off.width = width;
  off.height = height;
  const offCtx = off.getContext('2d');
  if (!offCtx) throw new Error('2d context unavailable');

  const frames: BankFrame[] = [];
  let pendingBlobs = 0;
  let decodeError: unknown = null;

  const decoder = new VideoDecoder({
    output: (frame) => {
      const ts = frame.timestamp;
      offCtx.drawImage(frame, 0, 0, width, height);
      frame.close();
      pendingBlobs++;
      // toBlob snapshots the bitmap synchronously, so the canvas can be reused right away.
      off.toBlob(
        (blob) => {
          pendingBlobs--;
          if (blob) frames.push({ ts, blob });
        },
        'image/webp',
        0.82,
      );
    },
    error: (e) => {
      decodeError = e;
    },
  });

  try {
    decoder.configure(config);
    for (const s of track.samples) {
      // Throttle: never let decoding run more than LEAD frames ahead of blob encoding.
      while (decoder.decodeQueueSize + pendingBlobs > LEAD) {
        if (signal.aborted || decodeError) break;
        await sleep(4);
      }
      if (signal.aborted) throw new DOMException('aborted', 'AbortError');
      if (decodeError) throw decodeError;
      decoder.decode(
        new EncodedVideoChunk({
          type: s.is_sync ? 'key' : 'delta',
          timestamp: (1e6 * s.cts) / s.timescale,
          duration: (1e6 * s.duration) / s.timescale,
          data: s.data,
        }),
      );
    }
    await decoder.flush();
    while (pendingBlobs > 0) {
      if (signal.aborted) throw new DOMException('aborted', 'AbortError');
      await sleep(10);
    }
    if (decodeError) throw decodeError;
  } finally {
    if (decoder.state !== 'closed') decoder.close();
  }

  if (frames.length === 0) throw new Error('no frames decoded');
  frames.sort((a, b) => a.ts - b.ts);
  return { frames, duration: track.duration, width, height };
}

export function useVideoScrub(videoSrc: string) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [canvasLive, setCanvasLive] = useState(false);

  useEffect(() => {
    const s = freshState();
    const controller = new AbortController();
    const reduced = prefersReducedMotion();
    setCanvasLive(false);

    // ---- scroll progress ----
    let top = 0;
    let span = 1;
    const measure = () => {
      const el = containerRef.current;
      if (!el) return;
      top = el.getBoundingClientRect().top + window.scrollY;
      span = Math.max(1, el.offsetHeight - window.innerHeight);
    };
    const getProgress = () => Math.min(1, Math.max(0, (window.scrollY - top) / span));
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);

    // ---- duration from the <video> element (fallback path) ----
    const video = videoRef.current;
    const onMeta = () => {
      if (video && Number.isFinite(video.duration) && video.duration > 0) s.dur = video.duration;
    };
    if (video) {
      video.addEventListener('loadedmetadata', onMeta);
      if (video.readyState >= 1) onMeta();
    }

    // ---- frame bank LRU of decoded ImageBitmaps ----
    const warmLRU = (i: number) => {
      for (let j = i - 1; j <= i + 2; j++) {
        if (j < 0 || j >= s.bank.length) continue;
        if (s.lru.has(j)) {
          const v = s.lru.get(j)!;
          s.lru.delete(j);
          s.lru.set(j, v);
          continue;
        }
        s.lru.set(j, null);
        createImageBitmap(s.bank[j].blob).then(
          (bmp) => {
            if (s.lru.has(j) && s.lru.get(j) === null && !controller.signal.aborted) s.lru.set(j, bmp);
            else bmp.close();
          },
          () => s.lru.delete(j),
        );
      }
      while (s.lru.size > LRU_MAX) {
        const oldest = s.lru.keys().next().value as number;
        s.lru.get(oldest)?.close();
        s.lru.delete(oldest);
      }
    };

    const drawAt = (t: number) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx || s.bank.length === 0) return;
      const i = nearestIndex(s.bank, t);
      warmLRU(i);
      if (i === s.lastDrawn) return;
      const bmp = s.lru.get(i);
      if (!bmp) return; // keep previous frame until this one is ready
      ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
      s.lastDrawn = i;
      if (!s.painted) {
        s.painted = true;
        setCanvasLive(true);
      }
    };

    // ---- rAF loop ----
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      const p = getProgress();
      setScrollProgress(p);
      if (s.dur > 0) {
        s.target = p * s.dur;
        if (reduced) {
          s.current = s.target;
        } else {
          s.current += (s.target - s.current) * (1 - Math.exp(-dt * LERP_TAU));
          if (Math.abs(s.target - s.current) < SNAP) s.current = s.target;
        }
        const useBank = s.ready && !s.reverted;
        if (useBank) drawAt(s.current);
        if (!useBank || !s.painted) {
          const v = videoRef.current;
          if (v && v.readyState >= 1 && !v.seeking && Math.abs(v.currentTime - s.current) > 0.01) {
            v.currentTime = Math.min(s.current, Math.max(0, s.dur - 0.001));
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    // ---- frame bank build (after window load) ----
    let watchdog = 0;
    const revert = () => {
      s.reverted = true;
      s.ready = false;
      setCanvasLive(false);
    };
    const build = async () => {
      if (!videoSrc || reduced || typeof VideoDecoder === 'undefined' || s.building) return;
      s.building = true;
      watchdog = window.setTimeout(() => {
        if (!s.ready) {
          controller.abort();
          revert();
        }
      }, WATCHDOG);
      try {
        const res = await fetch(videoSrc, { signal: controller.signal, mode: 'cors' });
        if (!res.ok) throw new Error(`fetch ${res.status}`);
        const buffer = await res.arrayBuffer();
        let out;
        try {
          out = await decodeToBank(buffer, 'prefer-hardware', controller.signal);
        } catch (e) {
          if (controller.signal.aborted) throw e;
          out = await decodeToBank(buffer, 'prefer-software', controller.signal);
        }
        if (controller.signal.aborted) return;
        const canvas = canvasRef.current;
        if (canvas) {
          canvas.width = out.width;
          canvas.height = out.height;
        }
        s.bank = out.frames;
        if (s.dur <= 0) s.dur = out.duration;
        s.ready = true;
      } catch (e) {
        if (!controller.signal.aborted) console.warn('[useVideoScrub] frame bank unavailable, using <video> seeking', e);
        revert();
      } finally {
        window.clearTimeout(watchdog);
        s.building = false;
      }
    };
    const onLoad = () => void build();
    if (document.readyState === 'complete') onLoad();
    else window.addEventListener('load', onLoad, { once: true });

    return () => {
      controller.abort();
      cancelAnimationFrame(raf);
      window.clearTimeout(watchdog);
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
      window.removeEventListener('load', onLoad);
      video?.removeEventListener('loadedmetadata', onMeta);
      s.lru.forEach((b) => b?.close());
      s.lru.clear();
      s.bank = [];
    };
  }, [videoSrc]);

  return { containerRef, videoRef, canvasRef, scrollProgress, canvasLive };
}
