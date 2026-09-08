import React, { useState, useEffect, useRef } from "react";
import { dataService } from "../services/dataService";
import SupplierPicker from "./SupplierPicker.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { blockInvalidNumberKeys } from "../utils/numberInput";

// Same starter set the phone app ships with — covers most small-shop
// inventory without typing anything, while "Other" still allows a fully
// custom unit for whatever doesn't fit.
const PRESET_UNITS = [
  { value: "pc", label: "Pc" },
  { value: "kg", label: "Kilo (kg)" },
  { value: "lita", label: "Lita (L)" },
  { value: "mita", label: "Mita (m)" },
  { value: "kifurushi", label: "Kifurushi" },
  { value: "dazani", label: "Dazani" },
  { value: "sanduku", label: "Sanduku" },
];

const PAYMENT_METHODS = [
  { value: "cash", labelKey: "cashMethodOption" },
  { value: "bank_transfer", labelKey: "bankTransferMethodOption" },
  { value: "lipa_namba", labelKey: "lipaNambaMethodOption" },
];

const emptyForm = {
  name: "",
  category: "",
  brand: "",
  unit: "pc",
  stock: "",
  buyingPrice: "",
  sellingPrice: "",
  imageUri: null,
  expiryDate: "",
  supplierId: "",
  supplierPaymentStatus: "paid",
  supplierPaymentMethod: "cash",
};

// Same 3-step structure the phone app uses (basics / pricing / stock),
// carried over deliberately rather than redesigned — one long scrolling
// form was the actual complaint, and this is the proven fix for it,
// not a fresh guess at what "better" looks like. Desktop's extra brand
// field lives in step 1 alongside category, the closest match to where
// the phone app groups it conceptually.
const STEPS = ["basics", "pricing", "stock"];

