import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, X } from 'lucide-react';
import { formatPrice, lineLink, type Product, type SiteSettings } from '@/lib/content';
import { DARK, placeholderTone } from '@/lib/theme';

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
      className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
      style={{ backgroundColor: LINE_GREEN }}
    >
      {label}
      <ArrowRight size={14} />
    </a>
  );
}

function ProductModal({
  product,
  settings,
  onClose,
}: {
  product: Product | null;
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
  return (
    <div
      className="fixed inset-0 z-[90] bg-black/50 flex items-end sm:items-center justify-center sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={product.name}
    >
      <div
        className="bg-white w-full sm:max-w-3xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl grid sm:grid-cols-2"
        onClick={(e) => e.stopPropagation()}
      >
        <ProductImage product={product} className="w-full aspect-square" />
        <div className="relative p-6 sm:p-8 flex flex-col">
          <button
            type="button"
            aria-label="關閉"
            onClick={onClose}
            className="absolute top-4 right-4 w-10 h-10 rounded-full border flex items-center justify-center hover:opacity-70"
            style={{ borderColor: `${DARK}30`, color: DARK }}
          >
            <X size={18} />
          </button>
          <p className="text-xs tracking-[0.3em] uppercase mb-3" style={{ color: `${DARK}90` }}>
            {product.category}
          </p>
          <h3 className="text-2xl font-light pr-12 mb-4" style={{ color: DARK }}>
            {product.name}
          </h3>
          <p className="text-lg mb-6" style={{ color: DARK }}>
            {formatPrice(product.price)}
          </p>
          {product.description && (
            <p className="text-sm leading-relaxed whitespace-pre-line mb-8" style={{ color: `${DARK}CC` }}>
              {product.description}
            </p>
          )}
          <div className="mt-auto">
            <LineButton href={lineLink(settings, product.name)} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function Catalog({ settings, products }: { settings: SiteSettings; products: Product[] }) {
  const [filter, setFilter] = useState<string>('全部');
  const [selected, setSelected] = useState<Product | null>(null);

  const categories = useMemo(() => {
    const used = new Set(products.map((p) => p.category).filter(Boolean));
    const ordered = settings.categories.filter((c) => used.has(c));
    for (const c of used) if (!ordered.includes(c)) ordered.push(c);
    return ['全部', ...ordered];
  }, [products, settings.categories]);

  const visible = filter === '全部' ? products : products.filter((p) => p.category === filter);

  return (
    <section id="products" className="px-6 sm:px-8 md:px-20 lg:px-32 py-24 sm:py-32" style={{ color: DARK }}>
      <h2 className="font-light uppercase tracking-wide mb-4" style={{ fontSize: 'clamp(1.75rem,3.5vw,3rem)' }}>
        {settings.productsTitle}
      </h2>
      <p className="text-sm tracking-wide mb-10 max-w-2xl" style={{ color: `${DARK}90` }}>
        {settings.productsIntro}
      </p>

      {categories.length > 2 && (
        <div className="flex flex-wrap gap-2 mb-10">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setFilter(c)}
              className="px-4 py-2 rounded-full text-xs tracking-[0.15em] border transition-colors"
              style={
                filter === c
                  ? { backgroundColor: DARK, borderColor: DARK, color: '#fff' }
                  : { borderColor: `${DARK}40`, color: DARK }
              }
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <p className="text-sm py-16 text-center" style={{ color: `${DARK}80` }}>
          商品準備中，歡迎透過 LINE 詢問。
        </p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-10 sm:gap-x-6">
          {visible.map((p) => (
            <div
              key={p.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelected(p)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setSelected(p))}
              className="group text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-4 rounded-xl"
            >
              <div className="overflow-hidden rounded-xl mb-4">
                <ProductImage
                  product={p}
                  className="w-full aspect-square transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <p className="text-[11px] tracking-[0.25em] uppercase mb-1" style={{ color: `${DARK}80` }}>
                {p.category}
              </p>
              <h3 className="text-base font-normal mb-1 line-clamp-2">{p.name}</h3>
              <p className="text-sm mb-4" style={{ color: `${DARK}CC` }}>
                {formatPrice(p.price)}
              </p>
              <LineButton href={lineLink(settings, p.name)} />
            </div>
          ))}
        </div>
      )}

      <ProductModal product={selected} settings={settings} onClose={() => setSelected(null)} />
    </section>
  );
}

export function About({ settings }: { settings: SiteSettings }) {
  return (
    <section
      id="about"
      className="px-6 sm:px-8 md:px-20 lg:px-32 py-24 sm:py-32 grid md:grid-cols-2 gap-10 md:gap-16 items-center"
      style={{ backgroundColor: '#F4F2EE', color: DARK }}
    >
      {settings.aboutImage ? (
        <img src={settings.aboutImage} alt={settings.aboutTitle} className="w-full aspect-[4/5] object-cover rounded-xl" />
      ) : (
        <div className="w-full aspect-[4/5] rounded-xl" style={{ backgroundColor: placeholderTone('about') }} />
      )}
      <div>
        <h2 className="font-light uppercase tracking-wide mb-6" style={{ fontSize: 'clamp(1.75rem,3.5vw,3rem)' }}>
          {settings.aboutTitle}
        </h2>
        <p className="text-base leading-loose whitespace-pre-line" style={{ color: `${DARK}CC` }}>
          {settings.aboutText}
        </p>
      </div>
    </section>
  );
}

export function Contact({ settings }: { settings: SiteSettings }) {
  return (
    <section id="contact" className="px-6 sm:px-8 md:px-20 lg:px-32 pt-24 pb-10 text-white" style={{ backgroundColor: DARK }}>
      <h2 className="font-light uppercase tracking-wide mb-6" style={{ fontSize: 'clamp(1.75rem,3.5vw,3rem)' }}>
        {settings.contactTitle}
      </h2>
      <p className="text-base leading-loose text-white/70 max-w-2xl whitespace-pre-line mb-10">{settings.contactText}</p>
      <LineButton href={lineLink(settings)} label="加入 LINE 詢問" />
      <p className="mt-24 text-xs tracking-[0.2em] uppercase text-white/40">{settings.footerText}</p>
    </section>
  );
}
