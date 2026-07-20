import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { InboundModule } from '../inbound/inbound.module';
import { ItemModule } from '../item/item.module';
import { PortalController } from './portal.controller';
import { PortalService } from './portal.service';

@Module({
  imports: [DatabaseModule, InboundModule, ItemModule],
  controllers: [PortalController],
  providers: [PortalService],
})
export class PortalModule {}
