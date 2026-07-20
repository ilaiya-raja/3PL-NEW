import { Injectable } from '@nestjs/common';
import { ItemRepository } from './item.repository';
import { createPaginationMeta } from '../../common/utils/pagination';
import { toItemDto } from './item.mapper';
import type { CreateItemDto } from './dto/create-item.dto';
import type { UpdateItemDto } from './dto/update-item.dto';
import type { ImportItemsDto } from './dto/import-items.dto';
import type { ListItemsQueryDto } from './dto/list-items-query.dto';

@Injectable()
export class ItemService {
  constructor(private readonly itemRepository: ItemRepository) {}

  async createItem(clientId: string, data: CreateItemDto) {
    const item = await this.itemRepository.create(clientId, data);
    return toItemDto(item);
  }

  async listItems(clientId: string, query: ListItemsQueryDto) {
    const { items, total } = await this.itemRepository.findMany(clientId, query);

    return {
      items: items.map(toItemDto),
      meta: createPaginationMeta(
        query.page!,
        query.limit!,
        total,
        query.sortBy,
        query.sortOrder,
      ),
    };
  }

  async getItem(_clientId: string, id: string) {
    const item = await this.itemRepository.findById(id);
    return toItemDto(item);
  }

  async updateItem(_clientId: string, id: string, data: UpdateItemDto) {
    const item = await this.itemRepository.update(id, data);
    return toItemDto(item);
  }

  async importItems(clientId: string, data: ImportItemsDto) {
    return this.itemRepository.importBatch(clientId, data.rows);
  }
}
