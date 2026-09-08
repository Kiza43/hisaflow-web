const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
const { app } = require("electron");
const { migrateFromJson } = require("./migrate");

// This app originally stored everything as plain JSON files, deliberately —
// avoiding native module compilation risk and staying consistent with the
// phone app's AsyncStorage-based approach. That trade-off held up fine at
// small scale, but it has a real, structural limitation: every save reads
// a whole file, modifies it in JS, and writes the whole file back, with no
// true transaction isolation. A double-click race on credit sale deletion
// (fixed at the application layer, but the underlying gap remained) was
// the concrete proof this needed a real fix, not just a narrower one.
//
// SQLite closes that gap structurally: a sale becomes one real database
// transaction — decrement stock, insert the sale row, commit — atomic by
// construction, not by careful button-disabling in the UI.

const DATA_DIR = path.join(app.getPath("userData"), "hisaflow-data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, "hisaflow.db");
const isNewDatabase = !fs.existsSync(DB_PATH); // must check before new Database() below, which creates the file
const db = new Database(DB_PATH);

// WAL mode: readers don't block writers and vice versa — the standard
// recommendation for a desktop app doing frequent small writes.
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT,
      brand TEXT,
      unit TEXT NOT NULL DEFAULT 'pc',
      selling_price REAL NOT NULL DEFAULT 0,
      buying_price REAL NOT NULL DEFAULT 0,
      stock REAL NOT NULL DEFAULT 0,
      image_uri TEXT,
      expiry_date TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS stock_batches (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      quantity REAL NOT NULL,
      remaining REAL NOT NULL,
      buying_price REAL NOT NULL,
      date TEXT NOT NULL,
      supplier_id TEXT,
      supplier_name TEXT,
      payment_method TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_batches_product ON stock_batches(product_id);
    CREATE INDEX IF NOT EXISTS idx_batches_date ON stock_batches(date);

    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      buying_price REAL,
      selling_price REAL NOT NULL,
      total_cost REAL,
      total_revenue REAL NOT NULL,
      profit REAL NOT NULL,
      payment_method TEXT,
      account_id TEXT,
      account_label TEXT,
      notes TEXT,
      date TEXT NOT NULL,
      edited_at TEXT,
      batch_breakdown TEXT,
      customer_phone TEXT,
      customer_name TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date);
    CREATE INDEX IF NOT EXISTS idx_sales_product ON sales(product_id);

    CREATE TABLE IF NOT EXISTS credit_sales (
      id TEXT PRIMARY KEY,
      customer_name TEXT NOT NULL,
      customer_phone TEXT,
      total_amount REAL NOT NULL,
      amount_paid REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      date TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_credit_sales_date ON credit_sales(date);
    CREATE INDEX IF NOT EXISTS idx_credit_sales_phone ON credit_sales(customer_phone);

    CREATE TABLE IF NOT EXISTS credit_sale_items (
      id TEXT PRIMARY KEY,
      credit_sale_id TEXT NOT NULL REFERENCES credit_sales(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      selling_price REAL NOT NULL,
      cost_at_sale REAL,
      batch_breakdown TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_credit_items_sale ON credit_sale_items(credit_sale_id);

    CREATE TABLE IF NOT EXISTS credit_sale_payments (
      id TEXT PRIMARY KEY,
      credit_sale_id TEXT NOT NULL REFERENCES credit_sales(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      payment_method TEXT,
      date TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_credit_payments_sale ON credit_sale_payments(credit_sale_id);

    CREATE TABLE IF NOT EXISTS expenditures (
      id TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      type TEXT,
      date TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_expenditures_date ON expenditures(date);

    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      total_supplied REAL NOT NULL DEFAULT 0,
      total_paid REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS supplier_payments (
      id TEXT PRIMARY KEY,
      supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      payment_method TEXT,
      date TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_supplier_payments_supplier ON supplier_payments(supplier_id);

    -- permissions stays as a JSON text blob rather than its own table —
    -- it's a small, fixed-shape object always read/written as a whole,
    -- never queried with a SQL WHERE clause ("find staff with permission
    -- X" isn't something this app does), so normalizing it further would
    -- add complexity without a real query benefit.
    CREATE TABLE IF NOT EXISTS staff (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      pin TEXT NOT NULL,
      permissions TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      details TEXT,
      actor_name TEXT,
      date TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_activity_date ON activity_log(date);

    CREATE TABLE IF NOT EXISTS crash_log (
      id TEXT PRIMARY KEY,
      message TEXT NOT NULL,
      stack TEXT,
      context TEXT,
      timestamp TEXT NOT NULL
    );

    -- Settings is one flat config object the app always reads/writes as a
    -- whole (business name, PIN, payment accounts, VAT settings, etc.) —
    -- a single JSON-blob row preserves that exact shape and the existing
    -- getSettings()/saveSettings(settings) interface with zero changes
    -- needed anywhere else in the app. The CHECK constraint makes a
    -- second row structurally impossible, not just a convention.
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      data TEXT NOT NULL
    );
    -- Deliberately its own table, not folded into settings — settings
    -- gets exported and re-imported through the normal backup/restore
    -- flow, and license state should never be touched by that. A trial
    -- reset via "restore a backup" would defeat the entire point of this.
    CREATE TABLE IF NOT EXISTS license (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      machine_id TEXT NOT NULL,
      install_date TEXT NOT NULL,
      licensed INTEGER NOT NULL DEFAULT 0,
      license_key TEXT
    );
  `);
}

initSchema();

// CREATE TABLE IF NOT EXISTS only helps brand-new databases — an
// already-existing sales/credit_sale_items table (like the one already
// running with real data) needs its own column added explicitly. This
// checks first and only adds it if genuinely missing, so it's safe to
// run on every single startup without erroring on the second launch.
function addColumnIfMissing(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  const exists = columns.some((c) => c.name === column);
  if (!exists) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
addColumnIfMissing("sales", "batch_breakdown", "TEXT");
addColumnIfMissing("credit_sale_items", "batch_breakdown", "TEXT");
addColumnIfMissing("products", "created_at", "TEXT");
addColumnIfMissing("sales", "customer_phone", "TEXT");
addColumnIfMissing("sales", "customer_name", "TEXT");

// Existing products from before this fix have no created_at recorded.
// Backfilling with each product's earliest stock batch date is a
// reasonable proxy for "when this was first added" — far better than
// leaving it null (which would sort inconsistently) or defaulting
// everything to the same migration timestamp (which would make "newest
// first" meaningless for anything that existed before this update).
const productsNeedingBackfill = db
  .prepare("SELECT id FROM products WHERE created_at IS NULL")
  .all();
if (productsNeedingBackfill.length > 0) {
  const earliestBatchDate = db.prepare(
    "SELECT MIN(date) as date FROM stock_batches WHERE product_id = ?",
  );
  const setCreatedAt = db.prepare(
    "UPDATE products SET created_at = ? WHERE id = ?",
  );
  const now = new Date().toISOString();
  const backfill = db.transaction(() => {
    for (const p of productsNeedingBackfill) {
      const earliest = earliestBatchDate.get(p.id);
      setCreatedAt.run(earliest?.date || now, p.id);
    }
  });
  backfill();
}

// Runs exactly once — isNewDatabase is only true the very first time this
// file exists (checked above, before better-sqlite3 created it). Every
// later launch, even seconds after, sees an existing hisaflow.db and
// skips this entirely, so there's no risk of re-importing and
// duplicating data on a second run.
if (isNewDatabase) {
  const result = migrateFromJson(db, DATA_DIR);
  if (result.migrated) {
    console.log("Migrated existing JSON data into SQLite:", result.counts);
  } else {
    console.log(
      "New database, no existing JSON data found to migrate (fresh install).",
    );
  }
}

module.exports = { db, DATA_DIR };
