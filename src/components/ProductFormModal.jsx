import React, { useState, useEffect } from "react";
import { useLanguage } from "../context/LanguageContext.jsx";

const emptyForm = {
  name: "",
  category: "",
  unit: "pc",
  stock: "",
  buyingPrice: "",
  sellingPrice: "",
};

const ProductFormModal = ({ visible, editingProduct, onSave, onClose }) => {
  const { t } = useLanguage();
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");

  useEffect(() => {
    if (editingProduct) {
      setForm({
        name: editingProduct.name || "",
        category: editingProduct.category || "",
        unit: editingProduct.unit || "pc",
        stock: String(editingProduct.stock ?? ""),
        buyingPrice: String(editingProduct.buyingPrice ?? ""),
        sellingPrice: String(editingProduct.sellingPrice ?? ""),
      });
    } else {
      setForm(emptyForm);
    }
    setError("");
  }, [editingProduct, visible]);

  if (!visible) return null;

  const handleSave = () => {
    if (!form.name.trim()) {
      setError(t("enterProductNameError"));
      return;
    }
    const sellingPrice = parseFloat(form.sellingPrice) || 0;
    const buyingPrice = parseFloat(form.buyingPrice) || 0;
    if (sellingPrice <= 0) {
      setError(t("enterValidSellingPriceError"));
      return;
    }

    onSave({
      id: editingProduct
        ? editingProduct.id
        : `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: form.name.trim(),
      category: form.category.trim(),
      unit: form.unit,
      stock: parseInt(form.stock, 10) || 0,
      buyingPrice,
      sellingPrice,
    });
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 style={styles.title}>
          {editingProduct ? t("editProductTitle") : t("addProductTitle")}
        </h2>

        {error && <div style={styles.error}>{error}</div>}

        <label style={styles.label}>{t("productNameLabel")}</label>
        <input
          style={styles.input}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder={t("productNamePlaceholder")}
          autoFocus
        />

        <label style={styles.label}>{t("categoryLabel")}</label>
        <input
          style={styles.input}
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          placeholder={t("categoryPlaceholder")}
        />

        <div style={styles.row}>
          <div style={{ flex: 1 }}>
            <label style={styles.label}>{t("stockLabel")}</label>
            <input
              style={styles.input}
              type="number"
              value={form.stock}
              onChange={(e) => setForm({ ...form, stock: e.target.value })}
              placeholder="0"
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={styles.label}>{t("unitLabel")}</label>
            <input
              style={styles.input}
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              placeholder="pc"
            />
          </div>
        </div>

        <div style={styles.row}>
          <div style={{ flex: 1 }}>
            <label style={styles.label}>{t("buyingPriceLabel")}</label>
            <input
              style={styles.input}
              type="number"
              value={form.buyingPrice}
              onChange={(e) =>
                setForm({ ...form, buyingPrice: e.target.value })
              }
              placeholder="0"
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={styles.label}>{t("sellingPriceLabel")}</label>
            <input
              style={styles.input}
              type="number"
              value={form.sellingPrice}
              onChange={(e) =>
                setForm({ ...form, sellingPrice: e.target.value })
              }
              placeholder="0"
            />
          </div>
        </div>

        <div style={styles.actions}>
          <button style={styles.cancelBtn} onClick={onClose}>
            {t("cancelButton")}
          </button>
          <button style={styles.saveBtn} onClick={handleSave}>
            {t("saveButton")}
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
    width: 420,
    background: "var(--surface)",
    borderRadius: 20,
    padding: 28,
    maxHeight: "85vh",
    overflow: "auto",
  },
  title: { fontSize: 18, fontWeight: 800, marginBottom: 18 },
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
  row: { display: "flex", gap: 12 },
  actions: { display: "flex", gap: 10, marginTop: 6 },
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
    background: "var(--primary)",
    color: "white",
    fontWeight: 800,
    fontSize: 14,
  },
};

export default ProductFormModal;
