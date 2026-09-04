import React from "react";
import { useLanguage } from "../context/LanguageContext.jsx";

const formatTZS = (amount) => {
  const v = typeof amount === "number" && !isNaN(amount) ? amount : 0;
  return "TZS " + Math.round(v).toLocaleString("en-US");
};

const ProductCard = ({
  product,
  onEdit,
  onDelete,
  onQuickSell,
  onAddToCart,
  onAddStock,
  onAddToRestockCart,
  lowStockThreshold = 10,
}) => {
  const { t } = useLanguage();
  const stock = product.stock || 0;
  const isOut = stock === 0;
  const isLow = !isOut && stock <= lowStockThreshold;
  const statusColor = isOut
    ? "var(--danger)"
    : isLow
      ? "var(--warning)"
      : "var(--success)";
  const profitPerUnit =
    (product.sellingPrice || 0) - (product.buyingPrice || 0);

  return (
    <div style={styles.card}>
      <div style={styles.headerRow}>
        <div style={{ flex: 1, paddingRight: 8 }}>
          <div style={styles.nameRow}>
            <span style={{ ...styles.statusDot, background: statusColor }} />
            <span style={styles.name}>{product.name}</span>
          </div>
          {product.category && (
            <div style={styles.category}>{product.category}</div>
          )}
        </div>
        <div style={styles.headerActions}>
          <button style={styles.ghostIconBtn} onClick={() => onEdit(product)}>
            ✏️
          </button>
          <button
            style={styles.ghostIconBtn}
            onClick={() => onDelete(product.id)}
          >
            🗑️
          </button>
        </div>
      </div>

      <div style={styles.infoRow}>
        <span style={styles.profitLabel}>
          {t("profitPerUnit")}{" "}
          <strong
            style={{
              color:
                profitPerUnit >= 0 ? "var(--primary-dark)" : "var(--danger)",
            }}
          >
            {formatTZS(Math.abs(profitPerUnit))}
          </strong>
        </span>
        <span style={{ ...styles.stockText, color: statusColor }}>
          {stock} {product.unit}
        </span>
      </div>

      <div style={styles.actionRow}>
        <button
          style={styles.iconBtn}
          onClick={() => onAddStock(product)}
          title={t("addStockButton")}
        >
          📦
        </button>
        <button
          style={styles.iconBtn}
          onClick={() => onAddToRestockCart(product)}
          title={t("itemsInRestockCart")}
        >
          📦+
        </button>
        <button
          style={{ ...styles.iconBtn, opacity: isOut ? 0.4 : 1 }}
          disabled={isOut}
          onClick={() => onAddToCart(product)}
          title={t("addToCartTooltip")}
        >
          🛒
        </button>
        <button
          style={{ ...styles.sellBtn, opacity: isOut ? 0.4 : 1 }}
          disabled={isOut}
          onClick={() => onQuickSell(product)}
        >
          {t("sellButton")}
        </button>
      </div>
    </div>
  );
};

const styles = {
  card: {
    background: "var(--surface)",
    borderRadius: 16,
    padding: 16,
    border: "1px solid var(--border-muted)",
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  nameRow: { display: "flex", alignItems: "center", gap: 7 },
  statusDot: { width: 6, height: 6, borderRadius: 999, flexShrink: 0 },
  name: { fontSize: 14, fontWeight: 700 },
  category: {
    fontSize: 11,
    color: "var(--text-muted)",
    marginTop: 2,
    marginLeft: 13,
  },
  headerActions: { display: "flex", gap: 4 },
  ghostIconBtn: {
    background: "none",
    border: "none",
    fontSize: 12,
    padding: 3,
    opacity: 0.6,
  },
  infoRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  profitLabel: { fontSize: 12, color: "var(--text-muted)" },
  stockText: { fontSize: 12, fontWeight: 700 },
  actionRow: { display: "flex", gap: 6 },
  iconBtn: {
    width: 34,
    borderRadius: 10,
    border: "1px solid var(--border-muted)",
    background: "var(--bg)",
    fontSize: 13,
    padding: "7px 0",
  },
  sellBtn: {
    flex: 1,
    borderRadius: 10,
    border: "none",
    padding: "8px 0",
    background: "var(--primary)",
    color: "white",
    fontWeight: 700,
    fontSize: 13,
  },
};

export default ProductCard;
