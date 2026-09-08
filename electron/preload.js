const { contextBridge, ipcRenderer } = require("electron");

// Everything the renderer (React app) can touch is explicitly listed
// here — nothing more. This is what contextIsolation is for: even though
// this file has full Node access, only what's exposed below is reachable
// from the actual UI code.
contextBridge.exposeInMainWorld("hisaflow", {
  getProducts: () => ipcRenderer.invoke("data:getProducts"),
  saveProducts: (products) => ipcRenderer.invoke("data:saveProducts", products),

  getSales: () => ipcRenderer.invoke("data:getSales"),
  saveSales: (sales) => ipcRenderer.invoke("data:saveSales", sales),

  getCreditSales: () => ipcRenderer.invoke("data:getCreditSales"),
  saveCreditSales: (creditSales) =>
    ipcRenderer.invoke("data:saveCreditSales", creditSales),

  getExpenditures: () => ipcRenderer.invoke("data:getExpenditures"),
  saveExpenditures: (expenditures) =>
    ipcRenderer.invoke("data:saveExpenditures", expenditures),

  getSuppliers: () => ipcRenderer.invoke("data:getSuppliers"),
  saveSuppliers: (suppliers) =>
    ipcRenderer.invoke("data:saveSuppliers", suppliers),

  getStaff: () => ipcRenderer.invoke("data:getStaff"),
  saveStaff: (staff) => ipcRenderer.invoke("data:saveStaff", staff),

  getActivityLog: () => ipcRenderer.invoke("data:getActivityLog"),
  saveActivityLog: (log) => ipcRenderer.invoke("data:saveActivityLog", log),

  getCrashLog: () => ipcRenderer.invoke("data:getCrashLog"),
  saveCrashLog: (log) => ipcRenderer.invoke("data:saveCrashLog", log),

  completeSale: (args) => ipcRenderer.invoke("sales:completeSale", args),
  completeCartSale: (cartItems, meta) =>
    ipcRenderer.invoke("sales:completeCartSale", cartItems, meta),
  completeCreditSale: (args) =>
    ipcRenderer.invoke("credit:completeCreditSale", args),

  addStaff: (args) => ipcRenderer.invoke("staff:addStaff", args),
  updateStaff: (staffId, args) =>
    ipcRenderer.invoke("staff:updateStaff", staffId, args),
  deleteStaff: (staffId) => ipcRenderer.invoke("staff:deleteStaff", staffId),
  identifyStaffByPin: (pin) => ipcRenderer.invoke("staff:identifyByPin", pin),

  addSupplier: (args) => ipcRenderer.invoke("suppliers:addSupplier", args),
  deleteSupplier: (supplierId) =>
    ipcRenderer.invoke("suppliers:deleteSupplier", supplierId),
  recordSupply: (supplierId, amount) =>
    ipcRenderer.invoke("suppliers:recordSupply", supplierId, amount),
  recordSupplierPayment: (supplierId, amount, paymentMethod) =>
    ipcRenderer.invoke(
      "suppliers:recordPayment",
      supplierId,
      amount,
      paymentMethod,
    ),

  addStock: (args) => ipcRenderer.invoke("restock:addStock", args),
  completeRestockCart: (cartItems, meta) =>
    ipcRenderer.invoke("restock:completeRestockCart", cartItems, meta),

  editSale: (saleId, args) =>
    ipcRenderer.invoke("sales:editSale", saleId, args),
  deleteSale: (saleId) => ipcRenderer.invoke("sales:deleteSale", saleId),

  recordCreditPayment: (creditSaleId, amount, paymentMethod) =>
    ipcRenderer.invoke(
      "credit:recordPayment",
      creditSaleId,
      amount,
      paymentMethod,
    ),
  deleteCreditSale: (creditSaleId) =>
    ipcRenderer.invoke("credit:deleteCreditSale", creditSaleId),

  createOrder: (args) => ipcRenderer.invoke("orders:createOrder", args),
  getOrders: () => ipcRenderer.invoke("orders:getOrders"),
  fulfillOrder: (orderId) => ipcRenderer.invoke("orders:fulfillOrder", orderId),
  cancelOrder: (orderId) => ipcRenderer.invoke("orders:cancelOrder", orderId),

  getLicenseStatus: () => ipcRenderer.invoke("license:getStatus"),
  activateLicense: (key) => ipcRenderer.invoke("license:activate", key),

  openExternal: (url) => ipcRenderer.invoke("shell:openExternal", url),

  copyImageToClipboard: (dataUrl) =>
    ipcRenderer.invoke("clipboard:writeImage", dataUrl),

  getSettings: () => ipcRenderer.invoke("data:getSettings"),
  saveSettings: (settings) => ipcRenderer.invoke("data:saveSettings", settings),
});
