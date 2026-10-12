import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Loader } from '@/components/Loader';
import { MobileMenu, Navbar } from '@/components/Navbar';
import { About, Catalog, Contact } from '@/components/Catalog';
import { AuraHero } from '@/components/AuraHero';
import { Story } from '@/components/Story';
import { DEFAULT_SETTINGS, lineLink, listProducts, loadSettings, type Product, type SiteSettings } from '@/lib/content';
import { isPreviewFrame, usePreviewDrafts, type PreviewTarget } from '@/lib/preview';

const Admin = lazy(() => import('@/admin/Admin'));

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
    const ids: Record<PreviewTarget, string> = {
      hero: 'hero', s1: 'story-1', s2: 'story-2', s3: 'story-3', products: 'products', product: 'products', about: 'about', contact: 'contact',
    };
    document.getElementById(ids[target])?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);
  const drafts = usePreviewDrafts(preview, scrollToTarget);
  const settings = drafts.settings ?? savedSettings;
  const products = useMemo(() => {
    const d = drafts.product;
    if (!d) return savedProducts;
    return savedProducts.some((x) => x.id === d.id) ? savedProducts.map((x) => (x.id === d.id ? d : x)) : [...savedProducts, d];
  }, [savedProducts, drafts.product]);

  useEffect(() => {
    document.title = settings.brandName || 'memorycollector';
  }, [settings.brandName]);

  // the upright mark doubles as the favicon
  useEffect(() => {
    const icon = settings.logoMarkUrl || settings.logoUrl;
    if (!icon) return;
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = icon;
  }, [settings.logoMarkUrl, settings.logoUrl]);

  const lineHref = lineLink(settings);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  return (
    <>
      {!preview && <Loader ready={loaded} brandName={settings.brandName} logoUrl={settings.logoUrl} />}
      <div id="top" className="relative">
        <div className="absolute inset-x-0 top-0 z-50 pointer-events-none">
          <Navbar
            isLight={false}
            lineHref={lineHref}
            logoUrl={settings.logoMarkUrl}
            brandName={settings.brandName}
            onOpenMenu={() => setMenuOpen(true)}
          />
        </div>
        {/* key: re-mount when the photo wall or logo changes in the admin preview */}
        {loaded && <AuraHero key={`${settings.heroWall.join('|')}|${settings.logoMarkUrl}`} settings={settings} />}
        {!loaded && <div className="h-[100svh] bg-white" />}
      </div>

      <Story settings={settings} />
      <Catalog settings={settings} products={products} previewProduct={drafts.product} />
      <About settings={settings} />
      <Contact settings={settings} />

      <MobileMenu open={menuOpen} lineHref={lineHref} onClose={closeMenu} />
    </>
  );
}
