import React, { useState, useEffect } from "react";
import { dataService } from "../services/dataService";
import ProductFormModal from "../components/ProductFormModal.jsx";
import ProductCard from "../components/ProductCard.jsx";
import SaleFormModal from "../components/SaleFormModal.jsx";
import CartBar from "../components/CartBar.jsx";
import CartModal from "../components/CartModal.jsx";
import AddStockModal from "../components/AddStockModal.jsx";
import RestockCartBar from "../components/RestockCartBar.jsx";
import RestockCartModal from "../components/RestockCartModal.jsx";
import ReceiptModal from "../components/ReceiptModal.jsx";
import ConfirmModal from "../components/ConfirmModal.jsx";
import PosterModal from "../components/PosterModal.jsx";
import NotifyPastBuyersModal from "../components/NotifyPastBuyersModal.jsx";
import BatchListModal from "../components/BatchListModal.jsx";
import { useCart } from "../context/CartContext.jsx";
import { useRestockCart } from "../context/RestockCartContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { restockService } from "../services/restockService";
import { supplierService } from "../services/supplierService";
import { batchService } from "../services/batchService";
import { activityLogService } from "../services/activityLogService";
import { sampleDataService } from "../services/sampleDataService";
import { filterService } from "../services/filterService";
import { searchService } from "../services/searchService";

