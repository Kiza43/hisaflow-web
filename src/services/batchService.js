// The real problem this solves: if you buy 10 units at TZS 500, sell 5,
// then buy 10 more at TZS 700, a single running average blends those
// together — the next sale gets charged against a blended cost that was
// never the actual price paid for the specific units being sold. FIFO
// batches fix this by tracking each delivery separately and consuming the
// oldest one first, so profit on every single sale reflects what was
// genuinely paid for those exact units.
//
// product.stock and product.buyingPrice stay as always-in-sync derived
// fields — every function here recalculates and returns them alongside
// stockBatches, so nothing else in the app (ProductCard, filters, the
// dashboard) needs to change at all. stockBatches is the real source of
// truth underneath; those two fields are just a cheap, always-correct
// summary of it.

const recalcSummary = (stockBatches) => {
  const stock = stockBatches.reduce((sum, b) => sum + b.remaining, 0);
  const totalValue = stockBatches.reduce(
    (sum, b) => sum + b.remaining * b.buyingPrice,
    0,
  );
  const buyingPrice = stock > 0 ? totalValue / stock : 0;
  return { stock, buyingPrice };
};

export const batchService = {
  createBatch(quantity, buyingPrice, date) {
    return {
      id: `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      quantity,
      remaining: quantity,
      buyingPrice,
      date: date || new Date().toISOString(),
    };
  },

  // Idempotent — a product that already has stockBatches is returned
  // completely untouched (same reference, same batch ids). This matters:
  // if migration regenerated random ids every time it ran, anything
  // referencing a batch by id (editing, payment tracking) would silently
  // break the moment the app touched that product again.
  migrateProduct(product) {
    if (Array.isArray(product.stockBatches)) return product;

    const stock = product.stock || 0;
    const buyingPrice = product.buyingPrice || 0;
    const stockBatches =
      stock > 0
        ? [this.createBatch(stock, buyingPrice, product.createdAt)]
        : [];

    return { ...product, stockBatches, stock, buyingPrice };
  },

  // FIFO consumption — oldest batch first. Returns the real cost of THIS
  // specific sale from the batches actually consumed, plus the updated
  // product. Returns null (not a partial sale) if requested quantity
  // exceeds total stock — a sale should never silently oversell.
  consumeStock(product, quantitySold) {
    const migrated = this.migrateProduct(product);
    const totalAvailable = migrated.stockBatches.reduce(
      (sum, b) => sum + b.remaining,
      0,
    );
    if (quantitySold > totalAvailable) return null;

    const sortedBatches = [...migrated.stockBatches].sort(
      (a, b) => new Date(a.date) - new Date(b.date),
    );
    let remainingToConsume = quantitySold;
    let totalCost = 0;
    const updatedBatches = [];

    for (const batch of sortedBatches) {
      if (remainingToConsume <= 0) {
        updatedBatches.push(batch);
        continue;
      }
      const takeFromThisBatch = Math.min(batch.remaining, remainingToConsume);
      totalCost += takeFromThisBatch * batch.buyingPrice;
      remainingToConsume -= takeFromThisBatch;
      const newRemaining = batch.remaining - takeFromThisBatch;
      if (newRemaining > 0)
        updatedBatches.push({ ...batch, remaining: newRemaining });
      // fully consumed batches are dropped — nothing left to track
    }

    const { stock, buyingPrice } = recalcSummary(updatedBatches);
    return {
      updatedProduct: {
        ...migrated,
        stockBatches: updatedBatches,
        stock,
        buyingPrice,
      },
      totalCost,
      effectiveBuyingPrice: quantitySold > 0 ? totalCost / quantitySold : 0,
    };
  },

  // Adds a genuinely new batch rather than blending into one average —
  // this is what makes restocking at a different price actually mean
  // something distinct in the data, not just a recalculated number.
  addBatch(product, quantity, buyingPrice, date) {
    const migrated = this.migrateProduct(product);
    const newBatch = this.createBatch(quantity, buyingPrice, date);
    const stockBatches = [...migrated.stockBatches, newBatch];
    const { stock, buyingPrice: avgBuyingPrice } = recalcSummary(stockBatches);
    return { ...migrated, stockBatches, stock, buyingPrice: avgBuyingPrice };
  },
};
