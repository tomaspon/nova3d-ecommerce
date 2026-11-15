import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { fetchReservedMap, releaseExpiredReservations } from '../reservations';
import { mapProduct } from '../productMapping';
import { ORDER_STATUS, isAwaitingPayment } from '../orderStatus';
import { resolveStore, DEFAULT_STORE_ID } from '../currentStore';
import { applyBranding, normalizeBranding } from '../branding';
import { DEMO_PRODUCTS, DEMO_SETTINGS, DEMO_CHECKOUT_MESSAGE } from '../demoStore';

const DEFAULT_CATEGORIES = ['Tecnología', 'Indumentaria', 'Accesorios', 'Hogar'];

// Carrito y categorías se guardan por tienda: en un mismo navegador pueden convivir varias.
// La tienda original usaba claves sin tienda; se leen como respaldo para no perder carritos.
function loadSaved(key, storeId, fallback) {
  try {
    const saved = localStorage.getItem(`${key}_${storeId}`)
      ?? (storeId === DEFAULT_STORE_ID ? localStorage.getItem(key) : null);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

const StoreContext = createContext();

export function StoreProvider({ children }) {
  const hasLoadedProductsRef = useRef(false);

  // TIENDA ACTUAL (según el dominio). Todo lo demás se carga recién cuando se conoce.
  const [store, setStore] = useState(null);
  const storeId = store?.id;

  // ESTADO BASE
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // CONFIGURACIONES Y CAMPAÑAS
  const [storeSettings, setStoreSettings] = useState({
    campaign_active: false,
    campaign_name: 'Ofertas Especiales',
    campaign_image_url: '',
    store_name: '',
    store_email: '',
    shipping_cost: 0,
    // Cobro por transferencia y contacto de la tienda
    transfer_alias: '',
    transfer_cbu: '',
    transfer_holder: '',
    contact_whatsapp: ''
  });

  // ESTADO AUTH Y PERFIL
  const [user, setUser] = useState(null);
  const [favorites, setFavorites] = useState([]);

  // ESTADO DEL CARRITO (Local)
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // MODO OSCURO GLOBAL
  // Si el visitante eligió un modo, se respeta; si no, se usa el que eligió la tienda (Panel > Diseño)
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  const toggleDarkMode = () => setIsDarkMode(prev => {
    localStorage.setItem('theme', prev ? 'light' : 'dark');
    return !prev;
  });

  // Efectos de guardado local (por tienda)
  const loadedLocalFor = useRef(null);
  useEffect(() => {
    if (!storeId || loadedLocalFor.current !== storeId) return;
    localStorage.setItem(`store_categories_${storeId}`, JSON.stringify(categories));
    localStorage.setItem(`store_cart_${storeId}`, JSON.stringify(cart));
  }, [storeId, categories, cart]);

  // Marca en borrador que mandó el panel de Diseño (puede llegar antes de que cargue la tienda)
  const previewBrandingRef = useRef(null);

  // INICIO: identificar la tienda y la sesión
  useEffect(() => {
    resolveStore().then(resolved => setStore(
      previewBrandingRef.current ? { ...resolved, branding: previewBrandingRef.current } : resolved
    ));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // MARCA DE LA TIENDA: color, tipografía, ícono y modo por defecto
  useEffect(() => {
    if (!store || window.location.pathname.startsWith('/plataforma')) return;
    applyBranding(store.branding);
    if (localStorage.getItem('theme') === null) setIsDarkMode(normalizeBranding(store.branding).theme === 'dark');
  }, [store]);

  // Vista previa en vivo del panel de Diseño: la página que encuadra la tienda le manda la marca en borrador
  useEffect(() => {
    const onMessage = (event) => {
      if (event.origin !== window.location.origin || event.data?.type !== 'store-branding-preview') return;
      previewBrandingRef.current = event.data.branding;
      setStore(prev => (prev ? { ...prev, branding: event.data.branding } : prev));
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Guarda la marca (solo quien administra la tienda: lo controla la base)
  const updateBranding = async (branding) => {
    const clean = normalizeBranding(branding);
    const { data, error } = await supabase.from('stores').update({ branding: clean }).eq('id', storeId).select('id');
    if (error || !data?.length) return { success: false, error: error?.message || 'No se pudo guardar.' };
    setStore(prev => ({ ...prev, branding: clean }));
    return { success: true };
  };

  // DATOS DE LA TIENDA
  useEffect(() => {
    if (!storeId) return;
    // Las páginas de la plataforma (/plataforma...) llevan su propio título
    if (store?.name && !window.location.pathname.startsWith('/plataforma')) document.title = `${store.name} | Tienda online`;
    setCart(loadSaved('store_cart', storeId, []));
    setCategories(loadSaved('store_categories', storeId, DEFAULT_CATEGORIES));
    loadedLocalFor.current = storeId;

    fetchProducts();
    fetchStoreSettings();
    // Refresco de stock cada minuto, solo mientras la pestaña está a la vista
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchProducts();
    }, 60000);
    return () => clearInterval(interval);
  }, [storeId]);

  useEffect(() => {
    fetchFavorites();
  }, [user, storeId]);

  const fetchStoreSettings = async () => {
    if (store?.isDemo) {
      setStoreSettings(prev => ({ ...prev, ...DEMO_SETTINGS }));
      return;
    }
    try {
      const { data, error } = await supabase.from('store_settings').select('*').eq('store_id', storeId).maybeSingle();
      if (data && !error) {
        setStoreSettings(prev => ({
          ...prev,
          campaign_active: data.campaign_active,
          campaign_name: data.campaign_name,
          campaign_image_url: data.campaign_image_url || '',
          store_name: data.store_name || '',
          store_email: data.store_email || '',
          shipping_cost: Number(data.shipping_cost) || 0,
          transfer_alias: data.transfer_alias || '',
          transfer_cbu: data.transfer_cbu || '',
          transfer_holder: data.transfer_holder || '',
          contact_whatsapp: data.contact_whatsapp || ''
        }));
      }
    } catch (error) {
      console.error('Error fetching store settings:', error);
    }
  };

  const updateStoreSettings = async (newSettings) => {
    try {
      setStoreSettings(prev => ({ ...prev, ...newSettings }));
      
      const payload = {};
      if (newSettings.campaign_name !== undefined) payload.campaign_name = newSettings.campaign_name;
      if (newSettings.campaign_active !== undefined) payload.campaign_active = newSettings.campaign_active;
      if (newSettings.campaign_image_url !== undefined) payload.campaign_image_url = newSettings.campaign_image_url;
      if (newSettings.store_name !== undefined) payload.store_name = newSettings.store_name;
      if (newSettings.store_email !== undefined) payload.store_email = newSettings.store_email;
      if (newSettings.shipping_cost !== undefined) payload.shipping_cost = Math.max(0, Number(newSettings.shipping_cost) || 0);
      for (const field of ['transfer_alias','transfer_cbu','transfer_holder','contact_whatsapp']) {
        if (newSettings[field] !== undefined) payload[field] = String(newSettings[field]).trim() || null;
      }

      if (Object.keys(payload).length > 0) {
        // Las tiendas nuevas todavía no tienen fila: se crea al guardar por primera vez.
        // .select() permite detectar cuando la base no guardó nada (sin permiso).
        const { data, error } = await supabase.from('store_settings')
          .upsert({ ...payload, store_id: storeId }, { onConflict: 'store_id' })
          .select();
        if (error) throw error;
        if (!data || data.length === 0) throw new Error('store_settings no se actualizó');
      }
      return true;
    } catch (error) {
      console.error('Error updating settings:', error);
      fetchStoreSettings(); // Volver al estado real de la base
      return false;
    }
  };

  const toggleProductCampaign = async (productId, currentStatus) => {
    try {
      const { error } = await supabase.from('products').update({ in_campaign: !currentStatus }).eq('id', productId);
      if (error) throw error;
      await fetchProducts();
    } catch (error) {
      console.error('Error toggling campaign product:', error);
    }
  };

  
  const fetchProducts = async () => {
    if (!storeId) return;
    if (store?.isDemo) {
      setProducts(DEMO_PRODUCTS.map(row => mapProduct(row)));
      hasLoadedProductsRef.current = true;
      setIsLoading(false);
      return;
    }
    // El indicador de carga solo en la primera carga: las recargas automáticas no deben tapar el catálogo
    if (!hasLoadedProductsRef.current) setIsLoading(true);
    try {
      // Liberar vencidas no hace falta esperarlo: las reservas ya se cuentan por plazo
      releaseExpiredReservations().catch(err => console.error('Error liberando reservas:', err));

      const [productsRes, reservedMap] = await Promise.all([
        supabase.from('products').select('*').eq('store_id', storeId),
        fetchReservedMap(storeId)
      ]);
      if (productsRes.error) throw productsRes.error;

      const mappedProducts = productsRes.data.map(row => mapProduct(row, reservedMap));

      // Sumar las categorías de los productos sin pisar las creadas a mano que todavía no tienen productos
      const productCats = mappedProducts.map(p => p.category).filter(Boolean);
      if (productCats.length > 0) {
        setCategories(prev => [...new Set([...productCats, ...prev])]);
      }
      setProducts(mappedProducts);
      hasLoadedProductsRef.current = true;
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFavorites = async () => {
    if (!user || !storeId || store?.isDemo) return;
    try {
      const { data, error } = await supabase.from('favorites').select('product_id').eq('user_id', user.id).eq('store_id', storeId);
      if (error) throw error;
      setFavorites(data.map(f => f.product_id));
    } catch (error) {
      console.error('Error fetching favorites:', error);
    }
  };

  const toggleFavorite = async (productId) => {
    if (!user) {
      alert("Iniciá sesión o registrate para guardar tus productos favoritos.");
      return;
    }
    const isFavorite = favorites.includes(productId);
    try {
      if (isFavorite) {
        await supabase.from('favorites').delete().match({ user_id: user.id, product_id: productId });
        setFavorites(prev => prev.filter(id => id !== productId));
      } else {
        await supabase.from('favorites').insert([{ user_id: user.id, product_id: productId, store_id: storeId }]);
        setFavorites(prev => [...prev, productId]);
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const addToCart = (product, quantityToAdd = 1) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      
      // Nunca más unidades que las disponibles (stock físico menos lo reservado por otros)
      if (existing) {
        const newQty = Math.min(existing.quantity + quantityToAdd, product.available_stock);
        return prev.map(item => item.id === product.id ? { ...item, quantity: newQty } : item);
      }

      if (product.available_stock < 1) return prev;

      return [...prev, { ...product, quantity: Math.min(quantityToAdd, product.available_stock) }];
    });
    setIsCartOpen(true);
  };

  const removeFromCart = (productId) => setCart(prev => prev.filter(item => item.id !== productId));

  const updateQuantity = (productId, quantity) => {
    if (quantity < 1) return removeFromCart(productId);
    
    const productInStore = products.find(p => p.id === productId);
    const newQty = productInStore ? Math.min(quantity, productInStore.available_stock) : quantity;
    if (newQty < 1) return removeFromCart(productId);
    setCart(prev => prev.map(item => item.id === productId ? { ...item, quantity: newQty } : item));
  };

  const toggleCart = () => setIsCartOpen(!isCartOpen);

  // FUNCIONES CRUD Y LOGS DE INVENTARIO
  const logInventoryChange = async (productId, changeAmount, stockAfter, reason, note) => {
    try {
      const { error } = await supabase.from('inventory_logs').insert([{
        product_id: productId,
        change_amount: changeAmount,
        stock_after: stockAfter,
        reason: reason,
        note: note || '',
        store_id: storeId
      }]);
      if (error) console.error('Supabase error logging inventory:', error);
    } catch (error) {
      console.error('Error logging inventory:', error);
    }
  };

  const addCategory = (name) => {
    if (!categories.includes(name)) setCategories([...categories, name]);
  };

  const deleteCategory = (name) => setCategories(prev => prev.filter(c => c !== name));

  const addProduct = async (productData) => {
    try {
      const payload = {
        name: productData.name,
        description: productData.description,
        price: productData.price,
        discount: productData.discount,
        category: productData.category,
        stock: productData.stock,
        image_url: productData.images && productData.images.length > 0 ? JSON.stringify(productData.images) : (productData.imageUrl || null),
        features: productData.features || [],
        barcode: productData.barcode || null,
        store_id: storeId
      };
      const { data, error } = await supabase.from('products').insert([payload]).select();
      if (error) throw error;
      
      if (data && data[0] && productData.stock > 0) {
        await logInventoryChange(data[0].id, productData.stock, productData.stock, 'Ingreso', 'Carga inicial del producto');
      }
      await fetchProducts();
      return { success: true };
    } catch (error) {
      console.error('Error adding product:', error);
      return { success: false, error: error.message };
    }
  };

  // Edita los datos del producto. El stock no se toca acá: cambia solo con ventas o ajustes
  // de inventario, así una edición no pisa una venta que entró mientras el formulario estaba abierto.
  const updateProduct = async (id, updatedData) => {
    try {
      const payload = {
        name: updatedData.name,
        description: updatedData.description,
        price: updatedData.price,
        discount: updatedData.discount,
        category: updatedData.category,
        image_url: updatedData.images && updatedData.images.length > 0 ? JSON.stringify(updatedData.images) : (updatedData.imageUrl || null)
      };
      // Solo se tocan si el formulario los envía; si no, quedan como están en la base
      if (updatedData.features !== undefined) payload.features = updatedData.features;
      if (updatedData.barcode !== undefined) payload.barcode = updatedData.barcode || null;

      const { error } = await supabase.from('products').update(payload).eq('id', id);
      if (error) throw error;

      await fetchProducts();
      return { success: true };
    } catch (error) {
      console.error('Error updating product:', error);
      return { success: false, error: error.message };
    }
  };

  const softDeleteProduct = async (id) => {
    try {
      const { error } = await supabase.from('products').update({ is_active: false }).eq('id', id);
      if (error) throw error;
      await fetchProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
    }
  };

  const restoreProduct = async (id) => {
    try {
      const { error } = await supabase.from('products').update({ is_active: true }).eq('id', id);
      if (error) throw error;
      await fetchProducts();
    } catch (error) {
      console.error('Error restoring product:', error);
    }
  };

  
  const updateOrderStatus = async (order, newStatus) => {
    try {
      const confirmStatuses = ['pagado', 'preparando', 'enviado', 'entregado'];
      const confirmsPayment = isAwaitingPayment(order.status) && confirmStatuses.includes(newStatus);

      // Al confirmar el pago, lo reservado pasa a ser una venta. La base descuenta el stock
      // y registra el movimiento en una sola operación (mark_order_paid).
      if (confirmsPayment) {
        const { error: paidError } = await supabase.rpc('mark_order_paid', { p_order_id: order.id });
        if (paidError) throw paidError;
      }

      if (!(confirmsPayment && newStatus === ORDER_STATUS.PAID)) {
        const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', order.id);
        if (error) throw error;
      }

      fetchProducts(); // refresh products to update UI

      return { success: true };
    } catch (error) {
      console.error(error);
      return { success: false, error: error.message };
    }
  };

  const applyDiscount = async (id, discountPercent) => {
    try {
      const { error } = await supabase.from('products').update({ discount: discountPercent }).eq('id', id);
      if (error) throw error;
      await fetchProducts();
    } catch (error) {
      console.error('Error applying discount:', error);
    }
  };

  // La orden se crea dentro de la base (create_order): ahí se validan el stock disponible,
  // los precios y el envío, con el producto bloqueado para que dos compras no reserven la misma unidad.
  const checkoutOrder = async (checkoutData) => {
    if (store?.isDemo) return { success: false, errorMessage: DEMO_CHECKOUT_MESSAGE };
    try {
      const { data: created, error: orderError } = await supabase.rpc('create_order', {
        p_name: checkoutData.name,
        p_email: user?.email || checkoutData.email,
        p_phone: checkoutData.phone,
        p_document: checkoutData.document,
        p_address: checkoutData.address,
        p_payment_method: checkoutData.paymentMethod,
        p_items: cart.map(item => ({ id: item.id, quantity: item.quantity })),
        p_store_id: storeId
      });
      if (orderError) throw orderError;

      // Guardar los datos de envío en la cuenta para la próxima compra
      if (user) {
        await supabase.auth.updateUser({
          data: {
            shipping: {
              name: checkoutData.name,
              email: checkoutData.email,
              phone: checkoutData.phone,
              document: checkoutData.document,
              address: checkoutData.address
            }
          }
        });
      }

      // El stock físico no se descuenta acá: queda reservado hasta que se pague o venza
      setCart([]);
      setIsCartOpen(false);
      await fetchProducts();

      return { success: true, orderId: created.id, total: Number(created.total) };
    } catch (error) {
      console.error('Error processing checkout:', error);
      fetchProducts(); // el stock disponible pudo haber cambiado
      return { success: false, errorMessage: error.message };
    }
  };

  return (
    <StoreContext.Provider value={{
      store,
      storeId,
      updateBranding,
      categories,
      products,
      cart,
      user,
      favorites,
      isCartOpen,
      isLoading,
      isDarkMode,
      storeSettings,
      toggleDarkMode,
      toggleCart,
      addToCart,
      removeFromCart,
      updateQuantity,
      toggleFavorite,
      addCategory,
      deleteCategory,
      addProduct,
      updateProduct,
      softDeleteProduct,
      restoreProduct,
      applyDiscount,
      checkoutOrder,
        updateOrderStatus,
      updateStoreSettings,
      toggleProductCampaign
    }}>
      {children}
    </StoreContext.Provider>
  );
}

export const useStore = () => useContext(StoreContext);
