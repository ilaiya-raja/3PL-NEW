import { Injectable, HttpStatus } from '@nestjs/common';
import type { Prisma } from '@wms/db';
import * as bcrypt from 'bcrypt';
import { ErrorCodes } from '@wms/types';
import { PrismaService } from '../../database/prisma.service';
import { WmsException } from '../../common/exceptions/wms.exception';
import type { CreateOpsUserDto } from './dto/create-ops-user.dto';
import type { UpdateOpsUserDto } from './dto/update-ops-user.dto';
import type { ListOpsUsersQueryDto } from './dto/list-ops-users-query.dto';

@Injectable()
export class OpsUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateOpsUserDto) {
    const email = data.email.toLowerCase();
    const exists = await this.prisma.opsUser.findFirst({
      where: { email },
    });

    if (exists) {
      throw new WmsException(
        ErrorCodes.VAL_VALIDATION_FAILED,
        `Ops user with email ${data.email} already exists`,
        HttpStatus.CONFLICT,
      );
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    return this.prisma.opsUser.create({
      data: {
        email,
        passwordHash,
        name: data.name,
        role: data.role,
        active: data.active ?? true,
      },
    });
  }

  async findMany(query: ListOpsUsersQueryDto) {
    const where: Prisma.OpsUserWhereInput = {};

    if (query.role) {
      where.role = query.role;
    }

    if (query.active !== undefined) {
      where.active = query.active;
    }

    if (query.search) {
      where.OR = [
        { email: { contains: query.search, mode: 'insensitive' } },
        { name: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.opsUser.findMany({
        where,
        skip: (query.page! - 1) * query.limit!,
        take: query.limit,
        orderBy: query.sortBy
          ? { [query.sortBy]: query.sortOrder }
          : { createdAt: 'desc' },
      }),
      this.prisma.opsUser.count({ where }),
    ]);

    return { items, total };
  }

  async findById(id: string) {
    const user = await this.prisma.opsUser.findUnique({
      where: { id },
    });

    if (!user) {
      throw new WmsException(
        ErrorCodes.SYS_NOT_FOUND,
        `Ops user with ID ${id} not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    return user;
  }

  async update(id: string, data: UpdateOpsUserDto) {
    await this.findById(id);

    const updateData: Prisma.OpsUserUpdateInput = {};

    if (data.email !== undefined) {
      const email = data.email.toLowerCase();
      const exists = await this.prisma.opsUser.findFirst({
        where: { email, NOT: { id } },
      });

      if (exists) {
        throw new WmsException(
          ErrorCodes.VAL_VALIDATION_FAILED,
          `Ops user with email ${data.email} already exists`,
          HttpStatus.CONFLICT,
        );
      }

      updateData.email = email;
    }

    if (data.password !== undefined) {
      updateData.passwordHash = await bcrypt.hash(data.password, 10);
    }

    if (data.name !== undefined) {
      updateData.name = data.name;
    }

    if (data.role !== undefined) {
      updateData.role = data.role;
    }

    if (data.active !== undefined) {
      updateData.active = data.active;
    }

    return this.prisma.opsUser.update({
      where: { id },
      data: updateData,
    });
  }
}
