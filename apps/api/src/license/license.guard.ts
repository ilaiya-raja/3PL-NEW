import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCodes } from '@wms/types';
import type { FastifyRequest } from 'fastify';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import { SKIP_LICENSE_KEY } from '../common/decorators/skip-license.decorator';
import { WmsException } from '../common/exceptions/wms.exception';
import { LICENSE_WRITE_METHODS } from './license.constants';
import { LicenseService } from './license.service';

@Injectable()
export class LicenseGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly licenseService: LicenseService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const skipLicense = this.reflector.getAllAndOverride<boolean>(SKIP_LICENSE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic || skipLicense) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const path = request.url.split('?')[0] ?? '';

    // Always allow health, license, and auth routes
    if (
      path.includes('/health') ||
      path.includes('/license') ||
      path.includes('/auth/')
    ) {
      return true;
    }

    const method = (request.method ?? 'GET').toUpperCase();
    if (!LICENSE_WRITE_METHODS.has(method)) {
      return true;
    }

    if (this.licenseService.isWriteBlocked()) {
      throw new WmsException(
        ErrorCodes.LIC_EXPIRED,
        'License is expired or invalid. Write operations are disabled. Contact Digisailor to renew.',
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    return true;
  }
}
