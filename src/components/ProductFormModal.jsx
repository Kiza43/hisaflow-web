import React, { useState, useEffect, useRef } from "react";
import { dataService } from "../services/dataService";
import { useLanguage } from "../context/LanguageContext.jsx";

const emptyForm = {
  name: "",
  category: "",
  unit: "pc",
  stock: "",
  buyingPrice: "",
  sellingPrice: "",
  imageUri: null,
  expiryDate: "",
  supplierId: "",
  supplierPaymentStatus: "paid",
};

const ProductFormModal = ({ visible, editingProduct, onSave, onClose }) => {
  const { t } = useLanguage();
  const [form, setForm] = useState(emptyForm);
  const [suppliers, setSuppliers] = useState([]);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (visible) dataService.getSuppliers().then(setSuppliers);
  }, [visible]);

  useEffect(() => {
    if (editingProduct) {
      setForm({
        name: editingProduct.name || "",
        category: editingProduct.category || "",
        unit: editingProduct.unit || "pc",
        stock: String(editingProduct.stock ?? ""),
        buyingPrice: String(editingProduct.buyingPrice ?? ""),
        sellingPrice: String(editingProduct.sellingPrice ?? ""),
        imageUri: editingProduct.imageUri || null,
        expiryDate: editingProduct.expiryDate
          ? editingProduct.expiryDate.slice(0, 10)
          : "",
        supplierId: "",
        supplierPaymentStatus: "paid",
      });
    } else {
      setForm(emptyForm);
    }
    setError("");
  }, [editingProduct, visible]);

  if (!visible) return null;

  const handlePickImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () =>
      setForm((prev) => ({ ...prev, imageUri: reader.result }));
    reader.readAsDataURL(file);
  };

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
    const stock = parseInt(form.stock, 10) || 0;

    onSave({
      product: {
        id: editingProduct
          ? editingProduct.id
          : `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: form.name.trim(),
        category: form.category.trim(),
        unit: form.unit,
        stock,
        buyingPrice,
        sellingPrice,
        imageUri: form.imageUri || null,
        expiryDate: form.expiryDate || null,
      },
      // Only meaningful for genuinely new stock entering the shop — editing
      // an existing product's price shouldn't retroactively create a new
      // supplier debt for stock that's already been there.
      supplierLink:
        !editingProduct && form.supplierId && stock > 0
          ? {
              supplierId: form.supplierId,
              amount: stock * buyingPrice,
              isCredit: form.supplierPaymentStatus === "credit",
            }
          : null,
    });
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 style={styles.title}>
          {editingProduct ? t("editProductTitle") : t("addProductTitle")}
        </h2>

        {error && <div style={styles.error}>{error}</div>}

        <div style={styles.photoRow}>
          <div
            style={styles.photoPreview}
            onClick={() => fileInputRef.current.click()}
          >
            {form.imageUri && (
              <img src={form.imageUri} alt="" style={styles.photoImg} />
            )}
          </div>
          <div>
            <button
              style={styles.photoBtn}
              onClick={() => fileInputRef.current.click()}
            >
              {form.imageUri ? t("changePhoto") : t("addPhoto")}
            </button>
            {form.imageUri && (
              <button
                style={styles.removePhotoBtn}
                onClick={() => setForm((prev) => ({ ...prev, imageUri: null }))}
              >
                {t("removePhoto")}
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePickImage}
            style={{ display: "none" }}
          />
        </div>

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
              style={{
                ...styles.input,
                ...(editingProduct ? styles.inputDisabled : {}),
              }}
              type="number"
              value={form.stock}
              onChange={(e) => setForm({ ...form, stock: e.target.value })}
              placeholder="0"
              disabled={!!editingProduct}
            />
            {editingProduct && (
              <div style={styles.stockLockedHint}>{t("stockLockedHint")}</div>
            )}
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

        <label style={styles.label}>{t("expiryDateLabel")}</label>
        <input
          style={styles.input}
          type="date"
          value={form.expiryDate}
          onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
        />

        {!editingProduct && suppliers.length > 0 && (
          <>
            <label style={styles.label}>{t("supplierOptionalLabel")}</label>
            <select
              style={styles.input}
              value={form.supplierId}
              onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
            >
              <option value="">{t("noSupplierOption")}</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            {form.supplierId && (
              <div style={styles.paymentToggleRow}>
                <button
                  style={{
                    ...styles.paymentToggle,
                    ...(form.supplierPaymentStatus === "paid"
                      ? styles.paymentToggleActive
                      : {}),
                  }}
                  onClick={() =>
                    setForm({ ...form, supplierPaymentStatus: "paid" })
                  }
                >
                  {t("paidNowOption")}
                </button>
                <button
                  style={{
                    ...styles.paymentToggle,
                    ...(form.supplierPaymentStatus === "credit"
                      ? styles.paymentToggleActiveCredit
                      : {}),
                  }}
                  onClick={() =>
                    setForm({ ...form, supplierPaymentStatus: "credit" })
                  }
                >
                  {t("oweSupplierOption")}
                </button>
              </div>
            )}
          </>
        )}

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
  photoRow: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    marginBottom: 18,
  },
  photoPreview: {
    width: 56,
    height: 56,
    borderRadius: 14,
    background: "var(--bg)",
    border: "1.5px dashed var(--border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    overflow: "hidden",
    flexShrink: 0,
  },
  photoImg: { width: "100%", height: "100%", objectFit: "cover" },
  photoBtn: {
    display: "block",
    padding: "7px 12px",
    borderRadius: 10,
    border: "1.5px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text-secondary)",
    fontWeight: 700,
    fontSize: 12,
    marginBottom: 6,
  },
  removePhotoBtn: {
    display: "block",
    padding: "5px 12px",
    border: "none",
    background: "none",
    color: "var(--danger)",
    fontWeight: 700,
    fontSize: 11,
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
  inputDisabled: {
    background: "var(--border-muted)",
    color: "var(--text-muted)",
    cursor: "not-allowed",
  },
  stockLockedHint: {
    fontSize: 10,
    color: "var(--text-muted)",
    marginTop: -10,
    marginBottom: 10,
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
