import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ArrowDown, ArrowRight, ChevronUp } from 'lucide-react';
import { useVideoScrub } from '@/useVideoScrub';
import { Stagger } from '@/components/Stagger';
import { SplitReveal } from '@/components/Reveal';
import { Loader } from '@/components/Loader';
import { usePointerParallax } from '@/lib/motion';
import { MobileMenu, Navbar } from '@/components/Navbar';
import { About, Catalog, Contact } from '@/components/Catalog';
import { DEFAULT_SETTINGS, lineLink, listProducts, loadSettings, type Product, type SiteSettings } from '@/lib/content';
import { DARK } from '@/lib/theme';
import { isPreviewFrame, usePreviewDrafts, type PreviewTarget } from '@/lib/preview';

const Admin = lazy(() => import('@/admin/Admin'));

const s1Opacity = (p: number) => (p < 0.2 ? 1 : Math.max(0, 1 - (p - 0.2) / 0.08));
const s2Opacity = (p: number) =>
  p < 0.32 ? 0 : p < 0.4 ? (p - 0.32) / 0.08 : p < 0.55 ? 1 : Math.max(0, 1 - (p - 0.55) / 0.08);
const s3Opacity = (p: number) => (p < 0.67 ? 0 : p < 0.75 ? (p - 0.67) / 0.08 : 1);

const isAdminRoute = () => window.location.hash.startsWith('#/admin');