const ProductsScreen = () => {
  const { t } = useLanguage();
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [settings, setSettings] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [showBestSellers, setShowBestSellers] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [brandFilter, setBrandFilter] = useState("all");
  const [stockStatusFilter, setStockStatusFilter] = useState("all"); // all | low-stock | out-of-stock
  const [sortBy, setSortBy] = useState("name"); // name | price | stock
  const [sortOrder, setSortOrder] = useState("asc");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [quickSellProductId, setQuickSellProductId] = useState(null);
  const [showCart, setShowCart] = useState(false);
  const [addStockProduct, setAddStockProduct] = useState(null);
  const [showRestockCart, setShowRestockCart] = useState(false);
  const [receiptSale, setReceiptSale] = useState(null);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [showPoster, setShowPoster] = useState(false);
  const [notifyBuyersProduct, setNotifyBuyersProduct] = useState(null);
  const [viewingBatchesProduct, setViewingBatchesProduct] = useState(null);
  const [loadingSample, setLoadingSample] = useState(false);
  const { addToCart } = useCart();
  const { addToRestockCart } = useRestockCart();

  const loadProducts = () =>
    dataService.getProducts().then((data) => {
      setProducts(data);
      setLoading(false);
    });

  useEffect(() => {
    loadProducts();
    dataService.getSales().then(setSales);
    dataService.getSettings().then(setSettings);
  }, []);

  const persist = async (updated) => {
    setProducts(updated);
    await dataService.saveProducts(updated);
  };

  const handleSaveProduct = async ({ product, supplierLink }) => {
    const exists = products.some((p) => p.id === product.id);
    // A brand new product with initial stock gets a real first batch,
    // same as restocking does — not just flat stock/buyingPrice fields
    // left for lazy migration to sort out on first touch.
    const finalProduct =
      !exists && product.stock > 0
        ? batchService.addBatch(
            { ...product, stock: 0, buyingPrice: 0, stockBatches: [] },
            product.stock,
            product.buyingPrice,
            undefined,
            supplierLink
              ? {
                  supplierId: supplierLink.supplierId,
                  supplierName: supplierLink.supplierName,
                  paymentMethod: supplierLink.paymentMethod,
                }
              : {},
          )
        : product;
    const updated = exists
      ? products.map((p) => (p.id === product.id ? finalProduct : p))
      : [...products, finalProduct];
    await persist(updated);

    if (supplierLink && supplierLink.isCredit) {
      await supplierService.recordSupply(
        supplierLink.supplierId,
        supplierLink.amount,
      );
    }

    setShowForm(false);
    setEditingProduct(null);
  };

  const handleDelete = (productId) => setPendingDeleteId(productId);

  const confirmDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      const removed = products.find((p) => p.id === pendingDeleteId);
      await persist(products.filter((p) => p.id !== pendingDeleteId));
      if (removed)
        await activityLogService.logActivity("deleted a product", removed.name);
      setPendingDeleteId(null);
    } catch (err) {
      console.error("Delete product error:", err);
    } finally {
      setDeleting(false);
    }
  };

  const handleAddSampleProducts = async () => {
    setLoadingSample(true);
    await sampleDataService.addSampleProducts();
    await loadProducts();
    await activityLogService.logActivity("added sample products", "");
    setLoadingSample(false);
  };

  const handleAddStockComplete = async ({
    productId,
    quantity,
    buyingPrice,
    supplierId,
    supplierName,
    paymentMethod,
  }) => {
    const result = await restockService.addStock({
      productId,
      quantity,
      buyingPrice,
      supplierId,
      supplierName,
      paymentMethod,
    });
    if (result.success) {
      await loadProducts();
      setAddStockProduct(null);
    }
    return result;
  };

  if (loading) return null;

  const categories = filterService.getCategories(products);
  const brands = filterService.getBrands(products);

  const quantityByProduct = {};
  sales.forEach((s) => {
    quantityByProduct[s.productId] =
      (quantityByProduct[s.productId] || 0) + (s.quantity || 0);
  });

  // Search first, then attribute filters, then either a best-sellers
  // ranking or the chosen sort — search narrows the working set before
  // anything else touches it, same order the phone app uses.
  let displayedProducts = searchService.searchProducts(products, searchQuery);
  displayedProducts = filterService.filterProducts(displayedProducts, {
    category: categoryFilter,
    brand: brandFilter,
    stockStatus: stockStatusFilter,
  });

  if (showBestSellers) {
    displayedProducts = displayedProducts
      .filter((p) => quantityByProduct[p.id] > 0)
      .sort(
        (a, b) =>
          (quantityByProduct[b.id] || 0) - (quantityByProduct[a.id] || 0),
      );
  } else {
    displayedProducts = filterService.filterProducts(displayedProducts, {
      sortBy,
      sortOrder,
    });
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <h1 style={styles.title}>{t("navProducts")}</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={styles.posterBtn} onClick={() => setShowPoster(true)}>
            {t("createPosterButton")}
          </button>
          <button
            style={styles.addBtn}
            onClick={() => {
              setEditingProduct(null);
              setShowForm(true);
            }}
          >
            {t("addProductButton")}
          </button>
        </div>
      </div>

      <input
        style={styles.searchInput}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder={t("searchProductsPlaceholder")}
      />

      <div style={styles.filterRow}>
        <button
          style={{
            ...styles.filterBtn,
            ...(showBestSellers ? styles.filterBtnActive : {}),
          }}
          onClick={() => setShowBestSellers(!showBestSellers)}
        >
          {t("popularProductsFilter")}
        </button>

        {categories.length > 0 && (
          <select
            style={styles.filterSelect}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">{t("allCategoriesOption")}</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}

        {brands.length > 0 && (
          <select
            style={styles.filterSelect}
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
          >
            <option value="all">{t("allBrandsOption")}</option>
            {brands.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        )}

        <select
          style={styles.filterSelect}
          value={stockStatusFilter}
          onChange={(e) => setStockStatusFilter(e.target.value)}
        >
          <option value="all">{t("allStockOption")}</option>
          <option value="low-stock">{t("lowStockOption")}</option>
          <option value="out-of-stock">{t("outOfStockOption")}</option>
        </select>

        {!showBestSellers && (
          <>
            <select
              style={styles.filterSelect}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="name">{t("sortByNameOption")}</option>
              <option value="price">{t("sortByPriceOption")}</option>
              <option value="stock">{t("sortByStockOption")}</option>
            </select>
            <button
              style={styles.sortOrderBtn}
              onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
              title={
                sortOrder === "asc" ? t("ascendingLabel") : t("descendingLabel")
              }
            >
              {sortOrder === "asc" ? "↑" : "↓"}
            </button>
          </>
        )}
      </div>

      {products.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>
            {t("noProductsYet")}
          </div>
          <div
            style={{
              fontSize: 13,
              color: "var(--text-muted)",
              marginBottom: 16,
            }}
          >
            {t("tapAddProductHint")}
          </div>
          <button
            style={styles.sampleDataBtn}
            disabled={loadingSample}
            onClick={handleAddSampleProducts}
          >
            {loadingSample ? t("completing") : t("addSampleProductsButton")}
          </button>
        </div>
      ) : displayedProducts.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>
            {showBestSellers
              ? t("noPopularProductsYet")
              : t("noMatchingProductsMessage")}
          </div>
        </div>
      ) : (
        <div style={styles.grid}>
          {displayedProducts.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              onEdit={(prod) => {
                setEditingProduct(prod);
                setShowForm(true);
              }}
              onDelete={handleDelete}
              onQuickSell={(prod) => setQuickSellProductId(prod.id)}
              onAddToCart={addToCart}
              onAddStock={(prod) => setAddStockProduct(prod)}
              onAddToRestockCart={addToRestockCart}
              onNotifyPastBuyers={setNotifyBuyersProduct}
              onViewBatches={setViewingBatchesProduct}
            />
          ))}
        </div>
      )}

      <ProductFormModal
        visible={showForm}
        editingProduct={editingProduct}
        onSave={handleSaveProduct}
        onClose={() => {
          setShowForm(false);
          setEditingProduct(null);
        }}
      />

      <SaleFormModal
        visible={!!quickSellProductId}
        products={products}
        preSelectedProductId={quickSellProductId}
        onCompleted={(saleData) => {
          loadProducts();
          setQuickSellProductId(null);
          setReceiptSale(saleData);
        }}
        onClose={() => setQuickSellProductId(null)}
      />

      <CartModal
        visible={showCart}
        onClose={() => setShowCart(false)}
        onCompleted={(saleData) => {
          setShowCart(false);
          loadProducts();
          setReceiptSale(saleData);
        }}
      />

      <AddStockModal
        visible={!!addStockProduct}
        product={addStockProduct}
        onSave={handleAddStockComplete}
        onClose={() => setAddStockProduct(null)}
      />

      <RestockCartModal
        visible={showRestockCart}
        onClose={() => setShowRestockCart(false)}
        onCompleted={() => {
          setShowRestockCart(false);
          loadProducts();
        }}
      />

      <div style={styles.floatingStack}>
        <CartBar onOpenCart={() => setShowCart(true)} />
        <RestockCartBar onOpenCart={() => setShowRestockCart(true)} />
      </div>

      <ReceiptModal
        visible={!!receiptSale}
        sale={receiptSale}
        settings={settings}
        onClose={() => setReceiptSale(null)}
      />

      <ConfirmModal
        visible={!!pendingDeleteId}
        message={t("confirmDeleteProduct")}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDeleteId(null)}
        busy={deleting}
      />

      <PosterModal visible={showPoster} onClose={() => setShowPoster(false)} />

      <NotifyPastBuyersModal
        visible={!!notifyBuyersProduct}
        product={notifyBuyersProduct}
        onClose={() => setNotifyBuyersProduct(null)}
      />

      <BatchListModal
        visible={!!viewingBatchesProduct}
        product={viewingBatchesProduct}
        onClose={() => setViewingBatchesProduct(null)}
      />
    </div>
  );
};

