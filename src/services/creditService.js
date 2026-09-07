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
  // Migrated to a real SQL transaction — same reasoning as
  // salesService.completeCartSale, since a credit sale is really a cart
  // sale with a different payment status. The costAtSale preserved per
  // item was tested directly: it reflects genuine FIFO cost across
  // whatever batches were actually consumed, not the product's current
  // blended average — this is what makes deleteCreditSale's stock
  // restoration correct later.
  async completeCreditSale({ cartItems, customerName, customerPhone }) {
    return dataService.completeCreditSale({
      cartItems,
      customerName,
      customerPhone,
    });
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
  // to give that stock back as real batches at the prices they were
  // actually consumed at. If the sale spanned two batches at different
  // prices, this restores two separate batches — not one blended into
  // an average that loses which units came from where.
  async deleteCreditSale(creditSaleId) {
    const creditSales = await dataService.getCreditSales();
    const creditSale = creditSales.find((cs) => cs.id === creditSaleId);
    if (!creditSale) {
      return { success: false, error: "Deni halipatikani" };
    }

    const restoreDate = new Date().toISOString();
    const products = await dataService.getProducts();
    const updatedProducts = products.map((p) => {
      const item = (creditSale.items || []).find((i) => i.productId === p.id);
      if (!item) return p;
      const fallbackCost = item.costAtSale ?? p.buyingPrice ?? 0;
      return batchService.restoreFromBreakdown(
        p,
        item.batchBreakdown,
        item.quantity,
        fallbackCost,
        restoreDate,
      );
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
