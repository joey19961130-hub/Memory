import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface SiteSettings {
  brandName: string;
  /** 完整 Logo（圖形＋文字），顯示在導覽列與載入畫面 */
  logoUrl: string;
  /** Logo 圖形（直立的水滴）。首頁中央會把它轉成橫向（鼻子）吸入光暈；也是瀏覽器分頁圖示 */
  logoMarkUrl: string;
  /** 文字 Logo，顯示在首頁圖形下方 */
  logoWordUrl: string;
  /** 首頁照片牆：平常是暗的黑白，光暈經過處變彩色，Logo 吸入光暈後全部變全彩 */
  heroWall: string[];
  /** 首頁互動提示文字 */
  heroHint: string;
  /** LINE 官方帳號 ID（例如 @abc1234）。有填時，詢問按鈕會自動帶入商品名稱。 */
  lineId: string;
  /** LINE 加好友連結（例如 https://lin.ee/xxxx），沒填 lineId 時使用。 */
  lineUrl: string;
  heroTitle: string;
  heroSubtitle: string;
  s2Lead: string;
  s2Accent1: string;
  s2Accent2: string;
  s3Eyebrow: string;
  s3Line1: string;
  s3Line2: string;
  s3Cta: string;
  productsTitle: string;
  productsIntro: string;
  categories: string[];
  aboutTitle: string;
  aboutText: string;
  aboutImage: string;
  contactTitle: string;
  contactText: string;
  footerText: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  /** 新台幣；null 代表「價格請洽詢」 */
  price: number | null;
  description: string;
  /** 封面照片（= images[0]），保留給舊資料與只需一張圖的地方 */
  image_url: string;
  /** 所有商品照片，第一張為封面 */
  images: string[];
  published: boolean;
  sort_order: number;
}

export const DEFAULT_SETTINGS: SiteSettings = {
  brandName: 'memorycollector',
  logoUrl: 'brand/logo.svg',
  logoMarkUrl: 'brand/mark.svg',
  logoWordUrl: 'brand/wordmark.svg',
  heroWall: [
    'demo/charm-1.webp',
    'demo/sachet-2.webp',
    'demo/box-1.webp',
    'demo/pin-2.webp',
    'demo/bear-1.webp',
    'demo/charm-3.webp',
    'demo/sachet-1.webp',
    'demo/box-2.webp',
    'demo/pin-1.webp',
  ],
  heroHint: '把光帶到中間，讓它聞一聞',
  lineId: '',
  lineUrl: 'https://line.me/',
  heroTitle: '把日常的溫度，做成隨身的小物',
  heroSubtitle: '吊飾・香氛・包裝・徽章・娃娃',
  s2Lead: '每一件作品都從手繪開始 ',
  s2Accent1: '用心打樣',
  s2Accent2: '陪你收藏每個故事',
  s3Eyebrow: 'memorycollector | 文創選物',
  s3Line1: '喜歡哪一件，',
  s3Line2: '直接 LINE 我們。',
  s3Cta: 'LINE 詢問',
  productsTitle: '商品一覽',
  productsIntro: '點選商品即可透過 LINE 詢問庫存、客製與大量訂購。',
  categories: ['吊飾', '香氛', '包裝', '徽章 Pin', '娃娃'],
  aboutTitle: '品牌故事',
  aboutText: '這裡放品牌介紹文字，可以在後台「主頁內容」隨時修改。',
  aboutImage: '',
  contactTitle: '聯絡我們',
  contactText: '商品詢問、客製化與企業大量訂購，歡迎加入 LINE 官方帳號與我們聯繫。',
  footerText: '© memorycollector',
};

export const DEFAULT_PRODUCTS: Product[] = [
  { id: 'demo-1', name: '手繪壓克力吊飾', category: '吊飾', price: 180, description: '雙面印刷壓克力，附金屬扣環。', image_url: 'demo/charm-1.webp', images: ['demo/charm-1.webp', 'demo/charm-2.webp', 'demo/charm-3.webp'], published: true, sort_order: 1 },
  { id: 'demo-2', name: '香氛擴香片', category: '香氛', price: 220, description: '天然精油擴香，掛在衣櫃或車內。', image_url: 'demo/sachet-1.webp', images: ['demo/sachet-1.webp', 'demo/sachet-2.webp', 'demo/sachet-3.webp'], published: true, sort_order: 2 },
  { id: 'demo-3', name: '禮物包裝組', category: '包裝', price: 120, description: '紙盒、緞帶與小卡一組。', image_url: 'demo/box-1.webp', images: ['demo/box-1.webp', 'demo/box-2.webp', 'demo/box-3.webp'], published: true, sort_order: 3 },
  { id: 'demo-4', name: '琺瑯徽章 Pin', category: '徽章 Pin', price: 250, description: '硬琺瑯工藝，附背卡。', image_url: 'demo/pin-1.webp', images: ['demo/pin-1.webp', 'demo/pin-2.webp', 'demo/pin-3.webp'], published: true, sort_order: 4 },
  { id: 'demo-5', name: '療癒絨毛娃娃', category: '娃娃', price: null, description: '可客製服裝與刺繡，價格請洽詢。', image_url: 'demo/bear-1.webp', images: ['demo/bear-1.webp', 'demo/bear-2.webp', 'demo/bear-3.webp'], published: true, sort_order: 5 },
];

// ---------------------------------------------------------------------------

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null;
export const isDemoMode = !supabase;

const BUCKET = 'images';
const LS_SETTINGS = 'demo.settings';
const LS_PRODUCTS = 'demo.products';

function lsGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function lsSet(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    throw new Error('瀏覽器儲存空間不足（示範模式圖片存在瀏覽器內）。請改用較小的圖片或接上 Supabase。');
  }
}

