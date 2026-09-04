import React, { useState, useMemo, useEffect } from "react";
import { useLanguage } from "../context/LanguageContext.jsx";

const formatTZS = (amount) => {
  const v = typeof amount === "number" && !isNaN(amount) ? amount : 0;
  return "TZS " + Math.round(v).toLocaleString("en-US");
};

const SaleFormModal = ({
  visible,
  products,
  preSelectedProductId,
  onSave,
  onClose,
}) => {
  const { t } = useLanguage();
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [sellingPrice, setSellingPrice] = useState("");
  const [error, setError] = useState("");

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === productId) || null,
    [productId, products],
  );

  const handleSelectProduct = (id) => {
    setProductId(id);
    const p = products.find((prod) => prod.id === id);
    setSellingPrice(p ? String(p.sellingPrice) : "");
    setError("");
  };

  useEffect(() => {
    if (visible && preSelectedProductId) {
      handleSelectProduct(preSelectedProductId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, preSelectedProductId]);

  if (!visible) return null;

  const qtyNum = parseFloat(quantity) || 0;
  const priceNum = parseFloat(sellingPrice) || 0;
  const total = qtyNum * priceNum;

  const handleSubmit = async () => {
    if (!selectedProduct) {
      setError(t("chooseProductError"));
      return;
    }
    if (qtyNum <= 0) {
      setError(t("enterValidQuantityError"));
      return;
    }
    if (qtyNum > (selectedProduct.stock || 0)) {
      setError(
        t("notEnoughStockError", {
          stock: selectedProduct.stock,
          unit: selectedProduct.unit,
        }),
      );
      return;
    }
    const result = await onSave({
      productId,
      quantity: qtyNum,
      sellingPrice: priceNum,
    });
    // onSave may not return anything (SalesScreen handles its own error
    // display) or may return { success, error } (quick-sell from a
    // product card) — only act on it when it's actually there.
    if (result && result.success === false) {
      setError(result.error || t("saleFailedError"));
    }
  };

  const handleClose = () => {
    setProductId("");
    setQuantity("1");
    setSellingPrice("");
    setError("");
    onClose();
  };

  return (
    <div style={styles.overlay} onClick={handleClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 style={styles.title}>{t("sellProductTitle")}</h2>

        {error && <div style={styles.error}>{error}</div>}

        <label style={styles.label}>{t("tableProduct")}</label>
        <select
          style={styles.input}
          value={productId}
          onChange={(e) => handleSelectProduct(e.target.value)}
        >
          <option value="">{t("chooseProductPlaceholder")}</option>
          {products
            .filter((p) => (p.stock || 0) > 0)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.stock} {p.unit} {t("remainingSuffix")})
              </option>
            ))}
        </select>

        <div style={styles.row}>
          <div style={{ flex: 1 }}>
            <label style={styles.label}>{t("tableQuantity")}</label>
            <input
              style={styles.input}
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={styles.label}>{t("sellingPriceLabel")}</label>
            <input
              style={styles.input}
              type="number"
              value={sellingPrice}
              onChange={(e) => setSellingPrice(e.target.value)}
            />
          </div>
        </div>

        {selectedProduct && (
          <div style={styles.totalBox}>
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--text-secondary)",
              }}
            >
              {t("tableTotal")}
            </span>
            <span
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: "var(--primary-dark)",
              }}
            >
              {formatTZS(total)}
            </span>
          </div>
        )}

        <div style={styles.actions}>
          <button style={styles.cancelBtn} onClick={handleClose}>
            {t("cancelButton")}
          </button>
          <button style={styles.saveBtn} onClick={handleSubmit}>
            {t("completeSaleButton")}
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
  totalBox: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "var(--primary-light)",
    borderRadius: 14,
    padding: "14px 16px",
    marginBottom: 18,
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
    background: "var(--primary)",
    color: "white",
    fontWeight: 800,
    fontSize: 14,
  },
};

export default SaleFormModal;
