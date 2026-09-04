import React, { useState } from "react";
import { useCart } from "../context/CartContext.jsx";
import { salesService } from "../services/salesService";
import { creditService } from "../services/creditService";
import { useLanguage } from "../context/LanguageContext.jsx";

const formatTZS = (amount) => {
  const v = typeof amount === "number" && !isNaN(amount) ? amount : 0;
  return "TZS " + Math.round(v).toLocaleString("en-US");
};

const CartModal = ({ visible, onClose, onCompleted }) => {
  const { items, updateQuantity, removeFromCart, clearCart, totalAmount } =
    useCart();
  const { t } = useLanguage();
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState("");
  const [paymentMode, setPaymentMode] = useState("cash"); // 'cash' | 'credit'
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  if (!visible) return null;

  const handleComplete = async () => {
    setError("");
    setCompleting(true);

    const result =
      paymentMode === "credit"
        ? await creditService.completeCreditSale({
            cartItems: items,
            customerName,
            customerPhone,
          })
        : await salesService.completeCartSale(items);

    setCompleting(false);

    if (!result.success) {
      setError(result.error);
      return;
    }
    clearCart();
    setCustomerName("");
    setCustomerPhone("");
    setPaymentMode("cash");
    onCompleted();
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>{t("yourCartTitle")}</h2>
          <button style={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        {items.length === 0 ? (
          <div style={styles.empty}>{t("cartEmpty")}</div>
        ) : (
          <div style={styles.itemList}>
            {items.map((item) => (
              <div key={item.productId} style={styles.item}>
                <div style={{ flex: 1 }}>
                  <div style={styles.itemName}>{item.productName}</div>
                  <div style={styles.itemPrice}>
                    {formatTZS(item.sellingPrice)} / {item.unit}
                  </div>
                </div>
                <div style={styles.qtyControls}>
                  <button
                    style={styles.qtyBtn}
                    onClick={() =>
                      updateQuantity(item.productId, item.quantity - 1)
                    }
                  >
                    −
                  </button>
                  <span style={styles.qtyValue}>{item.quantity}</span>
                  <button
                    style={styles.qtyBtn}
                    onClick={() =>
                      updateQuantity(item.productId, item.quantity + 1)
                    }
                  >
                    +
                  </button>
                </div>
                <div style={styles.itemTotal}>
                  {formatTZS(item.sellingPrice * item.quantity)}
                </div>
                <button
                  style={styles.removeBtn}
                  onClick={() => removeFromCart(item.productId)}
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        )}

        {items.length > 0 && (
          <>
            <div style={styles.modeRow}>
              <button
                style={{
                  ...styles.modeBtn,
                  ...(paymentMode === "cash" ? styles.modeBtnActive : {}),
                }}
                onClick={() => setPaymentMode("cash")}
              >
                {t("cashSaleLabel")}
              </button>
              <button
                style={{
                  ...styles.modeBtn,
                  ...(paymentMode === "credit"
                    ? styles.modeBtnActiveCredit
                    : {}),
                }}
                onClick={() => setPaymentMode("credit")}
              >
                {t("creditSaleLabel")}
              </button>
            </div>

            {paymentMode === "credit" && (
              <div style={styles.customerFields}>
                <input
                  style={styles.customerInput}
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder={t("customerNamePlaceholder")}
                />
                <input
                  style={styles.customerInput}
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder={t("customerPhonePlaceholder")}
                />
              </div>
            )}

            <div style={styles.totalRow}>
              <span style={{ fontWeight: 700, color: "var(--text-secondary)" }}>
                {t("tableTotal")}
              </span>
              <span
                style={{
                  fontWeight: 800,
                  fontSize: 20,
                  color: "var(--primary-dark)",
                }}
              >
                {formatTZS(totalAmount)}
              </span>
            </div>
            <button
              style={{
                ...styles.completeBtn,
                ...(paymentMode === "credit" ? styles.completeBtnCredit : {}),
              }}
              disabled={completing}
              onClick={handleComplete}
            >
              {completing
                ? t("completing")
                : paymentMode === "credit"
                  ? t("completeCreditSaleButton")
                  : t("completeSaleButton")}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(41,37,34,0.4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
  },
  modal: {
    width: 460,
    maxHeight: "80vh",
    background: "var(--surface)",
    borderRadius: 20,
    padding: 24,
    display: "flex",
    flexDirection: "column",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: { fontSize: 18, fontWeight: 800 },
  closeBtn: {
    background: "none",
    border: "none",
    fontSize: 16,
    color: "var(--text-secondary)",
  },
  error: {
    background: "var(--danger-light)",
    color: "var(--danger)",
    fontSize: 13,
    fontWeight: 600,
    padding: "10px 14px",
    borderRadius: 12,
    marginBottom: 14,
  },
  empty: {
    padding: "32px 0",
    textAlign: "center",
    color: "var(--text-muted)",
    fontSize: 14,
  },
  itemList: { overflow: "auto", marginBottom: 16 },
  item: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 0",
    borderBottom: "1px solid var(--border-muted)",
  },
  itemName: { fontSize: 14, fontWeight: 700 },
  itemPrice: { fontSize: 12, color: "var(--text-muted)", marginTop: 2 },
  qtyControls: { display: "flex", alignItems: "center", gap: 8 },
  qtyBtn: {
    width: 26,
    height: 26,
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--bg)",
    fontSize: 14,
    fontWeight: 700,
  },
  qtyValue: {
    fontSize: 14,
    fontWeight: 700,
    minWidth: 20,
    textAlign: "center",
  },
  itemTotal: {
    fontSize: 13,
    fontWeight: 700,
    minWidth: 80,
    textAlign: "right",
  },
  removeBtn: { background: "none", border: "none", fontSize: 13 },
  totalRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px 0",
    borderTop: "1px solid var(--border-muted)",
    marginBottom: 14,
  },
  modeRow: { display: "flex", gap: 8, marginTop: 4, marginBottom: 12 },
  modeBtn: {
    flex: 1,
    padding: "10px 0",
    borderRadius: 12,
    border: "1.5px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text-secondary)",
    fontWeight: 700,
    fontSize: 13,
  },
  modeBtnActive: {
    background: "var(--primary-light)",
    borderColor: "var(--primary)",
    color: "var(--primary-dark)",
  },
  modeBtnActiveCredit: {
    background: "var(--accent-light)",
    borderColor: "var(--accent)",
    color: "#8A5A1E",
  },
  customerFields: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    marginBottom: 14,
  },
  customerInput: {
    width: "100%",
    padding: "11px 13px",
    border: "1.5px solid var(--border)",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 600,
    background: "var(--bg)",
    color: "var(--text-primary)",
  },
  completeBtn: {
    padding: 15,
    borderRadius: 14,
    border: "none",
    background: "var(--primary)",
    color: "white",
    fontWeight: 800,
    fontSize: 15,
  },
  completeBtnCredit: { background: "#8A5A1E" },
};

export default CartModal;
