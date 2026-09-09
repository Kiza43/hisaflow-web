const { db } = require("./db");

// Preserves the exact "get the whole array / save the whole array"
// interface every service in the renderer already calls — nothing in
// salesService, creditService, or any other service needs to change for
// this stage. What changes is what's behind that interface: instead of
// reading/writing a whole JSON file, saves now happen inside a real
// SQLite transaction (delete + re-insert, atomically) — which is what
// actually closes the race condition structurally, not just narrows it.
// The tradeoff being made deliberately here: this still moves whole
// tables at once rather than granular per-row queries, so the latency
// benefit of proper indexing comes in a later, separate stage that
// rewrites the services themselves — this stage is about correctness
// and safety first.

const productRowToObject = (p, batchesByProduct) => ({
  id: p.id,
  name: p.name,
  category: p.category,
  brand: p.brand,
  unit: p.unit,
  sellingPrice: p.selling_price,
  buyingPrice: p.buying_price,
  stock: p.stock,
  imageUri: p.image_uri,
  expiryDate: p.expiry_date,
  createdAt: p.created_at,
  stockBatches: batchesByProduct[p.id] || [],
});

const batchRowToObject = (b) => ({
  id: b.id,
  quantity: b.quantity,
  remaining: b.remaining,
  buyingPrice: b.buying_price,
  date: b.date,
  supplierId: b.supplier_id,
  supplierName: b.supplier_name,
  paymentMethod: b.payment_method,
  accountId: b.account_id,
  accountLabel: b.account_label,
  accountNumber: b.account_number,
});

function getProducts() {
  const products = db.prepare("SELECT * FROM products").all();
  const batches = db
    .prepare("SELECT * FROM stock_batches ORDER BY date ASC")
    .all();
  const batchesByProduct = {};
  for (const b of batches) {
    (batchesByProduct[b.product_id] ||= []).push(batchRowToObject(b));
  }
  return products.map((p) => productRowToObject(p, batchesByProduct));
}

const saveProducts = db.transaction((products) => {
  db.prepare("DELETE FROM stock_batches").run();
  db.prepare("DELETE FROM products").run();

  const insertProduct = db.prepare(`
    INSERT INTO products (id, name, category, brand, unit, selling_price, buying_price, stock, image_uri, expiry_date, created_at)
    VALUES (@id, @name, @category, @brand, @unit, @sellingPrice, @buyingPrice, @stock, @imageUri, @expiryDate, @createdAt)
  `);
  const insertBatch = db.prepare(`
    INSERT INTO stock_batches (id, product_id, quantity, remaining, buying_price, date, supplier_id, supplier_name, payment_method, account_id, account_label, account_number)
    VALUES (@id, @productId, @quantity, @remaining, @buyingPrice, @date, @supplierId, @supplierName, @paymentMethod, @accountId, @accountLabel, @accountNumber)
  `);

  for (const p of products) {
    insertProduct.run({
      id: p.id,
      name: p.name,
      category: p.category ?? null,
      brand: p.brand ?? null,
      unit: p.unit || "pc",
      sellingPrice: p.sellingPrice || 0,
      buyingPrice: p.buyingPrice || 0,
      stock: p.stock || 0,
      imageUri: p.imageUri ?? null,
      expiryDate: p.expiryDate ?? null,
      createdAt: p.createdAt || new Date().toISOString(),
    });
    for (const b of p.stockBatches || []) {
      insertBatch.run({
        id: b.id,
        productId: p.id,
        quantity: b.quantity,
        remaining: b.remaining,
        buyingPrice: b.buyingPrice,
        date: b.date,
        supplierId: b.supplierId ?? null,
        supplierName: b.supplierName ?? null,
        paymentMethod: b.paymentMethod ?? null,
        accountId: b.accountId ?? null,
        accountLabel: b.accountLabel ?? null,
        accountNumber: b.accountNumber ?? null,
      });
    }
  }
});

function getSales() {
  return db
    .prepare("SELECT * FROM sales")
    .all()
    .map((s) => ({
      id: s.id,
      productId: s.product_id,
      productName: s.product_name,
      quantity: s.quantity,
      buyingPrice: s.buying_price,
      sellingPrice: s.selling_price,
      totalCost: s.total_cost,
      totalRevenue: s.total_revenue,
      profit: s.profit,
      paymentMethod: s.payment_method,
      accountId: s.account_id,
      accountLabel: s.account_label,
      accountNumber: s.account_number,
      notes: s.notes,
      date: s.date,
      editedAt: s.edited_at,
      // Older sales made before this fix won't have a breakdown recorded —
      // null here, and the restoration logic falls back to the averaged
      // buyingPrice for those, same as it always did.
      batchBreakdown: s.batch_breakdown ? JSON.parse(s.batch_breakdown) : null,
      customerPhone: s.customer_phone,
      customerName: s.customer_name,
      discount: s.discount || 0,
    }));
}

const saveSales = db.transaction((sales) => {
  db.prepare("DELETE FROM sales").run();
  const insert = db.prepare(`
    INSERT INTO sales (id, product_id, product_name, quantity, buying_price, selling_price, total_cost, total_revenue, profit, payment_method, account_id, account_label, account_number, notes, date, edited_at, batch_breakdown, customer_phone, customer_name, discount)
    VALUES (@id, @productId, @productName, @quantity, @buyingPrice, @sellingPrice, @totalCost, @totalRevenue, @profit, @paymentMethod, @accountId, @accountLabel, @accountNumber, @notes, @date, @editedAt, @breakdownJson, @customerPhone, @customerName, @discount)
  `);
  for (const s of sales) {
    insert.run({
      id: s.id,
      productId: s.productId,
      productName: s.productName,
      quantity: s.quantity,
      buyingPrice: s.buyingPrice ?? null,
      sellingPrice: s.sellingPrice,
      totalCost: s.totalCost ?? null,
      totalRevenue: s.totalRevenue,
      profit: s.profit,
      paymentMethod: s.paymentMethod ?? null,
      accountId: s.accountId ?? null,
      accountLabel: s.accountLabel ?? null,
      accountNumber: s.accountNumber ?? null,
      notes: s.notes ?? null,
      date: s.date,
      editedAt: s.editedAt ?? null,
      breakdownJson: s.batchBreakdown ? JSON.stringify(s.batchBreakdown) : null,
      customerPhone: s.customerPhone ?? null,
      customerName: s.customerName ?? null,
      discount: s.discount ?? 0,
    });
  }
});

function getCreditSales() {
  const creditSales = db.prepare("SELECT * FROM credit_sales").all();
  const items = db.prepare("SELECT * FROM credit_sale_items").all();
  const payments = db
    .prepare("SELECT * FROM credit_sale_payments ORDER BY date ASC")
    .all();

  const itemsBySale = {};
  for (const i of items) {
    (itemsBySale[i.credit_sale_id] ||= []).push({
      productId: i.product_id,
      productName: i.product_name,
      quantity: i.quantity,
      sellingPrice: i.selling_price,
      costAtSale: i.cost_at_sale,
      batchBreakdown: i.batch_breakdown ? JSON.parse(i.batch_breakdown) : null,
    });
  }
  const paymentsBySale = {};
  for (const p of payments) {
    (paymentsBySale[p.credit_sale_id] ||= []).push({
      amount: p.amount,
      paymentMethod: p.payment_method,
      date: p.date,
    });
  }

  return creditSales.map((cs) => ({
    id: cs.id,
    customerName: cs.customer_name,
    customerPhone: cs.customer_phone,
    totalAmount: cs.total_amount,
    amountPaid: cs.amount_paid,
    status: cs.status,
    date: cs.date,
    items: itemsBySale[cs.id] || [],
    payments: paymentsBySale[cs.id] || [],
  }));
}

