const {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  clipboard,
  nativeImage,
} = require("electron");
const path = require("path");
const queries = require("./queries");

const isDev = process.env.NODE_ENV === "development";

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#FAF9F7", // matches the app's warm background, avoids a white flash on load
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true, // renderer never gets direct Node access
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// Every data operation the renderer needs goes through these explicit,
// narrow IPC handlers — the renderer process never touches the database
// directly (contextIsolation + no nodeIntegration above enforces this).
// The interface here is unchanged from the old JSON-file version — every
// service in the renderer calls these exact same functions. What's
// different is what happens behind them: saves now run inside a real
// SQLite transaction, closing the race-condition gap structurally.
ipcMain.handle("data:getProducts", () => queries.getProducts());
ipcMain.handle("data:saveProducts", (event, products) =>
  queries.saveProducts(products),
);

ipcMain.handle("data:getSales", () => queries.getSales());
ipcMain.handle("data:saveSales", (event, sales) => queries.saveSales(sales));

ipcMain.handle("data:getCreditSales", () => queries.getCreditSales());
ipcMain.handle("data:saveCreditSales", (event, creditSales) =>
  queries.saveCreditSales(creditSales),
);

ipcMain.handle("data:getExpenditures", () => queries.getExpenditures());
ipcMain.handle("data:saveExpenditures", (event, expenditures) =>
  queries.saveExpenditures(expenditures),
);

ipcMain.handle("data:getSuppliers", () => queries.getSuppliers());
ipcMain.handle("data:saveSuppliers", (event, suppliers) =>
  queries.saveSuppliers(suppliers),
);

ipcMain.handle("data:getStaff", () => queries.getStaff());
ipcMain.handle("data:saveStaff", (event, staff) => queries.saveStaff(staff));

ipcMain.handle("data:getActivityLog", () => queries.getActivityLog());
ipcMain.handle("data:saveActivityLog", (event, log) =>
  queries.saveActivityLog(log),
);

ipcMain.handle("data:getCrashLog", () => queries.getCrashLog());
ipcMain.handle("data:saveCrashLog", (event, log) => queries.saveCrashLog(log));

ipcMain.handle("sales:completeSale", (event, args) =>
  queries.completeSale(args),
);
ipcMain.handle("sales:completeCartSale", (event, cartItems, meta) =>
  queries.completeCartSale(cartItems, meta),
);
ipcMain.handle("credit:completeCreditSale", (event, args) =>
  queries.completeCreditSale(args),
);

ipcMain.handle("staff:addStaff", (event, args) => queries.addStaff(args));
ipcMain.handle("staff:updateStaff", (event, staffId, args) =>
  queries.updateStaff(staffId, args),
);
ipcMain.handle("staff:deleteStaff", (event, staffId) =>
  queries.deleteStaff(staffId),
);
ipcMain.handle("staff:identifyByPin", (event, pin) =>
  queries.identifyStaffByPin(pin),
);

// Opens a URL in the user's actual default browser (or, for wa.me links,
// straight into WhatsApp Desktop if it's installed and registered as the
// handler) — this is real, warranted use of Electron's native shell
// module. A sandboxed renderer navigating itself to an external site
// isn't the right approach and often won't behave the way a real browser
// tab would.
ipcMain.handle("shell:openExternal", (event, url) => shell.openExternal(url));

// Writes a PNG (as a data URL) straight to the OS clipboard — real,
// native Electron capability, not something achievable from a sandboxed
// web page. This is what makes "paste this poster into WhatsApp/Facebook"
// a single click instead of download-then-manually-attach.
ipcMain.handle("clipboard:writeImage", (event, dataUrl) => {
  const image = nativeImage.createFromDataURL(dataUrl);
  clipboard.writeImage(image);
});

ipcMain.handle("data:getSettings", () => queries.getSettings());
ipcMain.handle("data:saveSettings", (event, settings) =>
  queries.saveSettings(settings),
);
