import type { CSSProperties, ReactNode } from 'react';

const EASE = 'cubic-bezier(0.16,1,0.3,1)';

export function Stagger({
  visible,
  delay = 0,
  className,
  style,
  children,
}: {
  visible: boolean;
  delay?: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div
      className={className}
      style={{
        ...style,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition: `opacity 0.8s ${EASE} ${delay}ms, transform 0.8s ${EASE} ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}
