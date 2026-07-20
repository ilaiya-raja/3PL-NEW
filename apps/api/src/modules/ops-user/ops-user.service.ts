import { Injectable } from '@nestjs/common';
import { LicenseService } from '../../license/license.service';
import { createPaginationMeta } from '../../common/utils/pagination';
import { OpsUserRepository } from './ops-user.repository';
import { toOpsUserDto } from './ops-user.mapper';
import type { CreateOpsUserDto } from './dto/create-ops-user.dto';
import type { UpdateOpsUserDto } from './dto/update-ops-user.dto';
import type { ListOpsUsersQueryDto } from './dto/list-ops-users-query.dto';

@Injectable()
export class OpsUserService {
  constructor(
    private readonly opsUserRepository: OpsUserRepository,
    private readonly licenseService: LicenseService,
  ) {}

  async createOpsUser(data: CreateOpsUserDto) {
    await this.licenseService.assertWithinLimit('opsUsers');

    const user = await this.opsUserRepository.create(data);
    return toOpsUserDto(user);
  }

  async listOpsUsers(query: ListOpsUsersQueryDto) {
    const { items, total } = await this.opsUserRepository.findMany(query);

    return {
      items: items.map(toOpsUserDto),
      meta: createPaginationMeta(
        query.page!,
        query.limit!,
        total,
        query.sortBy,
        query.sortOrder,
      ),
    };
  }

  async getOpsUser(id: string) {
    const user = await this.opsUserRepository.findById(id);
    return toOpsUserDto(user);
  }

  async updateOpsUser(id: string, data: UpdateOpsUserDto) {
    const user = await this.opsUserRepository.update(id, data);
    return toOpsUserDto(user);
  }
}
