'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ClientOption {
  id: string;
  code: string;
  name: string;
}

interface ClientFilterProps {
  clients: ClientOption[];
  value: string | undefined;
  onChange: (clientId: string) => void;
  disabled?: boolean;
}

export function ClientFilter({
  clients,
  value,
  onChange,
  disabled,
}: ClientFilterProps) {
  return (
    <Select
      value={value ?? '__all__'}
      onValueChange={onChange}
      disabled={disabled || clients.length === 0}
    >
      <SelectTrigger className="w-[220px]">
        <SelectValue placeholder="Select client" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all__">All clients</SelectItem>
        {clients.map((client) => (
          <SelectItem key={client.id} value={client.id}>
            {client.code} — {client.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
