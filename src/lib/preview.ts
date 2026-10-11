import { useEffect, useState } from 'react';
import type { Product, SiteSettings } from '@/lib/content';

/** Where the admin wants the preview iframe to look while a given form group is being edited. */
export type PreviewTarget = 'hero' | 's2' | 's3' | 'products' | 'product' | 'about' | 'contact';

export type PreviewMessage =
  | { type: 'preview-ready' }
  | { type: 'preview-settings'; settings: SiteSettings; product: Product | null }
  | { type: 'preview-scroll'; target: PreviewTarget };

export const isPreviewFrame = () => window.location.hash.startsWith('#/preview') && window.parent !== window;

/**
 * Inside the admin's preview iframe: receive unsaved drafts from the parent window (same origin only)
 * and report readiness. Returns the latest draft settings/product, or nulls outside preview.
 */
export function usePreviewDrafts(enabled: boolean, onScroll: (target: PreviewTarget) => void) {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [product, setProduct] = useState<Product | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== window.parent) return;
      const msg = e.data as PreviewMessage;
      if (msg?.type === 'preview-settings') {
        setSettings(msg.settings);
        setProduct(msg.product);
      } else if (msg?.type === 'preview-scroll') {
        onScroll(msg.target);
      }
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({ type: 'preview-ready' } satisfies PreviewMessage, window.location.origin);
    return () => window.removeEventListener('message', onMsg);
  }, [enabled, onScroll]);

  return { settings, product };
}