export default function App() {
  const [admin, setAdmin] = useState(isAdminRoute);
  useEffect(() => {
    const onHash = () => setAdmin(isAdminRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (admin) {
    return (
      <Suspense fallback={<div className="p-10 text-sm">載入後台中…</div>}>
        <Admin />
      </Suspense>
    );
  }
  return <Site />;
}

function Site() {
  const [savedSettings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [savedProducts, setProducts] = useState<Product[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  // inside the admin's live-preview iframe, unsaved drafts override what is stored
  const [preview] = useState(isPreviewFrame);

  useEffect(() => {
    loadSettings()
      .then(setSettings)
      .catch((e) => console.error('載入主頁內容失敗', e))
      .finally(() => setLoaded(true));
    listProducts()
      .then(setProducts)
      .catch((e) => console.error('載入商品失敗', e));
  }, []);

  const scrollToTarget = useCallback((target: PreviewTarget) => {
    const el = document.getElementById('top');
    const progress = { hero: 0.04, s2: 0.47, s3: 0.86 } as Record<string, number>;
    if (target in progress && el) {
      window.scrollTo({ top: el.offsetTop + progress[target] * (el.offsetHeight - window.innerHeight), behavior: 'smooth' });
      return;
    }
    const id = target === 'product' ? 'products' : target;
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);
  const drafts = usePreviewDrafts(preview, scrollToTarget);
  const settings = drafts.settings ?? savedSettings;
  const products = useMemo(() => {
    const d = drafts.product;
    if (!d) return savedProducts;
    return savedProducts.some((x) => x.id === d.id) ? savedProducts.map((x) => (x.id === d.id ? d : x)) : [...savedProducts, d];
  }, [savedProducts, drafts.product]);

  useEffect(() => {
    document.title = settings.brandName || 'Scroll Tied Video Section';
  }, [settings.brandName]);

  // Logo doubles as the favicon
  useEffect(() => {
    if (!settings.logoUrl) return;
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = settings.logoUrl;
  }, [settings.logoUrl]);

  // Wait for settings so a custom video URL from the admin isn't preceded by a download of the default one.
  const { containerRef, videoRef, canvasRef, scrollProgress: p, canvasLive } = useVideoScrub(
    loaded ? settings.videoUrl : '',
  );

  const o1 = s1Opacity(p);
  const o2 = s2Opacity(p);
  const o3 = s3Opacity(p);
  const lineHref = lineLink(settings);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const scrollToProgress = (target: number) => {
    const el = containerRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + target * (el.offsetHeight - window.innerHeight), behavior: 'smooth' });
  };

  const interactive = (o: number) => (o > 0.3 ? 'pointer-events-auto' : 'pointer-events-none');
  const pointerRef = usePointerParallax<HTMLDivElement>();

  // Parallax: each layer drifts with the pointer (depth px) and with scroll inside its section.
  const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
  const k1 = clamp01(p / 0.28);
  const k2 = clamp01((p - 0.32) / 0.31);
  const k3 = clamp01((p - 0.67) / 0.33);
  const layer = (px: number, dy = 0, dx = 0, extra = ''): CSSProperties => ({
    transform: `translate3d(calc(var(--mx, 0) * ${px}px + ${dx.toFixed(1)}px), calc(var(--my, 0) * ${px}px + ${dy.toFixed(1)}px), 0) ${extra}`,
    willChange: 'transform',
  });

  return (
    <>
      {!preview && <Loader ready={loaded} brandName={settings.brandName} logoUrl={settings.logoUrl} />}
      <div id="top" ref={containerRef} className="relative h-[500vh]">
        <div ref={pointerRef} className="sticky top-0 w-full h-screen overflow-hidden" style={{ backgroundColor: '#F4F1EA' }}>
          {/* background plane: deepest parallax layer, slow push-in with scroll */}
          <div className="absolute inset-0" style={layer(-14, 0, 0, `scale(${(1.05 + p * 0.06).toFixed(4)})`)}>
            {loaded && (
              <video
                ref={videoRef}
                src={settings.videoUrl}
                muted
                playsInline
                preload="auto"
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}
            <canvas
              ref={canvasRef}
              width={1920}
              height={1080}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
                canvasLive ? 'opacity-100' : 'opacity-0'
              }`}
            />
          </div>

          <div className="absolute inset-0 pointer-events-none">
            <Navbar
              isLight={p > 0.55}
              lineHref={lineHref}
              logoUrl={settings.logoUrl}
              logoInvert={settings.logoInvert}
              brandName={settings.brandName}
              onOpenMenu={() => setMenuOpen(true)}
            />

            {/* Section 1 */}
            <div
              className="absolute inset-0 flex items-center px-6 sm:px-8 md:px-20 lg:px-32"
              style={{ opacity: o1, transition: 'opacity 0.1s ease-out' }}
            >
              <div>
                <div style={layer(22, -k1 * 110)}>
                  <SplitReveal
                    as="h1"
                    text={settings.heroTitle}
                    show={o1 > 0.3}
                    stagger={38}
                    className="block font-light uppercase leading-[1.2]"
                    style={{ fontSize: 'clamp(2rem,5vw,5rem)', color: DARK }}
                  />
                </div>
                <div style={layer(12, -k1 * 50)}>
                  <Stagger visible={o1 > 0.3} delay={450}>
                    <p className="mt-6 text-sm tracking-[0.3em] uppercase" style={{ color: `${DARK}90` }}>
                      {settings.heroSubtitle}
                    </p>
                  </Stagger>
                </div>
              </div>
              <div className="absolute bottom-12 right-6 sm:right-8 md:right-12" style={layer(6)}>
                <Stagger visible={o1 > 0.3} delay={650}>
                  <a
                    href="#products"
                    aria-label={settings.productsTitle}
                    className={`group w-12 h-12 rounded-full border flex items-center justify-center hover:opacity-70 transition-opacity ${interactive(o1)}`}
                    style={{ borderColor: `${DARK}80`, color: DARK }}
                  >
                    <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" />
                  </a>
                </Stagger>
              </div>
            </div>

            {/* Section 2 */}
            <div
              className="absolute inset-0 flex items-center justify-center px-6 sm:px-8"
              style={{ opacity: o2, transition: 'opacity 0.1s ease-out' }}
            >
              <div className="max-w-[900px]" style={layer(18, (0.5 - k2) * 90, 0, `scale(${(0.96 + k2 * 0.08).toFixed(4)})`)}>
                <h2
                  className="font-extralight tracking-wide leading-[1.3] text-center uppercase"
                  style={{ fontSize: 'clamp(1.5rem,4.5vw,4.5rem)', color: DARK }}
                >
                  <SplitReveal text={settings.s2Lead} show={o2 > 0.3} stagger={28} />
                  <SplitReveal
                    text={settings.s2Accent1}
                    show={o2 > 0.3}
                    stagger={28}
                    delay={settings.s2Lead.length * 28}
                    style={{ color: `${DARK}CC`, position: 'relative', top: `${((0.5 - k2) * 26).toFixed(1)}px` }}
                  />{' '}
                  <SplitReveal
                    text={settings.s2Accent2}
                    show={o2 > 0.3}
                    stagger={28}
                    delay={(settings.s2Lead.length + settings.s2Accent1.length) * 28}
                    style={{ color: `${DARK}80`, position: 'relative', top: `${((0.5 - k2) * 52).toFixed(1)}px` }}
                  />
                </h2>
              </div>
              <div className="absolute bottom-16 right-6 sm:right-8 md:right-12 flex flex-col items-center gap-4" style={layer(8)}>
                <Stagger visible={o2 > 0.3} delay={200}>
                  <button
                    type="button"
                    aria-label="下一段"
                    onClick={() => scrollToProgress(0.76)}
                    className={`w-12 h-12 rounded-full border flex items-center justify-center hover:opacity-70 transition-opacity ${interactive(o2)}`}
                    style={{ borderColor: `${DARK}66`, color: DARK }}
                  >
                    <ArrowDown size={18} className="animate-bounce" style={{ animationDuration: '2s' }} />
                  </button>
                </Stagger>
                <Stagger visible={o2 > 0.3} delay={350} className="mt-4 flex flex-col items-center gap-2">
                  <span className="block w-2 h-2 rounded-full" style={{ backgroundColor: DARK }} />
                  <span className="block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: `${DARK}66` }} />
                  <span className="block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: `${DARK}66` }} />
                </Stagger>
                <Stagger visible={o2 > 0.3} delay={500} className="mt-2">
                  <button
                    type="button"
                    aria-label="回到頂端"
                    onClick={() => scrollToProgress(0)}
                    className={`w-10 h-10 rounded-full border flex items-center justify-center hover:opacity-70 transition-opacity ${interactive(o2)}`}
                    style={{ borderColor: `${DARK}4D`, color: `${DARK}CC` }}
                  >
                    <ChevronUp size={16} />
                  </button>
                </Stagger>
              </div>
            </div>

            {/* Section 3 */}
            <div
              className="absolute inset-0 flex items-center justify-end px-6 sm:px-8 md:px-20 lg:px-32"
              style={{ opacity: o3, transition: 'opacity 0.1s ease-out' }}
            >
              <div className="max-w-2xl text-left">
                <div style={layer(10, 0, (1 - k3) * 40)}>
                  <Stagger visible={o3 > 0.3} delay={0}>
                    <p className="text-white/60 text-lg tracking-wide mb-4">{settings.s3Eyebrow}</p>
                  </Stagger>
                </div>
                <h2
                  className="font-light text-white leading-[1.2] uppercase tracking-wide mb-8"
                  style={{ fontSize: 'clamp(2rem,4vw,4rem)' }}
                >
                  <span className="block" style={layer(20, 0, (1 - k3) * 80)}>
                    <SplitReveal text={settings.s3Line1} show={o3 > 0.3} stagger={40} delay={150} />
                  </span>
                  <span className="block" style={layer(28, 0, (1 - k3) * 140)}>
                    <SplitReveal
                      text={settings.s3Line2}
                      show={o3 > 0.3}
                      stagger={40}
                      delay={150 + settings.s3Line1.length * 40}
                    />
                  </span>
                </h2>
                <div style={layer(8)}>
                  <Stagger visible={o3 > 0.3} delay={500}>
                    <a
                      href={lineHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`group inline-flex items-center gap-4 ${interactive(o3)}`}
                    >
                      <span className="relative text-sm tracking-[0.3em] text-white/80 uppercase">
                        {settings.s3Cta}
                        <span className="absolute left-0 -bottom-1 h-px w-full bg-white/70 origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
                      </span>
                      <span className="w-10 h-10 rounded-full bg-white flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                        <ArrowRight size={16} className="text-gray-800" />
                      </span>
                    </a>
                  </Stagger>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Catalog settings={settings} products={products} previewProduct={drafts.product} />
      <About settings={settings} />
      <Contact settings={settings} />

      <MobileMenu open={menuOpen} lineHref={lineHref} onClose={closeMenu} />
    </>
  );
}
