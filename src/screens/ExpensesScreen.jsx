import React, { useState, useEffect } from "react";
import { dataService } from "../services/dataService";
import ExpenditureFormModal from "../components/ExpenditureFormModal.jsx";
import ExpenditureCard from "../components/ExpenditureCard.jsx";
import ConfirmModal from "../components/ConfirmModal.jsx";
import { activityLogService } from "../services/activityLogService";
import { useLanguage } from "../context/LanguageContext.jsx";

const formatTZS = (amount) => {
  const v = typeof amount === "number" && !isNaN(amount) ? amount : 0;
  return "TZS " + Math.round(v).toLocaleString("en-US");
};

const ExpensesScreen = () => {
  const { t } = useLanguage();
  const [expenditures, setExpenditures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    dataService.getExpenditures().then((data) => {
      setExpenditures(data);
      setLoading(false);
    });
  }, []);

  const handleSave = async (expenditure) => {
    const updated = [...expenditures, expenditure];
    setExpenditures(updated);
    await dataService.saveExpenditures(updated);
    setShowForm(false);
  };

  const confirmDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      const removed = expenditures.find((exp) => exp.id === pendingDeleteId);
      const updated = expenditures.filter((exp) => exp.id !== pendingDeleteId);
      setExpenditures(updated);
      await dataService.saveExpenditures(updated);
      if (removed)
        await activityLogService.logActivity(
          "deleted an expense",
          removed.description,
        );
      setPendingDeleteId(null);
    } catch (err) {
      console.error("Delete expenditure error:", err);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return null;

  const sorted = expenditures
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  const totalThisList = expenditures.reduce(
    (sum, exp) => sum + (exp.amount || 0),
    0,
  );

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <h1 style={styles.title}>{t("navExpenses")}</h1>
        <button style={styles.addBtn} onClick={() => setShowForm(true)}>
          {t("addExpenditureButton")}
        </button>
      </div>

      {expenditures.length > 0 && (
        <div style={styles.summaryBox}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text-secondary)",
            }}
          >
            {t("totalExpensesLabel")}
          </span>
          <span
            style={{ fontSize: 22, fontWeight: 800, color: "var(--danger)" }}
          >
            {formatTZS(totalThisList)}
          </span>
        </div>
      )}

      {expenditures.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>
            {t("noExpensesYet")}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {t("tapAddExpenditureHint")}
          </div>
        </div>
      ) : (
        <div style={styles.grid}>
          {sorted.map((exp) => (
            <ExpenditureCard
              key={exp.id}
              expenditure={exp}
              onDelete={setPendingDeleteId}
            />
          ))}
        </div>
      )}

      <ExpenditureFormModal
        visible={showForm}
        onSave={handleSave}
        onClose={() => setShowForm(false)}
      />

      <ConfirmModal
        visible={!!pendingDeleteId}
        message={t("confirmDeleteExpenditure")}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDeleteId(null)}
        busy={deleting}
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
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  title: { fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" },
  addBtn: {
    padding: "11px 18px",
    borderRadius: 12,
    border: "none",
    background: "var(--danger)",
    color: "white",
    fontWeight: 800,
    fontSize: 13,
  },
  summaryBox: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "var(--danger-light)",
    borderRadius: 16,
    padding: "16px 20px",
    marginBottom: 20,
  },
  emptyState: {
    background: "var(--surface)",
    border: "1px solid var(--border-muted)",
    borderRadius: 18,
    padding: 48,
    textAlign: "center",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: 14,
  },
};

export default ExpensesScreen;
