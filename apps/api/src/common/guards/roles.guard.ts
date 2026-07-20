import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import {
  AuthRealm,
  ErrorCodes,
  isOpsPayload,
  type JwtPayload,
} from '@wms/types';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { WmsException } from '../exceptions/wms.exception';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<
      string[] | undefined
    >(ROLES_KEY, [context.getHandler(), context.getClass()]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const user = request.user as JwtPayload | undefined;

    if (!user) {
      throw new WmsException(
        ErrorCodes.AUTH_UNAUTHORIZED,
        'Authentication required',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (user.realm !== AuthRealm.OPS || !isOpsPayload(user)) {
      throw new WmsException(
        ErrorCodes.AUTH_FORBIDDEN,
        'Ops role required',
        HttpStatus.FORBIDDEN,
      );
    }

    if (!requiredRoles.includes(user.role)) {
      throw new WmsException(
        ErrorCodes.AUTH_FORBIDDEN,
        'Insufficient permissions',
        HttpStatus.FORBIDDEN,
      );
    }

    return true;
  }
}
