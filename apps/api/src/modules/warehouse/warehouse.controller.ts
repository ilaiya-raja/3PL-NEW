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
import { WarehouseService } from './warehouse.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { CreateZoneDto } from './dto/create-zone.dto';
import { UpdateZoneDto } from './dto/update-zone.dto';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { AssignLocationDto } from './dto/assign-location.dto';
import { BulkLocationsDto } from './dto/bulk-locations.dto';
import { ListWarehousesQueryDto } from './dto/list-warehouses-query.dto';

@ApiTags('warehouses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('warehouses')
export class WarehouseController {
  constructor(private readonly warehouseService: WarehouseService) {}

  @Post()
  @Roles(OpsRole.ADMIN, OpsRole.SUPERVISOR)
  @ApiOperation({ summary: 'Create a new warehouse' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Warehouse created',
  })
  async createWarehouse(@Body() dto: CreateWarehouseDto) {
    return this.warehouseService.createWarehouse(dto);
  }

  @Get()
  @Roles(
    OpsRole.ADMIN,
    OpsRole.SUPERVISOR,
    OpsRole.WAREHOUSE_OPS,
    OpsRole.BILLING,
    OpsRole.READONLY,
  )
  @ApiOperation({ summary: 'List all warehouses with pagination' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Warehouses retrieved' })
  async listWarehouses(@Query() query: ListWarehousesQueryDto) {
    return this.warehouseService.listWarehouses(query);
  }

  @Get(':id')
  @Roles(
    OpsRole.ADMIN,
    OpsRole.SUPERVISOR,
    OpsRole.WAREHOUSE_OPS,
    OpsRole.READONLY,
  )
  @ApiOperation({ summary: 'Get warehouse by ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Warehouse retrieved' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Warehouse not found',
  })
  async getWarehouse(@Param('id') id: string) {
    return this.warehouseService.getWarehouse(id);
  }

  @Patch(':id')
  @Roles(OpsRole.ADMIN, OpsRole.SUPERVISOR)
  @ApiOperation({ summary: 'Update warehouse details' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Warehouse updated' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Warehouse not found',
  })
  async updateWarehouse(
    @Param('id') id: string,
    @Body() dto: UpdateWarehouseDto,
  ) {
    return this.warehouseService.updateWarehouse(id, dto);
  }

  @Post(':id/zones')
  @Roles(OpsRole.ADMIN, OpsRole.SUPERVISOR)
  @ApiOperation({ summary: 'Create a zone in the warehouse' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Zone created' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Warehouse not found',
  })
  async createZone(
    @Param('id') warehouseId: string,
    @Body() dto: CreateZoneDto,
  ) {
    return this.warehouseService.createZone(warehouseId, dto);
  }

  @Get(':id/zones')
  @Roles(
    OpsRole.ADMIN,
    OpsRole.SUPERVISOR,
    OpsRole.WAREHOUSE_OPS,
    OpsRole.READONLY,
  )
  @ApiOperation({ summary: 'List all zones in the warehouse' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Zones retrieved' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Warehouse not found',
  })
  async listZones(@Param('id') warehouseId: string) {
    return this.warehouseService.listZones(warehouseId);
  }

  @Get(':id/space-utilization')
  @Roles(
    OpsRole.ADMIN,
    OpsRole.SUPERVISOR,
    OpsRole.WAREHOUSE_OPS,
    OpsRole.READONLY,
  )
  @ApiOperation({ summary: 'Get warehouse space utilization statistics' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Space utilization retrieved',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Warehouse not found',
  })
  async getSpaceUtilization(@Param('id') warehouseId: string) {
    return this.warehouseService.getSpaceUtilization(warehouseId);
  }
}

@ApiTags('zones')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('zones')
export class ZoneController {
  constructor(private readonly warehouseService: WarehouseService) {}

  @Patch(':id')
  @Roles(OpsRole.ADMIN, OpsRole.SUPERVISOR)
  @ApiOperation({ summary: 'Update zone details' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Zone updated' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Zone not found' })
  async updateZone(@Param('id') id: string, @Body() dto: UpdateZoneDto) {
    return this.warehouseService.updateZone(id, dto);
  }

  @Post(':id/locations')
  @Roles(OpsRole.ADMIN, OpsRole.SUPERVISOR)
  @ApiOperation({ summary: 'Create a location in the zone' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Location created' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Zone not found' })
  async createLocation(
    @Param('id') zoneId: string,
    @Body() dto: CreateLocationDto,
  ) {
    return this.warehouseService.createLocation(zoneId, dto);
  }

  @Post(':id/locations/bulk')
  @Roles(OpsRole.ADMIN, OpsRole.SUPERVISOR)
  @ApiOperation({ summary: 'Create multiple locations in the zone' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Locations created',
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Zone not found' })
  async createBulkLocations(
    @Param('id') zoneId: string,
    @Body() dto: BulkLocationsDto,
  ) {
    return this.warehouseService.createBulkLocations(zoneId, dto);
  }

  @Get(':id/locations')
  @Roles(
    OpsRole.ADMIN,
    OpsRole.SUPERVISOR,
    OpsRole.WAREHOUSE_OPS,
    OpsRole.READONLY,
  )
  @ApiOperation({ summary: 'List all locations in the zone' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Locations retrieved' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Zone not found' })
  async listLocations(@Param('id') zoneId: string) {
    return this.warehouseService.listLocations(zoneId);
  }
}

@ApiTags('locations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('locations')
export class LocationController {
  constructor(private readonly warehouseService: WarehouseService) {}

  @Patch(':id')
  @Roles(OpsRole.ADMIN, OpsRole.SUPERVISOR)
  @ApiOperation({ summary: 'Update location details' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Location updated' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Location not found',
  })
  async updateLocation(
    @Param('id') id: string,
    @Body() dto: UpdateLocationDto,
  ) {
    return this.warehouseService.updateLocation(id, dto);
  }

  @Patch(':id/assign')
  @Roles(OpsRole.ADMIN, OpsRole.SUPERVISOR)
  @ApiOperation({ summary: 'Assign location to a client' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Location assigned' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Location not found',
  })
  async assignLocation(
    @Param('id') id: string,
    @Body() dto: AssignLocationDto,
  ) {
    return this.warehouseService.assignLocation(id, dto);
  }

  @Patch(':id/release')
  @Roles(OpsRole.ADMIN, OpsRole.SUPERVISOR)
  @ApiOperation({ summary: 'Release location from client assignment' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Location released' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Location not found',
  })
  async releaseLocation(@Param('id') id: string) {
    return this.warehouseService.releaseLocation(id);
  }
}
