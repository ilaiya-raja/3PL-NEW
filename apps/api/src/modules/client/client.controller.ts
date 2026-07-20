import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { OpsRole } from '@wms/types';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ClientService } from './client.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { UpdateClientStatusDto } from './dto/update-status.dto';
import { UpdateClientConfigDto } from './dto/update-config.dto';
import { CreateContractDto } from './dto/create-contract.dto';
import { CreatePortalUserDto } from './dto/create-portal-user.dto';
import { UpdatePortalUserDto } from './dto/update-portal-user.dto';
import { ListClientsQueryDto } from './dto/list-clients-query.dto';

@ApiTags('clients')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('clients')
export class ClientController {
  constructor(private readonly clientService: ClientService) {}

  @Post()
  @Roles(OpsRole.ADMIN, OpsRole.SUPERVISOR)
  @ApiOperation({ summary: 'Create a new client' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Client created' })
  async createClient(@Body() dto: CreateClientDto) {
    return this.clientService.createClient(dto);
  }

  @Get()
  @Roles(
    OpsRole.ADMIN,
    OpsRole.SUPERVISOR,
    OpsRole.WAREHOUSE_OPS,
    OpsRole.BILLING,
    OpsRole.READONLY,
  )
  @ApiOperation({ summary: 'List all clients with pagination and filters' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Clients retrieved' })
  async listClients(@Query() query: ListClientsQueryDto) {
    return this.clientService.listClients(query);
  }

  @Get(':id')
  @Roles(
    OpsRole.ADMIN,
    OpsRole.SUPERVISOR,
    OpsRole.WAREHOUSE_OPS,
    OpsRole.BILLING,
    OpsRole.READONLY,
  )
  @ApiOperation({ summary: 'Get client by ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Client retrieved' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Client not found' })
  async getClient(@Param('id') id: string) {
    return this.clientService.getClient(id);
  }

  @Patch(':id')
  @Roles(OpsRole.ADMIN, OpsRole.SUPERVISOR)
  @ApiOperation({ summary: 'Update client details' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Client updated' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Client not found' })
  async updateClient(@Param('id') id: string, @Body() dto: UpdateClientDto) {
    return this.clientService.updateClient(id, dto);
  }

  @Patch(':id/status')
  @Roles(OpsRole.ADMIN, OpsRole.SUPERVISOR)
  @ApiOperation({ summary: 'Update client status' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Client status updated' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Client not found' })
  async updateClientStatus(
    @Param('id') id: string,
    @Body() dto: UpdateClientStatusDto,
  ) {
    return this.clientService.updateClientStatus(id, dto);
  }

  @Patch(':id/config')
  @Roles(OpsRole.ADMIN, OpsRole.SUPERVISOR)
  @ApiOperation({ summary: 'Update client configuration' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Client config updated',
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Client not found' })
  async updateClientConfig(
    @Param('id') id: string,
    @Body() dto: UpdateClientConfigDto,
  ) {
    return this.clientService.updateClientConfig(id, dto);
  }

  @Post(':id/contracts')
  @Roles(OpsRole.ADMIN, OpsRole.SUPERVISOR, OpsRole.BILLING)
  @ApiOperation({ summary: 'Create a new contract for the client' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Contract created' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Client not found' })
  async createContract(
    @Param('id') clientId: string,
    @Body() dto: CreateContractDto,
  ) {
    return this.clientService.createContract(clientId, dto);
  }

  @Get(':id/contracts')
  @Roles(
    OpsRole.ADMIN,
    OpsRole.SUPERVISOR,
    OpsRole.BILLING,
    OpsRole.READONLY,
  )
  @ApiOperation({ summary: 'List all contracts for the client' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Contracts retrieved' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Client not found' })
  async listContracts(@Param('id') clientId: string) {
    return this.clientService.listContracts(clientId);
  }

  @Post(':id/contracts/:contractId/sla')
  @Roles(OpsRole.ADMIN, OpsRole.SUPERVISOR, OpsRole.BILLING)
  @ApiOperation({ summary: 'Add an SLA definition to a contract' })
  async addSla(
    @Param('id') clientId: string,
    @Param('contractId') contractId: string,
    @Body() body: { metric: string; targetValue: string },
  ) {
    return this.clientService.addSlaDefinition(clientId, contractId, body);
  }

  @Post(':id/portal-users')
  @Roles(OpsRole.ADMIN, OpsRole.SUPERVISOR)
  @ApiOperation({ summary: 'Create a portal user for the client' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Portal user created',
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Client not found' })
  async createPortalUser(
    @Param('id') clientId: string,
    @Body() dto: CreatePortalUserDto,
  ) {
    return this.clientService.createPortalUser(clientId, dto);
  }

  @Get(':id/portal-users')
  @Roles(OpsRole.ADMIN, OpsRole.SUPERVISOR, OpsRole.READONLY)
  @ApiOperation({ summary: 'List all portal users for the client' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Portal users retrieved' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Client not found' })
  async listPortalUsers(@Param('id') clientId: string) {
    return this.clientService.listPortalUsers(clientId);
  }

  @Patch(':id/portal-users/:userId')
  @Roles(OpsRole.ADMIN, OpsRole.SUPERVISOR)
  @ApiOperation({ summary: 'Update a portal user' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Portal user updated' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'User not found' })
  async updatePortalUser(
    @Param('id') clientId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdatePortalUserDto,
  ) {
    return this.clientService.updatePortalUser(clientId, userId, dto);
  }

  @Delete(':id/portal-users/:userId')
  @Roles(OpsRole.ADMIN, OpsRole.SUPERVISOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a portal user' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Portal user deleted',
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'User not found' })
  async deletePortalUser(
    @Param('id') clientId: string,
    @Param('userId') userId: string,
  ) {
    await this.clientService.deletePortalUser(clientId, userId);
  }
}