const styles = {
  floatingStack: {
    position: "fixed",
    left: 244,
    right: 28,
    bottom: 28,
    zIndex: 30,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    pointerEvents: "none",
  },
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
  posterBtn: {
    padding: "11px 18px",
    borderRadius: 12,
    border: "1.5px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text-secondary)",
    fontWeight: 700,
    fontSize: 13,
  },
  emptyState: {
    background: "var(--surface)",
    border: "1px solid var(--border-muted)",
    borderRadius: 18,
    padding: 48,
    textAlign: "center",
  },
  sampleDataBtn: {
    padding: "10px 18px",
    borderRadius: 12,
    borderWidth: "1.5px",
    borderStyle: "solid",
    borderColor: "var(--border)",
    background: "var(--surface)",
    color: "var(--text-secondary)",
    fontWeight: 700,
    fontSize: 12,
  },
  searchInput: {
    width: "100%",
    padding: "11px 14px",
    border: "1.5px solid var(--border)",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 500,
    marginBottom: 14,
    background: "var(--surface)",
    color: "var(--text-primary)",
  },
  filterRow: {
    display: "flex",
    gap: 8,
    marginBottom: 18,
    flexWrap: "wrap",
    alignItems: "center",
  },
  filterBtn: {
    padding: "8px 16px",
    borderRadius: 999,
    borderWidth: "1.5px",
    borderStyle: "solid",
    borderColor: "var(--border)",
    background: "var(--surface)",
    color: "var(--text-secondary)",
    fontWeight: 700,
    fontSize: 12,
  },
  filterBtnActive: {
    background: "var(--primary-light)",
    borderColor: "var(--primary)",
    color: "var(--primary-dark)",
  },
  filterSelect: {
    padding: "8px 12px",
    borderRadius: 10,
    border: "1.5px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text-secondary)",
    fontWeight: 600,
    fontSize: 12,
  },
  sortOrderBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    border: "1.5px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text-secondary)",
    fontWeight: 700,
    fontSize: 14,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
    gap: 16,
  },
};

export default ProductsScreen;
