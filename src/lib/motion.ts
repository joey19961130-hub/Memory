import { useEffect, useRef, useState, type RefObject } from 'react';

export const EASE_OUT = 'cubic-bezier(0.16,1,0.3,1)';

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** true once the element has scrolled into view (never flips back). */
export function useInView<T extends Element>(threshold = 0.15): [RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(prefersReducedMotion);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined' || prefersReducedMotion()) {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold, rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, inView];
}

/**
 * Scroll parallax: translates the element by `speed` × its distance from the viewport centre.
 * Writes the transform directly so scrolling never re-renders React.
 */
export function useScrollParallax<T extends HTMLElement>(speed: number): RefObject<T> {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const parent = el.parentElement ?? el;
      const r = parent.getBoundingClientRect();
      const offset = r.top + r.height / 2 - window.innerHeight / 2;
      el.style.transform = `translate3d(0, ${(-offset * speed).toFixed(1)}px, 0)`;
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [speed]);
  return ref;
}

/**
 * Smoothed pointer position written to CSS variables --mx / --my (range -1…1) on the target element.
 * Children use them in calc() for depth-layered pointer parallax. Disabled for touch & reduced motion.
 */
export function usePointerParallax<T extends HTMLElement>(): RefObject<T> {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion() || !window.matchMedia('(pointer: fine)').matches) return;
    let tx = 0, ty = 0, x = 0, y = 0, raf = 0, last = performance.now();
    const onMove = (e: PointerEvent) => {
      tx = (e.clientX / window.innerWidth) * 2 - 1;
      ty = (e.clientY / window.innerHeight) * 2 - 1;
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const k = 1 - Math.exp(-dt * 5);
      x += (tx - x) * k;
      y += (ty - y) * k;
      el.style.setProperty('--mx', x.toFixed(4));
      el.style.setProperty('--my', y.toFixed(4));
      raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.0005 ? requestAnimationFrame(tick) : 0;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);
  return ref;
}

/** CSS transform for a pointer-parallax layer at the given depth (px of travel at the screen edge). */
export const depth = (px: number, extra = '') =>
  `translate3d(calc(var(--mx, 0) * ${px}px), calc(var(--my, 0) * ${px}px), 0) ${extra}`.trim();
