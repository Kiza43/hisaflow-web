import React, { useState } from "react";
import { dataService } from "../services/dataService";
import { useLanguage } from "../context/LanguageContext.jsx";

const ACCOUNT_TYPES = [
  { value: "bank_transfer", labelKey: "bankTransferMethodOption" },
  { value: "lipa_namba", labelKey: "lipaNambaMethodOption" },
];

// Configured once here, then selectable at time of sale — this is what
// lets "which account received the money" be a quick tap during a sale
// instead of typing an account number every single time.
const PaymentAccountsSection = ({ settings, onSettingsChange }) => {
  const { t } = useLanguage();
  const [type, setType] = useState("bank_transfer");
  const [label, setLabel] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const accounts = settings.paymentAccounts || [];

  const handleAdd = async () => {
    if (!label.trim()) {
      setError(t("enterAccountLabelError"));
      return;
    }
    if (!accountNumber.trim()) {
      setError(t("enterAccountNumberError"));
      return;
    }
    setSaving(true);
    const newAccount = {
      id: `acc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type,
      label: label.trim(),
      accountNumber: accountNumber.trim(),
    };
    const updated = { ...settings, paymentAccounts: [...accounts, newAccount] };
    await dataService.saveSettings(updated);
    onSettingsChange(updated);
    setLabel("");
    setAccountNumber("");
    setError("");
    setSaving(false);
  };

  const handleRemove = async (accountId) => {
    const updated = {
      ...settings,
      paymentAccounts: accounts.filter((a) => a.id !== accountId),
    };
    await dataService.saveSettings(updated);
    onSettingsChange(updated);
  };

  return (
    <div>
      {accounts.length > 0 && (
        <div style={styles.list}>
          {accounts.map((acc) => (
            <div key={acc.id} style={styles.accountRow}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={styles.accountLabel}>{acc.label}</div>
                <div style={styles.accountMeta}>
                  {t(
                    acc.type === "bank_transfer"
                      ? "bankTransferMethodOption"
                      : "lipaNambaMethodOption",
                  )}{" "}
                  · {acc.accountNumber}
                </div>
              </div>
              <button
                style={styles.removeBtn}
                onClick={() => handleRemove(acc.id)}
              >
                {t("deleteButton")}
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.typeRow}>
        {ACCOUNT_TYPES.map((accountType) => (
          <button
            key={accountType.value}
            style={{
              ...styles.typeChip,
              ...(type === accountType.value ? styles.typeChipActive : {}),
            }}
            onClick={() => setType(accountType.value)}
          >
            {t(accountType.labelKey)}
          </button>
        ))}
      </div>

      <input
        style={styles.input}
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder={t("accountLabelPlaceholder")}
      />
      <input
        style={styles.input}
        value={accountNumber}
        onChange={(e) => setAccountNumber(e.target.value)}
        placeholder={t("accountNumberPlaceholder")}
      />

      <button style={styles.addBtn} disabled={saving} onClick={handleAdd}>
        {saving ? t("completing") : t("addAccountButton")}
      </button>
    </div>
  );
};

const styles = {
  list: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 },
  accountRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: 12,
    background: "var(--bg)",
    borderRadius: 12,
  },
  accountLabel: { fontSize: 13, fontWeight: 700 },
  accountMeta: { fontSize: 11, color: "var(--text-muted)", marginTop: 2 },
  removeBtn: {
    background: "none",
    border: "none",
    fontSize: 11,
    fontWeight: 700,
    color: "var(--danger)",
  },
  error: {
    background: "var(--danger-light)",
    color: "var(--danger)",
    fontSize: 13,
    fontWeight: 600,
    padding: "10px 14px",
    borderRadius: 12,
    marginBottom: 14,
  },
  typeRow: { display: "flex", gap: 6, marginBottom: 10 },
  typeChip: {
    flex: 1,
    padding: "9px 0",
    borderRadius: 10,
    borderWidth: "1.5px",
    borderStyle: "solid",
    borderColor: "var(--border)",
    background: "var(--surface)",
    color: "var(--text-secondary)",
    fontWeight: 600,
    fontSize: 12,
  },
  typeChipActive: {
    background: "var(--primary-light)",
    borderColor: "var(--primary)",
    color: "var(--primary-dark)",
  },
  input: {
    width: "100%",
    padding: "11px 13px",
    borderWidth: "1.5px",
    borderStyle: "solid",
    borderColor: "var(--border)",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 10,
    background: "var(--bg)",
    color: "var(--text-primary)",
  },
  addBtn: {
    width: "100%",
    padding: 12,
    borderRadius: 12,
    border: "none",
    background: "var(--primary)",
    color: "white",
    fontWeight: 700,
    fontSize: 13,
  },
};

export default PaymentAccountsSection;
