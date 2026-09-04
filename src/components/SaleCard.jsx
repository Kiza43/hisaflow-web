import React from "react";
import { useLanguage } from "../context/LanguageContext.jsx";

const formatTZS = (amount) => {
  const v = typeof amount === "number" && !isNaN(amount) ? amount : 0;
  return "TZS " + Math.round(v).toLocaleString("en-US");
};

const formatDate = (iso) => {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("sw-TZ", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const SaleCard = ({ sale }) => {
  const { t } = useLanguage();
  const profit = sale.profit || 0;
  const isProfit = profit >= 0;

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <div style={{ flex: 1, paddingRight: 12 }}>
          <div style={styles.productName}>{sale.productName}</div>
        </div>
        <div style={styles.date}>{formatDate(sale.date)}</div>
      </div>

      <div style={styles.details}>
        <div style={styles.row}>
          <span style={styles.rowLabel}>{t("tableQuantity")}</span>
          <span style={styles.rowValue}>{sale.quantity}</span>
        </div>
        <div style={styles.row}>
          <span style={styles.rowLabel}>{t("sellingPriceLabel")}</span>
          <span style={styles.rowValue}>{formatTZS(sale.sellingPrice)}</span>
        </div>
      </div>

      <div style={styles.divider}>
        <div style={styles.row}>
          <span style={styles.rowLabel}>{t("tableTotal")}</span>
          <span style={styles.totalValue}>{formatTZS(sale.totalRevenue)}</span>
        </div>
        <div style={styles.row}>
          <span style={styles.rowLabel}>
            {isProfit ? t("profitLabel") : t("lossLabel")}
          </span>
          <span
            style={{
              ...styles.totalValue,
              color: isProfit ? "var(--success)" : "var(--danger)",
            }}
          >
            {formatTZS(Math.abs(profit))}
          </span>
        </div>
      </div>
    </div>
  );
};

const styles = {
  card: {
    background: "var(--surface)",
    borderRadius: 18,
    padding: 20,
    border: "1px solid var(--border-muted)",
    marginBottom: 12,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  productName: { fontSize: 15, fontWeight: 700 },
  date: { fontSize: 12, color: "var(--text-muted)" },
  details: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    marginBottom: 12,
  },
  row: { display: "flex", justifyContent: "space-between" },
  rowLabel: { fontSize: 13, color: "var(--text-secondary)" },
  rowValue: { fontSize: 13, fontWeight: 600 },
  divider: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    paddingTop: 12,
    borderTop: "1px solid var(--border-muted)",
  },
  totalValue: { fontSize: 14, fontWeight: 800 },
};

export default SaleCard;
