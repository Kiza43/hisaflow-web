import React, { useState, useEffect, useMemo } from "react";
import { dataService } from "../services/dataService";
import SaleFormModal from "../components/SaleFormModal.jsx";
import SaleCard from "../components/SaleCard.jsx";
import ReceiptModal from "../components/ReceiptModal.jsx";
import EditSaleModal from "../components/EditSaleModal.jsx";
import ConfirmModal from "../components/ConfirmModal.jsx";
import Pagination from "../components/Pagination.jsx";
import { salesService } from "../services/salesService";
import { useLanguage } from "../context/LanguageContext.jsx";

const SalesScreen = () => {
  const { t } = useLanguage();
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [receiptSale, setReceiptSale] = useState(null);
  const [editingSale, setEditingSale] = useState(null);
  const [pendingDeleteSale, setPendingDeleteSale] = useState(null);

  const loadAll = async () => {
    const [p, s] = await Promise.all([
      dataService.getProducts(),
      dataService.getSales(),
    ]);
    setProducts(p);
    setSales(s);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
    dataService.getSettings().then(setSettings);
  }, []);

  const confirmDeleteSale = async () => {
    const result = await salesService.deleteSale(pendingDeleteSale.id);
    if (result.success) await loadAll();
    setPendingDeleteSale(null);
  };

  const recentSales = useMemo(
    () => sales.slice().sort((a, b) => new Date(b.date) - new Date(a.date)),
    [sales],
  );

  const PAGE_SIZE = 24;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(recentSales.length / PAGE_SIZE));
  const pagedSales = useMemo(
    () =>
      recentSales.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [recentSales, currentPage],
  );

  // Safety clamp only — unlike ProductsScreen there's no search/filter
  // state here to reset on, since this screen has none. A sale being
  // deleted while on a later page is the only way the current page could
  // become invalid.
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  if (loading) return null;

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <h1 style={styles.title}>{t("navSales")}</h1>
        <button style={styles.addBtn} onClick={() => setShowForm(true)}>
          {t("sellProductButton")}
        </button>
      </div>

      {recentSales.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>
            {t("noSalesYet")}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {products.length === 0
              ? t("addProductsFirstHint")
              : t("tapSellProductHint")}
          </div>
        </div>
      ) : (
        <>
          <div style={styles.grid}>
            {pagedSales.map((s) => (
              <SaleCard
                key={s.id}
                sale={s}
                onEdit={setEditingSale}
                onDelete={setPendingDeleteSale}
              />
            ))}
          </div>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </>
      )}

      <SaleFormModal
        visible={showForm}
        products={products}
        onCompleted={(saleData) => {
          loadAll();
          setShowForm(false);
          setReceiptSale(saleData);
        }}
        onClose={() => setShowForm(false)}
      />

      <ReceiptModal
        visible={!!receiptSale}
        sale={receiptSale}
        settings={settings}
        onClose={() => setReceiptSale(null)}
      />

      <EditSaleModal
        visible={!!editingSale}
        sale={editingSale}
        onSaved={() => {
          loadAll();
          setEditingSale(null);
        }}
        onClose={() => setEditingSale(null)}
      />

      <ConfirmModal
        visible={!!pendingDeleteSale}
        message={t("confirmDeleteSaleMessage")}
        onConfirm={confirmDeleteSale}
        onCancel={() => setPendingDeleteSale(null)}
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
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: 14,
  },
};

export default SalesScreen;
