import { useEffect, useState } from 'react';
import { DARK } from '@/lib/theme';
import { EASE_OUT, prefersReducedMotion } from '@/lib/motion';
import { SplitReveal } from '@/components/Reveal';

const DOTS = ['#E9B8B0', '#A9C1A6', '#F1D58A', '#B9AEDC', '#A8C6DD'];
const MIN_MS = 700;

/**
 * Intro / waiting screen: bouncing palette dots + progress line while content loads,
 * then the brand name rises in and the curtain lifts to reveal the hero.
 */
export function Loader({ ready, brandName, logoUrl }: { ready: boolean; brandName: string; logoUrl: string }) {
  const [started, setStarted] = useState(false);
  const [minElapsed, setMinElapsed] = useState(false);
  const [phase, setPhase] = useState<'loading' | 'brand' | 'exit' | 'gone'>('loading');

  useEffect(() => {
    const raf = requestAnimationFrame(() => setStarted(true));
    const t = setTimeout(() => setMinElapsed(true), prefersReducedMotion() ? 0 : MIN_MS);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    if (ready && minElapsed && phase === 'loading') setPhase(prefersReducedMotion() ? 'gone' : 'brand');
  }, [ready, minElapsed, phase]);

  useEffect(() => {
    if (phase === 'brand') {
      const t = setTimeout(() => setPhase('exit'), 1000);
      return () => clearTimeout(t);
    }
    if (phase === 'exit') {
      const t = setTimeout(() => setPhase('gone'), 1100);
      return () => clearTimeout(t);
    }
  }, [phase]);

  useEffect(() => {
    if (phase === 'gone' || phase === 'exit') return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [phase]);

  if (phase === 'gone') return null;
  const exiting = phase === 'exit';

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center"
      style={{
        backgroundColor: '#F4F1EA',
        clipPath: exiting ? 'inset(0 0 100% 0)' : 'inset(0 0 0% 0)',
        transition: `clip-path 1000ms cubic-bezier(0.76,0,0.24,1)`,
      }}
      aria-busy={!ready}
      aria-label="載入中"
    >
      <div
        className="flex flex-col items-center"
        style={{
          transform: exiting ? 'translate3d(0,-60px,0)' : 'none',
          opacity: exiting ? 0 : 1,
          transition: `transform 900ms ${EASE_OUT}, opacity 600ms ease`,
        }}
      >
        <div className="flex gap-3 h-10 items-end mb-8">
          {DOTS.map((c, i) => (
            <span
              key={c}
              className="loader-dot block w-3 h-3 rounded-full"
              style={{ backgroundColor: c, animationDelay: `${i * 110}ms`, border: `1.5px solid ${DARK}` }}
            />
          ))}
        </div>
        {logoUrl && (
          <img
            src={logoUrl}
            alt=""
            className="h-16 w-auto max-w-[220px] object-contain mb-6"
            style={{
              opacity: phase === 'loading' ? 0 : 1,
              transform: phase === 'loading' ? 'scale(0.85) translateY(10px)' : 'none',
              transition: `opacity 700ms ${EASE_OUT}, transform 900ms ${EASE_OUT}`,
            }}
          />
        )}
        <div className="h-[1.6em] text-xl sm:text-2xl font-light tracking-[0.35em] uppercase" style={{ color: DARK }}>
          {phase !== 'loading' && <SplitReveal text={brandName} show stagger={55} duration={800} />}
        </div>
        <div className="mt-6 w-40 h-px overflow-hidden" style={{ backgroundColor: `${DARK}20` }}>
          <div
            className="h-full origin-left"
            style={{
              backgroundColor: DARK,
              transform: `scaleX(${phase === 'loading' ? (started ? 0.75 : 0) : 1})`,
              transition: `transform ${phase === 'loading' ? 2400 : 500}ms ${EASE_OUT}`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
