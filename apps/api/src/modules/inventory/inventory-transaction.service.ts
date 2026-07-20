import { Injectable } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@wms/db';
import type { WriteLedgerParams } from '@wms/types';

@Injectable()
export class InventoryTransactionService {
  async writeLedger(
    params: WriteLedgerParams,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await tx.inventoryTransaction.create({
      data: {
        clientId: params.clientId,
        txnType: params.txnType,
        itemId: params.itemId,
        lotId: params.lotId,
        fromLocationId: params.fromLocationId ?? null,
        toLocationId: params.toLocationId ?? null,
        qtyDelta: new Decimal(params.qtyDelta.toString()),
        statusFrom: params.statusFrom ?? null,
        statusTo: params.statusTo ?? null,
        refType: params.refType ?? null,
        refId: params.refId ?? null,
        actorId: params.actorId ?? null,
        notes: params.notes ?? null,
        occurredAt: params.occurredAt ?? new Date(),
      },
    });
  }
}
