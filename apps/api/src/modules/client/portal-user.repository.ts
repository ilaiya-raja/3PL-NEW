import { Injectable, HttpStatus } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { ErrorCodes } from '@wms/types';
import { TenantPrismaService } from '../../database/tenant-prisma.service';
import { WmsException } from '../../common/exceptions/wms.exception';
import type { CreatePortalUserDto } from './dto/create-portal-user.dto';
import type { UpdatePortalUserDto } from './dto/update-portal-user.dto';

@Injectable()
export class PortalUserRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async create(clientId: string, data: CreatePortalUserDto) {
    return this.tenantPrisma.withOpsRole(async (tx) => {
      const exists = await tx.portalUser.findFirst({
        where: { email: data.email },
      });

      if (exists) {
        throw new WmsException(
          ErrorCodes.VAL_VALIDATION_FAILED,
          `Portal user with email ${data.email} already exists`,
          HttpStatus.CONFLICT,
        );
      }

      const hashedPassword = await bcrypt.hash(data.password, 10);

      return tx.portalUser.create({
        data: {
          clientId,
          email: data.email,
          passwordHash: hashedPassword,
          name: data.name,
          role: data.role,
          active: data.active ?? true,
        },
      });
    });
  }

  async findByClientId(clientId: string) {
    return this.tenantPrisma.withOpsRole(async (tx) => {
      return tx.portalUser.findMany({
        where: { clientId },
        orderBy: { createdAt: 'desc' },
      });
    });
  }

  async findById(id: string) {
    return this.tenantPrisma.withOpsRole(async (tx) => {
      const user = await tx.portalUser.findUnique({
        where: { id },
      });

      if (!user) {
        throw new WmsException(
          ErrorCodes.SYS_NOT_FOUND,
          `Portal user with ID ${id} not found`,
          HttpStatus.NOT_FOUND,
        );
      }

      return user;
    });
  }

  async update(id: string, data: UpdatePortalUserDto) {
    return this.tenantPrisma.withOpsRole(async (tx) => {
      await this.findById(id);

      const updateData: Record<string, unknown> = {};

      if (data.email !== undefined) {
        updateData.email = data.email;
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

      return tx.portalUser.update({
        where: { id },
        data: updateData,
      });
    });
  }

  async delete(id: string) {
    return this.tenantPrisma.withOpsRole(async (tx) => {
      await this.findById(id);

      return tx.portalUser.delete({
        where: { id },
      });
    });
  }
}
