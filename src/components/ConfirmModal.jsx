import React from "react";
import { useLanguage } from "../context/LanguageContext.jsx";

// Replaces window.confirm() everywhere in the app. Native browser dialogs
// look jarring next to a designed interface — this is a small component,
// but it's one of those details that quietly signals "this was built with
// care" versus "this was thrown together."
const ConfirmModal = ({
  visible,
  title,
  message,
  onConfirm,
  onCancel,
  danger = true,
  busy = false,
}) => {
  const { t } = useLanguage();
  if (!visible) return null;

  return (
    <div style={styles.overlay} onClick={busy ? undefined : onCancel}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {title && <h2 style={styles.title}>{title}</h2>}
        <p style={styles.message}>{message}</p>

        <div style={styles.actions}>
          <button style={styles.cancelBtn} disabled={busy} onClick={onCancel}>
            {t("cancelButton")}
          </button>
          <button
            style={{
              ...styles.confirmBtn,
              ...(danger ? styles.confirmBtnDanger : {}),
            }}
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? t("completing") : t("deleteButton")}
          </button>
        </div>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(41,37,34,0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 70,
    animation: "fadeIn 0.15s ease",
  },
  modal: {
    width: 340,
    background: "var(--surface)",
    borderRadius: 20,
    padding: 28,
    textAlign: "center",
    animation: "scaleIn 0.15s ease",
  },
  title: { fontSize: 16, fontWeight: 800, marginBottom: 6 },
  message: {
    fontSize: 13,
    color: "var(--text-secondary)",
    lineHeight: 1.5,
    marginBottom: 22,
  },
  actions: { display: "flex", gap: 10 },
  cancelBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    border: "1.5px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text-secondary)",
    fontWeight: 700,
    fontSize: 14,
  },
  confirmBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    border: "none",
    background: "var(--primary)",
    color: "white",
    fontWeight: 800,
    fontSize: 14,
  },
  confirmBtnDanger: { background: "var(--danger)" },
};

export default ConfirmModal;
