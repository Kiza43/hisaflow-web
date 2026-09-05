const {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  clipboard,
  nativeImage,
} = require("electron");
const path = require("path");
const { store } = require("./store");

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
// narrow IPC handlers — the renderer process never touches the filesystem
// directly (contextIsolation + no nodeIntegration above enforces this).
ipcMain.handle("data:getProducts", () => store.getProducts());
ipcMain.handle("data:saveProducts", (event, products) =>
  store.saveProducts(products),
);

ipcMain.handle("data:getSales", () => store.getSales());
ipcMain.handle("data:saveSales", (event, sales) => store.saveSales(sales));

ipcMain.handle("data:getCreditSales", () => store.getCreditSales());
ipcMain.handle("data:saveCreditSales", (event, creditSales) =>
  store.saveCreditSales(creditSales),
);

ipcMain.handle("data:getExpenditures", () => store.getExpenditures());
ipcMain.handle("data:saveExpenditures", (event, expenditures) =>
  store.saveExpenditures(expenditures),
);

ipcMain.handle("data:getSuppliers", () => store.getSuppliers());
ipcMain.handle("data:saveSuppliers", (event, suppliers) =>
  store.saveSuppliers(suppliers),
);

ipcMain.handle("data:getStaff", () => store.getStaff());
ipcMain.handle("data:saveStaff", (event, staff) => store.saveStaff(staff));

ipcMain.handle("data:getActivityLog", () => store.getActivityLog());
ipcMain.handle("data:saveActivityLog", (event, log) =>
  store.saveActivityLog(log),
);

ipcMain.handle("data:getCrashLog", () => store.getCrashLog());
ipcMain.handle("data:saveCrashLog", (event, log) => store.saveCrashLog(log));

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

ipcMain.handle("data:getSettings", () => store.getSettings());
ipcMain.handle("data:saveSettings", (event, settings) =>
  store.saveSettings(settings),
);
