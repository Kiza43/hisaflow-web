import React, { useState, useEffect } from "react";
import { dataService } from "../services/dataService";
import { orderService } from "../services/orderService";
import { useCart } from "../context/CartContext.jsx";
import CreateOrderModal from "../components/CreateOrderModal.jsx";
import OrderTicketModal from "../components/OrderTicketModal.jsx";
import ConfirmModal from "../components/ConfirmModal.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";

// The list of order tickets staff have written up. Fulfilling a pending
// order doesn't complete a sale by itself — it loads the order's items
// into the shared cart and marks the ticket settled, then the cashier
// finishes the actual transaction from Products, same cart flow as any
// other sale. This keeps stock deduction and payment happening in
// exactly one place in the app, not duplicated here.
const OrdersScreen = ({ currentUser, onNavigate }) => {
  const { t } = useLanguage();
  const { addToCart, updateQuantity } = useCart();
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [viewingOrder, setViewingOrder] = useState(null);
  const [pendingCancelId, setPendingCancelId] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [fulfillingId, setFulfillingId] = useState(null);

  const loadOrders = () => orderService.getOrders().then(setOrders);

  useEffect(() => {
    Promise.all([
      orderService.getOrders(),
      dataService.getProducts(),
      dataService.getSettings(),
    ]).then(([o, p, s]) => {
      setOrders(o);
      setProducts(p);
      setSettings(s);
      setLoading(false);
    });
  }, []);

  const handleCreateOrder = async (payload) => {
    const result = await orderService.createOrder(payload);
    if (result.success) {
      const fresh = await orderService.getOrders();
      setOrders(fresh);
      const created = fresh.find((o) => o.id === result.order.id);
      if (created) setViewingOrder(created);
    }
    return result;
  };

  const handleFulfill = async (order) => {
    if (fulfillingId) return;
    setFulfillingId(order.id);
    try {
      // Load each item into the shared cart, respecting current stock —
      // if a product's stock has changed since the order was written up
      // (or the product was deleted), skip it rather than fail the whole
      // fulfillment; the cashier will see what actually made it into
      // the cart and can handle any gap directly with the customer.
      for (const item of order.items) {
        const product = products.find((p) => p.id === item.productId);
        if (!product || product.stock <= 0) continue;
        addToCart(product);
        updateQuantity(item.productId, item.quantity);
      }
      const result = await orderService.fulfillOrder(order.id);
      if (result.success) {
        await loadOrders();
        if (onNavigate) onNavigate("products");
      }
    } finally {
      setFulfillingId(null);
    }
  };

  const confirmCancel = async () => {
    if (cancelling) return;
    setCancelling(true);
    try {
      await orderService.cancelOrder(pendingCancelId);
      await loadOrders();
      setPendingCancelId(null);
    } finally {
      setCancelling(false);
    }
  };

  if (loading) return null;

  const pending = orders.filter((o) => o.status === "pending");
  const settled = orders.filter((o) => o.status !== "pending");

  return (
    <div style={styles.screen}>
      <div style={styles.header}>
        <h1 style={styles.title}>{t("navOrders")}</h1>
        <button style={styles.newBtn} onClick={() => setShowCreate(true)}>
          {t("newOrderButton")}
        </button>
      </div>

      {orders.length === 0 ? (
        <div style={styles.empty}>{t("noOrdersYet")}</div>
      ) : (
        <div style={styles.list}>
          {pending.length > 0 && (
            <>
              <div style={styles.sectionLabel}>{t("pendingOrdersLabel")}</div>
              {pending.map((order) => (
                <div
                  key={order.id}
                  style={styles.card}
                  onClick={() => setViewingOrder(order)}
                >
                  <div style={styles.cardTop}>
                    <span style={styles.orderNum}>
                      #{String(order.orderNumber).padStart(4, "0")}
                    </span>
                    <span
                      style={{ ...styles.statusPill, ...styles.statusPending }}
                    >
                      {t("orderStatusPending")}
                    </span>
                  </div>
                  <div style={styles.cardMeta}>
                    {t("issuedByLabel")}: {order.issuedBy || "—"}
                  </div>
                  {order.customerName && (
                    <div style={styles.cardMeta}>{order.customerName}</div>
                  )}
                  <div style={styles.cardItems}>
                    {order.items.length} {t("itemsLabel")}
                  </div>
                  <div
                    style={styles.cardActions}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      style={styles.fulfillBtn}
                      disabled={fulfillingId === order.id}
                      onClick={() => handleFulfill(order)}
                    >
                      {fulfillingId === order.id
                        ? t("completing")
                        : t("fulfillOrderButton")}
                    </button>
                    <button
                      style={styles.cancelOrderBtn}
                      onClick={() => setPendingCancelId(order.id)}
                    >
                      {t("cancelOrderButton")}
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}

          {settled.length > 0 && (
            <>
              <div style={styles.sectionLabel}>{t("orderHistoryLabel")}</div>
              {settled.map((order) => (
                <div
                  key={order.id}
                  style={{ ...styles.card, ...styles.cardSettled }}
                  onClick={() => setViewingOrder(order)}
                >
                  <div style={styles.cardTop}>
                    <span style={styles.orderNum}>
                      #{String(order.orderNumber).padStart(4, "0")}
                    </span>
                    <span
                      style={{
                        ...styles.statusPill,
                        ...(order.status === "fulfilled"
                          ? styles.statusFulfilled
                          : styles.statusCancelled),
                      }}
                    >
                      {order.status === "fulfilled"
                        ? t("orderStatusFulfilled")
                        : t("orderStatusCancelled")}
                    </span>
                  </div>
                  <div style={styles.cardMeta}>
                    {t("issuedByLabel")}: {order.issuedBy || "—"}
                  </div>
                  <div style={styles.cardItems}>
                    {order.items.length} {t("itemsLabel")}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      <CreateOrderModal
        visible={showCreate}
        products={products}
        currentUser={currentUser}
        onCreate={handleCreateOrder}
        onClose={() => setShowCreate(false)}
      />

      <OrderTicketModal
        visible={!!viewingOrder}
        order={viewingOrder}
        settings={settings}
        onClose={() => setViewingOrder(null)}
      />

      <ConfirmModal
        visible={!!pendingCancelId}
        busy={cancelling}
        title={t("cancelOrderConfirmTitle")}
        message={t("cancelOrderConfirmMessage")}
        onConfirm={confirmCancel}
        onCancel={() => setPendingCancelId(null)}
      />
    </div>
  );
};

const styles = {
  screen: { flex: 1, minHeight: 0, overflow: "auto", padding: 24 },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: { fontSize: 22, fontWeight: 800, color: "var(--text-primary)" },
  newBtn: {
    padding: "10px 18px",
    borderRadius: 12,
    border: "none",
    background: "var(--primary)",
    color: "white",
    fontWeight: 700,
    fontSize: 13,
  },
  empty: {
    textAlign: "center",
    color: "var(--text-muted)",
    fontSize: 14,
    marginTop: 60,
  },
  list: { display: "flex", flexDirection: "column", gap: 10, maxWidth: 640 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: "var(--text-muted)",
    marginTop: 12,
    marginBottom: 2,
    textTransform: "uppercase",
  },
  card: {
    background: "var(--surface)",
    borderRadius: 14,
    padding: 16,
    cursor: "pointer",
    border: "1px solid var(--border-muted)",
  },
  cardSettled: { opacity: 0.75 },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  orderNum: { fontSize: 16, fontWeight: 800, color: "var(--text-primary)" },
  statusPill: {
    fontSize: 10,
    fontWeight: 800,
    padding: "3px 10px",
    borderRadius: 999,
  },
  statusPending: {
    background: "var(--warning-light)",
    color: "var(--warning)",
  },
  statusFulfilled: {
    background: "var(--success-light)",
    color: "var(--success)",
  },
  statusCancelled: {
    background: "var(--danger-light)",
    color: "var(--danger)",
  },
  cardMeta: { fontSize: 12, color: "var(--text-secondary)", marginBottom: 2 },
  cardItems: {
    fontSize: 12,
    fontWeight: 600,
    color: "var(--text-muted)",
    marginBottom: 10,
  },
  cardActions: { display: "flex", gap: 8 },
  fulfillBtn: {
    flex: 1,
    padding: "9px 0",
    borderRadius: 10,
    border: "none",
    background: "var(--primary)",
    color: "white",
    fontWeight: 700,
    fontSize: 12,
  },
  cancelOrderBtn: {
    padding: "9px 14px",
    borderRadius: 10,
    border: "1.5px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text-secondary)",
    fontWeight: 700,
    fontSize: 12,
  },
};

export default OrdersScreen;
