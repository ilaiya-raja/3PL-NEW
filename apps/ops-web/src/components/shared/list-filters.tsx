'use client';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ClientFilter } from '@/components/shared/client-filter';
import { WarehouseFilter } from '@/components/shared/warehouse-filter';
import { Search } from 'lucide-react';

interface FilterOption {
  value: string;
  label: string;
}

interface ClientOption {
  id: string;
  code: string;
  name: string;
}

interface WarehouseOption {
  id: string;
  code: string;
  name: string;
}

export interface ListFiltersProps {
  status?: string;
  onStatusChange?: (value: string | undefined) => void;
  statusOptions?: FilterOption[];
  dateFrom?: string;
  onDateFromChange?: (value: string) => void;
  dateTo?: string;
  onDateToChange?: (value: string) => void;
  warehouseId?: string;
  onWarehouseChange?: (value: string) => void;
  warehouses?: WarehouseOption[];
  clientId?: string;
  onClientChange?: (value: string | undefined) => void;
  clients?: ClientOption[];
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  disabled?: boolean;
}

export function ListFilters({
  status,
  onStatusChange,
  statusOptions,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  warehouseId,
  onWarehouseChange,
  warehouses,
  clientId,
  onClientChange,
  clients,
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  disabled,
}: ListFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {statusOptions && onStatusChange && (
        <Select
          value={status ?? 'all'}
          onValueChange={(v) => onStatusChange(v === 'all' ? undefined : v)}
          disabled={disabled}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {statusOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {onDateFromChange && (
        <Input
          type="date"
          value={dateFrom ?? ''}
          onChange={(e) => onDateFromChange(e.target.value)}
          className="w-[150px]"
          disabled={disabled}
          aria-label="Date from"
        />
      )}

      {onDateToChange && (
        <Input
          type="date"
          value={dateTo ?? ''}
          onChange={(e) => onDateToChange(e.target.value)}
          className="w-[150px]"
          disabled={disabled}
          aria-label="Date to"
        />
      )}

      {warehouses && onWarehouseChange && (
        <WarehouseFilter
          warehouses={warehouses}
          value={warehouseId}
          onChange={onWarehouseChange}
          disabled={disabled}
        />
      )}

      {clients && onClientChange && (
        <ClientFilter
          clients={clients}
          value={clientId}
          onChange={(id) => onClientChange(id === '__all__' ? undefined : id)}
          disabled={disabled}
        />
      )}

      {onSearchChange && (
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search ?? ''}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-8"
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}