const mergeSettings = (data: Partial<SiteSettings> | null | undefined): SiteSettings => ({
  ...DEFAULT_SETTINGS,
  ...(data ?? {}),
});

/** Fill `images` for rows saved before multi-photo support, and keep image_url = cover. */
export function normalizeProduct(p: Partial<Product> & { id: string; name: string }): Product {
  const images = (p.images?.filter(Boolean) ?? []).length ? p.images!.filter(Boolean) : p.image_url ? [p.image_url] : [];
  return {
    category: '',
    price: null,
    description: '',
    published: true,
    sort_order: 0,
    ...p,
    images,
    image_url: images[0] ?? '',
  };
}

const sortProducts = (list: Product[]) =>
  list.map(normalizeProduct).sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));

export async function loadSettings(): Promise<SiteSettings> {
  if (!supabase) return mergeSettings(lsGet<Partial<SiteSettings>>(LS_SETTINGS));
  const { data, error } = await supabase.from('site_settings').select('data').eq('id', 1).maybeSingle();
  if (error) throw error;
  return mergeSettings(data?.data as Partial<SiteSettings> | undefined);
}

export async function saveSettings(settings: SiteSettings): Promise<void> {
  if (!supabase) return lsSet(LS_SETTINGS, settings);
  const { error } = await supabase
    .from('site_settings')
    .upsert({ id: 1, data: settings, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function listProducts(includeHidden = false): Promise<Product[]> {
  if (!supabase) {
    const list = lsGet<Product[]>(LS_PRODUCTS) ?? DEFAULT_PRODUCTS;
    return sortProducts(includeHidden ? list : list.filter((p) => p.published));
  }
  let q = supabase.from('products').select('id,name,category,price,description,image_url,images,published,sort_order');
  if (!includeHidden) q = q.eq('published', true);
  const { data, error } = await q.order('sort_order', { ascending: true });
  if (error) throw error;
  return sortProducts((data ?? []) as Product[]);
}

export async function saveProduct(input: Product): Promise<Product> {
  const product = normalizeProduct(input);
  if (!supabase) {
    const list = lsGet<Product[]>(LS_PRODUCTS) ?? DEFAULT_PRODUCTS;
    const saved = { ...product, id: product.id || `local-${crypto.randomUUID()}` };
    const idx = list.findIndex((p) => p.id === saved.id);
    const next = idx >= 0 ? list.map((p) => (p.id === saved.id ? saved : p)) : [...list, saved];
    lsSet(LS_PRODUCTS, next);
    return saved;
  }
  const { id, ...fields } = product;
  const query = id
    ? supabase.from('products').update(fields).eq('id', id)
    : supabase.from('products').insert(fields);
  const { data, error } = await query.select().single();
  if (error) throw error;
  return normalizeProduct(data as Product);
}

export async function saveProductOrder(products: Product[]): Promise<void> {
  const ordered = products.map((p, i) => ({ ...p, sort_order: i + 1 }));
  if (!supabase) return lsSet(LS_PRODUCTS, ordered);
  for (const p of ordered) {
    const { error } = await supabase.from('products').update({ sort_order: p.sort_order }).eq('id', p.id);
    if (error) throw error;
  }
}

export async function deleteProduct(id: string): Promise<void> {
  if (!supabase) {
    const list = lsGet<Product[]>(LS_PRODUCTS) ?? DEFAULT_PRODUCTS;
    return lsSet(LS_PRODUCTS, list.filter((p) => p.id !== id));
  }
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw error;
}

/** Resize to fit within maxSize px and re-encode, so uploads stay light. */
async function resizeImage(file: File, maxSize: number, type: string): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('圖片轉檔失敗'))), type, 0.85),
  );
}

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

export type UploadFolder = 'products' | 'site' | 'logo';

const extOf = (type: string) => (type === 'image/svg+xml' ? 'svg' : type.split('/')[1] || 'bin');

async function putFile(blob: Blob, folder: string, contentType: string): Promise<string> {
  if (!supabase) throw new Error('尚未設定 Supabase');
  const path = `${folder}/${crypto.randomUUID()}.${extOf(contentType)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType, cacheControl: '31536000' });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/**
 * Upload an image and return its public URL (demo mode: a data URL).
 * Logos keep transparency (PNG/WebP) and SVGs are stored untouched.
 */
export async function uploadImage(file: File, folder: UploadFolder): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('請選擇圖片檔（JPG、PNG、WebP、SVG）');
  if (file.size > 20 * 1024 * 1024) throw new Error('圖片超過 20MB，請先縮小');
  if (file.type === 'image/svg+xml') {
    return supabase ? putFile(file, folder, file.type) : blobToDataUrl(file);
  }
  const isLogo = folder === 'logo';
  if (!supabase) {
    return blobToDataUrl(await resizeImage(file, isLogo ? 400 : 800, isLogo ? 'image/png' : 'image/jpeg'));
  }
  const blob = await resizeImage(file, isLogo ? 800 : 1600, 'image/webp');
  return putFile(blob, folder, 'image/webp');
}

export function formatPrice(price: number | null): string {
  if (price === null || Number.isNaN(price)) return '價格請洽詢';
  return `NT$ ${price.toLocaleString('zh-TW')}`;
}

/** LINE link; with an official-account ID the chat opens with the product name prefilled. */
export function lineLink(settings: SiteSettings, productName?: string): string {
  const id = settings.lineId.trim();
  if (id) {
    const account = id.startsWith('@') ? id : `@${id}`;
    const text = productName ? `您好，我想詢問「${productName}」` : '您好，我想詢問商品';
    return `https://line.me/R/oaMessage/${encodeURIComponent(account)}/?${encodeURIComponent(text)}`;
  }
  return settings.lineUrl || 'https://line.me/';
}
