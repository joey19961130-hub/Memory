import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown, Smartphone, MousePointer2 } from 'lucide-react';
import type { SiteSettings } from '@/lib/content';
import { DARK } from '@/lib/theme';
import { prefersReducedMotion } from '@/lib/motion';

const PALETTE = ['#E9B8B0', '#F1D58A', '#A9C1A6', '#A8C6DD', '#B9AEDC', '#E8806B'];

/** Photo-wall slots: centre (% of hero), size (vmin), rotation (deg), parallax depth. The middle stays clear for the logo. */
type Slot = [x: number, y: number, size: number, rot: number, depth: number];
const LANDSCAPE: Slot[] = [
  [9, 33, 21, -6, 1.2], [30, 21, 15, 4, 0.7], [71, 15, 19, -3, 0.9], [91, 33, 18, 7, 1.4],
  [8, 74, 19, 5, 0.8], [29, 86, 16, -4, 1.3], [73, 81, 21, 4, 1.1], [93, 72, 15, -7, 0.6],
];
const PORTRAIT: Slot[] = [
  [18, 17, 28, -6, 1.2], [56, 13, 24, 3, 0.7], [87, 21, 24, 6, 1.0], [12, 36, 20, 5, 1.4], [89, 38, 20, -5, 0.8],
  [16, 68, 26, 4, 0.9], [85, 66, 24, -6, 1.3], [34, 83, 22, -3, 1.1], [72, 84, 22, 5, 0.7],
];

type Mode = 'idle' | 'mouse' | 'touch' | 'tilt' | 'inhale' | 'done';

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const seg = (x: number, a: number, b: number) => clamp((x - a) / (b - a));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const eOutBack = (x: number, s = 1.7) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2);
const eInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const eIn = (x: number) => x * x * x;
const eOut = (x: number) => 1 - Math.pow(1 - x, 3);

// inhale choreography (seconds after the trigger)
const T_ROTATE = 0.5, T_SHRINK_END = 1.0, T_BURST = 1.05, T_BURST_END = 2.2, T_RETURN = 2.5, T_RETURN_END = 3.3;
const DWELL = 0.22;

interface Particle {
  a: number; r: number; delay: number; dur: number; size: number; color: string; spin: number;
}

function Wall({ images, slots, variant }: { images: string[]; slots: Slot[]; variant: 'mono' | 'color' }) {
  if (!images.length) return null;
  return (
    <>
      {slots.map(([x, y, size, rot, depth], i) => {
        const src = images[i % images.length];
        if (i >= images.length && images.length < 4) return null; // few photos: don't repeat them obviously
        return (
          <div
            key={i}
            className="aura-card absolute rounded-2xl overflow-hidden"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              width: `${size}vmin`,
              height: `${size}vmin`,
              transform: `translate(-50%, -50%) translate3d(calc(var(--px, 0) * ${(depth * 18).toFixed(1)}px), calc(var(--py, 0) * ${(depth * 18).toFixed(1)}px + var(--sy, 0) * ${(-depth * 160).toFixed(0)}px), 0) rotate(${rot}deg)`,
              boxShadow: variant === 'mono' ? '0 18px 40px -18px rgba(12,22,34,0.45)' : undefined,
            }}
          >
            <img src={src} alt="" draggable={false} className="w-full h-full object-cover" loading={i < 6 ? 'eager' : 'lazy'} />
          </div>
        );
      })}
    </>
  );
}

