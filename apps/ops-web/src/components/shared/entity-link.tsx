'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';

interface EntityLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
}

export function EntityLink({ href, children, className }: EntityLinkProps) {
  if (!href || href.endsWith('/undefined') || href.endsWith('/null')) {
    return <span className={className}>{children}</span>;
  }

  return (
    <Link
      href={href}
      className={cn(
        'font-medium text-primary underline-offset-4 hover:underline',
        className,
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </Link>
  );
}
