import React, { useState, useEffect, useMemo } from "react";
import { dataService } from "../services/dataService";
import { customerService } from "../services/customerService";
import { creditService } from "../services/creditService";
import CustomerCard from "../components/CustomerCard.jsx";
import CustomerProfileModal from "../components/CustomerProfileModal.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";

const CustomersScreen = () => {
  const { t } = useLanguage();
  const [creditSales, setCreditSales] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [openCustomerKey, setOpenCustomerKey] = useState(null);

  const loadCreditSales = () =>
    dataService.getCreditSales().then((data) => {
      setCreditSales(data);
      setLoading(false);
    });

  useEffect(() => {
    loadCreditSales();
    dataService.getSettings().then(setSettings);
  }, []);

  const handleRecordPayment = async (creditSaleId, amount, paymentMethod) => {
    const result = await creditService.recordPayment(
      creditSaleId,
      amount,
      paymentMethod,
    );
    if (result.success) await loadCreditSales();
    return result;
  };

  // Aggregating every credit sale into per-customer profiles is real work
  // once there's meaningful transaction history — memoized so it only
  // recomputes when the underlying credit sales actually change, not on
  // every render (e.g. just opening a customer's profile modal).
  const customers = useMemo(
    () => customerService.getCustomerProfiles(creditSales),
    [creditSales],
  );
  const openCustomer = useMemo(
    () =>
      customers.find((c) => (c.phone || c.name) === openCustomerKey) || null,
    [customers, openCustomerKey],
  );

  if (loading) return null;

  return (
    <div style={styles.wrap}>
      <h1 style={styles.title}>{t("navCustomers")}</h1>
      <p style={styles.subtitle}>{t("customersHint")}</p>

      {customers.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>
            {t("noCustomersYet")}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {t("customersEmptyHint")}
          </div>
        </div>
      ) : (
        <div style={styles.grid}>
          {customers.map((customer) => (
            <CustomerCard
              key={customer.phone || customer.name}
              customer={customer}
              onOpen={() => setOpenCustomerKey(customer.phone || customer.name)}
            />
          ))}
        </div>
      )}

      <CustomerProfileModal
        visible={!!openCustomer}
        customer={openCustomer}
        businessName={settings.businessName}
        onRecordPayment={handleRecordPayment}
        onClose={() => setOpenCustomerKey(null)}
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
  title: {
    fontSize: 22,
    fontWeight: 800,
    letterSpacing: "-0.02em",
    marginBottom: 4,
  },
  subtitle: { fontSize: 12, color: "var(--text-muted)", marginBottom: 20 },
  emptyState: {
    background: "var(--surface)",
    border: "1px solid var(--border-muted)",
    borderRadius: 18,
    padding: 48,
    textAlign: "center",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
    gap: 14,
  },
};

export default CustomersScreen;
