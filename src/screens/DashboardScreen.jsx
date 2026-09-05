import React, { useState, useEffect } from "react";
import { dataService } from "../services/dataService";
import { analyticsService } from "../services/analyticsService";
import { alertService } from "../services/alertService.jsx";
import { notificationService } from "../services/notificationService";
import ReportModal from "../components/ReportModal.jsx";
import WeeklyRecapModal from "../components/WeeklyRecapModal.jsx";
import StockAlertBanner from "../components/StockAlertBanner.jsx";
import ExpiryAlertBanner from "../components/ExpiryAlertBanner.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";

const formatTZS = (amount) => {
  const v = typeof amount === "number" && !isNaN(amount) ? amount : 0;
  return "TZS " + Math.round(v).toLocaleString("en-US");
};

const PERIODS = ["today", "week", "month", "all"];

const DashboardScreen = ({ onNavigate }) => {
  const { t } = useLanguage();
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [expenditures, setExpenditures] = useState([]);
  const [showReport, setShowReport] = useState(false);
  const [showRecap, setShowRecap] = useState(false);
  const [period, setPeriod] = useState("today");

  useEffect(() => {
    dataService.getProducts().then((loadedProducts) => {
      setProducts(loadedProducts);
      const stockAlerts = alertService.getLowStockAlerts(loadedProducts);
      const expiryAlerts = alertService.getExpiryAlerts(loadedProducts);
      const totalAlerts = stockAlerts.total + expiryAlerts.total;
      if (totalAlerts > 0) {
        notificationService.showOnceThisSession(
          t("stockAlertTitle"),
          t("alertNotificationBody", { count: totalAlerts }),
        );
      }
    });
    dataService.getSales().then(setSales);
    dataService.getExpenditures().then(setExpenditures);
  }, []);

  const periodLabel = (p) => {
    if (p === "today") return t("periodToday");
    if (p === "week") return t("periodThisWeek");
    if (p === "month") return t("periodThisMonth");
    return t("periodAllTime");
  };

  // Filter first, then rank — best sellers "this week" means best sellers
  // among sales that actually happened this week, not an all-time ranking
  // just relabeled.
  const periodSales = analyticsService.filterSalesByPeriod(sales, period);
  const periodExpenditures = analyticsService.filterSalesByPeriod(
    expenditures,
    period,
  );

  const totalRevenue = periodSales.reduce(
    (sum, s) => sum + (s.totalRevenue || 0),
    0,
  );
  const grossProfit = periodSales.reduce((sum, s) => sum + (s.profit || 0), 0);
  const totalExpenses = periodExpenditures.reduce(
    (sum, exp) => sum + (exp.amount || 0),
    0,
  );
  const netProfit = grossProfit - totalExpenses;

  const bestSellers = analyticsService.getBestSellers(products, periodSales, 5);
  const mostProfitable = analyticsService.getMostProfitable(
    products,
    periodSales,
    5,
  );
  const maxSellerQty = bestSellers[0]?.quantity || 1;
  const maxProfitAmount = mostProfitable[0]?.profit || 1;

  return (
    <div style={styles.wrap}>
      <div style={styles.headerRow}>
        <h1 style={styles.title}>{t("navDashboard")}</h1>
        <div style={styles.headerRight}>
          <button style={styles.recapBtn} onClick={() => setShowRecap(true)}>
            {t("weeklyRecapButton")}
          </button>
          <button style={styles.exportBtn} onClick={() => setShowReport(true)}>
            {t("generateReportButton")}
          </button>
        </div>
      </div>

      {onNavigate && (
        <>
          <StockAlertBanner
            products={products}
            onPress={() => onNavigate("products")}
          />
          <ExpiryAlertBanner
            products={products}
            onPress={() => onNavigate("products")}
          />
        </>
      )}

      {products.length === 0 && sales.length === 0 && (
        <div style={styles.emptyNote}>{t("noDataYet")}</div>
      )}

      <div style={styles.periodRow}>
        {PERIODS.map((p) => (
          <button
            key={p}
            style={{
              ...styles.periodBtn,
              ...(period === p ? styles.periodBtnActive : {}),
            }}
            onClick={() => setPeriod(p)}
          >
            {periodLabel(p)}
          </button>
        ))}
      </div>

      <div style={styles.statGrid}>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>{t("statProducts")}</div>
          <div style={styles.statValue}>{products.length}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>{t("statSales")}</div>
          <div style={styles.statValue}>{periodSales.length}</div>
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

      <div style={styles.rankingsRow}>
        <div style={styles.rankingCard}>
          <h2 style={styles.rankingTitle}>{t("bestSellersHeading")}</h2>
          {bestSellers.length === 0 ? (
            <div style={styles.rankingEmpty}>{t("noSalesInPeriodMessage")}</div>
          ) : (
            bestSellers.map(({ product, quantity }) => (
              <div key={product.id} style={styles.rankRow}>
                <div style={styles.rankInfo}>
                  <span style={styles.rankName}>{product.name}</span>
                  <span style={styles.rankValue}>
                    {quantity} {product.unit}
                  </span>
                </div>
                <div style={styles.rankBarTrack}>
                  <div
                    style={{
                      ...styles.rankBarFill,
                      width: `${(quantity / maxSellerQty) * 100}%`,
                      background: "var(--accent)",
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </div>

        <div style={styles.rankingCard}>
          <h2 style={styles.rankingTitle}>{t("mostProfitableHeading")}</h2>
          {mostProfitable.length === 0 ? (
            <div style={styles.rankingEmpty}>{t("noSalesInPeriodMessage")}</div>
          ) : (
            mostProfitable.map(({ product, profit }) => (
              <div key={product.id} style={styles.rankRow}>
                <div style={styles.rankInfo}>
                  <span style={styles.rankName}>{product.name}</span>
                  <span style={styles.rankValue}>{formatTZS(profit)}</span>
                </div>
                <div style={styles.rankBarTrack}>
                  <div
                    style={{
                      ...styles.rankBarFill,
                      width: `${(profit / maxProfitAmount) * 100}%`,
                      background: "var(--primary)",
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <ReportModal visible={showReport} onClose={() => setShowReport(false)} />
      <WeeklyRecapModal
        visible={showRecap}
        onClose={() => setShowRecap(false)}
      />
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
    marginBottom: 18,
  },
  headerRight: { display: "flex", alignItems: "center", gap: 14 },
  exportBtn: {
    padding: "10px 16px",
    borderRadius: 12,
    border: "none",
    background: "var(--primary)",
    color: "white",
    fontWeight: 700,
    fontSize: 13,
  },
  recapBtn: {
    padding: "10px 16px",
    borderRadius: 12,
    borderWidth: "1.5px",
    borderStyle: "solid",
    borderColor: "var(--border)",
    background: "var(--surface)",
    color: "var(--text-secondary)",
    fontWeight: 700,
    fontSize: 13,
  },
  title: { fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" },
  emptyNote: {
    background: "var(--accent-light)",
    color: "#8A5A1E",
    fontSize: 13,
    fontWeight: 600,
    padding: "14px 18px",
    borderRadius: 14,
    marginBottom: 24,
  },
  periodRow: { display: "flex", gap: 8, marginBottom: 18 },
  periodBtn: {
    padding: "8px 16px",
    borderRadius: 999,
    borderWidth: "1.5px",
    borderStyle: "solid",
    borderColor: "var(--border)",
    background: "var(--surface)",
    color: "var(--text-secondary)",
    fontWeight: 700,
    fontSize: 12,
  },
  periodBtnActive: {
    background: "var(--primary-light)",
    borderColor: "var(--primary)",
    color: "var(--primary-dark)",
  },
  statGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 14,
    marginBottom: 24,
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
  rankingsRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 },
  rankingCard: {
    background: "var(--surface)",
    border: "1px solid var(--border-muted)",
    borderRadius: 18,
    padding: 20,
  },
  rankingTitle: { fontSize: 14, fontWeight: 800, marginBottom: 14 },
  rankingEmpty: { fontSize: 12, color: "var(--text-muted)", padding: "10px 0" },
  rankRow: { marginBottom: 12 },
  rankInfo: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  rankName: { fontSize: 12, fontWeight: 700, color: "var(--text-primary)" },
  rankValue: { fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" },
  rankBarTrack: {
    height: 6,
    background: "var(--border-muted)",
    borderRadius: 999,
    overflow: "hidden",
  },
  rankBarFill: { height: "100%", borderRadius: 999 },
};

export default DashboardScreen;
