import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCodes, type LicenseFeature } from '@wms/types';
import { REQUIRES_FEATURE_KEY } from '../common/decorators/requires-feature.decorator';
import { WmsException } from '../common/exceptions/wms.exception';
import { LicenseService } from './license.service';

@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly licenseService: LicenseService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const feature = this.reflector.getAllAndOverride<LicenseFeature | undefined>(
      REQUIRES_FEATURE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!feature) {
      return true;
    }

    if (!this.licenseService.isFeatureEnabled(feature)) {
      let edition = 'NONE';
      try {
        edition = this.licenseService.getLicense().edition;
      } catch {
        // ignore — invalid license
      }
      throw new WmsException(
        ErrorCodes.LIC_FEATURE_NOT_LICENSED,
        `Feature "${feature}" is not included in your ${edition} license. Upgrade to access this feature.`,
        HttpStatus.FORBIDDEN,
        { feature, edition },
      );
    }

    return true;
  }
}
