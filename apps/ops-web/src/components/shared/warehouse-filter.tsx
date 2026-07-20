'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface WarehouseOption {
  id: string;
  code: string;
  name: string;
}

interface WarehouseFilterProps {
  warehouses: WarehouseOption[];
  value: string | undefined;
  onChange: (warehouseId: string) => void;
  disabled?: boolean;
}

export function WarehouseFilter({
  warehouses,
  value,
  onChange,
  disabled,
}: WarehouseFilterProps) {
  return (
    <Select
      value={value}
      onValueChange={onChange}
      disabled={disabled || warehouses.length === 0}
    >
      <SelectTrigger className="w-[240px]">
        <SelectValue placeholder="Select warehouse" />
      </SelectTrigger>
      <SelectContent>
        {warehouses.map((wh) => (
          <SelectItem key={wh.id} value={wh.id}>
            {wh.code} — {wh.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