export function AuraHero({ settings }: { settings: SiteSettings }) {
  const rootRef = useRef<HTMLElement>(null);
  const markWrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [landscape, setLandscape] = useState(true);
  const [mode, setModeState] = useState<Mode>(() => (prefersReducedMotion() ? 'done' : 'idle'));
  const [needsPermission, setNeedsPermission] = useState(false);
  const [touchDevice, setTouchDevice] = useState(false);
  const modeRef = useRef<Mode>(mode);
  const setMode = (m: Mode) => {
    if (modeRef.current === m) return;
    modeRef.current = m;
    setModeState(m);
  };
  const tiltListenRef = useRef<(() => void) | null>(null);

  const images = settings.heroWall.slice(0, 9);

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setLandscape(e.contentRect.width >= e.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    setTouchDevice(window.matchMedia('(pointer: coarse)').matches);
    const DOE = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent;
    if (window.matchMedia('(pointer: coarse)').matches && typeof DOE?.requestPermission === 'function') setNeedsPermission(true);
  }, []);

  useEffect(() => {
    const root = rootRef.current, canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext('2d')!;
    const reduced = prefersReducedMotion();

    // ---- geometry ----
    let W = 0, H = 0, dpr = 1, R = 160;
    const logo = { x: 0, y: 0, h: 200 };
    const measure = () => {
      const r = root.getBoundingClientRect();
      W = r.width; H = r.height;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      R = Math.max(110, Math.min(W, H) * 0.24);
      const m = markWrapRef.current?.getBoundingClientRect();
      if (m) { logo.x = m.left - r.left + m.width / 2; logo.y = m.top - r.top + m.height / 2; logo.h = m.height; }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);

    // ---- state ----
    const pos = { x: W * 0.22, y: H * 0.3 }, target = { ...pos }, vel = { x: 0, y: 0 };
    let dwell = 0, t0 = 0, burstStart = { x: 0, y: 0 }, lastInput = 0;
    let particles: Particle[] = [];
    let sparks: { a: number; v: number; color: string; size: number }[] = [];
    const ptr = { x: 0, y: 0 }; // normalised pointer for wall parallax
    const intake = () => ({ x: logo.x + logo.h * 0.27, y: logo.y + logo.h * 0.05 }); // under the bulb once turned: the nostril

    const setVar = (k: string, v: string) => root.style.setProperty(k, v);

    if (modeRef.current === 'done') {
      setVar('--hr', '0px'); setVar('--cr', '0px'); root.dataset.done = 'true';
    }

    // ---- inputs ----
    const userMode = () => ['mouse', 'touch', 'tilt'].includes(modeRef.current) || modeRef.current === 'idle';
    const onPointer = (e: PointerEvent) => {
      if (!userMode()) return;
      // taps on the hero's own controls (motion permission, scroll cue, nav) aren't steering
      if ((e.target as Element | null)?.closest?.('button, a')) return;
      const r = root.getBoundingClientRect();
      if (e.clientY < r.top || e.clientY > r.bottom) return;
      target.x = e.clientX - r.left; target.y = e.clientY - r.top;
      ptr.x = (e.clientX / window.innerWidth) * 2 - 1; ptr.y = (e.clientY / window.innerHeight) * 2 - 1;
      lastInput = performance.now();
      setMode(e.pointerType === 'mouse' ? 'mouse' : 'touch');
    };
    window.addEventListener('pointermove', onPointer, { passive: true });
    root.addEventListener('pointerdown', onPointer, { passive: true });

    // gyroscope → "balance a marble": tilt accelerates the halo, friction calms it
    let base: { a: number; b: number } | null = null;
    const tilt = { x: 0, y: 0 };
    const axes = (e: DeviceOrientationEvent) => {
      const angle = (screen.orientation?.angle ?? (window as unknown as { orientation?: number }).orientation ?? 0) as number;
      const b = e.beta ?? 0, g = e.gamma ?? 0;
      if (angle === 90) return { a: b, b: -g };
      if (angle === -90 || angle === 270) return { a: -b, b: g };
      if (angle === 180) return { a: -g, b: -b };
      return { a: g, b };
    };
    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.beta == null || e.gamma == null) return;
      const v = axes(e);
      if (!base) base = { ...v };
      // slowly re-centre so a change of grip doesn't pin the halo to an edge
      base.a += (v.a - base.a) * 0.004; base.b += (v.b - base.b) * 0.004;
      tilt.x = clamp((v.a - base.a) / 28, -1, 1); tilt.y = clamp((v.b - base.b) / 28, -1, 1);
      if (Math.abs(tilt.x) + Math.abs(tilt.y) > 0.08 && performance.now() - lastInput > 1500 && userMode()) setMode('tilt');
    };
    const startTilt = () => {
      window.addEventListener('deviceorientation', onOrient);
      const onRot = () => (base = null);
      window.addEventListener('orientationchange', onRot);
      return () => { window.removeEventListener('deviceorientation', onOrient); window.removeEventListener('orientationchange', onRot); };
    };
    let stopTilt: (() => void) | null = null;
    const DOE = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent;
    if (window.matchMedia('(pointer: coarse)').matches && typeof DOE?.requestPermission !== 'function') stopTilt = startTilt();
    tiltListenRef.current = () => { if (!stopTilt) stopTilt = startTilt(); };

    const onScroll = () => setVar('--sy', clamp(window.scrollY / Math.max(1, H)).toFixed(4));
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // ---- particles ----
    const spawnInhale = (cx: number, cy: number) => {
      particles = Array.from({ length: 110 }, () => {
        const a = Math.random() * Math.PI * 2;
        return {
          a, r: R * (0.35 + Math.random() * 0.95), delay: Math.random() * 0.4, dur: 0.55 + Math.random() * 0.45,
          size: 2 + Math.random() * 5, color: PALETTE[(Math.random() * PALETTE.length) | 0], spin: 1.6 + Math.random() * 1.6,
        };
      });
      burstStart = { x: cx, y: cy };
    };
    const drawParticles = (tau: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const it = intake();
      for (const p of particles) {
        const k = seg(tau, p.delay, p.delay + p.dur);
        if (k <= 0 || k >= 1) continue;
        const e = eIn(k);
        const c = { x: lerp(burstStart.x, it.x, eInOut(Math.min(1, tau / T_SHRINK_END))), y: lerp(burstStart.y, it.y, eInOut(Math.min(1, tau / T_SHRINK_END))) };
        const rr = p.r * (1 - e), aa = p.a + e * p.spin;
        const x = c.x + Math.cos(aa) * rr, y = c.y + Math.sin(aa) * rr;
        const tail = 0.08;
        const e2 = eIn(Math.max(0, k - tail)), rr2 = p.r * (1 - e2), aa2 = p.a + e2 * p.spin;
        ctx.strokeStyle = p.color; ctx.globalAlpha = 0.9; ctx.lineCap = 'round';
        ctx.lineWidth = p.size * (1 - e * 0.6);
        ctx.beginPath(); ctx.moveTo(c.x + Math.cos(aa2) * rr2, c.y + Math.sin(aa2) * rr2); ctx.lineTo(x, y); ctx.stroke();
      }
      const sk = seg(tau, T_BURST, T_BURST + 0.9);
      if (sk > 0 && sk < 1) {
        for (const s of sparks) {
          const d = eOut(sk) * s.v;
          ctx.globalAlpha = 1 - sk; ctx.fillStyle = s.color;
          ctx.beginPath(); ctx.arc(it.x + Math.cos(s.a) * d, it.y + Math.sin(s.a) * d, s.size * (1 - sk * 0.5), 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    };

    // ---- main loop ----
    let raf = 0, last = performance.now(), visible = true;
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
    });
    io.observe(root);

    const tick = (now: number) => {
      raf = 0;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const m = modeRef.current;
      const sec = now / 1000;

      if (m === 'idle' || m === 'mouse' || m === 'touch' || m === 'tilt') {
        if (m === 'idle') {
          // lazy drift that never wanders onto the logo by itself
          target.x = W / 2 + Math.sin(sec * 0.37) * W * 0.3;
          target.y = H / 2 + Math.sin(sec * 0.53 + 1.3) * H * 0.28;
          const dx = target.x - logo.x, dy = target.y - logo.y, d = Math.hypot(dx, dy), keep = R * 1.3;
          if (d < keep) { target.x = logo.x + (dx / (d || 1)) * keep; target.y = logo.y + (dy / (d || 1)) * keep; }
        }
        if (m === 'tilt') {
          const K = Math.min(W, H) * 4.2;
          vel.x += tilt.x * K * dt; vel.y += tilt.y * K * dt;
          const dx = logo.x - pos.x, dy = logo.y - pos.y, d = Math.hypot(dx, dy);
          if (d < R * 0.9) { vel.x += dx * 6 * dt; vel.y += dy * 6 * dt; } // gentle pull into the nose
          const f = Math.exp(-dt * 2.4);
          vel.x *= f; vel.y *= f;
          pos.x += vel.x * dt; pos.y += vel.y * dt;
          if (pos.x < 0 || pos.x > W) { pos.x = clamp(pos.x, 0, W); vel.x *= -0.45; }
          if (pos.y < 0 || pos.y > H) { pos.y = clamp(pos.y, 0, H); vel.y *= -0.45; }
          ptr.x = lerp(ptr.x, tilt.x, 0.1); ptr.y = lerp(ptr.y, tilt.y, 0.1);
        } else {
          const k = 1 - Math.exp(-dt * (m === 'idle' ? 1.6 : 7));
          pos.x += (target.x - pos.x) * k; pos.y += (target.y - pos.y) * k;
        }
        const d = Math.hypot(pos.x - logo.x, pos.y - logo.y);
        const close = clamp(1 - d / (R * 1.7));
        // anticipation: the drop leans toward the light as it gets close
        setVar('--lrot', `${(-28 * Math.pow(close, 1.4)).toFixed(2)}deg`);
        setVar('--ls', (1 + 0.06 * close).toFixed(4));
        setVar('--hx', `${pos.x.toFixed(1)}px`); setVar('--hy', `${pos.y.toFixed(1)}px`);
        setVar('--cx', `${pos.x.toFixed(1)}px`); setVar('--cy', `${pos.y.toFixed(1)}px`);
        const breathe = R * (1 + 0.04 * Math.sin(sec * 2.1));
        setVar('--hr', `${breathe.toFixed(1)}px`); setVar('--cr', `${(breathe * 0.92).toFixed(1)}px`);
        setVar('--hrot', `${((sec * 40) % 360).toFixed(1)}deg`);
        const thr = Math.max(46, R * 0.4);
        if (m !== 'idle' && d < thr) dwell += dt; else dwell = 0;
        if (dwell >= DWELL) {
          t0 = now; spawnInhale(pos.x, pos.y);
          sparks = Array.from({ length: 46 }, () => ({ a: Math.random() * Math.PI * 2, v: 80 + Math.random() * Math.max(W, H) * 0.45, color: PALETTE[(Math.random() * 6) | 0], size: 2 + Math.random() * 4 }));
          root.dataset.inhaling = 'true';
          setMode('inhale');
        }
      } else if (m === 'inhale') {
        const tau = (now - t0) / 1000, it = intake();
        // drop turns into the nose (with overshoot), then two quick sniffs
        const rot = tau < T_RETURN ? lerp(-28, -90, eOutBack(seg(tau, 0, T_ROTATE))) : lerp(-90, 0, eInOut(seg(tau, T_RETURN, T_RETURN_END)));
        const sniff = Math.max(0, 1 - Math.abs(tau - 0.6) * 9) + Math.max(0, 1 - Math.abs(tau - 0.82) * 9);
        const pop = Math.max(0, 1 - Math.abs(tau - T_BURST) * 5);
        setVar('--lrot', `${rot.toFixed(2)}deg`);
        setVar('--ls', (1 + 0.1 * pop).toFixed(4));
        setVar('--lsy', (1 - 0.12 * sniff).toFixed(4));
        // halo is pulled into the nostril and shrinks to nothing
        const mk = eInOut(seg(tau, 0, 0.45));
        const hx = lerp(burstStart.x, it.x, mk), hy = lerp(burstStart.y, it.y, mk);
        const hr = R * (1 - eIn(seg(tau, 0.2, T_SHRINK_END)));
        setVar('--hx', `${hx.toFixed(1)}px`); setVar('--hy', `${hy.toFixed(1)}px`); setVar('--hr', `${hr.toFixed(1)}px`);
        if (tau < T_BURST) {
          setVar('--cx', `${hx.toFixed(1)}px`); setVar('--cy', `${hy.toFixed(1)}px`); setVar('--cr', `${(hr * 0.92).toFixed(1)}px`);
        } else {
          // exhale: colour floods out of the nose across the whole wall
          const diag = Math.hypot(Math.max(it.x, W - it.x), Math.max(it.y, H - it.y));
          setVar('--cx', `${it.x.toFixed(1)}px`); setVar('--cy', `${it.y.toFixed(1)}px`);
          setVar('--cr', `${(eOut(seg(tau, T_BURST, T_BURST_END)) * diag * 1.25).toFixed(1)}px`);
          root.dataset.burst = 'true';
        }
        drawParticles(tau);
        if (tau >= T_RETURN_END) {
          ctx.clearRect(0, 0, W, H);
          setVar('--lrot', '0deg'); setVar('--ls', '1'); setVar('--lsy', '1');
          root.dataset.done = 'true';
          delete root.dataset.inhaling;
          setMode('done');
        }
      }
      setVar('--px', ptr.x.toFixed(4)); setVar('--py', ptr.y.toFixed(4));
      if (visible && modeRef.current !== 'done') raf = requestAnimationFrame(tick);
    };
    if (!reduced && modeRef.current !== 'done') raf = requestAnimationFrame(tick);

    // pointer parallax on the wall keeps working after the inhale
    const onPtrDone = (e: PointerEvent) => {
      if (modeRef.current !== 'done' || e.pointerType !== 'mouse' || reduced) return;
      setVar('--px', ((e.clientX / window.innerWidth) * 2 - 1).toFixed(4));
      setVar('--py', ((e.clientY / window.innerHeight) * 2 - 1).toFixed(4));
    };
    window.addEventListener('pointermove', onPtrDone, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect();
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('pointermove', onPtrDone);
      root.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('scroll', onScroll);
      stopTilt?.();
    };
  }, []);

  const askMotion = async () => {
    const DOE = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent;
    try {
      const res = await DOE?.requestPermission?.();
      if (res === 'granted') tiltListenRef.current?.();
    } finally {
      setNeedsPermission(false);
    }
  };

  const slots = landscape ? LANDSCAPE : PORTRAIT;
  const done = mode === 'done';
  const active = mode === 'idle' || mode === 'mouse' || mode === 'touch' || mode === 'tilt';

  return (
    <section
      id="hero"
      ref={rootRef}
      aria-label={settings.brandName}
      className="aura-hero relative w-full h-[100svh] min-h-[560px] overflow-hidden bg-white select-none"
      data-mode={mode}
    >
      {/* ambient colour fields on white */}
      <div className="aura-ambient absolute inset-0 pointer-events-none" aria-hidden="true">
        <span className="aura-blob" style={{ background: '#F6D2CB', left: '6%', top: '8%', width: '42vmax', height: '42vmax' }} />
        <span className="aura-blob" style={{ background: '#D6E6F2', right: '-6%', top: '20%', width: '46vmax', height: '46vmax', animationDelay: '-6s' }} />
        <span className="aura-blob" style={{ background: '#F8EAC0', left: '28%', bottom: '-14%', width: '40vmax', height: '40vmax', animationDelay: '-12s' }} />
        <span className="aura-blob" style={{ background: '#E2DBF3', left: '-10%', bottom: '4%', width: '34vmax', height: '34vmax', animationDelay: '-3s' }} />
      </div>

      {/* black-and-white wall */}
      <div className="aura-mono absolute inset-0 pointer-events-none" aria-hidden="true">
        <Wall images={images} slots={slots} variant="mono" />
      </div>

      {/* the halo the visitor steers */}
      <div className="aura-halo pointer-events-none" aria-hidden="true" />

      {/* full-colour wall, revealed only inside the halo (then everywhere after the inhale) */}
      <div className="aura-color absolute inset-0 pointer-events-none" aria-hidden="true">
        <Wall images={images} slots={slots} variant="color" />
      </div>

      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true" />

      {/* logo */}
      <div
        className="aura-logo absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
        style={{ transform: 'translate3d(0, calc(var(--sy, 0) * 160px), 0)', opacity: 'calc(1 - var(--sy, 0) * 1.2)' }}
      >
        <div ref={markWrapRef} className="relative flex items-center justify-center" style={{ height: 'clamp(130px, 25vmin, 260px)', width: 'clamp(130px, 25vmin, 260px)' }}>
          {settings.logoMarkUrl && (
            <img
              src={settings.logoMarkUrl}
              alt=""
              draggable={false}
              className="aura-mark h-full w-auto"
              style={{ transform: 'rotate(var(--lrot, 0deg)) scale(var(--ls, 1)) scaleY(var(--lsy, 1))' }}
            />
          )}
        </div>
        {settings.logoWordUrl ? (
          <img src={settings.logoWordUrl} alt={settings.brandName} className="aura-word mt-[6vmin] w-auto" style={{ height: 'clamp(22px, 4.2vmin, 44px)' }} />
        ) : (
          <h1 className="aura-word mt-[6vmin] font-black tracking-tight" style={{ color: DARK, fontSize: 'clamp(24px, 4.6vmin, 48px)' }}>
            {settings.brandName}
          </h1>
        )}
        {settings.logoWordUrl && <h1 className="sr-only">{settings.brandName}</h1>}
      </div>

      {/* hint → then scroll cue */}
      <div className="absolute inset-x-0 bottom-8 sm:bottom-10 flex flex-col items-center gap-3 px-6 text-center">
        {needsPermission && active && (
          <button
            type="button"
            onClick={askMotion}
            className="aura-fade-in flex items-center gap-2 rounded-full bg-white/80 backdrop-blur px-4 py-2 text-xs tracking-[0.15em] shadow-sm border"
            style={{ color: DARK, borderColor: `${DARK}20` }}
          >
            <Smartphone size={14} /> 開啟體感互動
          </button>
        )}
        <p
          className="text-xs tracking-[0.25em] flex items-center gap-2 transition-opacity duration-700 rounded-full bg-white/75 backdrop-blur px-4 py-2"
          style={{ color: `${DARK}99`, opacity: active ? 1 : 0 }}
          aria-hidden={!active}
        >
          {touchDevice ? <Smartphone size={14} className="aura-wiggle" /> : <MousePointer2 size={14} className="aura-wiggle" />}
          {settings.heroHint}
        </p>
        <a
          href="#story-1"
          className={`absolute bottom-0 flex flex-col items-center gap-1 text-xs tracking-[0.3em] rounded-full bg-white/75 backdrop-blur px-4 pt-2 pb-1 transition-all duration-700 ${done ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'}`}
          style={{ color: DARK, transitionDelay: done ? '300ms' : '0ms' }}
          aria-hidden={!done}
          tabIndex={done ? 0 : -1}
        >
          往下看
          <ChevronDown size={18} className="animate-bounce" />
        </a>
      </div>
    </section>
  );
}