const saveCreditSales = db.transaction((creditSales) => {
  db.prepare("DELETE FROM credit_sale_items").run();
  db.prepare("DELETE FROM credit_sale_payments").run();
  db.prepare("DELETE FROM credit_sales").run();

  const insertCreditSale = db.prepare(`
    INSERT INTO credit_sales (id, customer_name, customer_phone, total_amount, amount_paid, status, date)
    VALUES (@id, @customerName, @customerPhone, @totalAmount, @amountPaid, @status, @date)
  `);
  const insertItem = db.prepare(`
    INSERT INTO credit_sale_items (id, credit_sale_id, product_id, product_name, quantity, selling_price, cost_at_sale, batch_breakdown)
    VALUES (@id, @creditSaleId, @productId, @productName, @quantity, @sellingPrice, @costAtSale, @breakdownJson)
  `);
  const insertPayment = db.prepare(`
    INSERT INTO credit_sale_payments (id, credit_sale_id, amount, payment_method, date)
    VALUES (@id, @creditSaleId, @amount, @paymentMethod, @date)
  `);
  const genId = (prefix) =>
    `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  for (const cs of creditSales) {
    insertCreditSale.run({
      id: cs.id,
      customerName: cs.customerName,
      customerPhone: cs.customerPhone ?? null,
      totalAmount: cs.totalAmount,
      amountPaid: cs.amountPaid || 0,
      status: cs.status || "pending",
      date: cs.date,
    });
    for (const item of cs.items || []) {
      // Items/payments never carried their own id in the JSON shape —
      // generate one fresh each save, same as the migration did.
      insertItem.run({
        id: genId("cci"),
        creditSaleId: cs.id,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        sellingPrice: item.sellingPrice,
        costAtSale: item.costAtSale ?? null,
        breakdownJson: item.batchBreakdown
          ? JSON.stringify(item.batchBreakdown)
          : null,
      });
    }
    for (const pmt of cs.payments || []) {
      insertPayment.run({
        id: genId("ccp"),
        creditSaleId: cs.id,
        amount: pmt.amount,
        paymentMethod: pmt.paymentMethod ?? null,
        date: pmt.date,
      });
    }
  }
});

function getExpenditures() {
  return db
    .prepare("SELECT * FROM expenditures")
    .all()
    .map((e) => ({
      id: e.id,
      description: e.description,
      amount: e.amount,
      type: e.type,
      date: e.date,
    }));
}

const saveExpenditures = db.transaction((expenditures) => {
  db.prepare("DELETE FROM expenditures").run();
  const insert = db.prepare(`
    INSERT INTO expenditures (id, description, amount, type, date)
    VALUES (@id, @description, @amount, @type, @date)
  `);
  for (const e of expenditures) {
    insert.run({
      id: e.id,
      description: e.description,
      amount: e.amount,
      type: e.type ?? null,
      date: e.date,
    });
  }
});

function getSuppliers() {
  const suppliers = db.prepare("SELECT * FROM suppliers").all();
  const payments = db
    .prepare("SELECT * FROM supplier_payments ORDER BY date ASC")
    .all();
  const paymentsBySupplier = {};
  for (const p of payments) {
    (paymentsBySupplier[p.supplier_id] ||= []).push({
      amount: p.amount,
      paymentMethod: p.payment_method,
      date: p.date,
    });
  }
  return suppliers.map((s) => ({
    id: s.id,
    name: s.name,
    phone: s.phone,
    totalSupplied: s.total_supplied,
    totalPaid: s.total_paid,
    payments: paymentsBySupplier[s.id] || [],
  }));
}

const saveSuppliers = db.transaction((suppliers) => {
  db.prepare("DELETE FROM supplier_payments").run();
  db.prepare("DELETE FROM suppliers").run();

  const insertSupplier = db.prepare(`
    INSERT INTO suppliers (id, name, phone, total_supplied, total_paid)
    VALUES (@id, @name, @phone, @totalSupplied, @totalPaid)
  `);
  const insertPayment = db.prepare(`
    INSERT INTO supplier_payments (id, supplier_id, amount, payment_method, date)
    VALUES (@id, @supplierId, @amount, @paymentMethod, @date)
  `);
  const genId = (prefix) =>
    `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  for (const s of suppliers) {
    insertSupplier.run({
      id: s.id,
      name: s.name,
      phone: s.phone ?? null,
      totalSupplied: s.totalSupplied || 0,
      totalPaid: s.totalPaid || 0,
    });
    for (const pmt of s.payments || []) {
      insertPayment.run({
        id: genId("sp"),
        supplierId: s.id,
        amount: pmt.amount,
        paymentMethod: pmt.paymentMethod ?? null,
        date: pmt.date,
      });
    }
  }
});

function getStaff() {
  return db
    .prepare("SELECT * FROM staff")
    .all()
    .map((s) => ({
      id: s.id,
      name: s.name,
      pin: s.pin,
      permissions: JSON.parse(s.permissions || "{}"),
    }));
}

const saveStaff = db.transaction((staff) => {
  db.prepare("DELETE FROM staff").run();
  const insert = db.prepare(
    `INSERT INTO staff (id, name, pin, permissions) VALUES (@id, @name, @pin, @permissions)`,
  );
  for (const s of staff) {
    insert.run({
      id: s.id,
      name: s.name,
      pin: s.pin,
      permissions: JSON.stringify(s.permissions || {}),
    });
  }
});

// Granular staff operations — simple CRUD with a PIN-uniqueness check,
// no batch/FIFO complexity like the sales-side functions. The
// self-exclusion case (updating a staff member while keeping their own
// existing PIN) was tested directly, since a naive "does this PIN
// already exist" check would wrongly reject a no-op edit.
function addStaff({ name, pin, permissions }) {
  if (!name || !name.trim())
    return { success: false, error: "Weka jina la mfanyakazi" };
  if (!pin || pin.length < 4)
    return { success: false, error: "PIN lazima iwe na tarakimu 4 au zaidi" };

  const existing = db
    .prepare("SELECT COUNT(*) as c FROM staff WHERE pin = ?")
    .get(pin);
  if (existing.c > 0)
    return {
      success: false,
      error: "PIN hii tayari inatumika na mfanyakazi mwingine",
    };

  const id = genId("staff");
  db.prepare(
    "INSERT INTO staff (id, name, pin, permissions) VALUES (?, ?, ?, ?)",
  ).run(id, name.trim(), pin, JSON.stringify(permissions || {}));

  db.prepare(
    `INSERT INTO activity_log (id, action, details, actor_name, date) VALUES (?, 'added a staff member', ?, NULL, ?)`,
  ).run(genId("al"), name.trim(), new Date().toISOString());

  return {
    success: true,
    staff: { id, name: name.trim(), pin, permissions: permissions || {} },
  };
}

function updateStaff(staffId, { name, pin, permissions }) {
  if (!name || !name.trim())
    return { success: false, error: "Weka jina la mfanyakazi" };
  if (!pin || pin.length < 4)
    return { success: false, error: "PIN lazima iwe na tarakimu 4 au zaidi" };

  const existing = db
    .prepare("SELECT COUNT(*) as c FROM staff WHERE pin = ? AND id != ?")
    .get(pin, staffId);
  if (existing.c > 0)
    return {
      success: false,
      error: "PIN hii tayari inatumika na mfanyakazi mwingine",
    };

  db.prepare(
    "UPDATE staff SET name = ?, pin = ?, permissions = ? WHERE id = ?",
  ).run(name.trim(), pin, JSON.stringify(permissions || {}), staffId);

  return { success: true };
}

function deleteStaff(staffId) {
  const removed = db.prepare("SELECT * FROM staff WHERE id = ?").get(staffId);
  db.prepare("DELETE FROM staff WHERE id = ?").run(staffId);
  if (removed) {
    db.prepare(
      `INSERT INTO activity_log (id, action, details, actor_name, date) VALUES (?, 'removed a staff member', ?, NULL, ?)`,
    ).run(genId("al"), removed.name, new Date().toISOString());
  }
  return { success: true };
}

