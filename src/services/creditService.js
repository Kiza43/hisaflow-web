import { dataService } from "./dataService";
import { batchService } from "./batchService";
import { activityLogService } from "./activityLogService";

const formatTZS = (amount) =>
  "TZS " + Math.round(amount || 0).toLocaleString("en-US");

// A credit sale is a real sale — the goods leave the shelf immediately,
// same FIFO consumption as a cash sale, only payment doesn't happen now.
// Each item records the actual batch cost it was sold at (costAtSale) —
// this is what lets deleteCreditSale correctly restore stock as a real
// batch later, rather than just bumping a number and silently breaking
// the connection between stock and stockBatches.
export const creditService = {
  async completeCreditSale({ cartItems, customerName, customerPhone }) {
    if (!cartItems || cartItems.length === 0) {
      return { success: false, error: "Hakuna bidhaa kwenye kikapu" };
    }
    if (!customerName || !customerName.trim()) {
      return { success: false, error: "Weka jina la mteja" };
    }

    const products = await dataService.getProducts();
    const productMap = new Map(products.map((p) => [p.id, p]));
    const consumptions = new Map();

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

    const totalAmount = cartItems.reduce(
      (sum, item) => sum + item.quantity * item.sellingPrice,
      0,
    );

    const creditSale = {
      id: `cs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      customerName: customerName.trim(),
      customerPhone: (customerPhone || "").trim(),
      items: cartItems.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        sellingPrice: item.sellingPrice,
        costAtSale: consumptions.get(item.productId).effectiveBuyingPrice,
      })),
      totalAmount,
      amountPaid: 0,
      status: "pending", // 'pending' | 'partial' | 'paid'
      payments: [],
      date: new Date().toISOString(),
    };

    const existing = await dataService.getCreditSales();
    await dataService.saveCreditSales([...existing, creditSale]);

    await activityLogService.logActivity(
      "sold on credit",
      `${customerName.trim()} — ${formatTZS(totalAmount)}`,
    );

    return { success: true, creditSale };
  },

  async recordPayment(creditSaleId, amount, paymentMethod) {
    if (amount <= 0) {
      return { success: false, error: "Weka kiasi sahihi" };
    }

    const creditSales = await dataService.getCreditSales();
    const creditSale = creditSales.find((cs) => cs.id === creditSaleId);
    if (!creditSale) {
      return { success: false, error: "Deni halipatikani" };
    }

    const remaining = creditSale.totalAmount - creditSale.amountPaid;
    if (amount > remaining) {
      return {
        success: false,
        error: `Kiasi kinazidi deni lililobaki (${remaining})`,
      };
    }

    const newAmountPaid = creditSale.amountPaid + amount;
    const newStatus =
      newAmountPaid >= creditSale.totalAmount ? "paid" : "partial";

    const updatedCreditSales = creditSales.map((cs) =>
      cs.id === creditSaleId
        ? {
            ...cs,
            amountPaid: newAmountPaid,
            status: newStatus,
            payments: [
              ...cs.payments,
              {
                amount,
                paymentMethod: paymentMethod || "",
                date: new Date().toISOString(),
              },
            ],
          }
        : cs,
    );
    await dataService.saveCreditSales(updatedCreditSales);

    await activityLogService.logActivity(
      "recorded a credit payment",
      `${creditSale.customerName} — ${formatTZS(amount)}`,
    );

    return { success: true, isFullySettled: newStatus === "paid" };
  },

  // Deleting a credit sale isn't just removing a record — the goods it
  // represented left the shelf when it was created, so deleting it needs
  // to give that stock back as a real batch at the price it was actually
  // costed at (costAtSale), not just increment a number and leave
  // stockBatches out of sync with it.
  async deleteCreditSale(creditSaleId) {
    const creditSales = await dataService.getCreditSales();
    const creditSale = creditSales.find((cs) => cs.id === creditSaleId);
    if (!creditSale) {
      return { success: false, error: "Deni halipatikani" };
    }

    const products = await dataService.getProducts();
    const updatedProducts = products.map((p) => {
      const item = (creditSale.items || []).find((i) => i.productId === p.id);
      if (!item) return p;
      const restoreCost = item.costAtSale ?? p.buyingPrice ?? 0;
      return batchService.addBatch(p, item.quantity, restoreCost);
    });
    await dataService.saveProducts(updatedProducts);

    const updatedCreditSales = creditSales.filter(
      (cs) => cs.id !== creditSaleId,
    );
    await dataService.saveCreditSales(updatedCreditSales);

    await activityLogService.logActivity(
      "deleted a credit sale",
      `${creditSale.customerName} — ${formatTZS(creditSale.totalAmount)}`,
    );

    return { success: true };
  },
};
