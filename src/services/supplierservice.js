import { dataService } from "./dataService";
import { activityLogService } from "./activityLogService";

const formatTZS = (amount) =>
  "TZS " + Math.round(amount || 0).toLocaleString("en-US");

// A simpler model than the phone app's per-batch payment allocation — one
// running balance per supplier (totalSupplied, totalPaid), not per-batch
// tracking. Genuinely functional for "who do I owe and how much," without
// the added complexity of tracking which specific delivery a payment
// applies to. That level of detail is a reasonable thing to add later if
// it turns out to matter.
export const supplierService = {
  async addSupplier({ name, phone }) {
    if (!name || !name.trim()) {
      return { success: false, error: "Weka jina la msambazaji" };
    }
    const suppliers = await dataService.getSuppliers();
    const supplier = {
      id: `sup_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: name.trim(),
      phone: (phone || "").trim(),
      totalSupplied: 0,
      totalPaid: 0,
      payments: [],
    };
    await dataService.saveSuppliers([...suppliers, supplier]);
    return { success: true, supplier };
  },

  async deleteSupplier(supplierId) {
    const suppliers = await dataService.getSuppliers();
    await dataService.saveSuppliers(
      suppliers.filter((s) => s.id !== supplierId),
    );
    return { success: true };
  },

  // Records new stock received from a supplier on credit — increases what
  // you owe them. Call this when restocking without paying the supplier
  // immediately.
  async recordSupply(supplierId, amount) {
    const suppliers = await dataService.getSuppliers();
    const updated = suppliers.map((s) =>
      s.id === supplierId
        ? { ...s, totalSupplied: s.totalSupplied + amount }
        : s,
    );
    await dataService.saveSuppliers(updated);
    return { success: true };
  },

  async recordPayment(supplierId, amount, paymentMethod) {
    if (amount <= 0) {
      return { success: false, error: "Weka kiasi sahihi" };
    }
    const suppliers = await dataService.getSuppliers();
    const supplier = suppliers.find((s) => s.id === supplierId);
    if (!supplier) {
      return { success: false, error: "Msambazaji hapatikani" };
    }
    const owed = supplier.totalSupplied - supplier.totalPaid;
    if (amount > owed) {
      return {
        success: false,
        error: `Kiasi kinazidi deni lililobaki (${owed})`,
      };
    }
    const updated = suppliers.map((s) =>
      s.id === supplierId
        ? {
            ...s,
            totalPaid: s.totalPaid + amount,
            // Suppliers added before this field existed won't have a
            // payments array yet — default to empty rather than crash.
            payments: [
              ...(s.payments || []),
              {
                amount,
                paymentMethod: paymentMethod || "",
                date: new Date().toISOString(),
              },
            ],
          }
        : s,
    );
    await dataService.saveSuppliers(updated);
    await activityLogService.logActivity(
      "paid a supplier",
      `${supplier.name} — ${formatTZS(amount)}`,
    );
    return { success: true };
  },
};
