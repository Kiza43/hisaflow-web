import React, { useState, useEffect } from "react";
import { dataService } from "../services/dataService";
import { staffService } from "../services/staffService";
import StaffCard from "../components/StaffCard.jsx";
import StaffFormModal from "../components/StaffFormModal.jsx";
import ConfirmModal from "../components/ConfirmModal.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";

const StaffScreen = () => {
  const { t } = useLanguage();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadStaff = () =>
    dataService.getStaff().then((data) => {
      setStaff(data);
      setLoading(false);
    });

  useEffect(() => {
    loadStaff();
  }, []);

  const handleSave = async (data) => {
    const result = editingStaff
      ? await staffService.updateStaff(editingStaff.id, data)
      : await staffService.addStaff(data);
    if (result.success) {
      await loadStaff();
      setShowForm(false);
      setEditingStaff(null);
    }
    return result;
  };

  const confirmDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await staffService.deleteStaff(pendingDeleteId);
      await loadStaff();
      setPendingDeleteId(null);
    } catch (err) {
      console.error("Delete staff error:", err);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return null;

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <h1 style={styles.title}>{t("navStaff")}</h1>
        <button
          style={styles.addBtn}
          onClick={() => {
            setEditingStaff(null);
            setShowForm(true);
          }}
        >
          {t("addStaffButton")}
        </button>
      </div>

      {staff.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>
            {t("noStaffYet")}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {t("tapAddStaffHint")}
          </div>
        </div>
      ) : (
        <div style={styles.grid}>
          {staff.map((s) => (
            <StaffCard
              key={s.id}
              staff={s}
              onEdit={(member) => {
                setEditingStaff(member);
                setShowForm(true);
              }}
              onDelete={setPendingDeleteId}
            />
          ))}
        </div>
      )}

      <StaffFormModal
        visible={showForm}
        editingStaff={editingStaff}
        onSave={handleSave}
        onClose={() => {
          setShowForm(false);
          setEditingStaff(null);
        }}
      />

      <ConfirmModal
        visible={!!pendingDeleteId}
        message={t("confirmDeleteStaff")}
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
    marginBottom: 22,
  },
  title: { fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" },
  addBtn: {
    padding: "11px 18px",
    borderRadius: 12,
    border: "none",
    background: "var(--primary)",
    color: "white",
    fontWeight: 800,
    fontSize: 13,
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
    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
    gap: 14,
  },
};

export default StaffScreen;
