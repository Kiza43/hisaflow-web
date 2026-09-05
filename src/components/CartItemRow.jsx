import React, { useState, useEffect } from "react";
import { useLanguage } from "../context/LanguageContext.jsx";

const formatTZS = (amount) => {
  const v = typeof amount === "number" && !isNaN(amount) ? amount : 0;
  return "TZS " + Math.round(v).toLocaleString("en-US");
};

// Typing a quantity directly needs its own local state, not a value
// bound straight to the cart's quantity — a controlled number input tied
// directly to a value that gets clamped on every keystroke fights the
// user the moment they try to clear the field to type a new number. This
// commits on blur/Enter instead (same pattern Amazon's own cart quantity
// field uses), while the +/- buttons still update immediately and this
// row stays in sync with them via the effect below.
const CartItemRow = ({ item, onUpdateQuantity, onRemove }) => {
  const { t } = useLanguage();
  const [qtyInput, setQtyInput] = useState(String(item.quantity));

  useEffect(() => {
    setQtyInput(String(item.quantity));
  }, [item.quantity]);

  const commitQuantity = () => {
    const parsed = parseInt(qtyInput, 10);
    if (!qtyInput || isNaN(parsed)) {
      setQtyInput(String(item.quantity)); // nothing usable typed — revert rather than guess
      return;
    }
    onUpdateQuantity(item.productId, parsed);
  };

  return (
    <div style={styles.item}>
      <div style={styles.itemTopRow}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={styles.itemName}>{item.productName}</div>
          <div style={styles.itemPrice}>
            {formatTZS(item.sellingPrice)} / {item.unit}
          </div>
        </div>
        <div style={styles.itemTotal}>
          {formatTZS(item.sellingPrice * item.quantity)}
        </div>
      </div>
      <div style={styles.itemBottomRow}>
        <div style={styles.qtyControls}>
          <span style={styles.qtyLabel}>{t("tableQuantity")}</span>
          <button
            style={styles.qtyBtn}
            onClick={() => onUpdateQuantity(item.productId, item.quantity - 1)}
          >
            −
          </button>
          <input
            style={styles.qtyInput}
            type="number"
            value={qtyInput}
            onChange={(e) => setQtyInput(e.target.value)}
            onBlur={commitQuantity}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.target.blur();
            }}
          />
          <button
            style={styles.qtyBtn}
            onClick={() => onUpdateQuantity(item.productId, item.quantity + 1)}
          >
            +
          </button>
        </div>
        <button
          style={styles.removeBtn}
          onClick={() => onRemove(item.productId)}
        >
          {t("deleteButton")}
        </button>
      </div>
    </div>
  );
};

const styles = {
  item: { padding: "12px 0", borderBottom: "1px solid var(--border-muted)" },
  itemTopRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  itemName: { fontSize: 14, fontWeight: 700 },
  itemPrice: { fontSize: 12, color: "var(--text-muted)", marginTop: 2 },
  itemBottomRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  qtyControls: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "var(--bg)",
    borderRadius: 12,
    padding: "6px 10px",
  },
  qtyLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "var(--text-muted)",
    marginRight: 2,
  },
  qtyBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: "1.5px",
    borderStyle: "solid",
    borderColor: "var(--border)",
    background: "var(--surface)",
    fontSize: 16,
    fontWeight: 700,
    color: "var(--text-primary)",
  },
  qtyInput: {
    width: 52,
    height: 30,
    borderRadius: 8,
    border: "none",
    background: "transparent",
    fontSize: 15,
    fontWeight: 800,
    textAlign: "center",
    color: "var(--text-primary)",
  },
  itemTotal: { fontSize: 14, fontWeight: 800, whiteSpace: "nowrap" },
  removeBtn: {
    background: "none",
    border: "none",
    fontSize: 12,
    fontWeight: 700,
    color: "var(--danger)",
    padding: "6px 10px",
  },
};

export default CartItemRow;
