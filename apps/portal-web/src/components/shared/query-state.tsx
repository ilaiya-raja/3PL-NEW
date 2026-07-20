'use client';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api-client';

export function QuerySkeletons({
  count = 4,
  className = 'h-28 w-full',
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className={className} />
      ))}
    </div>
  );
}

export function QueryError({
  error,
  onRetry,
  title = 'Could not load data',
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
}) {
  const message =
    error instanceof ApiError
      ? error.message
      : error instanceof Error
        ? error.message
        : 'Something went wrong. Please try again.';

  return (
    <div className="border border-border bg-card px-6 py-12 text-center">
      <p className="font-display text-lg font-semibold tracking-tight">{title}</p>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Button className="mt-5" variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

export function SessionMissing({
  onRetry,
}: {
  onRetry?: () => void;
}) {
  return (
    <QueryError
      title="Session expired"
      error={new Error('Sign out and sign in again to refresh your session.')}
      onRetry={onRetry}
    />
  );
}
