import { dataService } from "./dataService";

// Adding stock isn't just "increase the number" — the buying price of the
// new batch is usually different from what's already on the shelf, so the
// product's averageBuyingPrice needs a proper weighted recalculation.
// Buying at 500 then again at 600 doesn't make the product cost 600 — it
// makes it cost somewhere between the two, weighted by how much of each.
const recalculateAveragePrice = (
  currentStock,
  currentAvgPrice,
  addedQuantity,
  newBuyingPrice,
) => {
  const totalStock = currentStock + addedQuantity;
  if (totalStock <= 0) return newBuyingPrice;
  return (
    (currentStock * currentAvgPrice + addedQuantity * newBuyingPrice) /
    totalStock
  );
};

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

    const currentStock = product.stock || 0;
    const currentAvgPrice = product.buyingPrice || 0;
    const newAvgPrice = recalculateAveragePrice(
      currentStock,
      currentAvgPrice,
      quantity,
      buyingPrice,
    );

    const updatedProducts = products.map((p) =>
      p.id === productId
        ? { ...p, stock: currentStock + quantity, buyingPrice: newAvgPrice }
        : p,
    );
    await dataService.saveProducts(updatedProducts);

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
    const productMap = new Map(products.map((p) => [p.id, p]));

    const updatedProducts = products.map((p) => {
      const cartItem = cartItems.find((item) => item.productId === p.id);
      if (!cartItem) return p;
      const currentStock = p.stock || 0;
      const currentAvgPrice = p.buyingPrice || 0;
      const newAvgPrice = recalculateAveragePrice(
        currentStock,
        currentAvgPrice,
        cartItem.quantity,
        cartItem.buyingPrice,
      );
      return {
        ...p,
        stock: currentStock + cartItem.quantity,
        buyingPrice: newAvgPrice,
      };
    });

    await dataService.saveProducts(updatedProducts);
    return { success: true };
  },
};
