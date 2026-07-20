import '../src/config/env.js';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import Order from '../src/models/Order.js';
import { canGenerateInvoice } from '../src/utils/invoiceEligibility.js';
import { getOrCreateInvoiceNumber } from '../src/utils/invoiceNumber.js';

const batchSize = 50;

async function assignInvoiceNumbers() {
  await connectDatabase();

  let scanned = 0;
  let assigned = 0;
  let skipped = 0;
  let cursor = null;

  try {
    cursor = Order.find({
      $or: [{ 'invoice.number': { $exists: false } }, { 'invoice.number': '' }, { 'invoice.number': null }],
    })
      .sort({ createdAt: 1 })
      .cursor();

    for await (const order of cursor) {
      scanned += 1;

      if (!canGenerateInvoice(order)) {
        skipped += 1;
        continue;
      }

      await getOrCreateInvoiceNumber(order);
      assigned += 1;

      if (assigned > 0 && assigned % batchSize === 0) {
        console.log(`Assigned ${assigned} invoice numbers so far...`);
      }
    }

    console.log(`Invoice assignment complete. Scanned: ${scanned}. Assigned: ${assigned}. Skipped: ${skipped}.`);
  } finally {
    await cursor?.close?.();
    await disconnectDatabase();
  }
}

assignInvoiceNumbers().catch(async (error) => {
  console.error(error.message || 'Unable to assign invoice numbers.');
  await disconnectDatabase();
  process.exit(1);
});

