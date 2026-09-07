import { dataService } from "./dataService";
import { batchService } from "./batchService";
import { activityLogService } from "./activityLogService";

const formatTZS = (amount) =>
  "TZS " + Math.round(amount || 0).toLocaleString("en-US");

// Kept separate from any component on purpose — same reasoning as the
// phone app's store actions: the logic for "what actually happens when a
// sale completes" shouldn't live inside a form component. Now uses
// batchService.consumeStock so profit reflects the real, FIFO-consumed
// cost of the specific units sold — not a blended average that can drift
// from reality as buying prices change over time.
export const salesService = {
  // The first function migrated to a real, granular SQL transaction —
  // everything that used to happen here in JavaScript (load the whole
  // products array, run FIFO consumption, save the whole array back) now
  // happens atomically in the main process. This is deliberately the only
  // one converted so far; completeCartSale, editSale, and deleteSale still
  // use the array-based approach below, proven and working, while this one
  // serves as the template for migrating the rest.
  async completeSale({
    productId,
    quantity,
    sellingPrice,
    paymentMethod,
    accountId,
    accountLabel,
  }) {
    return dataService.completeSale({
      productId,
      quantity,
      sellingPrice,
      paymentMethod,
      accountId,
      accountLabel,
    });
  },

  // Second function migrated to a real SQL transaction — same reasoning
  // as completeSale, extended to multiple products at once. The
  // all-or-nothing guarantee this relies on was tested directly before
  // trusting it: a cart with one oversold item rolls back completely,
  // including stock already consumed for another, individually-valid
  // item in the same cart — not just the one that failed.
  async completeCartSale(cartItems, meta = {}) {
    return dataService.completeCartSale(cartItems, meta);
  },

  // Editing a sale isn't a simple field update — the stock it consumed
  // already left the shelf. The correct way to change it: first give back
  // what the ORIGINAL sale took (as a real batch, at the price it was
  // actually bought for), then re-consume stock for the NEW quantity from
  // that restored state. This handles both directions correctly — selling
  // more now, or realizing it should have been less — without ever
  // needing to reason about a "delta" by hand.
  async editSale(
    saleId,
    { quantity: newQuantity, sellingPrice: newSellingPrice, notes },
  ) {
    if (!newQuantity || newQuantity <= 0) {
      return { success: false, error: "Weka kiasi sahihi" };
    }
    if (!newSellingPrice || newSellingPrice <= 0) {
      return { success: false, error: "Weka bei sahihi ya kuuza" };
    }

    const sales = await dataService.getSales();
    const originalSale = sales.find((s) => s.id === saleId);
    if (!originalSale) {
      return { success: false, error: "Muuzo haupatikani" };
    }

    const products = await dataService.getProducts();
    const product = products.find((p) => p.id === originalSale.productId);
    if (!product) {
      return { success: false, error: "Bidhaa haipatikani tena" };
    }

    // Legacy sales recorded before this field existed won't have a stored
    // buyingPrice — derive a reasonable one from what's already on the
    // record rather than losing the restore entirely.
    const originalBuyingPrice =
      originalSale.buyingPrice ??
      (originalSale.quantity > 0
        ? originalSale.sellingPrice -
          (originalSale.profit || 0) / originalSale.quantity
        : product.buyingPrice);

    const restoredProduct = batchService.restoreFromBreakdown(
      product,
      originalSale.batchBreakdown,
      originalSale.quantity,
      originalBuyingPrice,
      new Date().toISOString(),
    );
    const consumption = batchService.consumeStock(restoredProduct, newQuantity);
    if (!consumption) {
      return {
        success: false,
        error: `Stoo haitoshi kwa kiasi kipya — ${restoredProduct.stock} pekee zingekuwepo`,
      };
    }

    const totalRevenue = newSellingPrice * newQuantity;
    const profit = totalRevenue - consumption.totalCost;

    const updatedSale = {
      ...originalSale,
      quantity: newQuantity,
      buyingPrice: consumption.effectiveBuyingPrice,
      sellingPrice: newSellingPrice,
      totalCost: consumption.totalCost,
      totalRevenue,
      profit,
      notes: notes || "",
      editedAt: new Date().toISOString(),
      batchBreakdown: consumption.breakdown,
    };

    const updatedSales = sales.map((s) => (s.id === saleId ? updatedSale : s));
    await dataService.saveSales(updatedSales);

    const updatedProducts = products.map((p) =>
      p.id === product.id ? consumption.updatedProduct : p,
    );
    await dataService.saveProducts(updatedProducts);

    await activityLogService.logActivity(
      "edited a sale",
      `${product.name} → ${newQuantity} × ${formatTZS(newSellingPrice)}`,
    );

    return { success: true, sale: updatedSale };
  },

  // Deleting a sale gives back the stock it took — as a real batch, at
  // the price it was actually bought for, same reasoning as
  // creditService.deleteCreditSale. Simpler than editing since there's no
  // new quantity to re-consume, just a straight restore.
  async deleteSale(saleId) {
    const sales = await dataService.getSales();
    const sale = sales.find((s) => s.id === saleId);
    if (!sale) {
      return { success: false, error: "Muuzo haupatikani" };
    }

    const products = await dataService.getProducts();
    const product = products.find((p) => p.id === sale.productId);

    if (product) {
      const originalBuyingPrice =
        sale.buyingPrice ??
        (sale.quantity > 0
          ? sale.sellingPrice - (sale.profit || 0) / sale.quantity
          : product.buyingPrice);
      const restoredProduct = batchService.restoreFromBreakdown(
        product,
        sale.batchBreakdown,
        sale.quantity,
        originalBuyingPrice,
        new Date().toISOString(),
      );
      const updatedProducts = products.map((p) =>
        p.id === product.id ? restoredProduct : p,
      );
      await dataService.saveProducts(updatedProducts);
    }
    // If the product itself was deleted since this sale happened, there's
    // nothing to restore stock to — the sale record is still removed.

    const updatedSales = sales.filter((s) => s.id !== saleId);
    await dataService.saveSales(updatedSales);

    await activityLogService.logActivity(
      "deleted a sale",
      `${sale.productName} × ${sale.quantity} — ${formatTZS(sale.totalRevenue)}`,
    );

    return { success: true };
  },
};
