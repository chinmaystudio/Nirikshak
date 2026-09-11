import { useEffect, useState } from 'react';
import type { ReactNode, MouseEvent } from 'react';

export function getHash(): string {
  const h = window.location.hash.replace(/^#/, '');
  return h || '/';
}

export function navigate(to: string) {
  if (getHash() === to) return;
  window.location.hash = to;
}

export function usePath(): string {
  const [p, setP] = useState(getHash());
  useEffect(() => {
    const f = () => setP(getHash());
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return p;
}

export function Link({
  to,
  children,
  className,
  title,
  onClick,
}: {
  to: string;
  children: ReactNode;
  className?: string;
  title?: string;
  onClick?: () => void;
}) {
  const handle = (e: MouseEvent) => {
    e.stopPropagation();
    onClick?.();
  };
  return (
    <a href={`#${to}`} className={className} title={title} onClick={handle}>
      {children}
    </a>
  );
}

export function match(pattern: string, path: string): Record<string, string> | null {
  const pp = pattern.split('/').filter(Boolean);
  const sp = path.split('/').filter(Boolean);
  if (pp.length !== sp.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < pp.length; i++) {
    if (pp[i].startsWith(':')) params[pp[i].slice(1)] = decodeURIComponent(sp[i]);
    else if (pp[i] !== sp[i]) return null;
  }
  return params;
}

export function isActive(path: string, target: string): boolean {
  if (target === path) return true;
  return path.startsWith(target + '/');
}
