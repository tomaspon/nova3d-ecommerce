import React, { createContext, useContext, useState } from 'react';
import { supabase, isSupabaseConfigured, PRODUCT_IMAGES_BUCKET } from '../lib/supabase';

const StoreContext = createContext();

// Conversión entre las columnas de la base (snake_case) y el modelo de la app
const fromRow = (row) => ({
  id: row.id,
  name: row.name,
  description: row.description,
  price: Number(row.price),
  discount: row.discount,
  category: row.category,
  stock: row.stock,
  imageUrl: row.image_url,
  isActive: row.is_active,
  createdAt: row.created_at
});

const toRow = (data) => ({
  name: data.name,
  description: data.description,
  price: data.price,
  discount: data.discount,
  category: data.category,
  stock: data.stock,
  image_url: data.imageUrl
});

const readAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onloadend = () => resolve(reader.result);
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(file);
});

export function StoreProvider({ children }) {
  // Sin Supabase configurado, productos y categorías viven en localStorage
  const [categories, setCategories] = useState(() => {
    if (isSupabaseConfigured) return [];
    const saved = localStorage.getItem('store_categories');
    return saved ? JSON.parse(saved) : ['Muebles', 'Iluminación', 'Decoración'];
  });

  const [products, setProducts] = useState(() => {
    if (isSupabaseConfigured) return [];
    const saved = localStorage.getItem('store_products');
    return saved ? JSON.parse(saved) : [];
  });

  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);
  const [loadError, setLoadError] = useState(null);

  // ── SESIÓN DEL ADMINISTRADOR ──
  // session: undefined = todavía verificando, null = sin sesión
  const [session, setSession] = useState(isSupabaseConfigured ? undefined : null);
  const isSessionKnown = session !== undefined;
  const userId = session?.user?.id ?? null;
  // Resultado de la última verificación de permisos y para qué usuario se hizo
  const [adminCheck, setAdminCheck] = useState({ userId: undefined, isAdmin: false });
  const isAuthReady = !isSupabaseConfigured || (isSessionKnown && adminCheck.userId === userId);
  const isAdmin = !isSupabaseConfigured || (isAuthReady && adminCheck.isAdmin);

  // ── ESTADO DEL CARRITO ──
  const [cart, setCart] = useState(() => {
    const saved = localStorage.getItem('store_cart');
    return saved ? JSON.parse(saved) : [];
  });
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Guardar en localStorage cada vez que hay un cambio
  React.useEffect(() => {
    localStorage.setItem('store_cart', JSON.stringify(cart));
    if (!isSupabaseConfigured) {
      localStorage.setItem('store_products', JSON.stringify(products));
      localStorage.setItem('store_categories', JSON.stringify(categories));
    }
  }, [products, categories, cart]);

  // Seguir la sesión de Supabase
  React.useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => setSession(newSession));
    return () => listener.subscription.unsubscribe();
  }, []);

  // Cargar el catálogo. Se repite al cambiar de usuario porque los admins también ven los productos ocultos
  React.useEffect(() => {
    if (!isSupabaseConfigured || !isSessionKnown) return;
    let cancelled = false;

    const load = async () => {
      let admin = false;
      if (userId) {
        const { data } = await supabase.rpc('is_admin');
        admin = data === true;
      }
      const [productsRes, categoriesRes] = await Promise.all([
        supabase.from('products').select('*').order('created_at'),
        supabase.from('categories').select('name').order('created_at')
      ]);
      if (cancelled) return;

      setAdminCheck({ userId, isAdmin: admin });
      const error = productsRes.error || categoriesRes.error;
      if (error) {
        setLoadError(error.message);
      } else {
        setLoadError(null);
        setProducts(productsRes.data.map(fromRow));
        setCategories(categoriesRes.data.map(c => c.name));
      }
      setIsLoading(false);
    };

    load();
    return () => { cancelled = true; };
  }, [isSessionKnown, userId]);

  const signIn = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

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
  // Son async y lanzan un error si la base rechaza el cambio

  const addCategory = async (name) => {
    if (categories.includes(name)) return;
    if (isSupabaseConfigured) {
      const { error } = await supabase.from('categories').insert({ name });
      if (error) throw error;
    }
    setCategories(prev => [...prev, name]);
  };

  const deleteCategory = async (name) => {
    if (isSupabaseConfigured) {
      const { error } = await supabase.from('categories').delete().eq('name', name);
      if (error) throw error;
    }
    setCategories(prev => prev.filter(cat => cat !== name));
  };

  // Sube la imagen y devuelve la URL a guardar en el producto
  const uploadImage = async (file) => {
    if (!isSupabaseConfigured) return readAsDataUrl(file); // Base64 para LocalStorage

    const extension = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : 'jpg';
    const path = `${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).upload(path, file);
    if (error) throw error;
    return supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(path).data.publicUrl;
  };

  const addProduct = async (productData) => {
    let newProduct;
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('products').insert(toRow(productData)).select().single();
      if (error) throw error;
      newProduct = fromRow(data);
    } else {
      newProduct = {
        ...productData,
        id: `PROD-${Math.floor(1000 + Math.random() * 9000)}`, // Generador de IDs falso
        isActive: true,
        createdAt: new Date().toISOString()
      };
    }
    setProducts(prev => [...prev, newProduct]);
  };

  // rowChanges usa los nombres de columna de la base; localChanges, los del modelo de la app
  const patchProduct = async (id, rowChanges, localChanges) => {
    let applied = localChanges;
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('products').update(rowChanges).eq('id', id).select().single();
      if (error) throw error;
      applied = fromRow(data);
    }
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...applied } : p));
  };

  const updateProduct = (id, updatedData) => patchProduct(id, toRow(updatedData), updatedData);

  // Borrado lógico: lo oculta de la tienda, pero no rompe el historial de ventas
  const softDeleteProduct = (id) => patchProduct(id, { is_active: false }, { isActive: false });

  const restoreProduct = (id) => patchProduct(id, { is_active: true }, { isActive: true });

  const applyDiscount = (id, discountPercent) => patchProduct(id, { discount: discountPercent }, { discount: discountPercent });

  return (
    <StoreContext.Provider value={{
      categories,
      products,
      isLoading,
      loadError,
      isSupabaseConfigured,
      session,
      isAdmin,
      isAuthReady,
      signIn,
      signOut,
      cart,
      isCartOpen,
      toggleCart,
      addToCart,
      removeFromCart,
      updateQuantity,
      addCategory,
      deleteCategory,
      uploadImage,
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
