import React from "react";
import { useCart } from "../context/CartContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";

const formatTZS = (amount) => {
  const v = typeof amount === "number" && !isNaN(amount) ? amount : 0;
  return "TZS " + Math.round(v).toLocaleString("en-US");
};

const CartBar = ({ onOpenCart }) => {
  const { totalItems, totalAmount } = useCart();
  const { t } = useLanguage();

  if (totalItems === 0) return null;

  return (
    <div style={styles.bar} onClick={onOpenCart}>
      <div style={styles.left}>
        <div style={styles.badge}>{totalItems}</div>
        <span style={styles.label}>{t("itemsInCart")}</span>
      </div>
      <div style={styles.right}>
        <span style={styles.total}>{formatTZS(totalAmount)}</span>
        <span style={styles.cta}>{t("viewCart")}</span>
      </div>
    </div>
  );
};

const styles = {
  bar: {
    position: "fixed",
    left: 240,
    right: 24,
    bottom: 24,
    zIndex: 30,
    background: "var(--primary-dark)",
    borderRadius: 16,
    padding: "14px 20px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    boxShadow: "0 8px 24px rgba(41,37,34,0.18)",
    cursor: "pointer",
  },
  left: { display: "flex", alignItems: "center", gap: 12 },
  badge: {
    width: 26,
    height: 26,
    borderRadius: 999,
    background: "rgba(255,255,255,0.2)",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    fontWeight: 800,
  },
  label: { color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: 600 },
  right: { display: "flex", alignItems: "center", gap: 16 },
  total: { color: "white", fontSize: 16, fontWeight: 800 },
  cta: { color: "white", fontSize: 13, fontWeight: 700 },
};

export default CartBar;
