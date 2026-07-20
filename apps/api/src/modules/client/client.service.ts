import { Injectable } from '@nestjs/common';
import { LicenseService } from '../../license/license.service';
import { ClientRepository } from './client.repository';
import { ContractRepository } from './contract.repository';
import { PortalUserRepository } from './portal-user.repository';
import { createPaginationMeta } from '../../common/utils/pagination';
import { toClientDto, toContractDto, toPortalUserDto } from './client.mapper';
import type { CreateClientDto } from './dto/create-client.dto';
import type { UpdateClientDto } from './dto/update-client.dto';
import type { UpdateClientStatusDto } from './dto/update-status.dto';
import type { UpdateClientConfigDto } from './dto/update-config.dto';
import type { CreateContractDto } from './dto/create-contract.dto';
import type { CreatePortalUserDto } from './dto/create-portal-user.dto';
import type { UpdatePortalUserDto } from './dto/update-portal-user.dto';
import type { ListClientsQueryDto } from './dto/list-clients-query.dto';

@Injectable()
export class ClientService {
  constructor(
    private readonly clientRepository: ClientRepository,
    private readonly contractRepository: ContractRepository,
    private readonly portalUserRepository: PortalUserRepository,
    private readonly licenseService: LicenseService,
  ) {}

  async createClient(data: CreateClientDto) {
    await this.licenseService.assertWithinLimit('clients');

    const client = await this.clientRepository.create(data);
    return toClientDto(client);
  }

  async listClients(query: ListClientsQueryDto) {
    const { items, total } = await this.clientRepository.findMany(query);

    return {
      items: items.map(toClientDto),
      meta: createPaginationMeta(
        query.page!,
        query.limit!,
        total,
        query.sortBy,
        query.sortOrder,
      ),
    };
  }

  async getClient(id: string) {
    const client = await this.clientRepository.findById(id);
    return toClientDto(client);
  }

  async updateClient(id: string, data: UpdateClientDto) {
    const client = await this.clientRepository.update(id, data);
    return toClientDto(client);
  }

  async updateClientStatus(id: string, data: UpdateClientStatusDto) {
    const client = await this.clientRepository.updateStatus(id, data);
    return toClientDto(client);
  }

  async updateClientConfig(id: string, data: UpdateClientConfigDto) {
    const client = await this.clientRepository.updateConfig(id, data);
    return toClientDto(client);
  }

  async createContract(clientId: string, data: CreateContractDto) {
    await this.clientRepository.findById(clientId);
    const contract = await this.contractRepository.create(clientId, data);
    return toContractDto(contract);
  }

  async listContracts(clientId: string) {
    await this.clientRepository.findById(clientId);
    const contracts = await this.contractRepository.findByClientId(clientId);
    return contracts.map(toContractDto);
  }

  async addSlaDefinition(
    clientId: string,
    contractId: string,
    data: { metric: string; targetValue: string },
  ) {
    await this.clientRepository.findById(clientId);
    return this.contractRepository.addSla(clientId, contractId, data);
  }

  async createPortalUser(clientId: string, data: CreatePortalUserDto) {
    await this.clientRepository.findById(clientId);
    await this.licenseService.assertWithinLimit('portalUsers');

    const user = await this.portalUserRepository.create(clientId, data);
    return toPortalUserDto(user);
  }

  async listPortalUsers(clientId: string) {
    await this.clientRepository.findById(clientId);
    const users = await this.portalUserRepository.findByClientId(clientId);
    return users.map(toPortalUserDto);
  }

  async updatePortalUser(
    clientId: string,
    userId: string,
    data: UpdatePortalUserDto,
  ) {
    await this.clientRepository.findById(clientId);
    const user = await this.portalUserRepository.update(userId, data);
    return toPortalUserDto(user);
  }

  async deletePortalUser(clientId: string, userId: string) {
    await this.clientRepository.findById(clientId);
    await this.portalUserRepository.delete(userId);
  }
}
