import { Module } from '@nestjs/common';
import { LicenseModule } from '../../license/license.module';
import { OpsUserController } from './ops-user.controller';
import { OpsUserService } from './ops-user.service';
import { OpsUserRepository } from './ops-user.repository';

@Module({
  imports: [LicenseModule],
  controllers: [OpsUserController],
  providers: [OpsUserService, OpsUserRepository],
  exports: [OpsUserService, OpsUserRepository],
})
export class OpsUserModule {}
