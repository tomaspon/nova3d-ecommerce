import React, { createContext, useContext, useState } from 'react';

const StoreContext = createContext();

export function StoreProvider({ children }) {
  const [categories, setCategories] = useState(() => {
    const saved = localStorage.getItem('store_categories');
    return saved ? JSON.parse(saved) : ['Muebles', 'Iluminación', 'Decoración'];
  });
  
  const [products, setProducts] = useState(() => {
    const saved = localStorage.getItem('store_products');
    return saved ? JSON.parse(saved) : [];
  });

  // ── ESTADO DEL CARRITO ──
  const [cart, setCart] = useState(() => {
    const saved = localStorage.getItem('store_cart');
    return saved ? JSON.parse(saved) : [];
  });
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Guardar en localStorage cada vez que hay un cambio
  React.useEffect(() => {
    localStorage.setItem('store_products', JSON.stringify(products));
    localStorage.setItem('store_categories', JSON.stringify(categories));
    localStorage.setItem('store_cart', JSON.stringify(cart));
  }, [products, categories, cart]);

  // ── FUNCIONES DEL CARRITO ──
  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    setIsCartOpen(true); // Abre el panel automáticamente
  };

  const removeFromCart = (productId) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId, quantity) => {
    if (quantity < 1) return removeFromCart(productId);
    setCart(prev => prev.map(item => item.id === productId ? { ...item, quantity } : item));
  };

  const toggleCart = () => setIsCartOpen(!isCartOpen);

  // ── FUNCIONES CRUD DEL DASHBOARD ──

  const addCategory = (name) => {
    if (!categories.includes(name)) {
      setCategories([...categories, name]);
    }
  };

  const deleteCategory = (name) => {
    setCategories(categories.filter(cat => cat !== name));
  };

  const addProduct = (productData) => {
    const newProduct = {
      ...productData,
      id: `PROD-${Math.floor(1000 + Math.random() * 9000)}`, // Generador de IDs falso
      isActive: true,
      createdAt: new Date().toISOString()
    };
    setProducts([...products, newProduct]);
  };

  const updateProduct = (id, updatedData) => {
    setProducts(products.map(p => p.id === id ? { ...p, ...updatedData } : p));
  };

  const softDeleteProduct = (id) => {
    // Borrado lógico: lo oculta de la tienda, pero no rompe el historial de ventas
    setProducts(products.map(p => p.id === id ? { ...p, isActive: false } : p));
  };

  const restoreProduct = (id) => {
    setProducts(products.map(p => p.id === id ? { ...p, isActive: true } : p));
  };

  const applyDiscount = (id, discountPercent) => {
    setProducts(products.map(p => p.id === id ? { ...p, discount: discountPercent } : p));
  };

  return (
    <StoreContext.Provider value={{
      categories,
      products,
      cart,
      isCartOpen,
      toggleCart,
      addToCart,
      removeFromCart,
      updateQuantity,
      addCategory,
      deleteCategory,
      addProduct,
      updateProduct,
      softDeleteProduct,
      restoreProduct,
      applyDiscount
    }}>
      {children}
    </StoreContext.Provider>
  );
}

export const useStore = () => useContext(StoreContext);
