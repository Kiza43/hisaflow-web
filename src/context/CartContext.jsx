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

  const removeFromCart = useCallback((productId) => {
    setItems((prev) => prev.filter((item) => item.productId !== productId));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = items.reduce(
    (sum, item) => sum + item.quantity * item.sellingPrice,
    0,
  );

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        updateQuantity,
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
