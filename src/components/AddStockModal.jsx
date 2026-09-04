import React, { useState, useEffect } from "react";
import { useLanguage } from "../context/LanguageContext.jsx";

const AddStockModal = ({ visible, product, onSave, onClose }) => {
  const { t } = useLanguage();
  const [quantity, setQuantity] = useState("");
  const [buyingPrice, setBuyingPrice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (visible && product) {
      setQuantity("");
      setBuyingPrice(String(product.buyingPrice || ""));
      setError("");
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
    const result = await onSave({
      productId: product.id,
      quantity: qty,
      buyingPrice: price,
    });
    if (result && result.success === false) {
      setError(result.error);
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

        <div style={styles.actions}>
          <button style={styles.cancelBtn} onClick={onClose}>
            {t("cancelButton")}
          </button>
          <button style={styles.saveBtn} onClick={handleSave}>
            {t("addStockButton")}
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
    marginBottom: 6,
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