function identifyStaffByPin(pin) {
  const row = db.prepare("SELECT * FROM staff WHERE pin = ?").get(pin);
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    isOwner: false,
    permissions: JSON.parse(row.permissions || "{}"),
  };
}

// Granular supplier operations. recordPayment's "can't pay more than
// owed" check reads the current balance and writes the update in the
// same transaction — the array-based version read the whole suppliers
// list, checked in JS, then saved back separately, leaving a real gap
// where two concurrent payments could each pass the check against the
// same stale balance and together overpay past what was actually owed.
function addSupplier({ name, phone }) {
  if (!name || !name.trim())
    return { success: false, error: "Weka jina la msambazaji" };
  const id = genId("sup");
  db.prepare(
    "INSERT INTO suppliers (id, name, phone, total_supplied, total_paid) VALUES (?, ?, ?, 0, 0)",
  ).run(id, name.trim(), (phone || "").trim());
  return {
    success: true,
    supplier: {
      id,
      name: name.trim(),
      phone: (phone || "").trim(),
      totalSupplied: 0,
      totalPaid: 0,
      payments: [],
    },
  };
}

function deleteSupplier(supplierId) {
  db.prepare("DELETE FROM suppliers WHERE id = ?").run(supplierId); // cascades to supplier_payments
  return { success: true };
}

function recordSupply(supplierId, amount) {
  db.prepare(
    "UPDATE suppliers SET total_supplied = total_supplied + ? WHERE id = ?",
  ).run(amount, supplierId);
  return { success: true };
}

const recordSupplierPaymentTx = db.transaction(
  (supplierId, amount, paymentMethod) => {
    const supplier = db
      .prepare("SELECT * FROM suppliers WHERE id = ?")
      .get(supplierId);
    if (!supplier) throw new CartValidationError("Msambazaji hapatikani");

    const owed = supplier.total_supplied - supplier.total_paid;
    if (amount > owed)
      throw new CartValidationError(
        `Kiasi kinazidi deni lililobaki (${Math.round(owed)})`,
      );

    db.prepare(
      "UPDATE suppliers SET total_paid = total_paid + ? WHERE id = ?",
    ).run(amount, supplierId);
    const date = new Date().toISOString();
    db.prepare(
      "INSERT INTO supplier_payments (id, supplier_id, amount, payment_method, date) VALUES (?, ?, ?, ?, ?)",
    ).run(genId("sp"), supplierId, amount, paymentMethod || "", date);
    db.prepare(
      `INSERT INTO activity_log (id, action, details, actor_name, date) VALUES (?, 'paid a supplier', ?, NULL, ?)`,
    ).run(
      genId("al"),
      `${supplier.name} — TZS ${Math.round(amount).toLocaleString("en-US")}`,
      date,
    );
  },
);

function recordSupplierPayment(supplierId, amount, paymentMethod) {
  if (!amount || amount <= 0)
    return { success: false, error: "Weka kiasi sahihi" };
  try {
    recordSupplierPaymentTx(supplierId, amount, paymentMethod);
    return { success: true };
  } catch (err) {
    if (err instanceof CartValidationError)
      return { success: false, error: err.message };
    throw err;
  }
}

// Restocking creates a genuinely new batch row rather than blending into
// one running average — same reasoning as the old batchService.addBatch,
// now as real SQL. This is what lets a later sale know the real,
// specific cost of the units it consumes (FIFO), not an average that
// drifts from reality as prices change over time.
function recomputeProductSummary(productId) {
  const batches = db
    .prepare("SELECT * FROM stock_batches WHERE product_id = ?")
    .all(productId);
  const newStock = batches.reduce((sum, b) => sum + b.remaining, 0);
  const totalValue = batches.reduce(
    (sum, b) => sum + b.remaining * b.buying_price,
    0,
  );
  const newBuyingPrice = newStock > 0 ? totalValue / newStock : 0;
  db.prepare(
    "UPDATE products SET stock = ?, buying_price = ? WHERE id = ?",
  ).run(newStock, newBuyingPrice, productId);
}

const addStockTx = db.transaction(
  (
    productId,
    quantity,
    buyingPrice,
    supplierId,
    supplierName,
    paymentMethod,
    accountId,
    accountLabel,
    accountNumber,
  ) => {
    const product = db
      .prepare("SELECT * FROM products WHERE id = ?")
      .get(productId);
    if (!product) throw new CartValidationError("Bidhaa haipatikani");

    const date = new Date().toISOString();
    db.prepare(
      `
    INSERT INTO stock_batches (id, product_id, quantity, remaining, buying_price, date, supplier_id, supplier_name, payment_method, account_id, account_label, account_number)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    ).run(
      genId("b"),
      productId,
      quantity,
      quantity,
      buyingPrice,
      date,
      supplierId || null,
      supplierName || null,
      paymentMethod || null,
      accountId || null,
      accountLabel || null,
      accountNumber || null,
    );

    recomputeProductSummary(productId);

    // Show exactly which account paid for it, when one was picked — not
    // just "added stock", the same specificity accountLabel gives sales.
    const paidViaSuffix = accountLabel ? ` — ${accountLabel}` : "";
    db.prepare(
      `INSERT INTO activity_log (id, action, details, actor_name, date) VALUES (?, 'added stock', ?, NULL, ?)`,
    ).run(
      genId("al"),
      `${product.name} +${quantity} @ TZS ${Math.round(buyingPrice).toLocaleString("en-US")}${paidViaSuffix}`,
      date,
    );
  },
);

function addStock({
  productId,
  quantity,
  buyingPrice,
  supplierId,
  supplierName,
  paymentMethod,
  accountId,
  accountLabel,
  accountNumber,
}) {
  if (!quantity || quantity <= 0)
    return { success: false, error: "Weka kiasi sahihi" };
  if (buyingPrice < 0)
    return { success: false, error: "Bei ya kununua haiwezi kuwa hasi" };
  try {
    addStockTx(
      productId,
      quantity,
      buyingPrice,
      supplierId,
      supplierName,
      paymentMethod,
      accountId,
      accountLabel,
      accountNumber,
    );
    return { success: true };
  } catch (err) {
    if (err instanceof CartValidationError)
      return { success: false, error: err.message };
    throw err;
  }
}

// Same all-or-nothing guarantee as a cash cart sale — a restock order
// covering several products is one business event (one delivery, one
// supplier trip), so it should commit completely or not at all. Tested
// directly: one valid product alongside one with a negative price
// correctly rolls back the valid one too, leaving stock exactly as it
// was before the attempt.
const completeRestockCartTx = db.transaction((cartItems, meta) => {
  for (const item of cartItems) {
    if (!item.quantity || item.quantity <= 0) {
      throw new CartValidationError(`${item.productName}: weka kiasi sahihi`);
    }
    if (item.buyingPrice < 0) {
      throw new CartValidationError(
        `${item.productName}: bei ya kununua haiwezi kuwa hasi`,
      );
    }
  }

  const date = new Date().toISOString();
  const insertBatch = db.prepare(`
    INSERT INTO stock_batches (id, product_id, quantity, remaining, buying_price, date, supplier_id, supplier_name, payment_method, account_id, account_label, account_number)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const item of cartItems) {
    insertBatch.run(
      genId("b"),
      item.productId,
      item.quantity,
      item.quantity,
      item.buyingPrice,
      date,
      meta.supplierId || null,
      meta.supplierName || null,
      meta.paymentMethod || null,
      meta.accountId || null,
      meta.accountLabel || null,
      meta.accountNumber || null,
    );
    recomputeProductSummary(item.productId);
  }

  const paidViaSuffix = meta.accountLabel ? ` — ${meta.accountLabel}` : "";
  db.prepare(
    `INSERT INTO activity_log (id, action, details, actor_name, date) VALUES (?, 'restocked multiple products', ?, NULL, ?)`,
  ).run(genId("al"), `${cartItems.length} bidhaa${paidViaSuffix}`, date);
});

