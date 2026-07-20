import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { ItemController } from './item.controller';
import { ItemService } from './item.service';
import { ItemRepository } from './item.repository';

@Module({
  imports: [DatabaseModule],
  controllers: [ItemController],
  providers: [ItemService, ItemRepository],
  exports: [ItemService, ItemRepository],
})
export class ItemModule {}
