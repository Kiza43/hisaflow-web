import React, { useState, useEffect } from "react";
import LoginScreen from "./screens/LoginScreen.jsx";
import DashboardScreen from "./screens/DashboardScreen.jsx";
import ProductsScreen from "./screens/ProductsScreen.jsx";
import SalesScreen from "./screens/SalesScreen.jsx";
import CreditScreen from "./screens/CreditScreen.jsx";
import ExpensesScreen from "./screens/ExpensesScreen.jsx";
import Sidebar from "./components/Sidebar.jsx";
import { CartProvider } from "./context/CartContext.jsx";
import { RestockCartProvider } from "./context/RestockCartContext.jsx";
import { LanguageProvider } from "./context/LanguageContext.jsx";
import { dataService } from "./services/dataService";

const App = () => {
  const [settings, setSettings] = useState(null);
  const [activeScreen, setActiveScreen] = useState("dashboard");
  const [initialLanguage, setInitialLanguage] = useState(null);

  useEffect(() => {
    // Read once up front so the correct language is active from the very
    // first screen (including the PIN login), not just after unlocking.
    dataService
      .getSettings()
      .then((s) => setInitialLanguage(s.language || "sw"));
  }, []);

  if (initialLanguage === null) return null; // brief, avoids a language flash

  return (
    <LanguageProvider initialLanguage={initialLanguage}>
      {!settings ? (
        <LoginScreen onUnlock={setSettings} />
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
                onNavigate={setActiveScreen}
                businessName={settings.businessName}
                settings={settings}
                onLogout={() => setSettings(null)}
              />
              {activeScreen === "dashboard" && <DashboardScreen />}
              {activeScreen === "products" && <ProductsScreen />}
              {activeScreen === "sales" && <SalesScreen />}
              {activeScreen === "credit" && <CreditScreen />}
              {activeScreen === "expenses" && <ExpensesScreen />}
            </div>
          </RestockCartProvider>
        </CartProvider>
      )}
    </LanguageProvider>
  );
};

export default App;
