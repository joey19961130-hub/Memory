export const DARK = '#1D3045';

export const NAV_LINKS = [
  { label: '首頁', href: '#top' },
  { label: '商品一覽', href: '#products' },
  { label: '品牌故事', href: '#about' },
  { label: '聯絡我們', href: '#contact' },
  { label: 'LINE 詢問', href: 'line' },
] as const;

const PLACEHOLDER_TONES = ['#E8E1D7', '#DCE3E8', '#E9DDE2', '#E2E6DA', '#E6E0EC', '#EDE6D6'];

/** Stable soft background colour for products without a photo. */
export function placeholderTone(key: string): string {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PLACEHOLDER_TONES[h % PLACEHOLDER_TONES.length];
}
