import { Injectable } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { TenantPrismaService } from '../../database/tenant-prisma.service';
import type { CreateContractDto } from './dto/create-contract.dto';

@Injectable()
export class ContractRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async create(clientId: string, data: CreateContractDto) {
    return this.tenantPrisma.withOpsRole(async (tx) => {
      return tx.contract.create({
        data: {
          clientId,
          startDate: new Date(data.startDate),
          endDate: new Date(data.endDate),
          minMonthlyCommit: data.minMonthlyCommit
            ? new Decimal(data.minMonthlyCommit)
            : null,
          renewalAlertDays: data.renewalAlertDays ?? 30,
          notes: data.notes,
        },
      });
    });
  }

  async findByClientId(clientId: string) {
    return this.tenantPrisma.withOpsRole(async (tx) => {
      return tx.contract.findMany({
        where: { clientId },
        include: { slaDefinitions: true },
        orderBy: { createdAt: 'desc' },
      });
    });
  }

  async addSla(
    clientId: string,
    contractId: string,
    data: { metric: string; targetValue: string },
  ) {
    return this.tenantPrisma.withOpsRole(async (tx) => {
      const contract = await tx.contract.findFirst({
        where: { id: contractId, clientId },
      });
      if (!contract) {
        throw new Error('Contract not found');
      }
      return tx.slaDefinition.create({
        data: {
          clientId,
          contractId,
          metric: data.metric,
          targetValue: new Decimal(data.targetValue),
        },
      });
    });
  }
}
