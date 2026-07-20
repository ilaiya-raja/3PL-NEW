import {
  Body,
  Controller,
  Get,
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
import { OpsUserService } from './ops-user.service';
import { CreateOpsUserDto } from './dto/create-ops-user.dto';
import { UpdateOpsUserDto } from './dto/update-ops-user.dto';
import { ListOpsUsersQueryDto } from './dto/list-ops-users-query.dto';

@ApiTags('ops-users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ops-users')
export class OpsUserController {
  constructor(private readonly opsUserService: OpsUserService) {}

  @Post()
  @Roles(OpsRole.ADMIN)
  @ApiOperation({ summary: 'Create a new ops user' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Ops user created' })
  async createOpsUser(@Body() dto: CreateOpsUserDto) {
    return this.opsUserService.createOpsUser(dto);
  }

  @Get()
  @Roles(OpsRole.ADMIN, OpsRole.SUPERVISOR)
  @ApiOperation({ summary: 'List ops users with pagination and filters' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Ops users retrieved' })
  async listOpsUsers(@Query() query: ListOpsUsersQueryDto) {
    return this.opsUserService.listOpsUsers(query);
  }

  @Get(':id')
  @Roles(OpsRole.ADMIN, OpsRole.SUPERVISOR)
  @ApiOperation({ summary: 'Get ops user by ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Ops user retrieved' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Ops user not found' })
  async getOpsUser(@Param('id') id: string) {
    return this.opsUserService.getOpsUser(id);
  }

  @Patch(':id')
  @Roles(OpsRole.ADMIN)
  @ApiOperation({ summary: 'Update ops user details' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Ops user updated' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Ops user not found' })
  async updateOpsUser(
    @Param('id') id: string,
    @Body() dto: UpdateOpsUserDto,
  ) {
    return this.opsUserService.updateOpsUser(id, dto);
  }
}
