import React, { useState, useEffect } from "react";
import { useRestockCart } from "../context/RestockCartContext.jsx";
import { restockService } from "../services/restockService";
import { supplierService } from "../services/supplierService";
import { dataService } from "../services/dataService";
import SupplierPicker from "./SupplierPicker.jsx";
import RestockCartItemRow from "./RestockCartItemRow.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";

const PAYMENT_METHODS = [
  { value: "cash", labelKey: "cashMethodOption" },
  { value: "bank_transfer", labelKey: "bankTransferMethodOption" },
  { value: "lipa_namba", labelKey: "lipaNambaMethodOption" },
];

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
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (visible) dataService.getSuppliers().then(setSuppliers);
  }, [visible]);

  if (!visible) return null;

  const handleComplete = async () => {
    setError("");
    setCompleting(true);
    try {
      const selectedSupplier = suppliers.find((s) => s.id === supplierId);
      const result = await restockService.completeRestockCart(items, {
        supplierId: supplierId || null,
        supplierName: selectedSupplier?.name || "",
        paymentMethod: paymentStatus === "paid" ? paymentMethod : "",
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      if (supplierId && paymentStatus === "credit") {
        await supplierService.recordSupply(supplierId, totalCost);
      }

      clearRestockCart();
      setSupplierId("");
      setPaymentStatus("paid");
      setPaymentMethod("cash");
      onCompleted();
    } catch (err) {
      console.error("Restock completion error:", err);
      setError(t("unexpectedErrorTryAgain"));
    } finally {
      setCompleting(false);
    }
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
              <RestockCartItemRow
                key={item.productId}
                item={item}
                onUpdateQuantity={updateQuantity}
                onUpdateBuyingPrice={updateBuyingPrice}
                onRemove={removeFromRestockCart}
              />
            ))}
          </div>
        )}

        {items.length > 0 && (
          <div style={{ marginBottom: 4 }}>
            <label style={styles.fieldLabel}>
              {t("supplierOptionalLabel")}
            </label>
            <SupplierPicker
              suppliers={suppliers}
              selectedSupplierId={supplierId || null}
              onSelect={(id) => setSupplierId(id || "")}
              onSupplierAdded={(newSupplier) => {
                setSuppliers((prev) => [...prev, newSupplier]);
                setSupplierId(newSupplier.id);
              }}
            />

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

            {supplierId && paymentStatus === "paid" && (
              <div style={styles.methodRow}>
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m.value}
                    style={{
                      ...styles.methodChip,
                      ...(paymentMethod === m.value
                        ? styles.methodChipActive
                        : {}),
                    }}
                    onClick={() => setPaymentMethod(m.value)}
                  >
                    {t(m.labelKey)}
                  </button>
                ))}
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
  methodRow: { display: "flex", gap: 6, marginTop: 8 },
  methodChip: {
    flex: 1,
    padding: "8px 0",
    borderRadius: 10,
    borderWidth: "1.5px",
    borderStyle: "solid",
    borderColor: "var(--border)",
    background: "var(--surface)",
    color: "var(--text-secondary)",
    fontWeight: 600,
    fontSize: 11,
  },
  methodChipActive: {
    background: "var(--primary-light)",
    borderColor: "var(--primary)",
    color: "var(--primary-dark)",
  },
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
