import React from "react";
import { PERMISSION_KEYS } from "../services/staffService";
import { useLanguage } from "../context/LanguageContext.jsx";

const StaffCard = ({ staff, onEdit, onDelete }) => {
  const { t } = useLanguage();
  const grantedCount = PERMISSION_KEYS.filter(
    (key) => staff.permissions?.[key],
  ).length;
  const isFullAccess = grantedCount === PERMISSION_KEYS.length;

  return (
    <div className="hf-card" style={styles.card}>
      <div style={styles.header}>
        <div style={styles.avatar}>
          {(staff.name || "?").charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={styles.name}>{staff.name}</div>
          <div
            style={{
              ...styles.permBadge,
              ...(isFullAccess ? styles.permBadgeFull : {}),
            }}
          >
            {isFullAccess
              ? t("fullAccessLabel")
              : t("permissionCountLabel", {
                  count: grantedCount,
                  total: PERMISSION_KEYS.length,
                })}
          </div>
        </div>
      </div>

      <div style={styles.actions}>
        <button style={styles.editBtn} onClick={() => onEdit(staff)}>
          {t("editButton")}
        </button>
        <button style={styles.deleteBtn} onClick={() => onDelete(staff.id)}>
          {t("deleteButton")}
        </button>
      </div>
    </div>
  );
};

const styles = {
  card: {
    background: "var(--surface)",
    borderRadius: 18,
    padding: 18,
    border: "1px solid var(--border-muted)",
  },
  header: { display: "flex", alignItems: "center", gap: 12, marginBottom: 14 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 999,
    background: "var(--primary)",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 15,
    fontWeight: 800,
    flexShrink: 0,
  },
  name: { fontSize: 14, fontWeight: 700 },
  permBadge: {
    display: "inline-block",
    fontSize: 10,
    fontWeight: 700,
    color: "var(--text-muted)",
    background: "var(--bg)",
    borderRadius: 999,
    padding: "3px 9px",
    marginTop: 4,
  },
  permBadgeFull: {
    background: "var(--primary-light)",
    color: "var(--primary-dark)",
  },
  actions: { display: "flex", gap: 8 },
  editBtn: {
    padding: "10px 16px",
    borderRadius: 10,
    border: "1.5px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text-secondary)",
    fontWeight: 700,
    fontSize: 12,
  },
  deleteBtn: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    border: "none",
    background: "var(--danger-light)",
    color: "var(--danger)",
    fontWeight: 700,
    fontSize: 12,
  },
};

export default StaffCard;
