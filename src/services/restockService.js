import { dataService } from "./dataService";
import { batchService } from "./batchService";
import { activityLogService } from "./activityLogService";

const formatTZS = (amount) =>
  "TZS " + Math.round(amount || 0).toLocaleString("en-US");

// Adding stock now creates a genuinely new batch via batchService.addBatch
// rather than blending into one running average — this is what makes it
// possible for salesService to later know the real, specific cost of the
// units it's selling (FIFO), not just an average that drifts from reality
// as prices change over time.
export const restockService = {
  async addStock({ productId, quantity, buyingPrice }) {
    if (quantity <= 0) {
      return { success: false, error: "Weka kiasi sahihi" };
    }

    const products = await dataService.getProducts();
    const product = products.find((p) => p.id === productId);
    if (!product) {
      return { success: false, error: "Bidhaa haipatikani" };
    }

    const updatedProducts = products.map((p) =>
      p.id === productId ? batchService.addBatch(p, quantity, buyingPrice) : p,
    );
    await dataService.saveProducts(updatedProducts);

    await activityLogService.logActivity(
      "added stock",
      `${product.name} +${quantity} @ ${formatTZS(buyingPrice)}`,
    );

    return { success: true };
  },

  // Same all-or-nothing guarantee as the sell cart — a restock order
  // covering several products is one business event (one delivery, one
  // supplier trip), so it should commit completely or not at all, not
  // partially apply if something's wrong with one line item.
  async completeRestockCart(cartItems) {
    if (!cartItems || cartItems.length === 0) {
      return { success: false, error: "Hakuna bidhaa kwenye kikapu" };
    }
    for (const item of cartItems) {
      if (item.quantity <= 0) {
        return {
          success: false,
          error: `${item.productName}: weka kiasi sahihi`,
        };
      }
    }

    const products = await dataService.getProducts();

    const updatedProducts = products.map((p) => {
      const cartItem = cartItems.find((item) => item.productId === p.id);
      if (!cartItem) return p;
      return batchService.addBatch(p, cartItem.quantity, cartItem.buyingPrice);
    });

    await dataService.saveProducts(updatedProducts);
    await activityLogService.logActivity(
      "restocked multiple products",
      `${cartItems.length} bidhaa`,
    );
    return { success: true };
  },
};
