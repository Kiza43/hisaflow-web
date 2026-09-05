import React from "react";
import { useLanguage } from "../context/LanguageContext.jsx";
import { dataService } from "../services/dataService";

// Which permission (if any) each nav item needs — mirrors App.jsx's
// SCREEN_PERMISSIONS map. A staff member without a given permission
// simply never sees that item; the owner sees everything unconditionally.
const NAV_PERMISSION = {
  products: "manageProducts",
  sales: "manageSales",
  credit: "manageCredit",
  customers: "manageCredit",
  expenses: "manageExpenses",
  suppliers: "manageSuppliers",
  staff: "manageStaff",
  activityLog: "manageStaff",
  settings: "manageSettings",
};

const Sidebar = ({
  activeScreen,
  onNavigate,
  businessName,
  settings,
  currentUser,
  onLogout,
}) => {
  const { t, language, setLanguage } = useLanguage();

  // Clean, text-first navigation — no icons. Wayfinding comes from a
  // clear active-state indicator (a left accent bar), not a row of
  // decorative glyphs competing for attention.
  const ALL_NAV_ITEMS = [
    { key: "dashboard", label: t("navDashboard") },
    { key: "products", label: t("navProducts") },
    { key: "sales", label: t("navSales") },
    { key: "credit", label: t("navCredit") },
    { key: "customers", label: t("navCustomers") },
    { key: "expenses", label: t("navExpenses") },
    { key: "suppliers", label: t("navSuppliers") },
    { key: "staff", label: t("navStaff") },
    { key: "activityLog", label: t("navActivityLog") },
    { key: "settings", label: t("navSettings") },
  ];

  const visibleNavItems = ALL_NAV_ITEMS.filter((item) => {
    const required = NAV_PERMISSION[item.key];
    if (!required) return true; // dashboard, always visible
    return currentUser?.isOwner || !!currentUser?.permissions?.[required];
  });

  const handleToggleLanguage = async () => {
    const next = language === "sw" ? "en" : "sw";
    const currentSettings = await dataService.getSettings();
    setLanguage(next, currentSettings);
  };

  return (
    <div style={styles.sidebar}>
      <div style={styles.brand}>
        <div style={styles.brandName}>{businessName || "HisaFlow"}</div>
      </div>

      {currentUser && (
        <div style={styles.userBadge}>
          <div style={styles.userName}>{currentUser.name}</div>
          <div style={styles.userRole}>
            {currentUser.isOwner ? t("ownerRoleLabel") : t("staffRoleLabel")}
          </div>
        </div>
      )}

      <nav style={styles.nav}>
        {visibleNavItems.map((item) => (
          <button
            key={item.key}
            onClick={() => onNavigate(item.key)}
            style={{
              ...styles.navItem,
              ...(activeScreen === item.key ? styles.navItemActive : {}),
            }}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <button style={styles.langBtn} onClick={handleToggleLanguage}>
        {language === "sw" ? "Kiswahili" : "English"}
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
    padding: "24px 0",
  },
  brand: { padding: "0 20px", marginBottom: 20 },
  brandName: {
    fontSize: 15,
    fontWeight: 700,
    letterSpacing: "-0.01em",
    color: "var(--text-primary)",
  },
  userBadge: {
    padding: "0 20px 16px",
    marginBottom: 12,
    borderBottom: "1px solid var(--border-muted)",
  },
  userName: {
    fontSize: 13,
    fontWeight: 700,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  userRole: { fontSize: 11, color: "var(--text-muted)", marginTop: 2 },
  nav: { flex: 1, display: "flex", flexDirection: "column" },
  navItem: {
    display: "block",
    textAlign: "left",
    width: "100%",
    padding: "10px 20px",
    border: "none",
    borderLeft: "3px solid transparent",
    background: "transparent",
    color: "var(--text-secondary)",
    fontSize: 13,
    fontWeight: 600,
    transition:
      "background 0.15s ease, border-color 0.15s ease, color 0.15s ease",
  },
  navItemActive: {
    background: "var(--bg)",
    color: "var(--text-primary)",
    borderLeft: "3px solid var(--primary)",
    fontWeight: 700,
  },
  langBtn: {
    textAlign: "left",
    padding: "10px 20px",
    border: "none",
    borderTop: "1px solid var(--border-muted)",
    background: "transparent",
    color: "var(--text-secondary)",
    fontSize: 12,
    fontWeight: 600,
  },
  logoutBtn: {
    textAlign: "left",
    padding: "10px 20px",
    border: "none",
    background: "transparent",
    color: "var(--text-muted)",
    fontSize: 12,
    fontWeight: 600,
  },
};

export default Sidebar;
