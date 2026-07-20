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
import { ItemService } from './item.service';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { ImportItemsDto } from './dto/import-items.dto';
import { ListItemsQueryDto } from './dto/list-items-query.dto';

@ApiTags('items')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('clients/:clientId/items')
export class ItemController {
  constructor(private readonly itemService: ItemService) {}

  @Post()
  @Roles(OpsRole.ADMIN, OpsRole.SUPERVISOR, OpsRole.WAREHOUSE_OPS)
  @ApiOperation({ summary: 'Create a new item for the client' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Item created' })
  async createItem(
    @Param('clientId') clientId: string,
    @Body() dto: CreateItemDto,
  ) {
    return this.itemService.createItem(clientId, dto);
  }

  @Get()
  @Roles(
    OpsRole.ADMIN,
    OpsRole.SUPERVISOR,
    OpsRole.WAREHOUSE_OPS,
    OpsRole.BILLING,
    OpsRole.READONLY,
  )
  @ApiOperation({ summary: 'List all items for the client with pagination' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Items retrieved' })
  async listItems(
    @Param('clientId') clientId: string,
    @Query() query: ListItemsQueryDto,
  ) {
    return this.itemService.listItems(clientId, query);
  }

  @Get(':id')
  @Roles(
    OpsRole.ADMIN,
    OpsRole.SUPERVISOR,
    OpsRole.WAREHOUSE_OPS,
    OpsRole.READONLY,
  )
  @ApiOperation({ summary: 'Get item by ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Item retrieved' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Item not found' })
  async getItem(
    @Param('clientId') clientId: string,
    @Param('id') id: string,
  ) {
    return this.itemService.getItem(clientId, id);
  }

  @Patch(':id')
  @Roles(OpsRole.ADMIN, OpsRole.SUPERVISOR, OpsRole.WAREHOUSE_OPS)
  @ApiOperation({ summary: 'Update item details' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Item updated' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Item not found' })
  async updateItem(
    @Param('clientId') clientId: string,
    @Param('id') id: string,
    @Body() dto: UpdateItemDto,
  ) {
    return this.itemService.updateItem(clientId, id, dto);
  }

  @Post('import')
  @Roles(OpsRole.ADMIN, OpsRole.SUPERVISOR, OpsRole.WAREHOUSE_OPS)
  @ApiOperation({ summary: 'Import multiple items in bulk' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Items imported',
  })
  async importItems(
    @Param('clientId') clientId: string,
    @Body() dto: ImportItemsDto,
  ) {
    return this.itemService.importItems(clientId, dto);
  }
}
