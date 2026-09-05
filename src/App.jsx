import React, { useState, useEffect, useCallback, useRef } from "react";
import LoginScreen from "./screens/LoginScreen.jsx";
import DashboardScreen from "./screens/DashboardScreen.jsx";
import ProductsScreen from "./screens/ProductsScreen.jsx";
import SalesScreen from "./screens/SalesScreen.jsx";
import CreditScreen from "./screens/CreditScreen.jsx";
import CustomersScreen from "./screens/CustomersScreen.jsx";
import ExpensesScreen from "./screens/ExpensesScreen.jsx";
import SuppliersScreen from "./screens/SuppliersScreen.jsx";
import StaffScreen from "./screens/StaffScreen.jsx";
import ActivityLogScreen from "./screens/ActivityLogScreen.jsx";
import SettingsScreen from "./screens/SettingsScreen.jsx";
import Sidebar from "./components/Sidebar.jsx";
import { CartProvider } from "./context/CartContext.jsx";
import { RestockCartProvider } from "./context/RestockCartContext.jsx";
import { LanguageProvider } from "./context/LanguageContext.jsx";
import { dataService } from "./services/dataService";
import { backupService } from "./services/backupService";
import { setCurrentActor } from "./services/activityLogService";

// Which permission (if any) a screen requires — dashboard is always
// visible to anyone logged in, since it's just numbers, nothing
// destructive lives there.
const SCREEN_PERMISSIONS = {
  dashboard: null,
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

const SESSION_KEY = "hisaflow_session";

// Keeps the current login session and active screen across a refresh —
// sessionStorage specifically, not localStorage: it survives a page
// reload (Vite HMR during dev, an accidental F5) but still clears the
// moment the actual app window closes. A refresh mid-session shouldn't
// force a PIN re-entry; a fresh app launch on a shared computer should.
const readSession = () => {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeSession = (settings, currentUser, activeScreen) => {
  try {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ settings, currentUser, activeScreen }),
    );
  } catch {
    // sessionStorage can fail in rare cases (quota, privacy mode) —
    // losing the persisted session isn't worth crashing over.
  }
};

const clearSession = () => {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // no-op
  }
};

const App = () => {
  const existingSession = readSession();
  const [settings, setSettings] = useState(existingSession?.settings || null);
  const [currentUser, setCurrentUser] = useState(
    existingSession?.currentUser || null,
  );
  const [activeScreen, setActiveScreen] = useState(
    existingSession?.activeScreen || "dashboard",
  );
  const [initialLanguage, setInitialLanguage] = useState(null);
  const backupPendingRef = useRef(false);

  useEffect(() => {
    if (existingSession?.currentUser)
      setCurrentActor(existingSession.currentUser.name);
    // Read once up front so the correct language is active from the very
    // first screen (including the PIN login), not just after unlocking.
    dataService
      .getSettings()
      .then((s) => setInitialLanguage(s.language || "sw"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the persisted session in sync whenever login state or the
  // active screen changes, so a refresh always lands back where it left off.
  useEffect(() => {
    if (settings) writeSession(settings, currentUser, activeScreen);
  }, [settings, currentUser, activeScreen]);

  const performAutoBackup = useCallback(async () => {
    const current = await dataService.getSettings();
    if (!current.ownerPhone || !current.ownerPin) return; // nothing to protect recovery with yet

    const result = await backupService.pushToCloud(
      current.ownerPhone,
      current.ownerPin,
    );
    backupPendingRef.current = !result.success;
    if (result.success) {
      await dataService.saveSettings({
        ...current,
        lastCloudBackupAt: new Date().toISOString(),
      });
    }
  }, []);

  // Same layered approach as the phone app: a steady interval as a
  // fallback, plus firing the moment connectivity actually returns (most
  // "failures" aren't real failures, just being offline at that instant),
  // plus one last attempt right before the window closes.
  useEffect(() => {
    if (!settings) return;

    const interval = setInterval(performAutoBackup, 30 * 60 * 1000);

    const handleOnline = () => {
      if (backupPendingRef.current) performAutoBackup();
    };
    window.addEventListener("online", handleOnline);

    const handleBeforeUnload = () => {
      performAutoBackup();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [settings, performAutoBackup]);

  const handleUnlock = (loadedSettings, identity) => {
    setSettings(loadedSettings);
    setCurrentUser(identity);
    setCurrentActor(identity?.name);
    setActiveScreen("dashboard");
  };

  const handleLogout = () => {
    setSettings(null);
    setCurrentUser(null);
    setCurrentActor(null);
    setActiveScreen("dashboard");
    clearSession();
  };

  const handleNavigate = (screenKey) => {
    const required = SCREEN_PERMISSIONS[screenKey];
    if (
      required &&
      !currentUser?.isOwner &&
      !currentUser?.permissions?.[required]
    )
      return; // silently ignore, nav shouldn't have shown this anyway
    setActiveScreen(screenKey);
  };

  const canAccess = (screenKey) => {
    const required = SCREEN_PERMISSIONS[screenKey];
    if (!required) return true;
    return currentUser?.isOwner || !!currentUser?.permissions?.[required];
  };

  if (initialLanguage === null) return null; // brief, avoids a language flash

  return (
    <LanguageProvider initialLanguage={initialLanguage}>
      {!settings ? (
        <LoginScreen onUnlock={handleUnlock} />
      ) : (
        <CartProvider>
          <RestockCartProvider>
            <div
              style={{
                height: "100vh",
                display: "flex",
                background: "var(--bg)",
              }}
            >
              <Sidebar
                activeScreen={activeScreen}
                onNavigate={handleNavigate}
                businessName={settings.businessName}
                settings={settings}
                currentUser={currentUser}
                onLogout={handleLogout}
              />
              {activeScreen === "dashboard" && <DashboardScreen />}
              {activeScreen === "products" && canAccess("products") && (
                <ProductsScreen />
              )}
              {activeScreen === "sales" && canAccess("sales") && (
                <SalesScreen />
              )}
              {activeScreen === "credit" && canAccess("credit") && (
                <CreditScreen />
              )}
              {activeScreen === "customers" && canAccess("customers") && (
                <CustomersScreen />
              )}
              {activeScreen === "expenses" && canAccess("expenses") && (
                <ExpensesScreen />
              )}
              {activeScreen === "suppliers" && canAccess("suppliers") && (
                <SuppliersScreen />
              )}
              {activeScreen === "staff" && canAccess("staff") && (
                <StaffScreen />
              )}
              {activeScreen === "activityLog" && canAccess("activityLog") && (
                <ActivityLogScreen />
              )}
              {activeScreen === "settings" && canAccess("settings") && (
                <SettingsScreen />
              )}
            </div>
          </RestockCartProvider>
        </CartProvider>
      )}
    </LanguageProvider>
  );
};

export default App;
