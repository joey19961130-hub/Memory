import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowDown, ChevronUp, ExternalLink, Monitor, Smartphone, X } from 'lucide-react';
import {
  deleteProduct,
  formatPrice,
  isDemoMode,
  listProducts,
  loadSettings,
  saveProduct,
  saveProductOrder,
  saveSettings,
  supabase,
  type Product,
  type SiteSettings,
} from '@/lib/content';
import { DARK, placeholderTone } from '@/lib/theme';
import { GalleryInput, ImageInput, errorText, inputCls } from '@/admin/Uploads';
import type { PreviewMessage, PreviewTarget } from '@/lib/preview';

const btnPrimary =
  'rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 hover:opacity-90 transition-opacity';
const btnGhost = 'rounded-lg px-3 py-2 text-sm border border-slate-300 hover:bg-slate-100 disabled:opacity-40';

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium mb-1">{label}</span>
      {children}
      {hint && <span className="block text-xs text-slate-500 mt-1">{hint}</span>}
    </label>
  );
}

/** Like Field but not a <label>, for upload widgets (a label would forward clicks to the first input). */
function Block({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <span className="block text-sm font-medium mb-1">{label}</span>
      {children}
      {hint && <span className="block text-xs text-slate-500 mt-1">{hint}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Login({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setErr('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setErr(error.message === 'Invalid login credentials' ? '帳號或密碼錯誤' : error.message);
    else onDone();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
      <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-slate-200 p-8 space-y-4">
        <h1 className="text-xl font-medium">後台登入</h1>
        <Field label="Email">
          <input className={inputCls} type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="密碼">
          <input className={inputCls} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button type="submit" disabled={busy} className={`${btnPrimary} w-full`} style={{ backgroundColor: DARK }}>
          {busy ? '登入中…' : '登入'}
        </button>
        <a href="#" className="block text-center text-xs text-slate-500 hover:underline">
          ← 回到網站
        </a>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Live preview: the real site in an iframe, fed unsaved drafts via postMessage.

function LivePreview({
  settings,
  product,
  target,
  reloadKey,
}: {
  settings: SiteSettings;
  product?: Product | null;
  target: PreviewTarget;
  reloadKey: number;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [ready, setReady] = useState(false);
  const [boxW, setBoxW] = useState(480);
  const size = device === 'desktop' ? { w: 1280, h: 800 } : { w: 390, h: 760 };
  const scale = Math.min(1, boxW / size.w);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBoxW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const post = useCallback((msg: PreviewMessage) => {
    frameRef.current?.contentWindow?.postMessage(msg, window.location.origin);
  }, []);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin === window.location.origin && e.data?.type === 'preview-ready') setReady(true);
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  // debounce drafts so typing stays smooth
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => post({ type: 'preview-settings', settings, product: product ?? null }), 120);
    return () => clearTimeout(t);
  }, [ready, settings, product, post]);

  useEffect(() => {
    if (ready) post({ type: 'preview-scroll', target });
  }, [ready, target, post, device]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-600">即時預覽（尚未儲存的內容）</span>
        <div className="flex items-center gap-1">
          {(
            [
              ['desktop', Monitor, '電腦'],
              ['mobile', Smartphone, '手機'],
            ] as const
          ).map(([d, Icon, label]) => (
            <button
              key={d}
              type="button"
              aria-label={`${label}預覽`}
              aria-pressed={device === d}
              onClick={() => {
                setReady(false);
                setDevice(d);
              }}
              className={`p-1.5 rounded ${device === d ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
            >
              <Icon size={14} />
            </button>
          ))}
          <a href="#" target="_blank" rel="noopener" className="p-1.5 text-slate-500 hover:bg-slate-100 rounded" aria-label="在新分頁開啟網站">
            <ExternalLink size={14} />
          </a>
        </div>
      </div>
      <div ref={boxRef} className="w-full flex justify-center">
        <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50" style={{ width: size.w * scale, height: size.h * scale }}>
          <iframe
            key={`${device}-${reloadKey}`}
            ref={frameRef}
            title="網站預覽"
            src="#/preview"
            className="absolute top-0 left-0 origin-top-left"
            style={{ width: size.w, height: size.h, transform: `scale(${scale})`, border: 0 }}
          />
          {!ready && <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-400">載入預覽…</div>}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

const EMPTY_PRODUCT: Product = {
  id: '',
  name: '',
  category: '',
  price: null,
  description: '',
  image_url: '',
  images: [],
  published: true,
  sort_order: 0,
};

function ProductEditor({
  initial,
  settings,
  onCancel,
  onSaved,
}: {
  initial: Product;
  settings: SiteSettings;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [p, setP] = useState<Product>(initial);
  const [priceText, setPriceText] = useState(initial.price === null ? '' : String(initial.price));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = <K extends keyof Product>(k: K, v: Product[K]) => setP((prev) => ({ ...prev, [k]: v }));
  const categories = settings.categories;

  const parsedPrice = priceText.trim() === '' ? null : Number(priceText.trim());
  const draft: Product = {
    ...p,
    id: p.id || 'draft',
    price: parsedPrice !== null && Number.isInteger(parsedPrice) && parsedPrice >= 0 ? parsedPrice : null,
    image_url: p.images[0] ?? '',
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (parsedPrice !== null && (!Number.isInteger(parsedPrice) || parsedPrice < 0)) {
      setErr('價格請填 0 以上的整數，或留白表示「價格請洽詢」');
      return;
    }
    if (!p.name.trim()) {
      setErr('請填寫商品名稱');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      await saveProduct({ ...p, name: p.name.trim(), price: parsedPrice });
      onSaved();
    } catch (e) {
      setErr(errorText(e));
      setBusy(false);
    }
  };

  const categoryOptions = p.category && !categories.includes(p.category) ? [...categories, p.category] : categories;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center sm:p-6" onClick={onCancel}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-5xl max-h-[94vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl grid lg:grid-cols-[1fr_400px]"
      >
        <form onSubmit={submit} className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">{initial.id ? '編輯商品' : '新增商品'}</h2>
            <button type="button" onClick={onCancel} aria-label="關閉" className="p-1">
              <X size={18} />
            </button>
          </div>
          <Field label="商品名稱 *">
            <input className={inputCls} value={p.name} onChange={(e) => set('name', e.target.value)} required />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="分類" hint="分類清單可在「主頁內容」修改">
              <select className={inputCls} value={p.category} onChange={(e) => set('category', e.target.value)}>
                <option value="">（未分類）</option>
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="價格（NT$）" hint="留白 = 價格請洽詢">
              <input className={inputCls} inputMode="numeric" value={priceText} onChange={(e) => setPriceText(e.target.value)} />
            </Field>
          </div>
          <Field label="商品說明">
            <textarea className={`${inputCls} min-h-[100px]`} value={p.description} onChange={(e) => set('description', e.target.value)} />
          </Field>
          <Block label={`商品照片（${p.images.length} 張）`}>
            <GalleryInput value={p.images} onChange={(v) => set('images', v)} />
          </Block>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={p.published} onChange={(e) => set('published', e.target.checked)} />
            上架（顯示在網站上）
          </label>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <div className="flex justify-end gap-2 pt-2 sticky bottom-0 bg-white pb-1">
            <button type="button" className={btnGhost} onClick={onCancel}>
              取消
            </button>
            <button type="submit" disabled={busy} className={btnPrimary} style={{ backgroundColor: DARK }}>
              {busy ? '儲存中…' : '儲存'}
            </button>
          </div>
        </form>
        <div className="hidden lg:block bg-slate-50 border-l border-slate-200 p-4">
          <LivePreview settings={settings} product={draft} target="product" reloadKey={0} />
          <p className="text-xs text-slate-500 mt-2">預覽會打開這件商品的詳細視窗，照片可左右切換。</p>
        </div>
      </div>
    </div>
  );
}

function ProductsTab({ settings }: { settings: SiteSettings }) {
  const [items, setItems] = useState<Product[] | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [err, setErr] = useState('');

  const refresh = useCallback(() => {
    listProducts(true)
      .then(setItems)
      .catch((e) => setErr(errorText(e)));
  }, []);
  useEffect(refresh, [refresh]);

  const run = async (fn: () => Promise<void>) => {
    setErr('');
    try {
      await fn();
    } catch (e) {
      setErr(errorText(e));
    }
    refresh();
  };

  const move = (i: number, dir: -1 | 1) => {
    if (!items) return;
    const next = [...items];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setItems(next);
    run(() => saveProductOrder(next));
  };

  const add = () =>
    setEditing({ ...EMPTY_PRODUCT, category: settings.categories[0] ?? '', sort_order: (items?.length ?? 0) + 1 });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">{items ? `共 ${items.length} 件商品` : '載入中…'}</p>
        <button type="button" onClick={add} className={btnPrimary} style={{ backgroundColor: DARK }}>
          ＋ 新增商品
        </button>
      </div>
      {err && <p className="text-sm text-red-600 mb-4">{err}</p>}
      <ul className="divide-y divide-slate-200 bg-white rounded-xl border border-slate-200">
        {items?.map((p, i) => (
          <li key={p.id} className="flex items-center gap-3 p-3">
            <div className="relative w-14 h-14 shrink-0 rounded-lg overflow-hidden" style={{ backgroundColor: placeholderTone(p.category || p.name) }}>
              {p.image_url && <img src={p.image_url} alt="" className="w-full h-full object-cover" />}
              {p.images.length > 1 && (
                <span className="absolute bottom-0.5 right-0.5 rounded bg-black/60 text-white text-[9px] px-1">{p.images.length}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {p.name}
                {!p.published && <span className="ml-2 text-xs rounded bg-slate-200 px-1.5 py-0.5 text-slate-600">已下架</span>}
              </p>
              <p className="text-xs text-slate-500">
                {p.category || '未分類'} · {formatPrice(p.price)}
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-1">
              <button type="button" aria-label="上移" className={btnGhost} disabled={i === 0} onClick={() => move(i, -1)}>
                <ChevronUp size={14} />
              </button>
              <button type="button" aria-label="下移" className={btnGhost} disabled={i === items.length - 1} onClick={() => move(i, 1)}>
                <ArrowDown size={14} />
              </button>
              <button type="button" className={btnGhost} onClick={() => run(() => saveProduct({ ...p, published: !p.published }).then(() => undefined))}>
                {p.published ? '下架' : '上架'}
              </button>
              <button type="button" className={btnGhost} onClick={() => setEditing(p)}>
                編輯
              </button>
              <button
                type="button"
                className={`${btnGhost} text-red-600`}
                onClick={() => window.confirm(`確定刪除「${p.name}」？`) && run(() => deleteProduct(p.id))}
              >
                刪除
              </button>
            </div>
          </li>
        ))}
        {items?.length === 0 && <li className="p-6 text-center text-sm text-slate-500">還沒有商品，按「新增商品」開始。</li>}
      </ul>
      {editing && (
        <ProductEditor
          initial={editing}
          settings={settings}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

type TextKey = { [K in keyof SiteSettings]: SiteSettings[K] extends string ? K : never }[keyof SiteSettings];

const SETTING_GROUPS: {
  title: string;
  target: PreviewTarget;
  fields: { key: TextKey; label: string; hint?: string; multiline?: boolean }[];
}[] = [
  {
    title: '品牌與 LINE',
    target: 'hero',
    fields: [
      { key: 'brandName', label: '品牌名稱', hint: '顯示在載入畫面與瀏覽器分頁標題' },
      { key: 'lineId', label: 'LINE 官方帳號 ID', hint: '例如 @abc1234。有填時，客人按「LINE 詢問」會自動帶入商品名稱' },
      { key: 'lineUrl', label: 'LINE 加好友連結', hint: '例如 https://lin.ee/xxxx（沒填官方帳號 ID 時使用）' },
    ],
  },
  { title: '首頁照片牆與互動', target: 'hero', fields: [{ key: 'heroHint', label: '互動提示文字', hint: '顯示在首頁下方，引導訪客把光暈移到 Logo' }] },
  {
    title: '首頁第一段',
    target: 's1',
    fields: [
      { key: 'heroTitle', label: '大標題' },
      { key: 'heroSubtitle', label: '副標題' },
    ],
  },
  {
    title: '首頁第二段',
    target: 's2',
    fields: [
      { key: 's2Lead', label: '前段文字' },
      { key: 's2Accent1', label: '強調文字 1（80% 深藍）' },
      { key: 's2Accent2', label: '強調文字 2（50% 深藍）' },
    ],
  },
  {
    title: '首頁第三段',
    target: 's3',
    fields: [
      { key: 's3Eyebrow', label: '小標' },
      { key: 's3Line1', label: '標題第一行' },
      { key: 's3Line2', label: '標題第二行' },
      { key: 's3Cta', label: '按鈕文字' },
    ],
  },
  {
    title: '商品區',
    target: 'products',
    fields: [
      { key: 'productsTitle', label: '標題' },
      { key: 'productsIntro', label: '說明', multiline: true },
    ],
  },
  {
    title: '品牌故事',
    target: 'about',
    fields: [
      { key: 'aboutTitle', label: '標題' },
      { key: 'aboutText', label: '內容', multiline: true },
    ],
  },
  {
    title: '聯絡區與頁尾',
    target: 'contact',
    fields: [
      { key: 'contactTitle', label: '標題' },
      { key: 'contactText', label: '內容', multiline: true },
      { key: 'footerText', label: '頁尾文字' },
    ],
  },
];

const parseCategories = (text: string) =>
  text
    .split(/[、,，\n]/)
    .map((c) => c.trim())
    .filter((c, i, arr) => c && arr.indexOf(c) === i);

function SettingsTab({ settings, onSaved }: { settings: SiteSettings; onSaved: (s: SiteSettings) => void }) {
  const [s, setS] = useState(settings);
  const [categoriesText, setCategoriesText] = useState(settings.categories.join('、'));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [target, setTarget] = useState<PreviewTarget>('hero');
  const set = <K extends keyof SiteSettings>(k: K, v: SiteSettings[K]) => {
    setS((prev) => ({ ...prev, [k]: v }));
    setMsg(null);
  };
  const dirty = JSON.stringify({ ...s, categories: parseCategories(categoriesText) }) !== JSON.stringify(settings);
  const draft = { ...s, categories: parseCategories(categoriesText) };

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next = { ...draft };
    setBusy(true);
    setMsg(null);
    try {
      await saveSettings(next);
      setS(next);
      onSaved(next);
      setMsg({ ok: true, text: '已儲存，網站已同步更新。' });
    } catch (e) {
      setMsg({ ok: false, text: errorText(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid xl:grid-cols-[1fr_520px] gap-6 items-start">
      <form onSubmit={submit} className="space-y-6 min-w-0">
        {SETTING_GROUPS.map((g) => (
          <fieldset
            key={g.title}
            onFocusCapture={() => setTarget(g.target)}
            onPointerEnter={() => setTarget(g.target)}
            className="bg-white rounded-xl border border-slate-200 p-5 space-y-4"
          >
            <legend className="text-sm font-semibold px-1">{g.title}</legend>
            {g.title === '品牌與 LINE' && (
              <>
                <Block label="完整 Logo（圖形＋文字）" hint="顯示在導覽列與載入畫面。建議透明背景 SVG 或 PNG">
                  <ImageInput value={s.logoUrl} folder="logo" onChange={(v) => set('logoUrl', v)} checker />
                </Block>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Block label="Logo 圖形（直立）" hint="首頁中央的水滴；吸入光暈時會轉成橫向（鼻子）。也是瀏覽器分頁圖示">
                    <ImageInput value={s.logoMarkUrl} folder="logo" onChange={(v) => set('logoMarkUrl', v)} checker />
                  </Block>
                  <Block label="文字 Logo" hint="首頁圖形下方的品牌字">
                    <ImageInput value={s.logoWordUrl} folder="logo" onChange={(v) => set('logoWordUrl', v)} checker />
                  </Block>
                </div>
              </>
            )}
            {g.title === '首頁照片牆與互動' && (
              <Block label={`首頁照片牆（${s.heroWall.length} 張，建議 6–9 張）`} hint="平常是暗的黑白，光暈經過的地方變彩色；Logo 吸入光暈後整面變全彩">
                <GalleryInput
                  value={s.heroWall}
                  onChange={(v) => set('heroWall', v)}
                  folder="site"
                  label="首頁照片牆（拖曳排序）"
                  hint="可一次拖進多張 · 拖曳縮圖調整位置順序 · 超過 9 張只顯示前 9 張"
                />
              </Block>
            )}
            {g.fields.map((f) => (
              <Field key={f.key} label={f.label} hint={f.hint}>
                {f.multiline ? (
                  <textarea className={`${inputCls} min-h-[90px]`} value={s[f.key]} onChange={(e) => set(f.key, e.target.value)} />
                ) : (
                  <input className={inputCls} value={s[f.key]} onChange={(e) => set(f.key, e.target.value)} />
                )}
              </Field>
            ))}
            {g.title === '商品區' && (
              <Field label="商品分類" hint="用頓號或逗號分隔，例如：吊飾、香氛、包裝、徽章 Pin、娃娃">
                <input className={inputCls} value={categoriesText} onChange={(e) => setCategoriesText(e.target.value)} />
              </Field>
            )}
            {g.title === '品牌故事' && (
              <Block label="品牌故事照片">
                <ImageInput value={s.aboutImage} folder="site" onChange={(v) => set('aboutImage', v)} />
              </Block>
            )}
          </fieldset>
        ))}
        <div className="sticky bottom-0 bg-slate-50/95 backdrop-blur py-4 flex items-center gap-4 z-10">
          <button type="submit" disabled={busy || !dirty} className={btnPrimary} style={{ backgroundColor: DARK }}>
            {busy ? '儲存中…' : dirty ? '儲存主頁內容' : '已是最新'}
          </button>
          {dirty && !msg && <span className="text-sm text-amber-700">有尚未儲存的變更</span>}
          {msg && <span className={`text-sm ${msg.ok ? 'text-green-700' : 'text-red-600'}`}>{msg.text}</span>}
        </div>
      </form>
      <div className="xl:sticky xl:top-4">
        <LivePreview settings={draft} target={target} reloadKey={0} />
        <p className="text-xs text-slate-500 mt-2">滑到或點進左邊的區塊，預覽會自動捲到網站對應的位置。</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

export default function Admin() {
  const [authed, setAuthed] = useState<boolean | null>(isDemoMode ? true : null);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [tab, setTab] = useState<'products' | 'settings'>('products');
  const [loadErr, setLoadErr] = useState('');

  useEffect(() => {
    document.title = '後台管理';
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, session) => setAuthed(!!session));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!authed) return;
    loadSettings()
      .then(setSettings)
      .catch((e) => setLoadErr(errorText(e)));
  }, [authed]);

  if (authed === null) return <div className="p-10 text-sm">載入中…</div>;
  if (!authed) return <Login onDone={() => setAuthed(true)} />;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {settings?.logoUrl && <img src={settings.logoUrl} alt="" className="h-7 w-auto" />}
            <h1 className="font-medium">後台管理</h1>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <a href="#" className="hover:underline">
              查看網站
            </a>
            {supabase && (
              <button type="button" className={btnGhost} onClick={() => supabase!.auth.signOut()}>
                登出
              </button>
            )}
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-6 text-sm">
          {(
            [
              ['products', '商品管理'],
              ['settings', '主頁內容'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`pb-3 border-b-2 ${tab === key ? 'font-medium' : 'border-transparent text-slate-500'}`}
              style={tab === key ? { borderColor: DARK } : undefined}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <main className={`mx-auto px-4 sm:px-6 py-6 ${tab === 'settings' ? 'max-w-7xl' : 'max-w-4xl'}`}>
        {isDemoMode && (
          <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            示範模式：尚未設定 Supabase，資料只會存在<strong>這台電腦的瀏覽器</strong>，其他人看不到。正式上線前請依 README 設定 Supabase。
          </div>
        )}
        {loadErr && <p className="text-sm text-red-600 mb-4">{loadErr}</p>}
        {!settings ? (
          !loadErr && <p className="text-sm text-slate-500">載入中…</p>
        ) : tab === 'products' ? (
          <ProductsTab settings={settings} />
        ) : (
          <SettingsTab settings={settings} onSaved={setSettings} />
        )}
      </main>
    </div>
  );
}
