import React, { useState, useEffect } from "react";
import { dataService } from "../services/dataService";
import { salesService } from "../services/salesService";
import ProductFormModal from "../components/ProductFormModal.jsx";
import ProductCard from "../components/ProductCard.jsx";
import SaleFormModal from "../components/SaleFormModal.jsx";
import CartBar from "../components/CartBar.jsx";
import CartModal from "../components/CartModal.jsx";
import AddStockModal from "../components/AddStockModal.jsx";
import RestockCartBar from "../components/RestockCartBar.jsx";
import RestockCartModal from "../components/RestockCartModal.jsx";
import { useCart } from "../context/CartContext.jsx";
import { useRestockCart } from "../context/RestockCartContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { restockService } from "../services/restockService";

const ProductsScreen = () => {
  const { t } = useLanguage();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [quickSellProductId, setQuickSellProductId] = useState(null);
  const [showCart, setShowCart] = useState(false);
  const [addStockProduct, setAddStockProduct] = useState(null);
  const [showRestockCart, setShowRestockCart] = useState(false);
  const { addToCart } = useCart();
  const { addToRestockCart } = useRestockCart();

  const loadProducts = () =>
    dataService.getProducts().then((data) => {
      setProducts(data);
      setLoading(false);
    });

  useEffect(() => {
    loadProducts();
  }, []);

  const persist = async (updated) => {
    setProducts(updated);
    await dataService.saveProducts(updated);
  };

  const handleSaveProduct = async (product) => {
    const exists = products.some((p) => p.id === product.id);
    const updated = exists
      ? products.map((p) => (p.id === product.id ? product : p))
      : [...products, product];
    await persist(updated);
    setShowForm(false);
    setEditingProduct(null);
  };

  const handleDelete = async (productId) => {
    if (!window.confirm(t("confirmDeleteProduct"))) return;
    await persist(products.filter((p) => p.id !== productId));
  };

  const handleQuickSellComplete = async ({
    productId,
    quantity,
    sellingPrice,
  }) => {
    const result = await salesService.completeSale({
      productId,
      quantity,
      sellingPrice,
    });
    if (result.success) {
      await loadProducts();
      setQuickSellProductId(null);
    }
    return result;
  };

  const handleAddStockComplete = async ({
    productId,
    quantity,
    buyingPrice,
  }) => {
    const result = await restockService.addStock({
      productId,
      quantity,
      buyingPrice,
    });
    if (result.success) {
      await loadProducts();
      setAddStockProduct(null);
    }
    return result;
  };

  if (loading) return null;

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <h1 style={styles.title}>{t("navProducts")}</h1>
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

      {products.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>
            {t("noProductsYet")}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {t("tapAddProductHint")}
          </div>
        </div>
      ) : (
        <div style={styles.grid}>
          {products
            .slice()
            .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
            .map((p) => (
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
        onSave={handleQuickSellComplete}
        onClose={() => setQuickSellProductId(null)}
      />

      <CartBar onOpenCart={() => setShowCart(true)} />

      <CartModal
        visible={showCart}
        onClose={() => setShowCart(false)}
        onCompleted={() => {
          setShowCart(false);
          loadProducts();
        }}
      />

      <AddStockModal
        visible={!!addStockProduct}
        product={addStockProduct}
        onSave={handleAddStockComplete}
        onClose={() => setAddStockProduct(null)}
      />

      <RestockCartBar onOpenCart={() => setShowRestockCart(true)} />

      <RestockCartModal
        visible={showRestockCart}
        onClose={() => setShowRestockCart(false)}
        onCompleted={() => {
          setShowRestockCart(false);
          loadProducts();
        }}
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

export default ProductsScreen;