function completeRestockCart(cartItems, meta = {}) {
  if (!cartItems || cartItems.length === 0) {
    return { success: false, error: "Hakuna bidhaa kwenye kikapu" };
  }
  try {
    completeRestockCartTx(cartItems, meta);
    return { success: true };
  } catch (err) {
    if (err instanceof CartValidationError)
      return { success: false, error: err.message };
    throw err;
  }
}

// Recreates stock exactly as it was actually consumed — one real batch
// per breakdown entry at its real price — rather than one batch blended
// to an average. Falls back to a single averaged batch only for sales
// made before batch_breakdown existed, since those never recorded the
// detail needed to do better.
function restoreBatchesFromBreakdown(
  productId,
  breakdown,
  totalQuantity,
  fallbackBuyingPrice,
  date,
) {
  const insertBatch = db.prepare(`
    INSERT INTO stock_batches (id, product_id, quantity, remaining, buying_price, date)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  if (breakdown && breakdown.length > 0) {
    for (const entry of breakdown) {
      if (entry.quantity > 0)
        insertBatch.run(
          genId("b"),
          productId,
          entry.quantity,
          entry.quantity,
          entry.buyingPrice,
          date,
        );
    }
  } else {
    insertBatch.run(
      genId("b"),
      productId,
      totalQuantity,
      totalQuantity,
      fallbackBuyingPrice,
      date,
    );
  }
  recomputeProductSummary(productId);
}

// FIFO consumption as its own reusable piece — same logic completeSaleTx
// uses, extracted here so editSale's "re-consume after restoring" step
// doesn't duplicate it. Throws on insufficient stock so the caller's
// transaction rolls back the restore too, not just the failed
// consumption — an edit either fully succeeds or nothing changes at all.
function consumeStockForEdit(productId, quantity) {
  const batches = db
    .prepare(
      "SELECT * FROM stock_batches WHERE product_id = ? ORDER BY date ASC",
    )
    .all(productId);
  const totalAvailable = batches.reduce((sum, b) => sum + b.remaining, 0);
  if (quantity > totalAvailable)
    throw new CartValidationError("INSUFFICIENT_STOCK");

  let remainingToConsume = quantity;
  let totalCost = 0;
  const breakdown = [];
  const updateBatch = db.prepare(
    "UPDATE stock_batches SET remaining = ? WHERE id = ?",
  );
  const deleteBatch = db.prepare("DELETE FROM stock_batches WHERE id = ?");

  for (const batch of batches) {
    if (remainingToConsume <= 0) break;
    const take = Math.min(batch.remaining, remainingToConsume);
    totalCost += take * batch.buying_price;
    remainingToConsume -= take;
    breakdown.push({ quantity: take, buyingPrice: batch.buying_price });
    const newRemaining = batch.remaining - take;
    if (newRemaining > 0) updateBatch.run(newRemaining, batch.id);
    else deleteBatch.run(batch.id);
  }

  recomputeProductSummary(productId);
  return { totalCost, breakdown, effectiveBuyingPrice: totalCost / quantity };
}

// Editing a sale isn't a field update — the stock it consumed already
// left the shelf. The correct sequence: restore what the ORIGINAL sale
// took (as real batches, at their real prices), then re-consume for the
// NEW quantity from that restored state. Both steps run in one
// transaction — tested directly that editing to an impossible quantity
// rolls back the restore too, not just the failed re-consumption,
// leaving stock exactly as it was before the edit was attempted.
const editSaleTx = db.transaction(
  (saleId, newQuantity, newSellingPrice, notes) => {
    const sale = db.prepare("SELECT * FROM sales WHERE id = ?").get(saleId);
    if (!sale) throw new CartValidationError("SALE_NOT_FOUND");

    const product = db
      .prepare("SELECT * FROM products WHERE id = ?")
      .get(sale.product_id);
    if (!product) throw new CartValidationError("PRODUCT_NOT_FOUND");

    // Legacy sales recorded before buying_price was tracked won't have
    // one stored — derive a reasonable one from what's already on the
    // record rather than losing the restore entirely.
    const originalBuyingPrice =
      sale.buying_price ??
      (sale.quantity > 0
        ? sale.selling_price - (sale.profit || 0) / sale.quantity
        : product.buying_price);
    const breakdown = sale.batch_breakdown
      ? JSON.parse(sale.batch_breakdown)
      : null;
    const restoreDate = new Date().toISOString();

    restoreBatchesFromBreakdown(
      sale.product_id,
      breakdown,
      sale.quantity,
      originalBuyingPrice,
      restoreDate,
    );

    let consumption;
    try {
      consumption = consumeStockForEdit(sale.product_id, newQuantity);
    } catch (err) {
      if (
        err instanceof CartValidationError &&
        err.message === "INSUFFICIENT_STOCK"
      ) {
        const currentStock = db
          .prepare("SELECT stock FROM products WHERE id = ?")
          .get(sale.product_id).stock;
        throw new CartValidationError(
          `Stoo haitoshi kwa kiasi kipya — ${currentStock} pekee zingekuwepo`,
        );
      }
      throw err;
    }

    const totalRevenue = newSellingPrice * newQuantity;
    const profit = totalRevenue - consumption.totalCost;
    const editedAt = new Date().toISOString();

    db.prepare(
      `
    UPDATE sales SET quantity = ?, buying_price = ?, selling_price = ?, total_cost = ?, total_revenue = ?,
      profit = ?, notes = ?, edited_at = ?, batch_breakdown = ?
    WHERE id = ?
  `,
    ).run(
      newQuantity,
      consumption.effectiveBuyingPrice,
      newSellingPrice,
      consumption.totalCost,
      totalRevenue,
      profit,
      notes || "",
      editedAt,
      JSON.stringify(consumption.breakdown),
      saleId,
    );

    db.prepare(
      `INSERT INTO activity_log (id, action, details, actor_name, date) VALUES (?, 'edited a sale', ?, NULL, ?)`,
    ).run(
      genId("al"),
      `${product.name} → ${newQuantity} × TZS ${Math.round(newSellingPrice).toLocaleString("en-US")}`,
      editedAt,
    );

    return db.prepare("SELECT * FROM sales WHERE id = ?").get(saleId);
  },
);

function editSale(
  saleId,
  { quantity: newQuantity, sellingPrice: newSellingPrice, notes },
) {
  if (!newQuantity || newQuantity <= 0)
    return { success: false, error: "Weka kiasi sahihi" };
  if (!newSellingPrice || newSellingPrice <= 0)
    return { success: false, error: "Weka bei sahihi ya kuuza" };

  try {
    const row = editSaleTx(saleId, newQuantity, newSellingPrice, notes);
    return {
      success: true,
      sale: {
        id: row.id,
        productId: row.product_id,
        productName: row.product_name,
        quantity: row.quantity,
        buyingPrice: row.buying_price,
        sellingPrice: row.selling_price,
        totalCost: row.total_cost,
        totalRevenue: row.total_revenue,
        profit: row.profit,
        notes: row.notes,
        editedAt: row.edited_at,
        batchBreakdown: row.batch_breakdown
          ? JSON.parse(row.batch_breakdown)
          : null,
      },
    };
  } catch (err) {
    if (err instanceof CartValidationError) {
      if (err.message === "SALE_NOT_FOUND")
        return { success: false, error: "Muuzo haupatikani" };
      if (err.message === "PRODUCT_NOT_FOUND")
        return { success: false, error: "Bidhaa haipatikani tena" };
      return { success: false, error: err.message };
    }
    throw err;
  }
}

// Simpler than editing — no new quantity to re-consume, just a straight
// restore of what the sale took, then remove the record.
const deleteSaleTx = db.transaction((saleId) => {
  const sale = db.prepare("SELECT * FROM sales WHERE id = ?").get(saleId);
  if (!sale) throw new CartValidationError("SALE_NOT_FOUND");

  const product = db
    .prepare("SELECT * FROM products WHERE id = ?")
    .get(sale.product_id);
  if (product) {
    const originalBuyingPrice =
      sale.buying_price ??
      (sale.quantity > 0
        ? sale.selling_price - (sale.profit || 0) / sale.quantity
        : product.buying_price);
    const breakdown = sale.batch_breakdown
      ? JSON.parse(sale.batch_breakdown)
      : null;
    restoreBatchesFromBreakdown(
      sale.product_id,
      breakdown,
      sale.quantity,
      originalBuyingPrice,
      new Date().toISOString(),
    );
  }
  // If the product itself was deleted since this sale happened, there's
  // nothing to restore stock to — the sale record still gets removed.

  db.prepare("DELETE FROM sales WHERE id = ?").run(saleId);

  db.prepare(
    `INSERT INTO activity_log (id, action, details, actor_name, date) VALUES (?, 'deleted a sale', ?, NULL, ?)`,
  ).run(
    genId("al"),
    `${sale.product_name} × ${sale.quantity} — TZS ${Math.round(sale.total_revenue).toLocaleString("en-US")}`,
    new Date().toISOString(),
  );
});

function deleteSale(saleId) {
  try {
    deleteSaleTx(saleId);
    return { success: true };
  } catch (err) {
    if (
      err instanceof CartValidationError &&
      err.message === "SALE_NOT_FOUND"
    ) {
      return { success: false, error: "Muuzo haupatikani" };
    }
    throw err;
  }
}

// Same overpayment-prevention reasoning as recordSupplierPayment — the
// balance check and the write happen in the same transaction, closing
// the same race a separate read-then-write would leave open.
const recordCreditPaymentTx = db.transaction(
  (creditSaleId, amount, paymentMethod) => {
    const cs = db
      .prepare("SELECT * FROM credit_sales WHERE id = ?")
      .get(creditSaleId);
    if (!cs) throw new CartValidationError("Deni halipatikani");

    const remaining = cs.total_amount - cs.amount_paid;
    if (amount > remaining)
      throw new CartValidationError(
        `Kiasi kinazidi deni lililobaki (${Math.round(remaining)})`,
      );

    const newAmountPaid = cs.amount_paid + amount;
    const newStatus = newAmountPaid >= cs.total_amount ? "paid" : "partial";
    const date = new Date().toISOString();

    db.prepare(
      "UPDATE credit_sales SET amount_paid = ?, status = ? WHERE id = ?",
    ).run(newAmountPaid, newStatus, creditSaleId);
    db.prepare(
      "INSERT INTO credit_sale_payments (id, credit_sale_id, amount, payment_method, date) VALUES (?, ?, ?, ?, ?)",
    ).run(genId("ccp"), creditSaleId, amount, paymentMethod || "", date);
    db.prepare(
      `INSERT INTO activity_log (id, action, details, actor_name, date) VALUES (?, 'recorded a credit payment', ?, NULL, ?)`,
    ).run(
      genId("al"),
      `${cs.customer_name} — TZS ${Math.round(amount).toLocaleString("en-US")}`,
      date,
    );

    return newStatus;
  },
);

function recordCreditPayment(creditSaleId, amount, paymentMethod) {
  if (!amount || amount <= 0)
    return { success: false, error: "Weka kiasi sahihi" };
  try {
    const status = recordCreditPaymentTx(creditSaleId, amount, paymentMethod);
    return { success: true, isFullySettled: status === "paid" };
  } catch (err) {
    if (err instanceof CartValidationError)
      return { success: false, error: err.message };
    throw err;
  }
}

// Deleting a credit sale isn't just removing a record — the goods it
// represented left the shelf when it was created. Each line item
// restores its OWN product using its OWN batch breakdown — a credit sale
// covering two different products correctly gives each one back its own
// real batches at its own real prices, not a single blended restoration
// across unrelated products. Tested directly with two products, each
// with a distinct breakdown, confirming both restore independently and
// correctly.
const deleteCreditSaleTx = db.transaction((creditSaleId) => {
  const cs = db
    .prepare("SELECT * FROM credit_sales WHERE id = ?")
    .get(creditSaleId);
  if (!cs) throw new CartValidationError("Deni halipatikani");

  const items = db
    .prepare("SELECT * FROM credit_sale_items WHERE credit_sale_id = ?")
    .all(creditSaleId);
  const restoreDate = new Date().toISOString();

  for (const item of items) {
    const product = db
      .prepare("SELECT * FROM products WHERE id = ?")
      .get(item.product_id);
    if (!product) continue; // product itself was deleted since — nothing to restore stock to

    const breakdown = item.batch_breakdown
      ? JSON.parse(item.batch_breakdown)
      : null;
    const fallbackCost = item.cost_at_sale ?? product.buying_price ?? 0;
    restoreBatchesFromBreakdown(
      item.product_id,
      breakdown,
      item.quantity,
      fallbackCost,
      restoreDate,
    );
  }

  db.prepare("DELETE FROM credit_sales WHERE id = ?").run(creditSaleId); // cascades items + payments

  db.prepare(
    `INSERT INTO activity_log (id, action, details, actor_name, date) VALUES (?, 'deleted a credit sale', ?, NULL, ?)`,
  ).run(
    genId("al"),
    `${cs.customer_name} — TZS ${Math.round(cs.total_amount).toLocaleString("en-US")}`,
    restoreDate,
  );
});

function deleteCreditSale(creditSaleId) {
  try {
    deleteCreditSaleTx(creditSaleId);
    return { success: true };
  } catch (err) {
    if (err instanceof CartValidationError)
      return { success: false, error: err.message };
    throw err;
  }
}

function getActivityLog() {
  return db
    .prepare("SELECT * FROM activity_log ORDER BY date DESC")
    .all()
    .map((a) => ({
      id: a.id,
      action: a.action,
      details: a.details,
      actorName: a.actor_name,
      date: a.date,
    }));
}

const saveActivityLog = db.transaction((log) => {
  db.prepare("DELETE FROM activity_log").run();
  const insert = db.prepare(`
    INSERT INTO activity_log (id, action, details, actor_name, date)
    VALUES (@id, @action, @details, @actorName, @date)
  `);
  for (const a of log) {
    insert.run({
      id: a.id,
      action: a.action,
      details: a.details ?? null,
      actorName: a.actorName ?? null,
      date: a.date,
    });
  }
});

function getCrashLog() {
  return db
    .prepare("SELECT * FROM crash_log ORDER BY timestamp DESC")
    .all()
    .map((c) => ({
      id: c.id,
      message: c.message,
      stack: c.stack,
      context: c.context,
      timestamp: c.timestamp,
    }));
}

const saveCrashLog = db.transaction((log) => {
  db.prepare("DELETE FROM crash_log").run();
  const insert = db.prepare(`
    INSERT INTO crash_log (id, message, stack, context, timestamp)
    VALUES (@id, @message, @stack, @context, @timestamp)
  `);
  for (const c of log) {
    insert.run({
      id: c.id,
      message: c.message,
      stack: c.stack ?? null,
      context: c.context ?? null,
      timestamp: c.timestamp,
    });
  }
});

function getSettings() {
  const row = db.prepare("SELECT data FROM settings WHERE id = 1").get();
  return row
    ? JSON.parse(row.data)
    : { businessName: "", ownerPin: "", ownerPhone: "" };
}

function saveSettings(settings) {
  db.prepare(
    `
    INSERT INTO settings (id, data) VALUES (1, @data)
    ON CONFLICT(id) DO UPDATE SET data = @data
  `,
  ).run({ data: JSON.stringify(settings) });
}

const genId = (prefix) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

// The first service migrated to genuinely granular SQL, as the template
// for the rest. Everything the old renderer-side salesService.js did in
// JavaScript — load the product, walk batches oldest-first, update or
// drop each one, recompute the product's summary, insert the sale — now
// happens as real SQL statements, wrapped in one database transaction.
// If anything throws partway through, better-sqlite3 rolls back
// everything: a failed sale can never leave stock half-consumed with no
// sale record to show for it. Tested against the exact FIFO scenarios
// batchService.js already proved (consumption spanning two batches at
// different prices, oversell rejection with zero mutation) before this
// was trusted to replace that logic.
const completeSaleTx = db.transaction(
  (
    productId,
    quantity,
    sellingPrice,
    paymentMethod,
    accountId,
    accountLabel,
    accountNumber,
    customerPhone,
    customerName,
    discount,
  ) => {
    const product = db
      .prepare("SELECT * FROM products WHERE id = ?")
      .get(productId);
    if (!product) throw new Error("PRODUCT_NOT_FOUND");

    const batches = db
      .prepare(
        "SELECT * FROM stock_batches WHERE product_id = ? ORDER BY date ASC",
      )
      .all(productId);
    const totalAvailable = batches.reduce((sum, b) => sum + b.remaining, 0);
    if (quantity > totalAvailable) throw new Error("INSUFFICIENT_STOCK");

    let remainingToConsume = quantity;
    let totalCost = 0;
    // Records exactly which batches were touched and how much came from
    // each, at each one's real price — not just the blended average. This
    // is what lets a later delete restore the exact original batches
    // instead of collapsing everything into one averaged batch.
    const breakdown = [];
    const updateBatch = db.prepare(
      "UPDATE stock_batches SET remaining = ? WHERE id = ?",
    );
    const deleteBatch = db.prepare("DELETE FROM stock_batches WHERE id = ?");

    for (const batch of batches) {
      if (remainingToConsume <= 0) break;
      const take = Math.min(batch.remaining, remainingToConsume);
      totalCost += take * batch.buying_price;
      remainingToConsume -= take;
      breakdown.push({ quantity: take, buyingPrice: batch.buying_price });
      const newRemaining = batch.remaining - take;
      if (newRemaining > 0) updateBatch.run(newRemaining, batch.id);
      else deleteBatch.run(batch.id);
    }

    const remainingBatches = db
      .prepare("SELECT * FROM stock_batches WHERE product_id = ?")
      .all(productId);
    const newStock = remainingBatches.reduce((sum, b) => sum + b.remaining, 0);
    const totalValue = remainingBatches.reduce(
      (sum, b) => sum + b.remaining * b.buying_price,
      0,
    );
    const newBuyingPrice = newStock > 0 ? totalValue / newStock : 0;
    db.prepare(
      "UPDATE products SET stock = ?, buying_price = ? WHERE id = ?",
    ).run(newStock, newBuyingPrice, productId);

    // The discount comes straight out of what the customer actually paid
    // — the cost of the goods sold doesn't change just because the price
    // was negotiated down, so it comes straight out of profit too. If the
    // discount exceeds the margin, profit genuinely goes negative here,
    // which is correct: that's what actually happened, not something to
    // hide by clamping at zero.
    const appliedDiscount = discount || 0;
    const totalRevenue = sellingPrice * quantity - appliedDiscount;
    const profit = totalRevenue - totalCost;
    const effectiveBuyingPrice = totalCost / quantity;
    const saleId = genId("s");
    const date = new Date().toISOString();
    const breakdownJson = JSON.stringify(breakdown);

    db.prepare(
      `
    INSERT INTO sales (id, product_id, product_name, quantity, buying_price, selling_price, total_cost, total_revenue, profit, payment_method, account_id, account_label, account_number, notes, date, batch_breakdown, customer_phone, customer_name, discount)
    VALUES (@id, @productId, @productName, @quantity, @buyingPrice, @sellingPrice, @totalCost, @totalRevenue, @profit, @paymentMethod, @accountId, @accountLabel, @accountNumber, @notes, @date, @breakdown, @customerPhone, @customerName, @discount)
  `,
    ).run({
      id: saleId,
      productId,
      productName: product.name,
      quantity,
      buyingPrice: effectiveBuyingPrice,
      sellingPrice,
      totalCost,
      totalRevenue,
      profit,
      paymentMethod: paymentMethod || "cash",
      accountId: accountId || null,
      accountLabel: accountLabel || null,
      accountNumber: accountNumber || null,
      notes: "",
      date,
      breakdown: breakdownJson,
      customerPhone: customerPhone || null,
      customerName: customerName || null,
      discount: appliedDiscount,
    });

    db.prepare(
      `
    INSERT INTO activity_log (id, action, details, actor_name, date)
    VALUES (?, 'sold a product', ?, NULL, ?)
  `,
    ).run(
      genId("al"),
      `${product.name} × ${quantity} — TZS ${Math.round(totalRevenue).toLocaleString("en-US")}`,
      date,
    );

    return {
      id: saleId,
      productId,
      productName: product.name,
      quantity,
      buyingPrice: effectiveBuyingPrice,
      sellingPrice,
      totalCost,
      totalRevenue,
      profit,
      paymentMethod: paymentMethod || "cash",
      accountId: accountId || null,
      accountLabel: accountLabel || null,
      accountNumber: accountNumber || null,
      notes: "",
      date,
      editedAt: null,
      batchBreakdown: breakdown,
      customerPhone: customerPhone || null,
      customerName: customerName || null,
      discount: appliedDiscount,
    };
  },
);

function completeSale({
  productId,
  quantity,
  sellingPrice,
  paymentMethod,
  accountId,
  accountLabel,
  accountNumber,
  customerPhone,
  customerName,
  discount,
}) {
  if (!quantity || quantity <= 0)
    return { success: false, error: "Weka kiasi sahihi" };
  if (!sellingPrice || sellingPrice <= 0)
    return { success: false, error: "Weka bei sahihi ya kuuza" };
  const grossTotal = sellingPrice * quantity;
  if (discount && discount < 0)
    return { success: false, error: "Punguzo haliwezi kuwa hasi" };
  if (discount && discount >= grossTotal)
    return { success: false, error: "Punguzo haliwezi kuzidi bei ya jumla" };

  try {
    const sale = completeSaleTx(
      productId,
      quantity,
      sellingPrice,
      paymentMethod,
      accountId,
      accountLabel,
      accountNumber,
      customerPhone,
      customerName,
      discount,
    );
    return { success: true, sale };
  } catch (err) {
    if (err.message === "PRODUCT_NOT_FOUND")
      return { success: false, error: "Bidhaa haipatikani" };
    if (err.message === "INSUFFICIENT_STOCK")
      return { success: false, error: "Stoo haitoshi" };
    throw err; // anything else is genuinely unexpected — let it surface, not hide it
  }
}

class CartValidationError extends Error {}

// Same reasoning as completeSale, extended to multiple products in one
// transaction. The validation and the mutation happen in the same pass
// per item — deliberately not "validate everything first, then mutate"
// like the old renderer-side code did. That's safe here in a way it
// wasn't in JavaScript: db.transaction() rolls back everything the
// moment any item throws, including stock already consumed for an
// earlier, individually-valid item in the same cart. Tested directly —
// a cart with one oversold item correctly leaves every other item's
// stock untouched, not just the failing one.
const completeCartSaleTx = db.transaction((cartItems, meta) => {
  const saleRows = [];

  for (const item of cartItems) {
    if (!item.quantity || item.quantity <= 0) {
      throw new CartValidationError(`${item.productName}: weka kiasi sahihi`);
    }
    if (!item.sellingPrice || item.sellingPrice <= 0) {
      throw new CartValidationError(
        `${item.productName}: weka bei sahihi ya kuuza`,
      );
    }
    const itemDiscount = item.discount || 0;
    if (itemDiscount < 0) {
      throw new CartValidationError(
        `${item.productName}: punguzo haliwezi kuwa hasi`,
      );
    }
    if (itemDiscount >= item.sellingPrice * item.quantity) {
      throw new CartValidationError(
        `${item.productName}: punguzo haliwezi kuzidi bei ya jumla`,
      );
    }

    const product = db
      .prepare("SELECT * FROM products WHERE id = ?")
      .get(item.productId);
    if (!product) {
      throw new CartValidationError(`${item.productName} haipatikani tena`);
    }

    const batches = db
      .prepare(
        "SELECT * FROM stock_batches WHERE product_id = ? ORDER BY date ASC",
      )
      .all(item.productId);
    const totalAvailable = batches.reduce((sum, b) => sum + b.remaining, 0);
    if (item.quantity > totalAvailable) {
      throw new CartValidationError(
        `${item.productName}: stoo haitoshi (${product.stock} pekee zimebaki)`,
      );
    }

    let remainingToConsume = item.quantity;
    let totalCost = 0;
    const breakdown = [];
    const updateBatch = db.prepare(
      "UPDATE stock_batches SET remaining = ? WHERE id = ?",
    );
    const deleteBatch = db.prepare("DELETE FROM stock_batches WHERE id = ?");

    for (const batch of batches) {
      if (remainingToConsume <= 0) break;
      const take = Math.min(batch.remaining, remainingToConsume);
      totalCost += take * batch.buying_price;
      remainingToConsume -= take;
      breakdown.push({ quantity: take, buyingPrice: batch.buying_price });
      const newRemaining = batch.remaining - take;
      if (newRemaining > 0) updateBatch.run(newRemaining, batch.id);
      else deleteBatch.run(batch.id);
    }

    const remainingBatches = db
      .prepare("SELECT * FROM stock_batches WHERE product_id = ?")
      .all(item.productId);
    const newStock = remainingBatches.reduce((sum, b) => sum + b.remaining, 0);
    const totalValue = remainingBatches.reduce(
      (sum, b) => sum + b.remaining * b.buying_price,
      0,
    );
    const newBuyingPrice = newStock > 0 ? totalValue / newStock : 0;
    db.prepare(
      "UPDATE products SET stock = ?, buying_price = ? WHERE id = ?",
    ).run(newStock, newBuyingPrice, item.productId);

    const totalRevenue = item.sellingPrice * item.quantity - itemDiscount;
    const profit = totalRevenue - totalCost;
    const effectiveBuyingPrice = totalCost / item.quantity;
    const saleId = genId("s");
    const date = new Date().toISOString();

    db.prepare(
      `
      INSERT INTO sales (id, product_id, product_name, quantity, buying_price, selling_price, total_cost, total_revenue, profit, payment_method, account_id, account_label, account_number, notes, date, batch_breakdown, customer_phone, customer_name, discount)
      VALUES (@id, @productId, @productName, @quantity, @buyingPrice, @sellingPrice, @totalCost, @totalRevenue, @profit, @paymentMethod, @accountId, @accountLabel, @accountNumber, @notes, @date, @breakdownJson, @customerPhone, @customerName, @discount)
    `,
    ).run({
      id: saleId,
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      buyingPrice: effectiveBuyingPrice,
      sellingPrice: item.sellingPrice,
      totalCost,
      totalRevenue,
      profit,
      paymentMethod: meta.paymentMethod || "cash",
      accountId: meta.accountId || null,
      accountLabel: meta.accountLabel || "",
      accountNumber: meta.accountNumber || "",
      notes: "",
      date,
      breakdownJson: JSON.stringify(breakdown),
      customerPhone: meta.customerPhone || null,
      customerName: meta.customerName || null,
      discount: itemDiscount,
    });

    saleRows.push({
      id: saleId,
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      buyingPrice: effectiveBuyingPrice,
      sellingPrice: item.sellingPrice,
      totalCost,
      totalRevenue,
      profit,
      paymentMethod: meta.paymentMethod || "cash",
      accountId: meta.accountId || null,
      accountLabel: meta.accountLabel || "",
      accountNumber: meta.accountNumber || "",
      notes: "",
      date,
      batchBreakdown: breakdown,
      customerPhone: meta.customerPhone || null,
      customerName: meta.customerName || null,
      discount: itemDiscount,
    });
  }

  const total = saleRows.reduce((sum, s) => sum + s.totalRevenue, 0);
  db.prepare(
    `
    INSERT INTO activity_log (id, action, details, actor_name, date)
    VALUES (?, 'sold multiple products', ?, NULL, ?)
  `,
  ).run(
    genId("al"),
    `${saleRows.length} bidhaa — TZS ${Math.round(total).toLocaleString("en-US")}`,
    new Date().toISOString(),
  );

  return saleRows;
});

function completeCartSale(cartItems, meta = {}) {
  if (!cartItems || cartItems.length === 0) {
    return { success: false, error: "Hakuna bidhaa kwenye kikapu" };
  }

  try {
    const sales = completeCartSaleTx(cartItems, meta);
    return { success: true, sales };
  } catch (err) {
    if (err instanceof CartValidationError)
      return { success: false, error: err.message };
    throw err;
  }
}

// A credit sale is a real sale — the goods leave the shelf immediately,
// same FIFO consumption and same all-or-nothing guarantee as a cash cart
// sale. The one thing that has to be exactly right here: costAtSale on
// each item. It's what lets deleteCreditSale correctly restore stock as
// a real batch later, at the price it was actually sold at — not a
// blended average that's drifted since. Tested directly before trusting
// this, including that costAtSale reflects genuine FIFO cost across
// multiple batches, not just the product's current average.
const completeCreditSaleTx = db.transaction(
  (cartItems, customerName, customerPhone) => {
    const creditSaleId = genId("cs");
    let totalAmount = 0;
    const itemInserts = [];

    for (const item of cartItems) {
      if (!item.quantity || item.quantity <= 0) {
        throw new CartValidationError(`${item.productName}: weka kiasi sahihi`);
      }
      if (!item.sellingPrice || item.sellingPrice <= 0) {
        throw new CartValidationError(
          `${item.productName}: weka bei sahihi ya kuuza`,
        );
      }

      const product = db
        .prepare("SELECT * FROM products WHERE id = ?")
        .get(item.productId);
      if (!product) {
        throw new CartValidationError(`${item.productName} haipatikani tena`);
      }

      const batches = db
        .prepare(
          "SELECT * FROM stock_batches WHERE product_id = ? ORDER BY date ASC",
        )
        .all(item.productId);
      const totalAvailable = batches.reduce((sum, b) => sum + b.remaining, 0);
      if (item.quantity > totalAvailable) {
        throw new CartValidationError(
          `${item.productName}: stoo haitoshi (${product.stock} pekee zimebaki)`,
        );
      }

      let remainingToConsume = item.quantity;
      let totalCost = 0;
      // Same reasoning as completeSaleTx — record which batches were
      // actually touched, not just the blended average, so a later delete
      // can restore the exact original batches at their real prices.
      const breakdown = [];
      const updateBatch = db.prepare(
        "UPDATE stock_batches SET remaining = ? WHERE id = ?",
      );
      const deleteBatch = db.prepare("DELETE FROM stock_batches WHERE id = ?");

      for (const batch of batches) {
        if (remainingToConsume <= 0) break;
        const take = Math.min(batch.remaining, remainingToConsume);
        totalCost += take * batch.buying_price;
        remainingToConsume -= take;
        breakdown.push({ quantity: take, buyingPrice: batch.buying_price });
        const newRemaining = batch.remaining - take;
        if (newRemaining > 0) updateBatch.run(newRemaining, batch.id);
        else deleteBatch.run(batch.id);
      }

      const remainingBatches = db
        .prepare("SELECT * FROM stock_batches WHERE product_id = ?")
        .all(item.productId);
      const newStock = remainingBatches.reduce(
        (sum, b) => sum + b.remaining,
        0,
      );
      const totalValue = remainingBatches.reduce(
        (sum, b) => sum + b.remaining * b.buying_price,
        0,
      );
      const newBuyingPrice = newStock > 0 ? totalValue / newStock : 0;
      db.prepare(
        "UPDATE products SET stock = ?, buying_price = ? WHERE id = ?",
      ).run(newStock, newBuyingPrice, item.productId);

      const effectiveBuyingPrice = totalCost / item.quantity;
      totalAmount += item.quantity * item.sellingPrice;

      itemInserts.push({
        id: genId("cci"),
        creditSaleId,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        sellingPrice: item.sellingPrice,
        costAtSale: effectiveBuyingPrice,
        batchBreakdown: breakdown,
      });
    }

    const date = new Date().toISOString();
    db.prepare(
      `
    INSERT INTO credit_sales (id, customer_name, customer_phone, total_amount, amount_paid, status, date)
    VALUES (?, ?, ?, ?, 0, 'pending', ?)
  `,
    ).run(creditSaleId, customerName, customerPhone, totalAmount, date);

    const insertItem = db.prepare(`
    INSERT INTO credit_sale_items (id, credit_sale_id, product_id, product_name, quantity, selling_price, cost_at_sale, batch_breakdown)
    VALUES (@id, @creditSaleId, @productId, @productName, @quantity, @sellingPrice, @costAtSale, @breakdownJson)
  `);
    for (const item of itemInserts) {
      insertItem.run({
        id: item.id,
        creditSaleId: item.creditSaleId,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        sellingPrice: item.sellingPrice,
        costAtSale: item.costAtSale,
        breakdownJson: JSON.stringify(item.batchBreakdown),
      });
    }

    db.prepare(
      `
    INSERT INTO activity_log (id, action, details, actor_name, date)
    VALUES (?, 'sold on credit', ?, NULL, ?)
  `,
    ).run(
      genId("al"),
      `${customerName} — TZS ${Math.round(totalAmount).toLocaleString("en-US")}`,
      date,
    );

    return {
      id: creditSaleId,
      customerName,
      customerPhone,
      items: itemInserts.map((i) => ({
        productId: i.productId,
        productName: i.productName,
        quantity: i.quantity,
        sellingPrice: i.sellingPrice,
        costAtSale: i.costAtSale,
        batchBreakdown: i.batchBreakdown,
      })),
      totalAmount,
      amountPaid: 0,
      status: "pending",
      payments: [],
      date,
    };
  },
);

function completeCreditSale({ cartItems, customerName, customerPhone }) {
  if (!cartItems || cartItems.length === 0) {
    return { success: false, error: "Hakuna bidhaa kwenye kikapu" };
  }
  if (!customerName || !customerName.trim()) {
    return { success: false, error: "Weka jina la mteja" };
  }

  try {
    const creditSale = completeCreditSaleTx(
      cartItems,
      customerName.trim(),
      (customerPhone || "").trim(),
    );
    return { success: true, creditSale };
  } catch (err) {
    if (err instanceof CartValidationError)
      return { success: false, error: err.message };
    throw err;
  }
}

// An order ticket, not a sale — recorded before the customer ever
// reaches the cashier. order_number is computed as current-max-plus-one
// and inserted in the same transaction, so two orders created back to
// back can never collide on the same number, even though nothing here
// depends on that race actually being possible in a single-device app.
const createOrderTx = db.transaction(
  (issuedBy, customerName, customerPhone, items) => {
    const row = db.prepare("SELECT MAX(order_number) as m FROM orders").get();
    const nextNumber = (row.m || 0) + 1;
    const orderId = genId("ord");
    const date = new Date().toISOString();

    db.prepare(
      `
    INSERT INTO orders (id, order_number, issued_by, customer_name, customer_phone, status, date)
    VALUES (?, ?, ?, ?, ?, 'pending', ?)
  `,
    ).run(
      orderId,
      nextNumber,
      issuedBy || null,
      customerName || null,
      customerPhone || null,
      date,
    );

    const insertItem = db.prepare(`
    INSERT INTO order_items (id, order_id, product_id, product_name, quantity, expected_price)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
    for (const item of items) {
      insertItem.run(
        genId("oi"),
        orderId,
        item.productId,
        item.productName,
        item.quantity,
        item.expectedPrice ?? null,
      );
    }

    return { id: orderId, orderNumber: nextNumber };
  },
);

