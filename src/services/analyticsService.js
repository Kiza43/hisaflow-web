// Kept separate from DashboardScreen for the same reason as everything
// else — pure logic, easy to verify, reusable if another screen ever
// wants period-based stats.

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const startOfWeek = () => {
  const d = startOfToday();
  d.setDate(d.getDate() - d.getDay()); // Sunday, same convention used elsewhere in this app
  return d;
};

const startOfMonth = () => {
  const d = startOfToday();
  d.setDate(1);
  return d;
};

export const analyticsService = {
  filterSalesByPeriod(sales, period) {
    if (period === "all") return sales;
    const boundary =
      period === "today"
        ? startOfToday()
        : period === "week"
          ? startOfWeek()
          : startOfMonth();
    return sales.filter((s) => new Date(s.date) >= boundary);
  },

  getBestSellers(products, sales, limit = 5) {
    const quantityByProduct = {};
    sales.forEach((s) => {
      quantityByProduct[s.productId] =
        (quantityByProduct[s.productId] || 0) + (s.quantity || 0);
    });
    return Object.entries(quantityByProduct)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([productId, quantity]) => {
        const product = products.find((p) => p.id === productId);
        return product ? { product, quantity } : null;
      })
      .filter(Boolean);
  },

  getMostProfitable(products, sales, limit = 5) {
    const profitByProduct = {};
    sales.forEach((s) => {
      profitByProduct[s.productId] =
        (profitByProduct[s.productId] || 0) + (s.profit || 0);
    });
    return Object.entries(profitByProduct)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([productId, profit]) => {
        const product = products.find((p) => p.id === productId);
        return product ? { product, profit } : null;
      })
      .filter(Boolean);
  },
};
