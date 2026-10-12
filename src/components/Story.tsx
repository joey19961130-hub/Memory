import { memo, type CSSProperties, type ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { lineLink, type SiteSettings } from '@/lib/content';
import { DARK } from '@/lib/theme';
import { useScrollParallax } from '@/lib/motion';
import { Reveal, SplitReveal } from '@/components/Reveal';

/**
 * One parallax plane. Its offset is measured against its parent (the section), so every
 * plane in a section shares one reference and only the speed differs → real depth.
 */
function Plane({
  speed,
  axis = 'y',
  className,
  style,
  children,
}: {
  speed: number;
  axis?: 'x' | 'y';
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const ref = useScrollParallax<HTMLDivElement>(speed, axis);
  return (
    <div ref={ref} className={className} style={{ willChange: 'transform', ...style }}>
      {children}
    </div>
  );
}

function Photo({ src, className, rot, size }: { src?: string; className: string; rot: number; size: string }) {
  if (!src) return null;
  return (
    <div className={`absolute ${className}`} aria-hidden="true">
      <Reveal variant="scale" duration={1200}>
        <div className="rounded-2xl overflow-hidden shadow-[0_30px_60px_-30px_rgba(12,22,34,0.45)]" style={{ width: size, height: size, transform: `rotate(${rot}deg)` }}>
          <img src={src} alt="" loading="lazy" className="w-full h-full object-cover" />
        </div>
      </Reveal>
    </div>
  );
}

function Glow({ color, className }: { color: string; className: string }) {
  return <div className={`absolute rounded-full blur-[80px] opacity-70 ${className}`} style={{ background: color }} aria-hidden="true" />;
}

const SECTION = 'relative min-h-[80svh] sm:min-h-[100svh] py-20 flex items-center overflow-hidden px-6 sm:px-8 md:px-20 lg:px-32';

export const Story = memo(function Story({ settings }: { settings: SiteSettings }) {
  const wall = settings.heroWall;
  const pick = (i: number) => (wall.length ? wall[i % wall.length] : undefined);
  const line = lineLink(settings);

  return (
    <div className="relative bg-white" style={{ color: DARK }}>
      {/* 1 — headline, left */}
      <section id="story-1" className={SECTION}>
        <Plane speed={-0.25} className="absolute inset-0 pointer-events-none">
          <Glow color="#F6D2CB" className="w-[40vmax] h-[40vmax] -left-[10vmax] top-[10%]" />
          <Glow color="#D6E6F2" className="w-[30vmax] h-[30vmax] right-[5%] bottom-[0%]" />
        </Plane>
        <Plane speed={0.45} className="absolute inset-0 pointer-events-none">
          <Photo src={pick(0)} className="right-[6%] top-[14%]" rot={6} size="clamp(120px, 20vw, 280px)" />
        </Plane>
        <Plane speed={-0.18} className="absolute inset-0 pointer-events-none">
          <Photo src={pick(3)} className="right-[24%] bottom-[10%] hidden sm:block" rot={-5} size="clamp(100px, 13vw, 200px)" />
        </Plane>
        <div className="relative max-w-4xl">
          <Plane speed={0.1}>
            <SplitReveal
              as="h2"
              text={settings.heroTitle}
              stagger={40}
              className="block font-light uppercase leading-[1.2]"
              style={{ fontSize: 'clamp(2rem,5vw,5rem)' }}
            />
          </Plane>
          <Plane speed={0.28}>
            <Reveal delay={500}>
              <p className="mt-6 text-sm tracking-[0.3em] uppercase" style={{ color: `${DARK}90` }}>
                {settings.heroSubtitle}
              </p>
            </Reveal>
          </Plane>
        </div>
      </section>

      {/* 2 — statement, centred; each phrase on its own depth */}
      <section id="story-2" className={`${SECTION} justify-center text-center`}>
        <Plane speed={-0.3} className="absolute inset-0 pointer-events-none">
          <Glow color="#F8EAC0" className="w-[36vmax] h-[36vmax] left-[30%] top-[20%]" />
        </Plane>
        <Plane speed={0.5} className="absolute inset-0 pointer-events-none">
          <Photo src={pick(1)} className="left-[5%] top-[12%]" rot={-7} size="clamp(110px, 16vw, 240px)" />
        </Plane>
        <Plane speed={-0.22} className="absolute inset-0 pointer-events-none">
          <Photo src={pick(4)} className="right-[6%] bottom-[12%]" rot={5} size="clamp(110px, 17vw, 250px)" />
        </Plane>
        <div role="heading" aria-level={2} className="relative max-w-[900px] font-extralight tracking-wide leading-[1.3] uppercase" style={{ fontSize: 'clamp(1.6rem,4.5vw,4.5rem)' }}>
          <Plane speed={0.06}>
            <SplitReveal text={settings.s2Lead.trim()} stagger={30} className="block" />
          </Plane>
          <Plane speed={0.2}>
            <SplitReveal text={settings.s2Accent1} stagger={30} delay={250} className="block" style={{ color: `${DARK}CC` }} />
          </Plane>
          <Plane speed={0.34}>
            <SplitReveal text={settings.s2Accent2} stagger={30} delay={450} className="block" style={{ color: `${DARK}80` }} />
          </Plane>
        </div>
      </section>

      {/* 3 — invitation, right; lines slide sideways at different speeds */}
      <section id="story-3" className={`${SECTION} justify-end`}>
        <Plane speed={-0.25} className="absolute inset-0 pointer-events-none">
          <Glow color="#E2DBF3" className="w-[38vmax] h-[38vmax] -right-[8vmax] top-[15%]" />
          <Glow color="#DCEBD8" className="w-[28vmax] h-[28vmax] left-[10%] bottom-[5%]" />
        </Plane>
        <Plane speed={0.4} className="absolute inset-0 pointer-events-none">
          <Photo src={pick(2)} className="left-[8%] top-[18%]" rot={-4} size="clamp(130px, 22vw, 320px)" />
        </Plane>
        <div className="relative max-w-2xl text-left">
          <Plane speed={0.08} axis="x">
            <Reveal>
              <p className="text-lg tracking-wide mb-4" style={{ color: `${DARK}99` }}>
                {settings.s3Eyebrow}
              </p>
            </Reveal>
          </Plane>
          <div role="heading" aria-level={2} className="font-light leading-[1.2] uppercase tracking-wide mb-8" style={{ fontSize: 'clamp(2rem,4vw,4rem)' }}>
            <Plane speed={0.18} axis="x">
              <SplitReveal text={settings.s3Line1} stagger={40} delay={150} className="block" />
            </Plane>
            <Plane speed={0.32} axis="x">
              <SplitReveal text={settings.s3Line2} stagger={40} delay={400} className="block" />
            </Plane>
          </div>
          <Reveal delay={700}>
            <a href={line} target="_blank" rel="noopener noreferrer" className="group inline-flex items-center gap-4">
              <span className="relative text-sm tracking-[0.3em] uppercase" style={{ color: `${DARK}CC` }}>
                {settings.s3Cta}
                <span className="absolute left-0 -bottom-1 h-px w-full origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500" style={{ background: DARK }} />
              </span>
              <span className="w-10 h-10 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300" style={{ background: DARK }}>
                <ArrowRight size={16} className="text-white" />
              </span>
            </a>
          </Reveal>
        </div>
      </section>
    </div>
  );
});
