import { cn } from '@/lib/utils';
import type {
  OrderStatus,
  ReceiptStatus,
  ShipStatus,
  LotStatus,
} from '@wms/types';

type Status = OrderStatus | ReceiptStatus | ShipStatus | LotStatus | string;

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

const statusConfig: Record<
  string,
  { className: string; label: string }
> = {
  RECEIVED: {
    label: 'Received',
    className: 'bg-secondary text-secondary-foreground',
  },
  VALIDATED: {
    label: 'Validated',
    className: 'bg-secondary text-secondary-foreground',
  },
  ALLOCATED: {
    label: 'Allocated',
    className: 'bg-primary/12 text-primary',
  },
  RELEASED: { label: 'Released', className: 'bg-primary/12 text-primary' },
  PICKING: { label: 'Picking', className: 'bg-primary/12 text-primary' },
  PACKED: { label: 'Packed', className: 'bg-primary/12 text-primary' },
  SHIPPED: {
    label: 'Shipped',
    className: 'bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))]',
  },
  CANCELLED: {
    label: 'Cancelled',
    className: 'bg-destructive/10 text-destructive',
  },
  BACKORDERED: {
    label: 'Backordered',
    className: 'bg-[hsl(var(--alert-soft))] text-[hsl(var(--alert))]',
  },
  EXPECTED: {
    label: 'Expected',
    className: 'bg-secondary text-secondary-foreground',
  },
  ARRIVED: {
    label: 'Arrived',
    className: 'bg-secondary text-secondary-foreground',
  },
  RECEIVING: { label: 'Receiving', className: 'bg-primary/12 text-primary' },
  QC: { label: 'QC', className: 'bg-primary/12 text-primary' },
  COMPLETE: {
    label: 'Complete',
    className: 'bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))]',
  },
  CREATED: {
    label: 'Created',
    className: 'bg-secondary text-secondary-foreground',
  },
  MANIFESTED: { label: 'Manifested', className: 'bg-primary/12 text-primary' },
  IN_TRANSIT: { label: 'In Transit', className: 'bg-primary/12 text-primary' },
  DELIVERED: {
    label: 'Delivered',
    className: 'bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))]',
  },
  EXCEPTION: {
    label: 'Exception',
    className: 'bg-destructive/10 text-destructive',
  },
  RTO: { label: 'RTO', className: 'bg-destructive/10 text-destructive' },
  AVAILABLE: {
    label: 'Available',
    className: 'bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))]',
  },
  ON_HOLD: {
    label: 'On Hold',
    className: 'bg-[hsl(var(--alert-soft))] text-[hsl(var(--alert))]',
  },
  QC_HOLD: {
    label: 'QC Hold',
    className: 'bg-[hsl(var(--alert-soft))] text-[hsl(var(--alert))]',
  },
  QUARANTINE: {
    label: 'Quarantine',
    className: 'bg-destructive/10 text-destructive',
  },
  DAMAGED: {
    label: 'Damaged',
    className: 'bg-destructive/10 text-destructive',
  },
  EXPIRED: {
    label: 'Expired',
    className: 'bg-destructive/10 text-destructive',
  },
};

function humanize(status: string) {
  return status
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const key = status || 'UNKNOWN';
  const config = statusConfig[key] || {
    className: 'bg-muted text-muted-foreground',
    label: humanize(String(key)),
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em]',
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
