import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface Column<T> {
  header: string;
  accessor: keyof T | ((row: T) => React.ReactNode);
  cell?: (value: T[keyof T], row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  isLoading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
}

export function DataTable<T>({
  data,
  columns,
  isLoading = false,
  emptyMessage = 'No data available',
  onRowClick,
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="space-y-2 border border-border bg-card p-3">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="border border-dashed border-border bg-card px-4 py-14 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-hidden border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            {columns.map((column, idx) => (
              <TableHead
                key={idx}
                className="h-10 bg-muted text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
              >
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, rowIdx) => (
            <TableRow
              key={rowIdx}
              onClick={() => onRowClick?.(row)}
              className={cn(
                'border-border/70',
                onRowClick && 'cursor-pointer hover:bg-muted/35'
              )}
            >
              {columns.map((column, colIdx) => {
                const value =
                  typeof column.accessor === 'function'
                    ? column.accessor(row)
                    : row[column.accessor];

                return (
                  <TableCell key={colIdx} className="py-3 text-sm">
                    {column.cell && typeof column.accessor !== 'function'
                      ? column.cell(value as T[keyof T], row)
                      : (value as React.ReactNode)}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
