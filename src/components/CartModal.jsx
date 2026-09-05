import React, { useState, useEffect } from "react";
import { useCart } from "../context/CartContext.jsx";
import { salesService } from "../services/salesService";
import { creditService } from "../services/creditService";
import { dataService } from "../services/dataService";
import CartItemRow from "./CartItemRow.jsx";
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
  const [paymentAccounts, setPaymentAccounts] = useState([]);
  const [receivedVia, setReceivedVia] = useState("cash");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  useEffect(() => {
    if (visible)
      dataService
        .getSettings()
        .then((s) => setPaymentAccounts(s.paymentAccounts || []));
  }, [visible]);

  if (!visible) return null;

  const handleComplete = async () => {
    setError("");
    setCompleting(true);

    try {
      const selectedAccount = paymentAccounts.find((a) => a.id === receivedVia);
      const paymentMethod =
        paymentMode === "cash"
          ? selectedAccount
            ? selectedAccount.type
            : "cash"
          : "";
      const accountId =
        paymentMode === "cash" ? selectedAccount?.id || null : null;
      const accountLabel =
        paymentMode === "cash" ? selectedAccount?.label || "" : "";

      const result =
        paymentMode === "credit"
          ? await creditService.completeCreditSale({
              cartItems: items,
              customerName,
              customerPhone,
            })
          : await salesService.completeCartSale(items, {
              paymentMethod,
              accountId,
              accountLabel,
            });

      if (!result.success) {
        setError(result.error);
        return;
      }

      const saleData = {
        items: items.map((item) => ({
          productName: item.productName,
          quantity: item.quantity,
          sellingPrice: item.sellingPrice,
        })),
        total: totalAmount,
        isCredit: paymentMode === "credit",
        paymentMethod,
        accountLabel,
        customerName,
        customerPhone,
        date: new Date().toISOString(),
      };

      clearCart();
      setCustomerName("");
      setCustomerPhone("");
      setPaymentMode("cash");
      setReceivedVia("cash");
      onCompleted(saleData);
    } catch (err) {
      console.error("Cart completion error:", err);
      setError(t("unexpectedErrorTryAgain"));
    } finally {
      setCompleting(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>{t("yourCartTitle")}</h2>
          <button style={styles.closeBtn} onClick={onClose}>
            Close
          </button>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        {items.length === 0 ? (
          <div style={styles.empty}>{t("cartEmpty")}</div>
        ) : (
          <div style={styles.itemList}>
            {items.map((item) => (
              <CartItemRow
                key={item.productId}
                item={item}
                onUpdateQuantity={updateQuantity}
                onRemove={removeFromCart}
              />
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

            {paymentMode === "cash" && paymentAccounts.length > 0 && (
              <div style={styles.accountChipRow}>
                <button
                  style={{
                    ...styles.accountChip,
                    ...(receivedVia === "cash" ? styles.accountChipActive : {}),
                  }}
                  onClick={() => setReceivedVia("cash")}
                >
                  {t("cashMethodOption")}
                </button>
                {paymentAccounts.map((acc) => (
                  <button
                    key={acc.id}
                    style={{
                      ...styles.accountChip,
                      ...(receivedVia === acc.id
                        ? styles.accountChipActive
                        : {}),
                    }}
                    onClick={() => setReceivedVia(acc.id)}
                  >
                    {acc.label}
                  </button>
                ))}
              </div>
            )}

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
    width: 480,
    maxHeight: "82vh",
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
    borderWidth: "1.5px",
    borderStyle: "solid",
    borderColor: "var(--border)",
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
  accountChipRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 14,
  },
  accountChip: {
    padding: "8px 14px",
    borderRadius: 999,
    borderWidth: "1.5px",
    borderStyle: "solid",
    borderColor: "var(--border)",
    background: "var(--surface)",
    color: "var(--text-secondary)",
    fontWeight: 600,
    fontSize: 12,
  },
  accountChipActive: {
    background: "var(--primary-light)",
    borderColor: "var(--primary)",
    color: "var(--primary-dark)",
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
