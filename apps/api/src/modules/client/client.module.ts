import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { LicenseModule } from '../../license/license.module';
import { ClientController } from './client.controller';
import { ClientService } from './client.service';
import { ClientRepository } from './client.repository';
import { ContractRepository } from './contract.repository';
import { PortalUserRepository } from './portal-user.repository';

@Module({
  imports: [DatabaseModule, LicenseModule],
  controllers: [ClientController],
  providers: [
    ClientService,
    ClientRepository,
    ContractRepository,
    PortalUserRepository,
  ],
  exports: [ClientService, ClientRepository],
})
export class ClientModule {}
