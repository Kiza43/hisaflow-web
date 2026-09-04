import React, { useState, useEffect } from "react";
import { dataService } from "../services/dataService";
import { useLanguage } from "../context/LanguageContext.jsx";

const LoginScreen = ({ onUnlock }) => {
  const { t } = useLanguage();
  const [settings, setSettings] = useState(null);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dataService.getSettings().then((s) => {
      setSettings(s);
      setLoading(false);
    });
  }, []);

  const handleSetupPin = async () => {
    setError("");
    if (pin.length < 4) {
      setError(t("pinTooShort"));
      return;
    }
    if (pin !== confirmPin) {
      setError(t("pinMismatch"));
      return;
    }
    const updatedSettings = { ...settings, ownerPin: pin };
    await dataService.saveSettings(updatedSettings);
    onUnlock(updatedSettings);
  };

  const handleUnlock = () => {
    setError("");
    if (pin === settings.ownerPin) {
      onUnlock(settings);
    } else {
      setError(t("incorrectPin"));
      setPin("");
    }
  };

  if (loading) return null;

  const isFirstRun = !settings.ownerPin;

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <div style={styles.icon}>🏪</div>
        <h1 style={styles.title}>HisaFlow</h1>
        <p style={styles.subtitle}>
          {isFirstRun ? t("setupPinTitle") : t("unlockPinTitle")}
        </p>

        {error && <div style={styles.error}>{error}</div>}

        {isFirstRun ? (
          <>
            <input
              type="password"
              inputMode="numeric"
              placeholder={t("newPinPlaceholder")}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              style={styles.input}
              autoFocus
            />
            <input
              type="password"
              inputMode="numeric"
              placeholder={t("confirmPinPlaceholder")}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value)}
              style={styles.input}
              onKeyUp={(e) => e.key === "Enter" && handleSetupPin()}
            />
            <button style={styles.button} onClick={handleSetupPin}>
              {t("startButton")}
            </button>
          </>
        ) : (
          <>
            <input
              type="password"
              inputMode="numeric"
              placeholder="••••"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              style={{
                ...styles.input,
                textAlign: "center",
                letterSpacing: "6px",
              }}
              autoFocus
              onKeyUp={(e) => e.key === "Enter" && handleUnlock()}
            />
            <button style={styles.button} onClick={handleUnlock}>
              {t("loginButton")}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

const styles = {
  wrap: {
    height: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--bg)",
  },
  card: {
    width: 360,
    background: "var(--surface)",
    borderRadius: 24,
    padding: "40px 32px",
    border: "1px solid var(--border-muted)",
    boxShadow: "0 1px 3px rgba(41, 37, 34, 0.08)",
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    background: "var(--primary-light)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 26,
    margin: "0 auto 20px",
  },
  title: {
    fontSize: 24,
    fontWeight: 800,
    textAlign: "center",
    letterSpacing: "-0.02em",
  },
  subtitle: {
    fontSize: 14,
    color: "var(--text-secondary)",
    textAlign: "center",
    margin: "8px 0 24px",
  },
  error: {
    background: "var(--danger-light)",
    color: "var(--danger)",
    fontSize: 13,
    fontWeight: 600,
    padding: "10px 14px",
    borderRadius: 12,
    marginBottom: 16,
    textAlign: "center",
  },
  input: {
    width: "100%",
    padding: "13px 14px",
    border: "2px solid var(--border)",
    borderRadius: 14,
    fontSize: 16,
    fontWeight: 600,
    marginBottom: 14,
    background: "var(--bg)",
    color: "var(--text-primary)",
  },
  button: {
    width: "100%",
    padding: 15,
    border: "none",
    borderRadius: 14,
    background: "var(--primary)",
    color: "white",
    fontSize: 15,
    fontWeight: 800,
  },
};

export default LoginScreen;
