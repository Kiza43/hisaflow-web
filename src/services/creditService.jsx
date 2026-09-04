import { dataService } from "./dataService";

// A credit sale is a real sale — the goods leave the shelf immediately,
// same stock validation and decrement as a cash sale — the only
// difference is payment doesn't happen now. That's why this reuses the
// exact same all-or-nothing stock-validation pattern as
// salesService.completeCartSale rather than being a separate concept.
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
      })),
      totalAmount,
      amountPaid: 0,
      status: "pending", // 'pending' | 'partial' | 'paid'
      payments: [],
      date: new Date().toISOString(),
    };

    const existing = await dataService.getCreditSales();
    await dataService.saveCreditSales([...existing, creditSale]);

    return { success: true, creditSale };
  },

  async recordPayment(creditSaleId, amount) {
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
              { amount, date: new Date().toISOString() },
            ],
          }
        : cs,
    );
    await dataService.saveCreditSales(updatedCreditSales);

    return { success: true, isFullySettled: newStatus === "paid" };
  },

  // Deleting a credit sale isn't just removing a record — the goods it
  // represented left the shelf when it was created, so deleting it needs
  // to give that stock back. Same principle as the phone app: a credit
  // sale is a real transaction, undoing it undoes its real effects.
  async deleteCreditSale(creditSaleId) {
    const creditSales = await dataService.getCreditSales();
    const creditSale = creditSales.find((cs) => cs.id === creditSaleId);
    if (!creditSale) {
      return { success: false, error: "Deni halipatikani" };
    }

    const products = await dataService.getProducts();
    const updatedProducts = products.map((p) => {
      const item = (creditSale.items || []).find((i) => i.productId === p.id);
      return item ? { ...p, stock: (p.stock || 0) + item.quantity } : p;
    });
    await dataService.saveProducts(updatedProducts);

    const updatedCreditSales = creditSales.filter(
      (cs) => cs.id !== creditSaleId,
    );
    await dataService.saveCreditSales(updatedCreditSales);

    return { success: true };
  },
};