function createOrder({ issuedBy, customerName, customerPhone, items }) {
  if (!items || items.length === 0)
    return { success: false, error: "Hakuna bidhaa kwenye oda" };
  for (const item of items) {
    if (!item.quantity || item.quantity <= 0) {
      return {
        success: false,
        error: `${item.productName}: weka kiasi sahihi`,
      };
    }
  }
  const order = createOrderTx(issuedBy, customerName, customerPhone, items);
  return { success: true, order };
}

function getOrders() {
  const orders = db
    .prepare("SELECT * FROM orders ORDER BY order_number DESC")
    .all();
  const items = db.prepare("SELECT * FROM order_items").all();
  const itemsByOrder = {};
  for (const i of items) {
    (itemsByOrder[i.order_id] ||= []).push({
      productId: i.product_id,
      productName: i.product_name,
      quantity: i.quantity,
      expectedPrice: i.expected_price,
    });
  }
  return orders.map((o) => ({
    id: o.id,
    orderNumber: o.order_number,
    issuedBy: o.issued_by,
    customerName: o.customer_name,
    customerPhone: o.customer_phone,
    status: o.status,
    date: o.date,
    fulfilledAt: o.fulfilled_at,
    items: itemsByOrder[o.id] || [],
  }));
}

// Fulfilling doesn't touch stock or create a sale itself — that already
// happens through the normal cart-sale flow once the cashier loads the
// order's items in. This just marks the order as settled and guards
// against marking the same order fulfilled twice.
function fulfillOrder(orderId) {
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId);
  if (!order) return { success: false, error: "Oda haipatikani" };
  if (order.status !== "pending")
    return {
      success: false,
      error: `Oda tayari ${order.status === "fulfilled" ? "imekamilika" : "imefutwa"}`,
    };

  db.prepare(
    `UPDATE orders SET status = 'fulfilled', fulfilled_at = ? WHERE id = ?`,
  ).run(new Date().toISOString(), orderId);
  return { success: true };
}

