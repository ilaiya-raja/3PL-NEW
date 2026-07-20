import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { InventoryTransactionService } from './inventory-transaction.service';
import { InventoryRepository } from './inventory.repository';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';

@Module({
  imports: [DatabaseModule, NotificationsModule],
  controllers: [InventoryController],
  providers: [
    InventoryTransactionService,
    InventoryRepository,
    InventoryService,
  ],
  exports: [InventoryTransactionService],
})
export class InventoryModule {}
