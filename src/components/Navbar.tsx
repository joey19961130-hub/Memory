import { useEffect, useState } from 'react';
import { Info, X } from 'lucide-react';
import { DARK, NAV_LINKS } from '@/lib/theme';

const EASE = 'cubic-bezier(0.16,1,0.3,1)';

const entrance = (shown: boolean, delay: number) => ({
  opacity: shown ? 1 : 0,
  transform: shown ? 'translateY(0)' : 'translateY(-12px)',
  transition: `opacity 0.6s ${EASE} ${delay}ms, transform 0.6s ${EASE} ${delay}ms, color 0.5s`,
});

const resolveHref = (href: string, lineHref: string) => (href === 'line' ? lineHref : href);
const isExternal = (href: string) => href.startsWith('http');

export function Navbar({
  isLight,
  lineHref,
  logoUrl,
  logoInvert,
  brandName,
  onOpenMenu,
}: {
  isLight: boolean;
  lineHref: string;
  logoUrl: string;
  logoInvert: boolean;
  brandName: string;
  onOpenMenu: () => void;
}) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShown(true), 200);
    return () => clearTimeout(t);
  }, []);

  const color = isLight ? '#FFFFFF' : DARK;
  const inverse = isLight ? DARK : '#FFFFFF';

  return (
    <nav
      className="absolute top-0 left-0 right-0 z-50 pointer-events-auto px-6 sm:px-8 md:px-12 pt-8 sm:pt-12 pb-6 flex items-center justify-between transition-colors duration-500"
      style={{ color }}
    >
      <div className="flex items-center gap-5 lg:gap-10">
      {/* Mobile hamburger */}
      <button
        type="button"
        aria-label="開啟選單"
        onClick={onOpenMenu}
        className="lg:hidden flex flex-col gap-[5px] py-2"
        style={entrance(shown, 100)}
      >
        {[24, 24, 16].map((w, i) => (
          <span
            key={i}
            className="block h-[2px] transition-colors duration-500"
            style={{ width: w, backgroundColor: color }}
          />
        ))}
      </button>

      {logoUrl && (
        <a href="#top" aria-label={brandName} className="block shrink-0" style={entrance(shown, 60)}>
          <img
            src={logoUrl}
            alt={brandName}
            className="h-7 sm:h-8 w-auto max-w-[140px] object-contain transition-[filter] duration-500"
            style={{ filter: isLight && logoInvert ? 'brightness(0) invert(1)' : 'none' }}
          />
        </a>
      )}

      {/* Desktop links */}
      <div className="hidden lg:flex items-center gap-8 xl:gap-10">
        {NAV_LINKS.map((link, i) => {
          const href = resolveHref(link.href, lineHref);
          return (
            <a
              key={link.label}
              href={href}
              {...(isExternal(href) ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              className="group relative text-xs tracking-[0.15em] uppercase font-medium hover:opacity-70 transition-opacity"
              style={entrance(shown, i * 80 + 100)}
            >
              {link.label}
              <span
                className={`absolute left-0 right-0 -bottom-3 h-[2px] origin-left transition-[transform,background-color] duration-500 ${
                  i === 0 ? '' : 'scale-x-0 group-hover:scale-x-100'
                }`}
                style={{ backgroundColor: color, transitionTimingFunction: 'cubic-bezier(0.16,1,0.3,1)' }}
              />
            </a>
          );
        })}
      </div>

      </div>

      {/* Right cluster */}
      <div className="hidden sm:flex items-center gap-8" style={entrance(shown, 500)}>
        <a
          href={lineHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-xs tracking-[0.2em] uppercase font-medium hover:opacity-70 transition-opacity"
        >
          LINE
          <span
            className="w-5 h-5 rounded-full flex items-center justify-center transition-colors duration-500"
            style={{ backgroundColor: color }}
          >
            <Info size={10} color={inverse} />
          </span>
        </a>
        <button
          type="button"
          onClick={onOpenMenu}
          className="text-xs tracking-[0.2em] uppercase font-medium hover:opacity-70 transition-opacity"
        >
          MENU
        </button>
      </div>
    </nav>
  );
}

export function MobileMenu({
  open,
  lineHref,
  onClose,
}: {
  open: boolean;
  lineHref: string;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  return (
    <div
      className={`fixed inset-0 z-[100] transition-all duration-500 ${open ? 'opacity-100 visible' : 'opacity-0 invisible'}`}
      style={{ backgroundColor: DARK, transitionTimingFunction: 'cubic-bezier(0.4,0,0.2,1)' }}
      aria-hidden={!open}
    >
      <div
        className={`h-full flex flex-col transition-transform duration-500 ${open ? 'translate-y-0' : '-translate-y-8'}`}
        style={{ transitionTimingFunction: 'cubic-bezier(0.4,0,0.2,1)' }}
      >
        <div className="flex justify-end px-6 sm:px-8 pt-8 sm:pt-12">
          <button
            type="button"
            aria-label="關閉選單"
            onClick={onClose}
            className="w-10 h-10 rounded-full border border-white/30 hover:border-white flex items-center justify-center text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 flex flex-col justify-center">
          {NAV_LINKS.map((link, i) => {
            const href = resolveHref(link.href, lineHref);
            return (
              <a
                key={link.label}
                href={href}
                onClick={onClose}
                {...(isExternal(href) ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className={`px-8 sm:px-12 py-3 text-2xl sm:text-3xl font-light tracking-wide uppercase transition-colors ${
                  i === 0 ? 'text-white' : 'text-white/60 hover:text-white'
                }`}
                style={{
                  opacity: open ? 1 : 0,
                  transform: open ? 'translateY(0)' : 'translateY(20px)',
                  transition: `opacity 0.5s ${EASE} ${i * 60}ms, transform 0.5s ${EASE} ${i * 60}ms, color 0.3s`,
                }}
              >
                {link.label}
              </a>
            );
          })}
        </div>

        <div className="flex gap-8 px-8 sm:px-12 pb-10 text-xs tracking-[0.2em] uppercase text-white/60">
          <a href={lineHref} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
            LINE
          </a>
          <a href="#contact" onClick={onClose} className="hover:text-white transition-colors">
            CONTACT
          </a>
        </div>
      </div>
    </div>
  );
}
