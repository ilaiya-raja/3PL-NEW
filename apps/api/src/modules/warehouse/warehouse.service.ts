import { Injectable } from '@nestjs/common';
import { LicenseService } from '../../license/license.service';
import { WarehouseRepository } from './warehouse.repository';
import { ZoneRepository } from './zone.repository';
import { LocationRepository } from './location.repository';
import { createPaginationMeta } from '../../common/utils/pagination';
import { toWarehouseDto, toZoneDto, toLocationDto } from './warehouse.mapper';
import type { CreateWarehouseDto } from './dto/create-warehouse.dto';
import type { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import type { CreateZoneDto } from './dto/create-zone.dto';
import type { UpdateZoneDto } from './dto/update-zone.dto';
import type { CreateLocationDto } from './dto/create-location.dto';
import type { UpdateLocationDto } from './dto/update-location.dto';
import type { AssignLocationDto } from './dto/assign-location.dto';
import type { BulkLocationsDto } from './dto/bulk-locations.dto';
import type { ListWarehousesQueryDto } from './dto/list-warehouses-query.dto';

@Injectable()
export class WarehouseService {
  constructor(
    private readonly warehouseRepository: WarehouseRepository,
    private readonly zoneRepository: ZoneRepository,
    private readonly locationRepository: LocationRepository,
    private readonly licenseService: LicenseService,
  ) {}

  async createWarehouse(data: CreateWarehouseDto) {
    await this.licenseService.assertWithinLimit('warehouses');

    const warehouse = await this.warehouseRepository.create(data);
    return toWarehouseDto(warehouse);
  }

  async listWarehouses(query: ListWarehousesQueryDto) {
    const { items, total } = await this.warehouseRepository.findMany(query);

    return {
      items: items.map(toWarehouseDto),
      meta: createPaginationMeta(
        query.page!,
        query.limit!,
        total,
        query.sortBy,
        query.sortOrder,
      ),
    };
  }

  async getWarehouse(id: string) {
    const warehouse = await this.warehouseRepository.findById(id);
    return toWarehouseDto(warehouse);
  }

  async updateWarehouse(id: string, data: UpdateWarehouseDto) {
    const warehouse = await this.warehouseRepository.update(id, data);
    return toWarehouseDto(warehouse);
  }

  async createZone(warehouseId: string, data: CreateZoneDto) {
    await this.warehouseRepository.findById(warehouseId);
    const zone = await this.zoneRepository.create(warehouseId, data);
    return toZoneDto(zone);
  }

  async listZones(warehouseId: string) {
    await this.warehouseRepository.findById(warehouseId);
    const zones = await this.zoneRepository.findByWarehouseId(warehouseId);
    return zones.map(toZoneDto);
  }

  async updateZone(id: string, data: UpdateZoneDto) {
    const zone = await this.zoneRepository.update(id, data);
    return toZoneDto(zone);
  }

  async createLocation(zoneId: string, data: CreateLocationDto) {
    const zone = await this.zoneRepository.findById(zoneId);
    const location = await this.locationRepository.create(
      zoneId,
      zone.warehouseId,
      data,
    );
    return toLocationDto(location);
  }

  async createBulkLocations(zoneId: string, data: BulkLocationsDto) {
    const zone = await this.zoneRepository.findById(zoneId);
    const result = await this.locationRepository.createBulk(
      zoneId,
      zone.warehouseId,
      data.locations,
    );
    return {
      created: result.count,
      errors: [],
    };
  }

  async listLocations(zoneId: string) {
    await this.zoneRepository.findById(zoneId);
    const locations = await this.locationRepository.findByZoneId(zoneId);
    return locations.map(toLocationDto);
  }

  async updateLocation(id: string, data: UpdateLocationDto) {
    const location = await this.locationRepository.update(id, data);
    return toLocationDto(location);
  }

  async assignLocation(id: string, data: AssignLocationDto) {
    const location = await this.locationRepository.assignClient(id, data.clientId);
    return toLocationDto(location);
  }

  async releaseLocation(id: string) {
    const location = await this.locationRepository.releaseClient(id);
    return toLocationDto(location);
  }

  async getSpaceUtilization(warehouseId: string) {
    await this.warehouseRepository.findById(warehouseId);
    return this.locationRepository.getSpaceUtilization(warehouseId);
  }
}
