import React from "react";
import { useLanguage } from "../context/LanguageContext.jsx";

const formatTZS = (amount) => {
  const v = typeof amount === "number" && !isNaN(amount) ? amount : 0;
  return "TZS " + Math.round(v).toLocaleString("en-US");
};

const getExpiryInfo = (expiryDate) => {
  if (!expiryDate) return null;
  const days = Math.ceil(
    (new Date(expiryDate) - new Date()) / (1000 * 60 * 60 * 24),
  );
  if (days < 0)
    return {
      label: "expired",
      color: "var(--danger)",
      bg: "var(--danger-light)",
    };
  if (days <= 30)
    return {
      label: "soon",
      color: "var(--warning)",
      bg: "var(--warning-light)",
    };
  return null;
};

const ProductCard = ({
  product,
  onEdit,
  onDelete,
  onQuickSell,
  onAddToCart,
  onAddStock,
  onAddToRestockCart,
  onNotifyPastBuyers,
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
  const expiryInfo = getExpiryInfo(product.expiryDate);

  return (
    <div className="hf-card" style={styles.card}>
      <div style={styles.headerRow}>
        <div style={styles.identity}>
          {product.imageUri ? (
            <img src={product.imageUri} alt="" style={styles.thumb} />
          ) : (
            <span style={{ ...styles.statusDot, background: statusColor }} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={styles.name}>{product.name}</div>
            {product.category && (
              <div style={styles.category}>{product.category}</div>
            )}
          </div>
        </div>
        <div style={styles.headerActions}>
          {onNotifyPastBuyers && (
            <button
              style={styles.textLink}
              onClick={() => onNotifyPastBuyers(product)}
            >
              {t("sendReminderButton")}
            </button>
          )}
          <button style={styles.textLink} onClick={() => onEdit(product)}>
            {t("editButton")}
          </button>
          <button
            style={{ ...styles.textLink, color: "var(--danger)" }}
            onClick={() => onDelete(product.id)}
          >
            {t("deleteButton")}
          </button>
        </div>
      </div>

      {expiryInfo && (
        <div
          style={{
            ...styles.expiryBadge,
            background: expiryInfo.bg,
            color: expiryInfo.color,
          }}
        >
          {expiryInfo.label === "expired"
            ? t("expiredLabel")
            : t("expiringSoonLabel")}
        </div>
      )}

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
        <button style={styles.iconBtn} onClick={() => onAddStock(product)}>
          {t("addStockButton")}
        </button>
        <button
          style={styles.iconBtn}
          onClick={() => onAddToRestockCart(product)}
        >
          {t("restockShortLabel")}
        </button>
        <button
          style={{ ...styles.iconBtn, opacity: isOut ? 0.4 : 1 }}
          disabled={isOut}
          onClick={() => onAddToCart(product)}
        >
          {t("cartShortLabel")}
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
    marginBottom: 10,
  },
  identity: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  statusDot: { width: 6, height: 6, borderRadius: 999, flexShrink: 0 },
  thumb: {
    width: 30,
    height: 30,
    borderRadius: 8,
    objectFit: "cover",
    flexShrink: 0,
  },
  name: {
    fontSize: 14,
    fontWeight: 700,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  category: { fontSize: 11, color: "var(--text-muted)", marginTop: 1 },
  headerActions: { display: "flex", gap: 10 },
  textLink: {
    background: "none",
    border: "none",
    fontSize: 11,
    fontWeight: 700,
    color: "var(--text-secondary)",
  },
  expiryBadge: {
    display: "inline-block",
    fontSize: 10,
    fontWeight: 700,
    padding: "3px 9px",
    borderRadius: 999,
    marginBottom: 10,
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
    flex: 1,
    borderRadius: 10,
    border: "1px solid var(--border-muted)",
    background: "var(--bg)",
    color: "var(--text-secondary)",
    fontWeight: 700,
    fontSize: 11,
    padding: "8px 0",
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
