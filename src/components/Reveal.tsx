import { useEffect, useState, type CSSProperties, type ElementType, type ReactNode } from 'react';
import { EASE_OUT, useInView } from '@/lib/motion';

type Variant = 'up' | 'fade' | 'scale' | 'left' | 'right';

const HIDDEN: Record<Variant, string> = {
  up: 'translate3d(0, 40px, 0)',
  fade: 'none',
  scale: 'scale(0.94)',
  left: 'translate3d(-48px, 0, 0)',
  right: 'translate3d(48px, 0, 0)',
};

/** Scroll-triggered reveal: animates once when the element enters the viewport. */
export function Reveal({
  children,
  variant = 'up',
  delay = 0,
  duration = 900,
  className,
  style,
  as: Tag = 'div',
}: {
  children: ReactNode;
  variant?: Variant;
  delay?: number;
  duration?: number;
  className?: string;
  style?: CSSProperties;
  as?: ElementType;
}) {
  const [ref, inView] = useInView<HTMLDivElement>();
  return (
    <Tag
      ref={ref}
      className={className}
      style={{
        ...style,
        opacity: inView ? 1 : 0,
        transform: inView ? 'none' : HIDDEN[variant],
        transition: `opacity ${duration}ms ${EASE_OUT} ${delay}ms, transform ${duration}ms ${EASE_OUT} ${delay}ms`,
      }}
    >
      {children}
    </Tag>
  );
}

// CJK characters break anywhere; Latin words must stay together so they never split mid-word.
const TOKEN = /[⺀-鿿豈-﫿＀-￯　-〿]|[^\s⺀-鿿豈-﫿＀-￯　-〿]+|\s+/g;

/**
 * Character-by-character masked reveal (each glyph rises out of its own clip box).
 * Scroll-triggered by default; pass `show` to drive it from outside (e.g. scroll progress), which also plays it in reverse.
 */
export function SplitReveal({
  text,
  show,
  delay = 0,
  stagger = 35,
  duration = 900,
  className,
  style,
  as: Tag = 'span',
}: {
  text: string;
  show?: boolean;
  delay?: number;
  stagger?: number;
  duration?: number;
  className?: string;
  style?: CSSProperties;
  as?: ElementType;
}) {
  const [ref, inView] = useInView<HTMLElement>();
  // paint the hidden state at least once so a glyph mounted with show=true still animates in
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    let r2 = 0;
    const r1 = requestAnimationFrame(() => (r2 = requestAnimationFrame(() => setArmed(true))));
    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
    };
  }, []);
  const visible = (show ?? inView) && armed;
  let i = 0;
  const glyph = (ch: string, key: string) => {
    const d = delay + i++ * stagger;
    return (
      <span key={key} className="inline-block overflow-hidden align-bottom" style={{ paddingBottom: '0.08em', marginBottom: '-0.08em' }}>
        <span
          className="inline-block will-change-transform"
          style={{
            transform: visible ? 'translate3d(0,0,0)' : 'translate3d(0,110%,0)',
            opacity: visible ? 1 : 0,
            transition: `transform ${duration}ms ${EASE_OUT} ${d}ms, opacity ${duration * 0.6}ms ${EASE_OUT} ${d}ms`,
          }}
        >
          {ch}
        </span>
      </span>
    );
  };
  const tokens = text.match(TOKEN) ?? [];
  return (
    <Tag ref={ref} className={className} style={style} aria-label={text}>
      <span aria-hidden="true">
        {tokens.map((tok, ti) => {
          if (/^\s+$/.test(tok)) return ' ';
          if (tok.length === 1) return glyph(tok, `g${ti}`);
          return (
            <span key={`w${ti}`} className="inline-block whitespace-nowrap">
              {Array.from(tok).map((ch, ci) => glyph(ch, `g${ti}-${ci}`))}
            </span>
          );
        })}
      </span>
    </Tag>
  );
}

/** Thin rule that draws from left to right when scrolled into view. */
export function DrawLine({ className, color, delay = 0 }: { className?: string; color: string; delay?: number }) {
  const [ref, inView] = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`h-px origin-left ${className ?? ''}`}
      style={{
        backgroundColor: color,
        transform: inView ? 'scaleX(1)' : 'scaleX(0)',
        transition: `transform 1200ms ${EASE_OUT} ${delay}ms`,
      }}
    />
  );
}
