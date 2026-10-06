import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowDown, ChevronUp, X } from 'lucide-react';
import {
  DEFAULT_SETTINGS,
  deleteProduct,
  formatPrice,
  isDemoMode,
  listProducts,
  loadSettings,
  saveProduct,
  saveProductOrder,
  saveSettings,
  supabase,
  uploadImage,
  type Product,
  type SiteSettings,
} from '@/lib/content';
import { DARK, placeholderTone } from '@/lib/theme';

const errorText = (e: unknown) => (e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e));

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white';
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

function ImageInput({
  value,
  folder,
  onChange,
}: {
  value: string;
  folder: 'products' | 'site';
  onChange: (url: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setErr('');
    try {
      onChange(await uploadImage(file, folder));
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="flex gap-3 items-start">
      <div className="w-24 h-24 shrink-0 rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
        {value && <img src={value} alt="" className="w-full h-full object-cover" />}
      </div>
      <div className="flex-1 space-y-2">
        <input ref={fileRef} type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0])} className="text-sm" />
        <input
          className={inputCls}
          placeholder="或貼上圖片網址"
          value={value.startsWith('data:') ? '（已上傳圖片）' : value}
          onChange={(e) => onChange(e.target.value)}
          readOnly={value.startsWith('data:')}
        />
        <div className="flex gap-3 text-xs">
          {busy && <span className="text-slate-500">上傳中…</span>}
          {value && !busy && (
            <button type="button" className="text-red-600 hover:underline" onClick={() => onChange('')}>
              移除圖片
            </button>
          )}
          {err && <span className="text-red-600">{err}</span>}
        </div>
      </div>
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

const EMPTY_PRODUCT: Product = {
  id: '',
  name: '',
  category: '',
  price: null,
  description: '',
  image_url: '',
  published: true,
  sort_order: 0,
};

function ProductEditor({
  initial,
  categories,
  onCancel,
  onSaved,
}: {
  initial: Product;
  categories: string[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [p, setP] = useState<Product>(initial);
  const [priceText, setPriceText] = useState(initial.price === null ? '' : String(initial.price));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = <K extends keyof Product>(k: K, v: Product[K]) => setP((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = priceText.trim();
    const price = trimmed === '' ? null : Number(trimmed);
    if (price !== null && (!Number.isInteger(price) || price < 0)) {
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
      await saveProduct({ ...p, name: p.name.trim(), price });
      onSaved();
    } catch (e) {
      setErr(errorText(e));
      setBusy(false);
    }
  };

  const categoryOptions = p.category && !categories.includes(p.category) ? [...categories, p.category] : categories;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center sm:p-6" onClick={onCancel}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full sm:max-w-xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-6 space-y-4"
      >
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
        <Field label="商品照片">
          <ImageInput value={p.image_url} folder="products" onChange={(v) => set('image_url', v)} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={p.published} onChange={(e) => set('published', e.target.checked)} />
          上架（顯示在網站上）
        </label>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className={btnGhost} onClick={onCancel}>
            取消
          </button>
          <button type="submit" disabled={busy} className={btnPrimary} style={{ backgroundColor: DARK }}>
            {busy ? '儲存中…' : '儲存'}
          </button>
        </div>
      </form>
    </div>
  );
}

function ProductsTab({ categories }: { categories: string[] }) {
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

  const add = () => setEditing({ ...EMPTY_PRODUCT, category: categories[0] ?? '', sort_order: (items?.length ?? 0) + 1 });

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
            <div className="w-14 h-14 shrink-0 rounded-lg overflow-hidden" style={{ backgroundColor: placeholderTone(p.category || p.name) }}>
              {p.image_url && <img src={p.image_url} alt="" className="w-full h-full object-cover" />}
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
          categories={categories}
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

const SETTING_GROUPS: { title: string; fields: { key: TextKey; label: string; hint?: string; multiline?: boolean }[] }[] = [
  {
    title: '品牌與 LINE',
    fields: [
      { key: 'brandName', label: '品牌名稱', hint: '顯示在瀏覽器分頁標題' },
      { key: 'lineId', label: 'LINE 官方帳號 ID', hint: '例如 @abc1234。有填時，客人按「LINE 詢問」會自動帶入商品名稱' },
      { key: 'lineUrl', label: 'LINE 加好友連結', hint: '例如 https://lin.ee/xxxx（沒填官方帳號 ID 時使用）' },
    ],
  },
  {
    title: '首頁影片',
    fields: [{ key: 'videoUrl', label: '背景影片網址（mp4）', hint: '需允許跨網域 (CORS) 才能逐格順暢捲動；否則會自動改用一般影片模式' }],
  },
  {
    title: '首頁第一段',
    fields: [
      { key: 'heroTitle', label: '大標題' },
      { key: 'heroSubtitle', label: '副標題' },
    ],
  },
  {
    title: '首頁第二段',
    fields: [
      { key: 's2Lead', label: '前段文字' },
      { key: 's2Accent1', label: '強調文字 1（80% 深藍）' },
      { key: 's2Accent2', label: '強調文字 2（50% 深藍）' },
    ],
  },
  {
    title: '首頁第三段',
    fields: [
      { key: 's3Eyebrow', label: '小標' },
      { key: 's3Line1', label: '標題第一行' },
      { key: 's3Line2', label: '標題第二行' },
      { key: 's3Cta', label: '按鈕文字' },
    ],
  },
  {
    title: '商品區',
    fields: [
      { key: 'productsTitle', label: '標題' },
      { key: 'productsIntro', label: '說明', multiline: true },
    ],
  },
  {
    title: '品牌故事',
    fields: [
      { key: 'aboutTitle', label: '標題' },
      { key: 'aboutText', label: '內容', multiline: true },
    ],
  },
  {
    title: '聯絡區與頁尾',
    fields: [
      { key: 'contactTitle', label: '標題' },
      { key: 'contactText', label: '內容', multiline: true },
      { key: 'footerText', label: '頁尾文字' },
    ],
  },
];

function SettingsTab({ settings, onSaved }: { settings: SiteSettings; onSaved: (s: SiteSettings) => void }) {
  const [s, setS] = useState(settings);
  const [categoriesText, setCategoriesText] = useState(settings.categories.join('、'));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = <K extends keyof SiteSettings>(k: K, v: SiteSettings[K]) => setS((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const categories = categoriesText
      .split(/[、,，\n]/)
      .map((c) => c.trim())
      .filter((c, i, arr) => c && arr.indexOf(c) === i);
    const next = { ...s, categories, videoUrl: s.videoUrl.trim() || DEFAULT_SETTINGS.videoUrl };
    setBusy(true);
    setMsg(null);
    try {
      await saveSettings(next);
      setS(next);
      onSaved(next);
      setMsg({ ok: true, text: '已儲存，重新整理網站即可看到變更。' });
    } catch (e) {
      setMsg({ ok: false, text: errorText(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      {SETTING_GROUPS.map((g) => (
        <fieldset key={g.title} className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <legend className="text-sm font-semibold px-1">{g.title}</legend>
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
            <Field label="品牌故事照片">
              <ImageInput value={s.aboutImage} folder="site" onChange={(v) => set('aboutImage', v)} />
            </Field>
          )}
        </fieldset>
      ))}
      <div className="sticky bottom-0 bg-slate-50/95 py-4 flex items-center gap-4">
        <button type="submit" disabled={busy} className={btnPrimary} style={{ backgroundColor: DARK }}>
          {busy ? '儲存中…' : '儲存主頁內容'}
        </button>
        {msg && <span className={`text-sm ${msg.ok ? 'text-green-700' : 'text-red-600'}`}>{msg.text}</span>}
      </div>
    </form>
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
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <h1 className="font-medium">後台管理</h1>
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
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex gap-6 text-sm">
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

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {isDemoMode && (
          <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            示範模式：尚未設定 Supabase，資料只會存在<strong>這台電腦的瀏覽器</strong>，其他人看不到。正式上線前請依 README 設定 Supabase。
          </div>
        )}
        {loadErr && <p className="text-sm text-red-600 mb-4">{loadErr}</p>}
        {!settings ? (
          !loadErr && <p className="text-sm text-slate-500">載入中…</p>
        ) : tab === 'products' ? (
          <ProductsTab categories={settings.categories} />
        ) : (
          <SettingsTab settings={settings} onSaved={setSettings} />
        )}
      </main>
    </div>
  );
}
