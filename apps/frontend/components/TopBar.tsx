import Link from 'next/link';
import { ReactNode } from 'react';
import { Logo } from './Logo';

export function TopBar({ homeHref, children }: { homeHref: string; children?: ReactNode }) {
  return (
    <header style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
      <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
        <Link href={homeHref}>
          <Logo size="sm" />
        </Link>
        <nav className="flex items-center gap-4 text-sm">{children}</nav>
      </div>
    </header>
  );
}
