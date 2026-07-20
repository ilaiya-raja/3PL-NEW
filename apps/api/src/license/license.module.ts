import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { FeatureGuard } from './feature.guard';
import { LicenseController } from './license.controller';
import { LicenseGuard } from './license.guard';
import { LicenseService } from './license.service';

@Global()
@Module({
  controllers: [LicenseController],
  providers: [
    LicenseService,
    LicenseGuard,
    FeatureGuard,
    {
      provide: APP_GUARD,
      useClass: LicenseGuard,
    },
    {
      provide: APP_GUARD,
      useClass: FeatureGuard,
    },
  ],
  exports: [LicenseService, LicenseGuard, FeatureGuard],
})
export class LicenseModule {}
