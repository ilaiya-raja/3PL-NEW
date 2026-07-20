import type { OpsUser } from '@wms/db';
import type { OpsUserDto } from '@wms/types';

export function toOpsUserDto(user: OpsUser): OpsUserDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as OpsUserDto['role'],
    active: user.active,
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
