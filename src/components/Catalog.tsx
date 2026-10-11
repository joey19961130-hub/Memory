import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, X } from 'lucide-react';
import { formatPrice, lineLink, type Product, type SiteSettings } from '@/lib/content';
import { DARK, placeholderTone } from '@/lib/theme';
import { EASE_OUT, prefersReducedMotion, useInView, useScrollParallax } from '@/lib/motion';
import { DrawLine, Reveal, SplitReveal } from '@/components/Reveal';

const LINE_GREEN = '#06C755';

function ProductImage({ product, className }: { product: Product; className?: string }) {
  if (product.image_url) {
    return <img src={product.image_url} alt={product.name} loading="lazy" className={`object-cover ${className ?? ''}`} />;
  }
  return (
    <div
      className={`flex items-center justify-center text-sm tracking-[0.3em] uppercase ${className ?? ''}`}
      style={{ backgroundColor: placeholderTone(product.category || product.name), color: `${DARK}80` }}
    >
      {product.category || '商品'}
    </div>
  );
}

function LineButton({ href, label = 'LINE 詢問' }: { href: string; label?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="group/line inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300"
      style={{ backgroundColor: LINE_GREEN }}
    >
      {label}
      <ArrowRight size={14} className="transition-transform duration-300 group-hover/line:translate-x-1" />
    </a>
  );
}

/** Section title: characters rise in, followed by a drawn rule. */
function SectionHeading({ title, intro, light = false }: { title: string; intro?: string; light?: boolean }) {
  const color = light ? '#FFFFFF' : DARK;
  return (
    <div className="mb-10">
      <SplitReveal
        as="h2"
        text={title}
        stagger={45}
        className="block font-light uppercase tracking-wide mb-5"
        style={{ fontSize: 'clamp(1.75rem,3.5vw,3rem)', color }}
      />
      <DrawLine className="w-24 mb-6" color={light ? 'rgba(255,255,255,0.5)' : `${DARK}55`} delay={250} />
      {intro && (
        <Reveal delay={350}>
          <p className="text-sm tracking-wide max-w-2xl whitespace-pre-line" style={{ color: light ? 'rgba(255,255,255,0.7)' : `${DARK}90` }}>
            {intro}
          </p>
        </Reveal>
      )}
    </div>
  );
}

