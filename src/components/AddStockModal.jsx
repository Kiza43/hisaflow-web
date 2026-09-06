import React, { useState, useEffect } from "react";
import { dataService } from "../services/dataService";
import { supplierService } from "../services/supplierService";
import SupplierPicker from "./SupplierPicker.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";

// Cash, bank transfer, or Lipa Namba (Tanzanian mobile money merchant
// payment) — exactly the three ways shop owners actually pay suppliers,
// per direct customer feedback.
const PAYMENT_METHODS = [
  { value: "cash", labelKey: "cashMethodOption" },
  { value: "bank_transfer", labelKey: "bankTransferMethodOption" },
  { value: "lipa_namba", labelKey: "lipaNambaMethodOption" },
];

const AddStockModal = ({ visible, product, onSave, onClose }) => {
  const { t } = useLanguage();
  const [quantity, setQuantity] = useState("");
  const [buyingPrice, setBuyingPrice] = useState("");
  const [suppliers, setSuppliers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [supplierId, setSupplierId] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState("paid");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [error, setError] = useState("");

  useEffect(() => {
    if (visible) dataService.getSuppliers().then(setSuppliers);
  }, [visible]);

  useEffect(() => {
    if (visible && product) {
      setQuantity("");
      setBuyingPrice(String(Math.round(product.buyingPrice || 0)));
      setSupplierId(null);
      setPaymentStatus("paid");
      setPaymentMethod("cash");
      setError("");
      setSaving(false);
    }
  }, [visible, product]);

  if (!visible || !product) return null;

  const handleSave = async () => {
    const qty = parseFloat(quantity) || 0;
    const price = parseFloat(buyingPrice) || 0;
    if (qty <= 0) {
      setError(t("enterValidQuantityError"));
      return;
    }
    setSaving(true);
    try {
      const selectedSupplier = suppliers.find((s) => s.id === supplierId);
      const result = await onSave({
        productId: product.id,
        quantity: qty,
        buyingPrice: price,
        supplierId: supplierId || null,
        supplierName: selectedSupplier?.name || "",
        paymentMethod: paymentStatus === "paid" ? paymentMethod : "",
      });
      if (result && result.success === false) {
        setError(result.error);
        return;
      }
      if (supplierId && paymentStatus === "credit") {
        await supplierService.recordSupply(supplierId, qty * price);
      }
    } catch (err) {
      console.error("Add stock error:", err);
      setError(t("unexpectedErrorTryAgain"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 style={styles.title}>{t("addStockTitle")}</h2>
        <div style={styles.productName}>{product.name}</div>

        {error && <div style={styles.error}>{error}</div>}

        <label style={styles.label}>{t("addStockQuantityLabel")}</label>
        <input
          style={styles.input}
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="0"
          autoFocus
        />

        <label style={styles.label}>{t("buyingPriceLabel")}</label>
        <input
          style={styles.input}
          type="number"
          value={buyingPrice}
          onChange={(e) => setBuyingPrice(e.target.value)}
          placeholder="0"
        />

        <div style={styles.hint}>{t("addStockPriceHint")}</div>

        <label style={styles.label}>{t("supplierOptionalLabel")}</label>
        <SupplierPicker
          suppliers={suppliers}
          selectedSupplierId={supplierId}
          onSelect={setSupplierId}
          onSupplierAdded={(newSupplier) => {
            setSuppliers((prev) => [...prev, newSupplier]);
            setSupplierId(newSupplier.id);
          }}
        />

        {supplierId && (
          <>
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

            {paymentStatus === "paid" && (
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
          </>
        )}

        <div style={styles.actions}>
          <button style={styles.cancelBtn} onClick={onClose}>
            {t("cancelButton")}
          </button>
          <button style={styles.saveBtn} disabled={saving} onClick={handleSave}>
            {saving ? t("completing") : t("addStockButton")}
          </button>
        </div>
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
    width: 400,
    background: "var(--surface)",
    borderRadius: 20,
    padding: 28,
  },
  title: { fontSize: 18, fontWeight: 800, marginBottom: 4 },
  productName: { fontSize: 13, color: "var(--text-muted)", marginBottom: 18 },
  error: {
    background: "var(--danger-light)",
    color: "var(--danger)",
    fontSize: 13,
    fontWeight: 600,
    padding: "10px 14px",
    borderRadius: 12,
    marginBottom: 14,
  },
  label: {
    display: "block",
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 8,
    color: "var(--text-primary)",
  },
  input: {
    width: "100%",
    padding: "11px 13px",
    border: "1.5px solid var(--border)",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 14,
    background: "var(--bg)",
    color: "var(--text-primary)",
  },
  hint: {
    fontSize: 11,
    color: "var(--text-muted)",
    marginBottom: 18,
    marginTop: -8,
  },
  paymentToggleRow: {
    display: "flex",
    gap: 8,
    marginBottom: 14,
    marginTop: -6,
  },
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
  methodRow: { display: "flex", gap: 6, marginBottom: 14, marginTop: -6 },
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
  actions: { display: "flex", gap: 10 },
  cancelBtn: {
    flex: 1,
    padding: 13,
    borderRadius: 12,
    border: "1.5px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text-secondary)",
    fontWeight: 700,
    fontSize: 14,
  },
  saveBtn: {
    flex: 1,
    padding: 13,
    borderRadius: 12,
    border: "none",
    background: "var(--accent)",
    color: "white",
    fontWeight: 800,
    fontSize: 14,
  },
};

export default AddStockModal;
