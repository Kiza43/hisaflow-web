import React, { useState, useEffect } from "react";
import { dataService } from "../services/dataService";
import { useLanguage } from "../context/LanguageContext.jsx";

const formatDateTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return (
    d.toLocaleDateString("sw-TZ", { day: "numeric", month: "short" }) +
    " · " +
    d.toLocaleTimeString("sw-TZ", { hour: "2-digit", minute: "2-digit" })
  );
};

const ActivityLogScreen = () => {
  const { t } = useLanguage();
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dataService.getActivityLog().then((data) => {
      setLog(data);
      setLoading(false);
    });
  }, []);

  if (loading) return null;

  const sorted = log
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div style={styles.wrap}>
      <h1 style={styles.title}>{t("navActivityLog")}</h1>
      <p style={styles.subtitle}>{t("activityLogHint")}</p>

      {sorted.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={{ fontWeight: 700 }}>{t("noActivityYet")}</div>
        </div>
      ) : (
        <div style={styles.panel}>
          {sorted.map((entry) => (
            <div key={entry.id} style={styles.row}>
              <div style={styles.avatar}>
                {(entry.actorName || "?").charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={styles.actionLine}>
                  <span style={styles.actorName}>{entry.actorName}</span>{" "}
                  {entry.action}
                </div>
                {entry.details && (
                  <div style={styles.details}>{entry.details}</div>
                )}
              </div>
              <div style={styles.date}>{formatDateTime(entry.date)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const styles = {
  wrap: {
    flex: 1,
    overflow: "auto",
    padding: 28,
    maxWidth: 780,
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
  panel: {
    background: "var(--surface)",
    border: "1px solid var(--border-muted)",
    borderRadius: 18,
    overflow: "hidden",
  },
  row: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    padding: "14px 18px",
    borderBottom: "1px solid var(--border-muted)",
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 999,
    background: "var(--primary-light)",
    color: "var(--primary-dark)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 800,
    flexShrink: 0,
  },
  actionLine: { fontSize: 13, color: "var(--text-primary)" },
  actorName: { fontWeight: 800 },
  details: { fontSize: 12, color: "var(--text-muted)", marginTop: 2 },
  date: {
    fontSize: 11,
    color: "var(--text-muted)",
    flexShrink: 0,
    whiteSpace: "nowrap",
  },
};

export default ActivityLogScreen;
