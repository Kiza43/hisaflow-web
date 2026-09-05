const fs = require("fs");
const path = require("path");
const { app } = require("electron");

// Deliberately plain JSON files on disk, not a native SQLite binding.
// The phone app itself stores data the same conceptual way (AsyncStorage
// is a JSON key-value store under the hood) — this keeps the desktop app
// consistent with that, and avoids the exact class of native-module
// compilation risk that cost real time getting the phone app's build
// working tonight. A genuine SQLite upgrade is a clean, isolated swap to
// make later, once this foundation is proven stable.

const DATA_DIR = path.join(app.getPath("userData"), "hisaflow-data");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const filePath = (key) => path.join(DATA_DIR, `${key}.json`);

function readFile(key, fallback) {
  try {
    const raw = fs.readFileSync(filePath(key), "utf-8");
    return JSON.parse(raw);
  } catch (error) {
    // File doesn't exist yet, or is corrupted — either way, a fresh
    // fallback is the safe default rather than crashing the app.
    return fallback;
  }
}

function writeFile(key, data) {
  fs.writeFileSync(filePath(key), JSON.stringify(data, null, 2), "utf-8");
}

const store = {
  // Mirrors the phone app's own store shapes, so the eventual sync layer
  // has as little translation to do as possible between the two.
  getProducts: () => readFile("products", []),
  saveProducts: (products) => writeFile("products", products),

  getSales: () => readFile("sales", []),
  saveSales: (sales) => writeFile("sales", sales),

  getCreditSales: () => readFile("creditSales", []),
  saveCreditSales: (creditSales) => writeFile("creditSales", creditSales),

  getExpenditures: () => readFile("expenditures", []),
  saveExpenditures: (expenditures) => writeFile("expenditures", expenditures),

  getSuppliers: () => readFile("suppliers", []),
  saveSuppliers: (suppliers) => writeFile("suppliers", suppliers),

  getStaff: () => readFile("staff", []),
  saveStaff: (staff) => writeFile("staff", staff),

  getActivityLog: () => readFile("activityLog", []),
  saveActivityLog: (log) => writeFile("activityLog", log),

  getSettings: () =>
    readFile("settings", { businessName: "", ownerPin: "", ownerPhone: "" }),
  saveSettings: (settings) => writeFile("settings", settings),
};

module.exports = { store, DATA_DIR };
