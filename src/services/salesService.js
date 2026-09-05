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
  async completeSale({
    productId,
    quantity,
    sellingPrice,
    paymentMethod,
    accountId,
    accountLabel,
  }) {
    const products = await dataService.getProducts();
    const product = products.find((p) => p.id === productId);

    if (!product) {
      return { success: false, error: "Bidhaa haipatikani" };
    }
    if (quantity <= 0) {
      return { success: false, error: "Weka kiasi sahihi" };
    }
    if (!sellingPrice || sellingPrice <= 0) {
      return { success: false, error: "Weka bei sahihi ya kuuza" };
    }

    const consumption = batchService.consumeStock(product, quantity);
    if (!consumption) {
      return {
        success: false,
        error: `Stoo haitoshi — ${product.stock} pekee zimebaki`,
      };
    }

    const updatedProducts = products.map((p) =>
      p.id === productId ? consumption.updatedProduct : p,
    );
    await dataService.saveProducts(updatedProducts);

    const totalRevenue = sellingPrice * quantity;
    const profit = totalRevenue - consumption.totalCost;

    const sale = {
      id: `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      productId,
      productName: product.name,
      quantity,
      buyingPrice: consumption.effectiveBuyingPrice,
      sellingPrice,
      totalCost: consumption.totalCost,
      totalRevenue,
      profit,
      paymentMethod: paymentMethod || "cash",
      accountId: accountId || null,
      accountLabel: accountLabel || "",
      notes: "",
      date: new Date().toISOString(),
    };

    const sales = await dataService.getSales();
    await dataService.saveSales([...sales, sale]);

    await activityLogService.logActivity(
      "sold a product",
      `${product.name} × ${quantity} — ${formatTZS(totalRevenue)}`,
    );

    return { success: true, sale };
  },

  // Handles a cart of multiple products as one transaction. Every item's
  // stock consumption is computed first (consumeStock is a pure function —
  // nothing is saved yet), and only committed to disk if every single one
  // succeeds. Same all-or-nothing guarantee as before: a cart with 3 valid
  // items and 1 oversold item commits nothing at all, not the first 3.
  async completeCartSale(cartItems, meta = {}) {
    if (!cartItems || cartItems.length === 0) {
      return { success: false, error: "Hakuna bidhaa kwenye kikapu" };
    }

    const products = await dataService.getProducts();
    const productMap = new Map(products.map((p) => [p.id, p]));
    const consumptions = new Map(); // productId -> consumeStock result

    for (const item of cartItems) {
      if (!item.quantity || item.quantity <= 0) {
        return {
          success: false,
          error: `${item.productName}: weka kiasi sahihi`,
        };
      }
      if (!item.sellingPrice || item.sellingPrice <= 0) {
        return {
          success: false,
          error: `${item.productName}: weka bei sahihi ya kuuza`,
        };
      }
      const product = productMap.get(item.productId);
      if (!product) {
        return {
          success: false,
          error: `${item.productName} haipatikani tena`,
        };
      }
      const consumption = batchService.consumeStock(product, item.quantity);
      if (!consumption) {
        return {
          success: false,
          error: `${item.productName}: stoo haitoshi (${product.stock} pekee zimebaki)`,
        };
      }
      consumptions.set(item.productId, consumption);
    }

    const updatedProducts = products.map((p) =>
      consumptions.has(p.id) ? consumptions.get(p.id).updatedProduct : p,
    );
    await dataService.saveProducts(updatedProducts);

    const now = new Date().toISOString();
    const newSales = cartItems.map((item) => {
      const consumption = consumptions.get(item.productId);
      const totalRevenue = item.sellingPrice * item.quantity;
      return {
        id: `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        buyingPrice: consumption.effectiveBuyingPrice,
        sellingPrice: item.sellingPrice,
        totalCost: consumption.totalCost,
        totalRevenue,
        profit: totalRevenue - consumption.totalCost,
        paymentMethod: meta.paymentMethod || "cash",
        accountId: meta.accountId || null,
        accountLabel: meta.accountLabel || "",
        notes: "",
        date: now,
      };
    });

    const existingSales = await dataService.getSales();
    await dataService.saveSales([...existingSales, ...newSales]);

    const total = newSales.reduce((sum, s) => sum + s.totalRevenue, 0);
    await activityLogService.logActivity(
      "sold multiple products",
      `${newSales.length} bidhaa — ${formatTZS(total)}`,
    );

    return { success: true, sales: newSales };
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

    const restoredProduct = batchService.addBatch(
      product,
      originalSale.quantity,
      originalBuyingPrice,
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
      const restoredProduct = batchService.addBatch(
        product,
        sale.quantity,
        originalBuyingPrice,
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
