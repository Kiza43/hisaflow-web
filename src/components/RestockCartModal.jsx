import React, { useState, useEffect } from "react";
import { useRestockCart } from "../context/RestockCartContext.jsx";
import { restockService } from "../services/restockService";
import { supplierService } from "../services/supplierService";
import { dataService } from "../services/dataService";
import { useLanguage } from "../context/LanguageContext.jsx";

const formatTZS = (amount) => {
  const v = typeof amount === "number" && !isNaN(amount) ? amount : 0;
  return "TZS " + Math.round(v).toLocaleString("en-US");
};

const RestockCartModal = ({ visible, onClose, onCompleted }) => {
  const {
    items,
    updateQuantity,
    updateBuyingPrice,
    removeFromRestockCart,
    clearRestockCart,
    totalCost,
  } = useRestockCart();
  const { t } = useLanguage();
  const [suppliers, setSuppliers] = useState([]);
  const [supplierId, setSupplierId] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("paid");
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (visible) dataService.getSuppliers().then(setSuppliers);
  }, [visible]);

  if (!visible) return null;

  const handleComplete = async () => {
    setError("");
    setCompleting(true);
    const result = await restockService.completeRestockCart(items);

    if (!result.success) {
      setCompleting(false);
      setError(result.error);
      return;
    }

    if (supplierId && paymentStatus === "credit") {
      await supplierService.recordSupply(supplierId, totalCost);
    }

    setCompleting(false);
    clearRestockCart();
    setSupplierId("");
    setPaymentStatus("paid");
    onCompleted();
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>{t("restockCartTitle")}</h2>
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
              <div key={item.productId} style={styles.item}>
                <div style={styles.itemTop}>
                  <span style={styles.itemName}>{item.productName}</span>
                  <button
                    style={styles.removeBtn}
                    onClick={() => removeFromRestockCart(item.productId)}
                  >
                    Remove
                  </button>
                </div>
                <div style={styles.itemRow}>
                  <div style={{ flex: 1 }}>
                    <label style={styles.fieldLabel}>
                      {t("addStockQuantityLabel")}
                    </label>
                    <input
                      type="number"
                      style={styles.fieldInput}
                      value={item.quantity}
                      onChange={(e) =>
                        updateQuantity(
                          item.productId,
                          parseFloat(e.target.value) || 1,
                        )
                      }
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={styles.fieldLabel}>
                      {t("buyingPriceLabel")}
                    </label>
                    <input
                      type="number"
                      style={styles.fieldInput}
                      value={item.buyingPrice}
                      onChange={(e) =>
                        updateBuyingPrice(
                          item.productId,
                          parseFloat(e.target.value) || 0,
                        )
                      }
                    />
                  </div>
                  <div style={{ minWidth: 90, textAlign: "right" }}>
                    <label style={styles.fieldLabel}>{t("tableTotal")}</label>
                    <div style={styles.itemTotal}>
                      {formatTZS(item.quantity * item.buyingPrice)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {items.length > 0 && suppliers.length > 0 && (
          <div style={{ marginBottom: 4 }}>
            <label style={styles.fieldLabel}>
              {t("supplierOptionalLabel")}
            </label>
            <select
              style={styles.fieldInput}
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
            >
              <option value="">{t("noSupplierOption")}</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            {supplierId && (
              <div style={styles.paymentToggleRow}>
                <button
                  style={{
                    ...styles.paymentToggle,
                    ...(paymentStatus === "paid"
                      ? styles.paymentToggleActive
                      : {}),
                  }}
                  onClick={() => setPaymentStatus("paid")}
                >
                  {t("paidNowOption")}
                </button>
                <button
                  style={{
                    ...styles.paymentToggle,
                    ...(paymentStatus === "credit"
                      ? styles.paymentToggleActiveCredit
                      : {}),
                  }}
                  onClick={() => setPaymentStatus("credit")}
                >
                  {t("oweSupplierOption")}
                </button>
              </div>
            )}
          </div>
        )}

        {items.length > 0 && (
          <>
            <div style={styles.totalRow}>
              <span style={{ fontWeight: 700, color: "var(--text-secondary)" }}>
                {t("totalCostLabel")}
              </span>
              <span style={{ fontWeight: 800, fontSize: 20, color: "#8A5A1E" }}>
                {formatTZS(totalCost)}
              </span>
            </div>
            <button
              style={styles.completeBtn}
              disabled={completing}
              onClick={handleComplete}
            >
              {completing ? t("completing") : t("completeRestockButton")}
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
    width: 500,
    maxHeight: "85vh",
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
  item: { padding: "12px 0", borderBottom: "1px solid var(--border-muted)" },
  itemTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  itemName: { fontSize: 14, fontWeight: 700 },
  removeBtn: { background: "none", border: "none", fontSize: 13 },
  itemRow: { display: "flex", gap: 10, alignItems: "flex-end" },
  fieldLabel: {
    display: "block",
    fontSize: 10,
    fontWeight: 700,
    color: "var(--text-muted)",
    marginBottom: 4,
  },
  fieldInput: {
    width: "100%",
    padding: "8px 10px",
    border: "1.5px solid var(--border)",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
    background: "var(--bg)",
    marginBottom: 10,
  },
  paymentToggleRow: { display: "flex", gap: 8, marginBottom: 10 },
  paymentToggle: {
    flex: 1,
    padding: "9px 0",
    borderRadius: 10,
    borderWidth: "1.5px",
    borderStyle: "solid",
    borderColor: "var(--border)",
    background: "var(--surface)",
    color: "var(--text-secondary)",
    fontWeight: 700,
    fontSize: 12,
  },
  paymentToggleActive: {
    background: "var(--success-light)",
    borderColor: "var(--success)",
    color: "var(--success)",
  },
  paymentToggleActiveCredit: {
    background: "var(--danger-light)",
    borderColor: "var(--danger)",
    color: "var(--danger)",
  },
  itemTotal: { fontSize: 13, fontWeight: 700, padding: "8px 0" },
  totalRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px 0",
    borderTop: "1px solid var(--border-muted)",
    marginBottom: 14,
  },
  completeBtn: {
    padding: 15,
    borderRadius: 14,
    border: "none",
    background: "#8A5A1E",
    color: "white",
    fontWeight: 800,
    fontSize: 15,
  },
};

export default RestockCartModal;
