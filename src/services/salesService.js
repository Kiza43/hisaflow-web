import { dataService } from "./dataService";

// Kept separate from any component on purpose — same reasoning as the
// phone app's store actions: the logic for "what actually happens when a
// sale completes" (validate stock, decrease it, record profit) shouldn't
// live inside a form component. Easier to test, easier to reuse if a
// second way to record a sale gets added later.
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
    if (quantity > (product.stock || 0)) {
      return {
        success: false,
        error: `Stoo haitoshi — ${product.stock} pekee zimebaki`,
      };
    }

    const updatedProducts = products.map((p) =>
      p.id === productId ? { ...p, stock: p.stock - quantity } : p,
    );
    await dataService.saveProducts(updatedProducts);

    const totalRevenue = sellingPrice * quantity;
    const profit = (sellingPrice - (product.buyingPrice || 0)) * quantity;

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

    return { success: true, sale };
  },

  // Handles a cart of multiple products as one transaction. Validates
  // every item against current stock BEFORE changing anything — same
  // all-or-nothing guarantee the phone app's cart checkout has: a cart
  // with 3 valid items and 1 oversold item should commit nothing at all,
  // not silently complete the first 3 and fail on the 4th.
  async completeCartSale(cartItems) {
    if (!cartItems || cartItems.length === 0) {
      return { success: false, error: "Hakuna bidhaa kwenye kikapu" };
    }

    const products = await dataService.getProducts();
    const productMap = new Map(products.map((p) => [p.id, p]));

    for (const item of cartItems) {
      const product = productMap.get(item.productId);
      if (!product) {
        return {
          success: false,
          error: `${item.productName} haipatikani tena`,
        };
      }
      if (item.quantity > (product.stock || 0)) {
        return {
          success: false,
          error: `${item.productName}: stoo haitoshi (${product.stock} pekee zimebaki)`,
        };
      }
    }

    const updatedProducts = products.map((p) => {
      const cartItem = cartItems.find((item) => item.productId === p.id);
      return cartItem ? { ...p, stock: p.stock - cartItem.quantity } : p;
    });
    await dataService.saveProducts(updatedProducts);

    const now = new Date().toISOString();
    const newSales = cartItems.map((item) => {
      const product = productMap.get(item.productId);
      return {
        id: `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        sellingPrice: item.sellingPrice,
        totalRevenue: item.sellingPrice * item.quantity,
        profit:
          (item.sellingPrice - (product.buyingPrice || 0)) * item.quantity,
        date: now,
      };
    });

    const existingSales = await dataService.getSales();
    await dataService.saveSales([...existingSales, ...newSales]);

    return { success: true, sales: newSales };
  },
};
