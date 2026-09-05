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
  async completeSale({ productId, quantity, sellingPrice }) {
    const products = await dataService.getProducts();
    const product = products.find((p) => p.id === productId);

    if (!product) {
      return { success: false, error: "Bidhaa haipatikani" };
    }
    if (quantity <= 0) {
      return { success: false, error: "Weka kiasi sahihi" };
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
      sellingPrice,
      totalRevenue,
      profit,
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
  async completeCartSale(cartItems) {
    if (!cartItems || cartItems.length === 0) {
      return { success: false, error: "Hakuna bidhaa kwenye kikapu" };
    }

    const products = await dataService.getProducts();
    const productMap = new Map(products.map((p) => [p.id, p]));
    const consumptions = new Map(); // productId -> consumeStock result

    for (const item of cartItems) {
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
        sellingPrice: item.sellingPrice,
        totalRevenue,
        profit: totalRevenue - consumption.totalCost,
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
};
