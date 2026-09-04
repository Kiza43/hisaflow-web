import React, { useState, useEffect } from "react";
import { dataService } from "../services/dataService";
import { syncService } from "../services/syncService";
import { useLanguage } from "../context/LanguageContext.jsx";

const formatTZS = (amount) => {
  const v = typeof amount === "number" && !isNaN(amount) ? amount : 0;
  return "TZS " + Math.round(v).toLocaleString("en-US");
};

const DashboardScreen = () => {
  const { t } = useLanguage();
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [expenditures, setExpenditures] = useState([]);
  const [syncStatus, setSyncStatus] = useState(syncService.getStatus());

  useEffect(() => {
    dataService.getProducts().then(setProducts);
    dataService.getSales().then(setSales);
    dataService.getExpenditures().then(setExpenditures);

    const unsubscribe = syncService.onStatusChange(setSyncStatus);
    return unsubscribe;
  }, []);

  const totalRevenue = sales.reduce((sum, s) => sum + (s.totalRevenue || 0), 0);
  const grossProfit = sales.reduce((sum, s) => sum + (s.profit || 0), 0);
  const totalExpenses = expenditures.reduce(
    (sum, exp) => sum + (exp.amount || 0),
    0,
  );
  const netProfit = grossProfit - totalExpenses;

  return (
    <div style={styles.wrap}>
      <div style={styles.headerRow}>
        <h1 style={styles.title}>{t("navDashboard")}</h1>
        <div style={styles.syncNote}>
          {syncStatus.status === "offline"
            ? t("notYetSynced")
            : syncStatus.status}
        </div>
      </div>

      {products.length === 0 && sales.length === 0 && (
        <div style={styles.emptyNote}>{t("noDataYet")}</div>
      )}

      <div style={styles.statGrid}>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>{t("statProducts")}</div>
          <div style={styles.statValue}>{products.length}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>{t("statSales")}</div>
          <div style={styles.statValue}>{sales.length}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>{t("statRevenue")}</div>
          <div style={{ ...styles.statValue, color: "var(--accent)" }}>
            {formatTZS(totalRevenue)}
          </div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>{t("statExpenses")}</div>
          <div style={{ ...styles.statValue, color: "var(--danger)" }}>
            {formatTZS(totalExpenses)}
          </div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>{t("statNetProfit")}</div>
          <div
            style={{
              ...styles.statValue,
              color: netProfit >= 0 ? "var(--primary-dark)" : "var(--danger)",
            }}
          >
            {formatTZS(netProfit)}
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  wrap: {
    flex: 1,
    overflow: "auto",
    padding: 28,
    maxWidth: 1080,
    margin: "0 auto",
    width: "100%",
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 22,
  },
  title: { fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" },
  syncNote: { fontSize: 12, color: "var(--text-muted)" },
  emptyNote: {
    background: "var(--accent-light)",
    color: "#8A5A1E",
    fontSize: 13,
    fontWeight: 600,
    padding: "14px 18px",
    borderRadius: 14,
    marginBottom: 24,
  },
  statGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 14,
  },
  statCard: {
    background: "var(--surface)",
    border: "1px solid var(--border-muted)",
    borderRadius: 18,
    padding: 20,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: "var(--text-muted)",
    marginBottom: 6,
  },
  statValue: { fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em" },
};

export default DashboardScreen;
