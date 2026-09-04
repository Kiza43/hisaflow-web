import React from "react";
import { useLanguage } from "../context/LanguageContext.jsx";
import { dataService } from "../services/dataService";

const Sidebar = ({
  activeScreen,
  onNavigate,
  businessName,
  settings,
  onLogout,
}) => {
  const { t, language, setLanguage } = useLanguage();

  const NAV_ITEMS = [
    { key: "dashboard", label: t("navDashboard"), icon: "📊" },
    { key: "products", label: t("navProducts"), icon: "📦" },
    { key: "sales", label: t("navSales"), icon: "🧾" },
    { key: "credit", label: t("navCredit"), icon: "🤝" },
    { key: "expenses", label: t("navExpenses"), icon: "💸" },
  ];

  const handleToggleLanguage = async () => {
    const next = language === "sw" ? "en" : "sw";
    const currentSettings = await dataService.getSettings();
    setLanguage(next, currentSettings);
  };

  return (
    <div style={styles.sidebar}>
      <div style={styles.brand}>
        <div style={styles.brandMark}>🏪</div>
        <div style={styles.brandName}>{businessName || "HisaFlow"}</div>
      </div>

      <nav style={styles.nav}>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            onClick={() => onNavigate(item.key)}
            style={{
              ...styles.navItem,
              ...(activeScreen === item.key ? styles.navItemActive : {}),
            }}
          >
            <span style={{ marginRight: 10 }}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      <button style={styles.langBtn} onClick={handleToggleLanguage}>
        🌐 {language === "sw" ? "Kiswahili" : "English"}
      </button>
      <button style={styles.logoutBtn} onClick={onLogout}>
        {t("logout")}
      </button>
    </div>
  );
};

const styles = {
  sidebar: {
    width: 220,
    background: "var(--surface)",
    borderRight: "1px solid var(--border-muted)",
    display: "flex",
    flexDirection: "column",
    padding: "20px 14px",
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "0 8px",
    marginBottom: 24,
  },
  brandMark: {
    width: 34,
    height: 34,
    borderRadius: 10,
    background: "var(--primary-light)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 16,
  },
  brandName: { fontSize: 14, fontWeight: 800, letterSpacing: "-0.01em" },
  nav: { flex: 1, display: "flex", flexDirection: "column", gap: 4 },
  navItem: {
    display: "flex",
    alignItems: "center",
    textAlign: "left",
    padding: "11px 12px",
    borderRadius: 12,
    border: "none",
    background: "transparent",
    color: "var(--text-secondary)",
    fontSize: 14,
    fontWeight: 700,
  },
  navItemActive: {
    background: "var(--primary-light)",
    color: "var(--primary-dark)",
  },
  langBtn: {
    textAlign: "left",
    padding: "10px 12px",
    border: "1px solid var(--border-muted)",
    borderRadius: 10,
    background: "var(--bg)",
    color: "var(--text-secondary)",
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 8,
  },
  logoutBtn: {
    textAlign: "left",
    padding: "11px 12px",
    border: "none",
    background: "transparent",
    color: "var(--text-muted)",
    fontSize: 13,
    fontWeight: 700,
  },
};

export default Sidebar;
