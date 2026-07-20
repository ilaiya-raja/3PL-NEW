import { SetMetadata } from '@nestjs/common';
import type { OpsRole } from '@wms/types';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: OpsRole[]): ReturnType<typeof SetMetadata> =>
  SetMetadata(ROLES_KEY, roles);
