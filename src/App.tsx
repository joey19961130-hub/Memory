import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowRight, ChevronUp } from 'lucide-react';
import { useVideoScrub } from '@/useVideoScrub';
import { Stagger } from '@/components/Stagger';
import { MobileMenu, Navbar } from '@/components/Navbar';
import { About, Catalog, Contact } from '@/components/Catalog';
import { DEFAULT_SETTINGS, lineLink, listProducts, loadSettings, type Product, type SiteSettings } from '@/lib/content';
import { DARK } from '@/lib/theme';

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
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    loadSettings()
      .then(setSettings)
      .catch((e) => console.error('載入主頁內容失敗', e))
      .finally(() => setLoaded(true));
    listProducts()
      .then(setProducts)
      .catch((e) => console.error('載入商品失敗', e));
  }, []);

  useEffect(() => {
    document.title = settings.brandName || 'Scroll Tied Video Section';
  }, [settings.brandName]);

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

  return (
    <>
      <div id="top" ref={containerRef} className="relative h-[500vh]">
        <div className="sticky top-0 w-full h-screen overflow-hidden">
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

          <div className="absolute inset-0 pointer-events-none">
            <Navbar isLight={p > 0.55} lineHref={lineHref} onOpenMenu={() => setMenuOpen(true)} />

            {/* Section 1 */}
            <div
              className="absolute inset-0 flex items-center px-6 sm:px-8 md:px-20 lg:px-32"
              style={{ opacity: o1, transition: 'opacity 0.1s ease-out' }}
            >
              <div>
                <Stagger visible={o1 > 0.3} delay={0}>
                  <h1
                    className="font-light uppercase leading-[1.2]"
                    style={{ fontSize: 'clamp(2rem,5vw,5rem)', color: DARK }}
                  >
                    {settings.heroTitle}
                  </h1>
                </Stagger>
                <Stagger visible={o1 > 0.3} delay={150}>
                  <p className="mt-6 text-sm tracking-[0.3em] uppercase" style={{ color: `${DARK}90` }}>
                    {settings.heroSubtitle}
                  </p>
                </Stagger>
              </div>
              <Stagger visible={o1 > 0.3} delay={300} className="absolute bottom-12 right-6 sm:right-8 md:right-12">
                <a
                  href="#products"
                  aria-label={settings.productsTitle}
                  className={`w-12 h-12 rounded-full border flex items-center justify-center hover:opacity-70 transition-opacity ${interactive(o1)}`}
                  style={{ borderColor: `${DARK}80`, color: DARK }}
                >
                  <ArrowRight size={18} />
                </a>
              </Stagger>
            </div>

            {/* Section 2 */}
            <div
              className="absolute inset-0 flex items-center justify-center px-6 sm:px-8"
              style={{ opacity: o2, transition: 'opacity 0.1s ease-out' }}
            >
              <Stagger visible={o2 > 0.3} delay={0} className="max-w-[900px]">
                <h2
                  className="font-extralight tracking-wide leading-[1.3] text-center uppercase"
                  style={{ fontSize: 'clamp(1.5rem,4.5vw,4.5rem)', color: DARK }}
                >
                  {settings.s2Lead}
                  <span style={{ color: `${DARK}CC` }}>{settings.s2Accent1}</span>{' '}
                  <span style={{ color: `${DARK}80` }}>{settings.s2Accent2}</span>
                </h2>
              </Stagger>
              <div className="absolute bottom-16 right-6 sm:right-8 md:right-12 flex flex-col items-center gap-4">
                <Stagger visible={o2 > 0.3} delay={200}>
                  <button
                    type="button"
                    aria-label="下一段"
                    onClick={() => scrollToProgress(0.76)}
                    className={`w-12 h-12 rounded-full border flex items-center justify-center hover:opacity-70 transition-opacity ${interactive(o2)}`}
                    style={{ borderColor: `${DARK}66`, color: DARK }}
                  >
                    <ArrowDown size={18} />
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
                <Stagger visible={o3 > 0.3} delay={0}>
                  <p className="text-white/60 text-lg tracking-wide mb-4">{settings.s3Eyebrow}</p>
                </Stagger>
                <Stagger visible={o3 > 0.3} delay={150}>
                  <h2
                    className="font-light text-white leading-[1.2] uppercase tracking-wide mb-8"
                    style={{ fontSize: 'clamp(2rem,4vw,4rem)' }}
                  >
                    {settings.s3Line1}
                    <br />
                    {settings.s3Line2}
                  </h2>
                </Stagger>
                <Stagger visible={o3 > 0.3} delay={300}>
                  <a
                    href={lineHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`group inline-flex items-center gap-4 ${interactive(o3)}`}
                  >
                    <span className="text-sm tracking-[0.3em] text-white/80 uppercase">{settings.s3Cta}</span>
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

      <Catalog settings={settings} products={products} />
      <About settings={settings} />
      <Contact settings={settings} />

      <MobileMenu open={menuOpen} lineHref={lineHref} onClose={closeMenu} />
    </>
  );
}
