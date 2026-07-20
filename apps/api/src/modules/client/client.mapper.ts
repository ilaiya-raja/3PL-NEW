import type { Client, Contract, PortalUser } from '@wms/db';
import { Decimal } from '@prisma/client/runtime/library';
import type { ClientDto, ContractDto, PortalUserDto } from '@wms/types';

export function toClientDto(client: Client): ClientDto {
  return {
    id: client.id,
    code: client.code,
    legalName: client.legalName,
    gstin: client.gstin,
    status: client.status as ClientDto['status'],
    config: client.config as unknown as ClientDto['config'],
    branding: client.branding as unknown as ClientDto['branding'],
    createdAt: client.createdAt.toISOString(),
    updatedAt: client.updatedAt.toISOString(),
  };
}

export function toContractDto(
  contract: Contract & {
    slaDefinitions?: Array<{
      id: string;
      metric: string;
      targetValue: Decimal | string;
      createdAt: Date;
    }>;
  },
): ContractDto {
  const minMonthlyCommit = contract.minMonthlyCommit;
  return {
    id: contract.id,
    clientId: contract.clientId,
    startDate: contract.startDate.toISOString(),
    endDate: contract.endDate.toISOString(),
    minMonthlyCommit:
      minMonthlyCommit !== null &&
      typeof minMonthlyCommit === 'object' &&
      'toString' in minMonthlyCommit
        ? (minMonthlyCommit as Decimal).toString()
        : minMonthlyCommit,
    renewalAlertDays: contract.renewalAlertDays,
    notes: contract.notes,
    createdAt: contract.createdAt.toISOString(),
    updatedAt: contract.updatedAt.toISOString(),
    slaDefinitions: (contract.slaDefinitions ?? []).map((s) => ({
      id: s.id,
      metric: s.metric,
      targetValue:
        typeof s.targetValue === 'object' && s.targetValue !== null
          ? s.targetValue.toString()
          : String(s.targetValue),
      createdAt: s.createdAt.toISOString(),
    })),
  };
}

export function toPortalUserDto(user: PortalUser): PortalUserDto {
  return {
    id: user.id,
    clientId: user.clientId,
    email: user.email,
    name: user.name,
    role: user.role as PortalUserDto['role'],
    active: user.active,
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
