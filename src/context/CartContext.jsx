import React, { createContext, useContext, useState, useCallback } from "react";

const CartContext = createContext(null);

export const CartProvider = ({ children }) => {
  const [items, setItems] = useState([]); // { productId, productName, unit, quantity, sellingPrice, buyingPrice, availableStock }

  const addToCart = useCallback((product) => {
    setItems((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        // Cap at available stock rather than letting the cart quietly
        // request more than exists — same guard the phone app's cart has.
        const nextQty = Math.min(existing.quantity + 1, product.stock || 0);
        return prev.map((item) =>
          item.productId === product.id ? { ...item, quantity: nextQty } : item,
        );
      }
      if ((product.stock || 0) <= 0) return prev; // nothing to add
      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          unit: product.unit,
          quantity: 1,
          sellingPrice: product.sellingPrice,
          buyingPrice: product.buyingPrice,
          availableStock: product.stock,
          discount: 0,
        },
      ];
    });
  }, []);

  const updateQuantity = useCallback((productId, quantity) => {
    setItems((prev) =>
      prev.map((item) =>
        item.productId === productId
          ? {
              ...item,
              quantity: Math.max(1, Math.min(quantity, item.availableStock)),
            }
          : item,
      ),
    );
  }, []);

  // A discount is per line item, same reasoning as the single-product
  // sale flow — a shop owner might discount one product in a cart
  // without discounting everything in it. Not clamped here to the
  // item's own total, since the quantity or price might still change
  // after the discount is entered; the real validation happens once at
  // checkout, against final values.
  const updateDiscount = useCallback((productId, discount) => {
    setItems((prev) =>
      prev.map((item) =>
        item.productId === productId
          ? { ...item, discount: Math.max(0, discount) }
          : item,
      ),
    );
  }, []);

  const removeFromCart = useCallback((productId) => {
    setItems((prev) => prev.filter((item) => item.productId !== productId));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = items.reduce(
    (sum, item) =>
      sum + item.quantity * item.sellingPrice - (item.discount || 0),
    0,
  );

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        updateQuantity,
        updateDiscount,
        removeFromCart,
        clearCart,
        totalItems,
        totalAmount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
