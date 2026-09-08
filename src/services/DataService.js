// Thin wrapper around the IPC bridge exposed in preload.js. Nothing in
// here talks to the filesystem directly — that only happens in the main
// process (electron/store.js), reached exclusively through this bridge.

export const dataService = {
  getProducts: () => window.hisaflow.getProducts(),
  saveProducts: (products) => window.hisaflow.saveProducts(products),

  getSales: () => window.hisaflow.getSales(),
  saveSales: (sales) => window.hisaflow.saveSales(sales),

  getCreditSales: () => window.hisaflow.getCreditSales(),
  saveCreditSales: (creditSales) =>
    window.hisaflow.saveCreditSales(creditSales),

  getExpenditures: () => window.hisaflow.getExpenditures(),
  saveExpenditures: (expenditures) =>
    window.hisaflow.saveExpenditures(expenditures),

  getSuppliers: () => window.hisaflow.getSuppliers(),
  saveSuppliers: (suppliers) => window.hisaflow.saveSuppliers(suppliers),

  getStaff: () => window.hisaflow.getStaff(),
  saveStaff: (staff) => window.hisaflow.saveStaff(staff),

  getActivityLog: () => window.hisaflow.getActivityLog(),
  saveActivityLog: (log) => window.hisaflow.saveActivityLog(log),

  getCrashLog: () => window.hisaflow.getCrashLog(),
  saveCrashLog: (log) => window.hisaflow.saveCrashLog(log),

  completeSale: (args) => window.hisaflow.completeSale(args),
  completeCartSale: (cartItems, meta) =>
    window.hisaflow.completeCartSale(cartItems, meta),
  completeCreditSale: (args) => window.hisaflow.completeCreditSale(args),

  addStaff: (args) => window.hisaflow.addStaff(args),
  updateStaff: (staffId, args) => window.hisaflow.updateStaff(staffId, args),
  deleteStaff: (staffId) => window.hisaflow.deleteStaff(staffId),
  identifyStaffByPin: (pin) => window.hisaflow.identifyStaffByPin(pin),

  addSupplier: (args) => window.hisaflow.addSupplier(args),
  deleteSupplier: (supplierId) => window.hisaflow.deleteSupplier(supplierId),
  recordSupply: (supplierId, amount) =>
    window.hisaflow.recordSupply(supplierId, amount),
  recordSupplierPayment: (supplierId, amount, paymentMethod) =>
    window.hisaflow.recordSupplierPayment(supplierId, amount, paymentMethod),

  addStock: (args) => window.hisaflow.addStock(args),
  completeRestockCart: (cartItems, meta) =>
    window.hisaflow.completeRestockCart(cartItems, meta),

  editSale: (saleId, args) => window.hisaflow.editSale(saleId, args),
  deleteSale: (saleId) => window.hisaflow.deleteSale(saleId),

  recordCreditPayment: (creditSaleId, amount, paymentMethod) =>
    window.hisaflow.recordCreditPayment(creditSaleId, amount, paymentMethod),
  deleteCreditSale: (creditSaleId) =>
    window.hisaflow.deleteCreditSale(creditSaleId),

  createOrder: (args) => window.hisaflow.createOrder(args),
  getOrders: () => window.hisaflow.getOrders(),
  fulfillOrder: (orderId) => window.hisaflow.fulfillOrder(orderId),
  cancelOrder: (orderId) => window.hisaflow.cancelOrder(orderId),

  getLicenseStatus: () => window.hisaflow.getLicenseStatus(),
  activateLicense: (key) => window.hisaflow.activateLicense(key),

  getSettings: () => window.hisaflow.getSettings(),
  saveSettings: (settings) => window.hisaflow.saveSettings(settings),
};