function ProductModal({
  product,
  open,
  settings,
  onClose,
}: {
  product: Product | null;
  open: boolean;
  settings: SiteSettings;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!product) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [product, onClose]);

  if (!product) return null;
  const ease = 'cubic-bezier(0.32,0.72,0,1)';
  return (
    <div
      className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center sm:p-6"
      style={{
        backgroundColor: open ? 'rgba(10,18,28,0.55)' : 'rgba(10,18,28,0)',
        backdropFilter: open ? 'blur(6px)' : 'blur(0px)',
        transition: `background-color 400ms ease, backdrop-filter 400ms ease`,
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={product.name}
    >
      <div
        className="modal-panel bg-white w-full sm:max-w-3xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl grid sm:grid-cols-2"
        data-open={open}
        style={{ transition: `transform 500ms ${ease}, opacity 400ms ${ease}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="overflow-hidden">
          <div style={{ transform: open ? 'scale(1)' : 'scale(1.12)', transition: `transform 1200ms ${EASE_OUT}` }}>
            <ProductImage product={product} className="w-full aspect-square" />
          </div>
        </div>
        <div className="relative p-6 sm:p-8 flex flex-col">
          <button
            type="button"
            aria-label="關閉"
            onClick={onClose}
            className="absolute top-4 right-4 w-10 h-10 rounded-full border flex items-center justify-center hover:rotate-90 transition-transform duration-300"
            style={{ borderColor: `${DARK}30`, color: DARK }}
          >
            <X size={18} />
          </button>
          {[
            <p key="c" className="text-xs tracking-[0.3em] uppercase mb-3" style={{ color: `${DARK}90` }}>
              {product.category}
            </p>,
            <h3 key="n" className="text-2xl font-light pr-12 mb-4" style={{ color: DARK }}>
              {product.name}
            </h3>,
            <p key="p" className="text-lg mb-6" style={{ color: DARK }}>
              {formatPrice(product.price)}
            </p>,
            product.description ? (
              <p key="d" className="text-sm leading-relaxed whitespace-pre-line mb-8" style={{ color: `${DARK}CC` }}>
                {product.description}
              </p>
            ) : null,
            <LineButton key="b" href={lineLink(settings, product.name)} />,
          ]
            .filter(Boolean)
            .map((node, i, arr) => (
              <div
                key={i}
                className={i === arr.length - 1 ? 'mt-auto' : undefined}
                style={{
                  opacity: open ? 1 : 0,
                  transform: open ? 'none' : 'translate3d(0,16px,0)',
                  transition: `opacity 600ms ${EASE_OUT} ${open ? 150 + i * 70 : 0}ms, transform 600ms ${EASE_OUT} ${open ? 150 + i * 70 : 0}ms`,
                }}
              >
                {node}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

/** Category chips with a pill that slides to the active one. */
function CategoryFilter({ categories, value, onChange }: { categories: string[]; value: string; onChange: (c: string) => void }) {
  const [wrapRef, inView] = useInView<HTMLDivElement>();
  const btnRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [pill, setPill] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const measure = useCallback(() => {
    const btn = btnRefs.current.get(value);
    if (!btn) return;
    setPill({ x: btn.offsetLeft, y: btn.offsetTop, w: btn.offsetWidth, h: btn.offsetHeight });
  }, [value]);

  useLayoutEffect(measure, [measure, categories]);
  useEffect(() => {
    window.addEventListener('resize', measure);
    document.fonts?.ready.then(measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  return (
    <div ref={wrapRef} className="relative flex flex-wrap gap-2 mb-10">
      {pill && (
        <span
          aria-hidden="true"
          className="absolute rounded-full"
          style={{
            left: pill.x,
            top: pill.y,
            width: pill.w,
            height: pill.h,
            backgroundColor: DARK,
            opacity: inView ? 1 : 0,
            transition: `left 550ms ${EASE_OUT}, top 550ms ${EASE_OUT}, width 550ms ${EASE_OUT}, opacity 600ms ease 200ms`,
          }}
        />
      )}
      {categories.map((c, i) => (
        <Reveal key={c} variant="up" delay={i * 60} duration={700}>
          <button
            ref={(el) => {
              if (el) btnRefs.current.set(c, el);
              else btnRefs.current.delete(c);
            }}
            type="button"
            onClick={() => onChange(c)}
            className="relative px-4 py-2 rounded-full text-xs tracking-[0.15em] border transition-colors duration-500 hover:border-current"
            style={
              value === c
                ? { borderColor: 'transparent', color: '#fff' }
                : { borderColor: `${DARK}40`, color: DARK }
            }
          >
            {c}
          </button>
        </Reveal>
      ))}
    </div>
  );
}

function ProductCard({ product, index, settings, onOpen }: { product: Product; index: number; settings: SiteSettings; onOpen: (p: Product) => void }) {
  const [ref, inView] = useInView<HTMLDivElement>(0.1);
  const delay = (index % 4) * 90;
  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(product)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(product);
        }
      }}
      className="group text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-4 rounded-xl"
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? 'none' : 'translate3d(0,48px,0) scale(0.97)',
        transition: `opacity 900ms ${EASE_OUT} ${delay}ms, transform 900ms ${EASE_OUT} ${delay}ms`,
      }}
    >
      <div
        className="relative overflow-hidden rounded-xl mb-4 transition-shadow duration-500 group-hover:shadow-xl"
        style={{
          clipPath: inView ? 'inset(0 0 0 0 round 12px)' : 'inset(100% 0 0 0 round 12px)',
          transition: `clip-path 1100ms cubic-bezier(0.76,0,0.24,1) ${delay + 80}ms, box-shadow 500ms`,
        }}
      >
        <div
          style={{
            transform: inView ? 'scale(1)' : 'scale(1.25)',
            transition: `transform 1400ms ${EASE_OUT} ${delay + 80}ms`,
          }}
        >
          <ProductImage product={product} className="w-full aspect-square transition-transform duration-700 group-hover:scale-105" />
        </div>
        <span className="absolute inset-x-0 bottom-0 p-3 text-[11px] tracking-[0.2em] text-white bg-gradient-to-t from-black/40 to-transparent translate-y-full group-hover:translate-y-0 transition-transform duration-500">
          查看詳情
        </span>
      </div>
      <p className="text-[11px] tracking-[0.25em] uppercase mb-1" style={{ color: `${DARK}80` }}>
        {product.category}
      </p>
      <h3 className="text-base font-normal mb-1 line-clamp-2">{product.name}</h3>
      <p className="text-sm mb-4" style={{ color: `${DARK}CC` }}>
        {formatPrice(product.price)}
      </p>
      <LineButton href={lineLink(settings, product.name)} />
    </div>
  );
}

export const Catalog = memo(function Catalog({ settings, products }: { settings: SiteSettings; products: Product[] }) {
  const [filter, setFilter] = useState<string>('全部');
  const [selected, setSelected] = useState<Product | null>(null);
  const [open, setOpen] = useState(false);
  const closeTimer = useRef(0);

  const categories = useMemo(() => {
    const used = new Set(products.map((p) => p.category).filter(Boolean));
    const ordered = settings.categories.filter((c) => used.has(c));
    for (const c of used) if (!ordered.includes(c)) ordered.push(c);
    return ['全部', ...ordered];
  }, [products, settings.categories]);

  const visible = filter === '全部' ? products : products.filter((p) => p.category === filter);

  const openProduct = useCallback((p: Product) => {
    window.clearTimeout(closeTimer.current);
    setSelected(p);
    requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true)));
  }, []);
  const closeProduct = useCallback(() => {
    setOpen(false);
    closeTimer.current = window.setTimeout(() => setSelected(null), prefersReducedMotion() ? 0 : 450);
  }, []);

  return (
    <section id="products" className="px-6 sm:px-8 md:px-20 lg:px-32 py-24 sm:py-32" style={{ color: DARK }}>
      <SectionHeading title={settings.productsTitle} intro={settings.productsIntro} />

      {categories.length > 2 && <CategoryFilter categories={categories} value={filter} onChange={setFilter} />}

      {visible.length === 0 ? (
        <Reveal>
          <p className="text-sm py-16 text-center" style={{ color: `${DARK}80` }}>
            商品準備中，歡迎透過 LINE 詢問。
          </p>
        </Reveal>
      ) : (
        // keyed by filter so a category switch re-plays the staggered entrance
        <div key={filter} className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-10 sm:gap-x-6">
          {visible.map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} settings={settings} onOpen={openProduct} />
          ))}
        </div>
      )}

      <ProductModal product={selected} open={open} settings={settings} onClose={closeProduct} />
    </section>
  );
});

export const About = memo(function About({ settings }: { settings: SiteSettings }) {
  const [frameRef, inView] = useInView<HTMLDivElement>(0.2);
  const imgRef = useScrollParallax<HTMLDivElement>(0.12);
  return (
    <section
      id="about"
      className="px-6 sm:px-8 md:px-20 lg:px-32 py-24 sm:py-32 grid md:grid-cols-2 gap-10 md:gap-16 items-center overflow-hidden"
      style={{ backgroundColor: '#F4F2EE', color: DARK }}
    >
      <div
        ref={frameRef}
        className="relative w-full aspect-[4/5] rounded-xl overflow-hidden"
        style={{
          clipPath: inView ? 'inset(0% 0% 0% 0% round 12px)' : 'inset(12% 12% 12% 12% round 12px)',
          opacity: inView ? 1 : 0,
          transition: `clip-path 1400ms cubic-bezier(0.76,0,0.24,1), opacity 800ms ease`,
        }}
      >
        {/* oversized inner layer gives the scroll parallax room to travel */}
        <div ref={imgRef} className="absolute -inset-y-[12%] inset-x-0">
          {settings.aboutImage ? (
            <img src={settings.aboutImage} alt={settings.aboutTitle} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full" style={{ backgroundColor: placeholderTone('about') }} />
          )}
        </div>
      </div>
      <div>
        <SectionHeading title={settings.aboutTitle} />
        <Reveal delay={300} variant="up">
          <p className="text-base leading-loose whitespace-pre-line" style={{ color: `${DARK}CC` }}>
            {settings.aboutText}
          </p>
        </Reveal>
      </div>
    </section>
  );
});

export const Contact = memo(function Contact({ settings }: { settings: SiteSettings }) {
  return (
    <section id="contact" className="px-6 sm:px-8 md:px-20 lg:px-32 pt-24 pb-10 text-white overflow-hidden" style={{ backgroundColor: DARK }}>
      <SectionHeading title={settings.contactTitle} intro={settings.contactText} light />
      <Reveal variant="scale" delay={450}>
        <LineButton href={lineLink(settings)} label="加入 LINE 詢問" />
      </Reveal>
      <Reveal variant="fade" delay={600}>
        <p className="mt-24 text-xs tracking-[0.2em] uppercase text-white/40">{settings.footerText}</p>
      </Reveal>
    </section>
  );
});
