import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Product } from '@/lib/content';
import { DARK, placeholderTone } from '@/lib/theme';
import { EASE_OUT } from '@/lib/motion';

const finePointer = () => typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/**
 * Pointer handlers that make a `.cursor-zoom` box zoom in exactly where the cursor is
 * (CSS reads --zx / --zy as the transform origin). No-ops on touch devices.
 */
export function cursorZoomHandlers() {
  const set = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.pointerType !== 'mouse') return;
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--zx', `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}%`);
    el.style.setProperty('--zy', `${(((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`);
  };
  return { onPointerMove: set, onPointerEnter: set };
}

export function Placeholder({ product, className = '' }: { product: Product; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center text-sm tracking-[0.3em] uppercase ${className}`}
      style={{ backgroundColor: placeholderTone(product.category || product.name), color: `${DARK}80` }}
    >
      {product.category || '商品'}
    </div>
  );
}

/** Product photo gallery for the detail modal: cursor magnifier, swipe, arrows, dots, thumbnails, ← → keys. */
export function Gallery({ product, open }: { product: Product; open: boolean }) {
  const images = product.images;
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(false);
  const swipe = useRef<{ x: number; id: number } | null>(null);
  const count = images.length;

  useEffect(() => setIndex(0), [product.id]);
  useEffect(() => {
    if (index >= count) setIndex(Math.max(0, count - 1));
  }, [count, index]);

  const go = (d: number) => count > 1 && setIndex((i) => (i + d + count) % count);

  useEffect(() => {
    if (!open || count < 2) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      go(e.key === 'ArrowRight' ? 1 : -1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (count === 0) return <Placeholder product={product} className="w-full aspect-square" />;

  const zoomable = finePointer();

  return (
    <div className="select-none">
      <div
        className="relative w-full aspect-square overflow-clip bg-slate-100 touch-pan-y"
        style={{ cursor: zoomable ? (zoom ? 'zoom-out' : 'zoom-in') : undefined }}
        {...cursorZoomHandlers()}
        onPointerLeave={() => setZoom(false)}
        onClick={() => zoomable && setZoom((z) => !z)}
        onPointerDown={(e) => {
          if (e.pointerType !== 'mouse') swipe.current = { x: e.clientX, id: e.pointerId };
        }}
        onPointerUp={(e) => {
          const s = swipe.current;
          swipe.current = null;
          if (!s || s.id !== e.pointerId) return;
          const dx = e.clientX - s.x;
          if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
        }}
        data-zoom={zoom}
        aria-roledescription="carousel"
        aria-label={`${product.name} 照片 ${index + 1} / ${count}`}
      >
        <div
          className="flex h-full"
          style={{ transform: `translate3d(${-index * 100}%,0,0)`, transition: `transform 600ms ${EASE_OUT}` }}
        >
          {images.map((src, i) => (
            <div key={src + i} className="relative w-full h-full shrink-0 overflow-clip">
              <img
                src={src}
                alt={`${product.name} ${i + 1}`}
                draggable={false}
                loading={i === 0 ? 'eager' : 'lazy'}
                className="w-full h-full object-cover"
                style={{
                  transformOrigin: 'var(--zx, 50%) var(--zy, 50%)',
                  transform: zoom && i === index ? 'scale(2.2)' : 'scale(1)',
                  transition: `transform 450ms ${EASE_OUT}`,
                }}
              />
            </div>
          ))}
        </div>
        {zoomable && !zoom && (
          <span className="pointer-events-none absolute top-3 left-3 rounded-full bg-black/40 text-white text-[10px] tracking-[0.2em] px-2 py-1">
            點擊放大
          </span>
        )}
        {count > 1 && (
          <>
            {[-1, 1].map((d) => (
              <button
                key={d}
                type="button"
                aria-label={d < 0 ? '上一張' : '下一張'}
                onClick={(e) => {
                  e.stopPropagation();
                  setZoom(false);
                  go(d);
                }}
                className={`absolute top-1/2 -translate-y-1/2 ${d < 0 ? 'left-3' : 'right-3'} w-9 h-9 rounded-full bg-white/85 backdrop-blur flex items-center justify-center shadow hover:scale-110 transition-transform`}
                style={{ color: DARK }}
              >
                {d < 0 ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
              </button>
            ))}
            <div className="absolute bottom-3 inset-x-0 flex justify-center gap-1.5 pointer-events-none">
              {images.map((_, i) => (
                <span
                  key={i}
                  className="h-1.5 rounded-full transition-all duration-500"
                  style={{ width: i === index ? 18 : 6, backgroundColor: i === index ? '#fff' : 'rgba(255,255,255,0.55)' }}
                />
              ))}
            </div>
          </>
        )}
      </div>
      {count > 1 && (
        <div className="flex gap-2 p-3 overflow-x-auto">
          {images.map((src, i) => (
            <button
              key={src + i}
              type="button"
              aria-label={`第 ${i + 1} 張`}
              aria-current={i === index}
              onClick={() => setIndex(i)}
              className="shrink-0 w-14 h-14 rounded-md overflow-hidden transition-all duration-300"
              style={{ outline: i === index ? `2px solid ${DARK}` : 'none', outlineOffset: 2, opacity: i === index ? 1 : 0.55 }}
            >
              <img src={src} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