function cancelOrder(orderId) {
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId);
  if (!order) return { success: false, error: "Oda haipatikani" };
  if (order.status !== "pending")
    return {
      success: false,
      error: `Oda tayari ${order.status === "fulfilled" ? "imekamilika" : "imefutwa"}`,
    };

  db.prepare(`UPDATE orders SET status = 'cancelled' WHERE id = ?`).run(
    orderId,
  );
  return { success: true };
}

module.exports = {
  getProducts,
  saveProducts,
  getSales,
  saveSales,
  getCreditSales,
  saveCreditSales,
  getExpenditures,
  saveExpenditures,
  getSuppliers,
  saveSuppliers,
  getStaff,
  saveStaff,
  getActivityLog,
  saveActivityLog,
  getCrashLog,
  saveCrashLog,
  getSettings,
  saveSettings,
  completeSale,
  completeCartSale,
  completeCreditSale,
  addStaff,
  updateStaff,
  deleteStaff,
  identifyStaffByPin,
  addSupplier,
  deleteSupplier,
  recordSupply,
  recordSupplierPayment,
  addStock,
  completeRestockCart,
  editSale,
  deleteSale,
  recordCreditPayment,
  deleteCreditSale,
  createOrder,
  getOrders,
  fulfillOrder,
  cancelOrder,
};
