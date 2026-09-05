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

  getSettings: () => window.hisaflow.getSettings(),
  saveSettings: (settings) => window.hisaflow.saveSettings(settings),
};
