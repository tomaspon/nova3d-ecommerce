import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { fetchReservedMap, releaseExpiredReservations } from '../reservations';
import { mapProduct } from '../productMapping';
import { ORDER_STATUS, isAwaitingPayment } from '../orderStatus';

const StoreContext = createContext();

export function StoreProvider({ children }) {
  const hasLoadedProductsRef = useRef(false);

  // ESTADO BASE
  const [categories, setCategories] = useState(() => {
    const saved = localStorage.getItem('store_categories');
    return saved ? JSON.parse(saved) : ['Tecnología', 'Indumentaria', 'Accesorios', 'Hogar'];
  });
  
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // CONFIGURACIONES Y CAMPAÑAS
  const [storeSettings, setStoreSettings] = useState({
    campaign_active: false,
    campaign_name: 'Ofertas Especiales',
    campaign_image_url: '',
    store_name: '',
    store_email: '',
    shipping_cost: 0
  });

  // ESTADO AUTH Y PERFIL
  const [user, setUser] = useState(null);
  const [favorites, setFavorites] = useState([]);

  // ESTADO DEL CARRITO (Local)
  const [cart, setCart] = useState(() => {
    const saved = localStorage.getItem('store_cart');
    return saved ? JSON.parse(saved) : [];
  });
  const [isCartOpen, setIsCartOpen] = useState(false);

  // MODO OSCURO GLOBAL
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => setIsDarkMode(prev => !prev);

  // Efectos de guardado local
  useEffect(() => {
    localStorage.setItem('store_categories', JSON.stringify(categories));
    localStorage.setItem('store_cart', JSON.stringify(cart));
  }, [categories, cart]);

  // INICIO: CARGAR DATOS
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
    });

    fetchProducts();
    // Refresco de stock cada minuto, solo mientras la pestaña está a la vista
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchProducts();
    }, 60000);
    fetchStoreSettings();

    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    fetchFavorites();
  }, [user]);

  const fetchStoreSettings = async () => {
    try {
      const { data, error } = await supabase.from('store_settings').select('*').eq('id', 1).single();
      if (data && !error) {
        setStoreSettings(prev => ({
          ...prev,
          campaign_active: data.campaign_active,
          campaign_name: data.campaign_name,
          campaign_image_url: data.campaign_image_url || '',
          store_name: data.store_name || '',
          store_email: data.store_email || '',
          shipping_cost: Number(data.shipping_cost) || 0
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

      if (Object.keys(payload).length > 0) {
        // .select() permite detectar cuando la base no actualizó ninguna fila
        const { data, error } = await supabase.from('store_settings').update(payload).eq('id', 1).select();
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
    // El indicador de carga solo en la primera carga: las recargas automáticas no deben tapar el catálogo
    if (!hasLoadedProductsRef.current) setIsLoading(true);
    try {
      // Liberar vencidas no hace falta esperarlo: las reservas ya se cuentan por plazo
      releaseExpiredReservations().catch(err => console.error('Error liberando reservas:', err));

      const [productsRes, reservedMap] = await Promise.all([
        supabase.from('products').select('*'),
        fetchReservedMap()
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
    if (!user) return;
    try {
      const { data, error } = await supabase.from('favorites').select('product_id').eq('user_id', user.id);
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
        await supabase.from('favorites').insert([{ user_id: user.id, product_id: productId }]);
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
        note: note || ''
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
        barcode: productData.barcode || null
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
    try {
      const { data: created, error: orderError } = await supabase.rpc('create_order', {
        p_name: checkoutData.name,
        p_email: user?.email || checkoutData.email,
        p_phone: checkoutData.phone,
        p_document: checkoutData.document,
        p_address: checkoutData.address,
        p_payment_method: checkoutData.paymentMethod,
        p_items: cart.map(item => ({ id: item.id, quantity: item.quantity }))
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