const ProductFormModal = ({ visible, editingProduct, onSave, onClose }) => {
  const { t } = useLanguage();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(emptyForm);
  const [showCustomUnit, setShowCustomUnit] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (visible) dataService.getSuppliers().then(setSuppliers);
  }, [visible]);

  useEffect(() => {
    if (editingProduct) {
      setForm({
        name: editingProduct.name || "",
        category: editingProduct.category || "",
        brand: editingProduct.brand || "",
        unit: editingProduct.unit || "pc",
        stock: String(editingProduct.stock ?? ""),
        buyingPrice: String(Math.round(editingProduct.buyingPrice ?? 0)),
        sellingPrice: String(editingProduct.sellingPrice ?? ""),
        imageUri: editingProduct.imageUri || null,
        expiryDate: editingProduct.expiryDate
          ? editingProduct.expiryDate.slice(0, 10)
          : "",
        supplierId: "",
        supplierPaymentStatus: "paid",
        supplierPaymentMethod: "cash",
      });
      setShowCustomUnit(
        !PRESET_UNITS.some((u) => u.value === (editingProduct.unit || "pc")),
      );
    } else {
      setForm(emptyForm);
      setShowCustomUnit(false);
    }
    setStep(0);
    setError("");
    setSaving(false);
  }, [editingProduct, visible]);

  if (!visible) return null;

  const handlePickImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () =>
      setForm((prev) => ({ ...prev, imageUri: reader.result }));
    reader.readAsDataURL(file);
  };

  // Same validation rules as before, just checked per-step rather than
  // all at once at the very end — a name typo on step 1 gets caught
  // immediately instead of after filling in pricing and stock too.
  const validateStep = (stepIndex) => {
    setError("");
    if (stepIndex === 0) {
      if (!form.name.trim()) {
        setError(t("enterProductNameError"));
        return false;
      }
      return true;
    }
    if (stepIndex === 1) {
      const sellingPrice = parseFloat(form.sellingPrice) || 0;
      if (sellingPrice <= 0) {
        setError(t("enterValidSellingPriceError"));
        return false;
      }
      return true;
    }
    return true;
  };

  const goNext = () => {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const goBack = () => {
    setError("");
    setStep((s) => Math.max(s - 1, 0));
  };

  const handleSave = async () => {
    if (saving) return; // already in flight — a second click here shouldn't create a duplicate product/batch
    if (!validateStep(0) || !validateStep(1)) return;

    const sellingPrice = parseFloat(form.sellingPrice) || 0;
    const buyingPrice = parseFloat(form.buyingPrice) || 0;
    const stock = parseInt(form.stock, 10) || 0;

    setSaving(true);
    try {
      await onSave({
        product: {
          id: editingProduct
            ? editingProduct.id
            : `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          name: form.name.trim(),
          category: form.category.trim(),
          brand: form.brand.trim(),
          unit: form.unit,
          stock,
          buyingPrice,
          sellingPrice,
          imageUri: form.imageUri || null,
          expiryDate: form.expiryDate || null,
        },
        // How the initial stock was actually paid for — captured
        // regardless of whether a supplier was chosen, since "I paid
        // cash for this" is true for a one-off purchase too, not just
        // stock bought from a tracked supplier.
        stockPaymentMethod:
          !editingProduct && stock > 0 ? form.supplierPaymentMethod : null,
        // Only meaningful for genuinely new stock entering the shop — editing
        // an existing product's price shouldn't retroactively create a new
        // supplier debt for stock that's already been there.
        supplierLink:
          !editingProduct && form.supplierId && stock > 0
            ? {
                supplierId: form.supplierId,
                supplierName:
                  suppliers.find((s) => s.id === form.supplierId)?.name || "",
                amount: stock * buyingPrice,
                isCredit: form.supplierPaymentStatus === "credit",
                paymentMethod:
                  form.supplierPaymentStatus === "paid"
                    ? form.supplierPaymentMethod
                    : "",
              }
            : null,
      });
    } catch (err) {
      console.error("Product save error:", err);
      setError(t("unexpectedErrorTryAgain"));
    } finally {
      setSaving(false);
    }
  };

  const isLastStep = step === STEPS.length - 1;
  const stepLabel = (i) => {
    if (i === 0) return t("stepBasics");
    if (i === 1) return t("stepPricing");
    return t("stepStock");
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 style={styles.title}>
          {editingProduct ? t("editProductTitle") : t("addProductTitle")}
        </h2>

        <div style={styles.stepRow}>
          {STEPS.map((key, i) => (
            <React.Fragment key={key}>
              <div
                style={{
                  ...styles.stepDot,
                  ...(i <= step ? styles.stepDotActive : {}),
                }}
              >
                {i < step ? "✓" : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  style={{
                    ...styles.stepLine,
                    ...(i < step ? styles.stepLineActive : {}),
                  }}
                />
              )}
            </React.Fragment>
          ))}
        </div>
        <div style={styles.stepIndicatorText}>
          {t("stepIndicator", {
            step: step + 1,
            total: STEPS.length,
            label: stepLabel(step),
          })}
        </div>

        {error && <div style={styles.error}>{error}</div>}

        {step === 0 && (
          <>
            <div style={styles.photoRow}>
              <div
                style={styles.photoPreview}
                onClick={() => fileInputRef.current.click()}
              >
                {form.imageUri && (
                  <img src={form.imageUri} alt="" style={styles.photoImg} />
                )}
              </div>
              <div>
                <button
                  style={styles.photoBtn}
                  onClick={() => fileInputRef.current.click()}
                >
                  {form.imageUri ? t("changePhoto") : t("addPhoto")}
                </button>
                {form.imageUri && (
                  <button
                    style={styles.removePhotoBtn}
                    onClick={() =>
                      setForm((prev) => ({ ...prev, imageUri: null }))
                    }
                  >
                    {t("removePhoto")}
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePickImage}
                style={{ display: "none" }}
              />
            </div>

            <label style={styles.label}>{t("productNameLabel")}</label>
            <input
              style={styles.input}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t("productNamePlaceholder")}
              autoFocus
            />

            <div style={styles.row}>
              <div style={{ flex: 1 }}>
                <label style={styles.label}>{t("categoryLabel")}</label>
                <input
                  style={styles.input}
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
                  placeholder={t("categoryPlaceholder")}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={styles.label}>{t("brandLabel")}</label>
                <input
                  style={styles.input}
                  value={form.brand}
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
                  placeholder={t("brandPlaceholder")}
                />
              </div>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div style={styles.row}>
              <div style={{ flex: 1 }}>
                <label style={styles.label}>{t("buyingPriceLabel")}</label>
                <input
                  style={styles.input}
                  type="number"
                  value={form.buyingPrice}
                  onChange={(e) =>
                    setForm({ ...form, buyingPrice: e.target.value })
                  }
                  onKeyDown={blockInvalidNumberKeys}
                  placeholder="0"
                  autoFocus
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={styles.label}>{t("sellingPriceLabel")}</label>
                <input
                  style={styles.input}
                  type="number"
                  value={form.sellingPrice}
                  onChange={(e) =>
                    setForm({ ...form, sellingPrice: e.target.value })
                  }
                  onKeyDown={blockInvalidNumberKeys}
                  placeholder="0"
                />
              </div>
            </div>

            <label style={styles.label}>{t("unitLabel")}</label>
            <div style={styles.unitChipRow}>
              {PRESET_UNITS.map((u) => (
                <button
                  key={u.value}
                  type="button"
                  style={{
                    ...styles.unitChip,
                    ...(form.unit === u.value ? styles.unitChipActive : {}),
                  }}
                  onClick={() => {
                    setForm({ ...form, unit: u.value });
                    setShowCustomUnit(false);
                  }}
                >
                  {u.label}
                </button>
              ))}
              <button
                type="button"
                style={{
                  ...styles.unitChip,
                  ...(showCustomUnit ? styles.unitChipActive : {}),
                }}
                onClick={() => setShowCustomUnit(true)}
              >
                {t("otherOption")}
              </button>
            </div>
            {showCustomUnit && (
              <input
                style={{ ...styles.input, marginTop: 8 }}
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                placeholder={t("customUnitPlaceholder")}
                autoFocus
              />
            )}
          </>
        )}

        {step === 2 && (
          <>
            <label style={styles.label}>{t("stockLabel")}</label>
            <input
              style={{
                ...styles.input,
                ...(editingProduct ? styles.inputDisabled : {}),
              }}
              type="number"
              value={form.stock}
              onChange={(e) => setForm({ ...form, stock: e.target.value })}
              onKeyDown={blockInvalidNumberKeys}
              placeholder="0"
              disabled={!!editingProduct}
              autoFocus={!editingProduct}
            />
            {editingProduct && (
              <div style={styles.stockLockedHint}>{t("stockLockedHint")}</div>
            )}

            <label style={styles.label}>{t("expiryDateLabel")}</label>
            <input
              style={styles.input}
              type="date"
              value={form.expiryDate}
              onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
            />

            {!editingProduct && (
              <>
                <label style={styles.label}>{t("supplierOptionalLabel")}</label>
                <SupplierPicker
                  suppliers={suppliers}
                  selectedSupplierId={form.supplierId || null}
                  onSelect={(id) => setForm({ ...form, supplierId: id || "" })}
                  onSupplierAdded={(newSupplier) => {
                    setSuppliers((prev) => [...prev, newSupplier]);
                    setForm({ ...form, supplierId: newSupplier.id });
                  }}
                />

                {form.supplierId && (
                  <div style={styles.paymentToggleRow}>
                    <button
                      style={{
                        ...styles.paymentToggle,
                        ...(form.supplierPaymentStatus === "paid"
                          ? styles.paymentToggleActive
                          : {}),
                      }}
                      onClick={() =>
                        setForm({ ...form, supplierPaymentStatus: "paid" })
                      }
                    >
                      {t("paidNowOption")}
                    </button>
                    <button
                      style={{
                        ...styles.paymentToggle,
                        ...(form.supplierPaymentStatus === "credit"
                          ? styles.paymentToggleActiveCredit
                          : {}),
                      }}
                      onClick={() =>
                        setForm({ ...form, supplierPaymentStatus: "credit" })
                      }
                    >
                      {t("oweSupplierOption")}
                    </button>
                  </div>
                )}

                {/* Recording how stock was paid for doesn't require a
                    supplier first — "owe supplier" needs someone to owe,
                    but "I paid cash for this" is true whether or not a
                    formal supplier record exists for a one-off purchase. */}
                {(!form.supplierId ||
                  form.supplierPaymentStatus === "paid") && (
                  <>
                    <label style={styles.label}>
                      {t("paymentMethodLabel")}
                    </label>
                    <div style={styles.methodRow}>
                      {PAYMENT_METHODS.map((m) => (
                        <button
                          key={m.value}
                          style={{
                            ...styles.methodChip,
                            ...(form.supplierPaymentMethod === m.value
                              ? styles.methodChipActive
                              : {}),
                          }}
                          onClick={() =>
                            setForm({ ...form, supplierPaymentMethod: m.value })
                          }
                        >
                          {t(m.labelKey)}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}

        <div style={styles.actions}>
          <button
            style={styles.cancelBtn}
            onClick={step === 0 ? onClose : goBack}
          >
            {step === 0 ? t("cancelButton") : t("backButton")}
          </button>
          <button
            style={styles.saveBtn}
            disabled={saving}
            onClick={isLastStep ? handleSave : goNext}
          >
            {saving
              ? t("completing")
              : isLastStep
                ? t("saveButton")
                : t("continueButton")}
          </button>
        </div>
      </div>
    </div>
  );
};

const styles = {
  unitChipRow: { display: "flex", flexWrap: "wrap", gap: 5 },
  unitChip: {
    padding: "7px 10px",
    borderRadius: 999,
    borderWidth: "1.5px",
    borderStyle: "solid",
    borderColor: "var(--border)",
    background: "var(--surface)",
    color: "var(--text-secondary)",
    fontWeight: 600,
    fontSize: 11,
  },
  unitChipActive: {
    background: "var(--primary)",
    borderColor: "var(--primary)",
    color: "white",
  },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(41,37,34,0.4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
  },
  modal: {
    width: 420,
    background: "var(--surface)",
    borderRadius: 20,
    padding: 28,
    maxHeight: "85vh",
    overflow: "auto",
  },
  title: { fontSize: 18, fontWeight: 800, marginBottom: 16 },
  stepRow: { display: "flex", alignItems: "center", marginBottom: 8 },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 999,
    background: "var(--border-muted)",
    color: "var(--text-muted)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 800,
    flexShrink: 0,
  },
  stepDotActive: { background: "var(--primary)", color: "white" },
  stepLine: {
    flex: 1,
    height: 2,
    background: "var(--border-muted)",
    margin: "0 4px",
  },
  stepLineActive: { background: "var(--primary)" },
  stepIndicatorText: {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--text-muted)",
    textAlign: "center",
    marginBottom: 18,
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
  photoRow: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    marginBottom: 18,
  },
  photoPreview: {
    width: 56,
    height: 56,
    borderRadius: 14,
    background: "var(--bg)",
    border: "1.5px dashed var(--border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    overflow: "hidden",
    flexShrink: 0,
  },
  photoImg: { width: "100%", height: "100%", objectFit: "cover" },
  photoBtn: {
    display: "block",
    padding: "7px 12px",
    borderRadius: 10,
    border: "1.5px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text-secondary)",
    fontWeight: 700,
    fontSize: 12,
    marginBottom: 6,
  },
  removePhotoBtn: {
    display: "block",
    padding: "5px 12px",
    border: "none",
    background: "none",
    color: "var(--danger)",
    fontWeight: 700,
    fontSize: 11,
  },
  label: {
    display: "block",
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 6,
    color: "var(--text-primary)",
  },
  input: {
    width: "100%",
    padding: "11px 13px",
    border: "1.5px solid var(--border)",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 14,
    background: "var(--bg)",
    color: "var(--text-primary)",
  },
  row: { display: "flex", gap: 12 },
  inputDisabled: {
    background: "var(--border-muted)",
    color: "var(--text-muted)",
    cursor: "not-allowed",
  },
  stockLockedHint: {
    fontSize: 10,
    color: "var(--text-muted)",
    marginTop: -10,
    marginBottom: 10,
  },
  paymentToggleRow: {
    display: "flex",
    gap: 8,
    marginBottom: 14,
    marginTop: -6,
  },
  paymentToggle: {
    flex: 1,
    padding: "9px 0",
    borderRadius: 10,
    borderWidth: "1.5px",
    borderStyle: "solid",
    borderColor: "var(--border)",
    background: "var(--surface)",
    color: "var(--text-secondary)",
    fontWeight: 700,
    fontSize: 12,
  },
  paymentToggleActive: {
    background: "var(--success-light)",
    borderColor: "var(--success)",
    color: "var(--success)",
  },
  paymentToggleActiveCredit: {
    background: "var(--danger-light)",
    borderColor: "var(--danger)",
    color: "var(--danger)",
  },
  methodRow: { display: "flex", gap: 6, marginTop: 8 },
  methodChip: {
    flex: 1,
    padding: "8px 0",
    borderRadius: 10,
    borderWidth: "1.5px",
    borderStyle: "solid",
    borderColor: "var(--border)",
    background: "var(--surface)",
    color: "var(--text-secondary)",
    fontWeight: 600,
    fontSize: 11,
  },
  methodChipActive: {
    background: "var(--primary-light)",
    borderColor: "var(--primary)",
    color: "var(--primary-dark)",
  },
  actions: { display: "flex", gap: 10, marginTop: 6 },
  cancelBtn: {
    flex: 1,
    padding: 13,
    borderRadius: 12,
    border: "1.5px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text-secondary)",
    fontWeight: 700,
    fontSize: 14,
  },
  saveBtn: {
    flex: 1,
    padding: 13,
    borderRadius: 12,
    border: "none",
    background: "var(--primary)",
    color: "white",
    fontWeight: 800,
    fontSize: 14,
  },
};

export default ProductFormModal;
