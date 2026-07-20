import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import {
  AuthRealm,
  ErrorCodes,
  isPortalPayload,
  type JwtPayload,
} from '@wms/types';
import { WmsException } from '../exceptions/wms.exception';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const user = request.user as JwtPayload | undefined;

    if (!user) {
      return true;
    }

    if (user.realm === AuthRealm.PORTAL && isPortalPayload(user)) {
      request.clientId = user.clientId;
      return true;
    }

    if (user.realm === AuthRealm.OPS) {
      request.clientId = undefined;
      return true;
    }

    throw new WmsException(
      ErrorCodes.AUTH_FORBIDDEN,
      'Invalid authentication realm',
      HttpStatus.FORBIDDEN,
    );
  }
}
