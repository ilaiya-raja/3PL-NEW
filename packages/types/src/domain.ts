import type {
  AdjustmentStatus,
  AppointmentStatus,
  CartonStatus,
  ClientStatus,
  HoldType,
  LocationType,
  LotStatus,
  OpsRole,
  OrderStatus,
  PickTaskStatus,
  PortalRole,
  ReceiptStatus,
  ShipStatus,
  TempClass,
  TxnType,
  WaveStatus,
  ZoneType,
} from './enums';
import type { AllocationStrategy } from './enums';
import type { ClientBranding } from './auth';

export interface ClientConfig {
  allocationStrategy?: AllocationStrategy;
  adjustmentAutoApproveThreshold?: number;
  [key: string]: unknown;
}

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface Dimensions {
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
}

export interface PackConfig {
  unitsPerCase?: number;
  casesPerPallet?: number;
  caseWeightKg?: number;
  [key: string]: unknown;
}

export interface ShipToAddress {
  name: string;
  phone?: string;
  email?: string;
  address: Address;
}

export interface OpsUserDto {
  id: string;
  email: string;
  name: string;
  role: OpsRole;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClientDto {
  id: string;
  code: string;
  legalName: string;
  gstin: string | null;
  status: ClientStatus;
  config: ClientConfig;
  branding: ClientBranding;
  createdAt: string;
  updatedAt: string;
}

export interface ContractDto {
  id: string;
  clientId: string;
  startDate: string;
  endDate: string;
  minMonthlyCommit: string | null;
  renewalAlertDays: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  slaDefinitions?: Array<{
    id: string;
    metric: string;
    targetValue: string;
    createdAt: string;
  }>;
}

export interface PortalUserDto {
  id: string;
  clientId: string;
  email: string;
  name: string;
  role: PortalRole;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WarehouseDto {
  id: string;
  code: string;
  name: string;
  address: Address;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ZoneDto {
  id: string;
  warehouseId: string;
  code: string;
  name: string;
  type: ZoneType;
  tempClass: TempClass;
  hazmatAllowed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LocationDto {
  id: string;
  zoneId: string;
  warehouseId: string;
  code: string;
  type: LocationType;
  clientId: string | null;
  pickSequence: number | null;
  maxWeightKg: string | null;
  dims: Dimensions | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ItemDto {
  id: string;
  clientId: string;
  sku: string;
  description: string;
  uom: string;
  packConfig: PackConfig;
  lotTracked: boolean;
  serialTracked: boolean;
  shelfLifeDays: number | null;
  minShipShelfPct: number | null;
  hazmatClass: string | null;
  tempClass: TempClass;
  velocityClass: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryLotDto {
  id: string;
  clientId: string;
  itemId: string;
  warehouseId: string;
  locationId: string | null;
  lpn: string | null;
  lotNumber: string | null;
  expiryDate: string | null;
  qtyOnHand: string;
  qtyAllocated: string;
  status: LotStatus;
  receivedAt: string;
  receiptLineId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryTransactionDto {
  id: string;
  clientId: string;
  txnType: TxnType;
  itemId: string;
  lotId: string;
  fromLocationId: string | null;
  toLocationId: string | null;
  qtyDelta: string;
  statusFrom: LotStatus | null;
  statusTo: LotStatus | null;
  refType: string | null;
  refId: string | null;
  actorId: string | null;
  notes: string | null;
  occurredAt: string;
  createdAt: string;
}

export interface InventoryHoldDto {
  id: string;
  clientId: string;
  itemId: string | null;
  lotId: string | null;
  locationId: string | null;
  holdType: HoldType;
  reason: string;
  heldBy: string;
  releasedBy: string | null;
  releasedAt: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdjustmentDto {
  id: string;
  clientId: string;
  itemId: string;
  lotId: string;
  locationId: string | null;
  qtyDelta: string;
  reasonCode: string;
  notes: string | null;
  status: AdjustmentStatus;
  requestedBy: string;
  approvedBy: string | null;
  rejectedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InboundReceiptDto {
  id: string;
  clientId: string;
  warehouseId: string;
  asnNumber: string | null;
  status: ReceiptStatus;
  expectedDate: string | null;
  arrivedAt: string | null;
  completedAt: string | null;
  carrierName: string | null;
  vehicleRef: string | null;
  sealNumber: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InboundLineDto {
  id: string;
  receiptId: string;
  itemId: string;
  expectedQty: string;
  receivedQty: string;
  damagedQty: string;
  shortQty: string;
  lotNumber: string | null;
  expiryDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DockAppointmentDto {
  id: string;
  warehouseId: string;
  receiptId: string | null;
  dockCode: string;
  scheduledAt: string;
  durationMinutes: number;
  carrierName: string | null;
  vehicleRef: string | null;
  driverName: string | null;
  driverPhone: string | null;
  status: AppointmentStatus;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OutboundOrderDto {
  id: string;
  clientId: string;
  warehouseId: string;
  externalRef: string;
  status: OrderStatus;
  shipTo: ShipToAddress;
  billTo: ShipToAddress | null;
  priority: number;
  slaShipBy: string | null;
  waveId: string | null;
  notes: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OutboundLineDto {
  id: string;
  orderId: string;
  itemId: string;
  orderedQty: string;
  pickedQty: string;
  packedQty: string;
  backorderedQty: string;
  requestedLotNumber: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AllocationDto {
  id: string;
  lineId: string;
  lotId: string;
  qty: string;
  allocatedAt: string;
}

export interface WaveDto {
  id: string;
  warehouseId: string;
  name: string;
  status: WaveStatus;
  releasedAt: string | null;
  completedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface PickTaskDto {
  id: string;
  waveId: string | null;
  orderId: string;
  lineId: string;
  lotId: string;
  fromLocationId: string;
  itemId: string;
  clientId: string;
  qtyToPick: string;
  qtyPicked: string;
  status: PickTaskStatus;
  pickSequence: number;
  assignedTo: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CartonDto {
  id: string;
  orderId: string;
  clientId: string;
  cartonNo: string;
  dims: Dimensions | null;
  weightKg: string | null;
  labelUrl: string | null;
  status: CartonStatus;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CartonLineDto {
  id: string;
  cartonId: string;
  itemId: string;
  lotId: string;
  qty: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShipmentDto {
  id: string;
  orderId: string;
  clientId: string;
  carrierName: string | null;
  trackingNumber: string | null;
  labelUrl: string | null;
  podUrl: string | null;
  shipDate: string | null;
  status: ShipStatus;
  ewayBillNo: string | null;
  manifestedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WriteLedgerParams {
  clientId: string;
  txnType: TxnType;
  itemId: string;
  lotId: string;
  fromLocationId?: string | null;
  toLocationId?: string | null;
  qtyDelta: string | number;
  statusFrom?: LotStatus | null;
  statusTo?: LotStatus | null;
  refType?: string | null;
  refId?: string | null;
  actorId?: string | null;
  notes?: string | null;
  occurredAt?: Date;
}
