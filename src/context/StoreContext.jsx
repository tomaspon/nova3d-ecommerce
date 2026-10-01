import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const StoreContext = createContext();

export function StoreProvider({ children }) {
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
    allow_backorders: localStorage.getItem('allow_backorders') === 'true' // Guardado localmente
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
    localStorage.setItem('allow_backorders', storeSettings.allow_backorders);
  }, [categories, cart, storeSettings.allow_backorders]);

  // INICIO: CARGAR DATOS
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
    });

    fetchProducts();
    const interval = setInterval(() => { fetchProducts(); }, 60000);
    // attached interval to context
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
          campaign_image_url: data.campaign_image_url || ''
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

      if (Object.keys(payload).length > 0) {
        await supabase.from('store_settings').update(payload).eq('id', 1);
      }
    } catch (error) {
      console.error('Error updating settings:', error);
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

  
  const releaseExpiredReservations = async () => {
    try {
      const tenMinsAgo = new Date(Date.now() - 10 * 60000).toISOString();
      const { data: expiredOrders } = await supabase
        .from('orders')
        .update({ status: 'cancelado (tiempo agotado)' })
        .in('status', ['reservado', 'pendiente'])
        .lt('created_at', tenMinsAgo)
        .select();

      if (expiredOrders && expiredOrders.length > 0) {
        console.log(`Se liberaron reservas de ${expiredOrders.length} ordenes expiradas.`);
      }
    } catch (err) {
      console.error('Error liberando reservas:', err);
    }
  };

  const fetchProducts = async () => {

    
    setIsLoading(true);
    await releaseExpiredReservations();
    try {

      const { data, error } = await supabase.from('products').select('*');
      if (error) throw error;

      // Calculamos reservas
        const tenMinsAgo = new Date(Date.now() - 10 * 60000).toISOString();
        const { data: pendingOrders } = await supabase.from('orders').select('items').in('status', ['reservado', 'pendiente']).gt('created_at', tenMinsAgo);
        const reservedMap = {};
        if (pendingOrders) {
          pendingOrders.forEach(o => {
            if(o.items) {
              o.items.forEach(item => {
                reservedMap[item.id] = (reservedMap[item.id] || 0) + item.quantity;
              });
            }
          });
        }

        const mappedProducts = data.map(p => {
          let parsedImages = [];
          if (p.image_url) {
            try {
              if (p.image_url.startsWith('[')) {
                parsedImages = JSON.parse(p.image_url);
              } else {
                parsedImages = [p.image_url];
              }
            } catch (e) {
              parsedImages = [p.image_url];
            }
          }
          const reserved = reservedMap[p.id] || 0;
          return {
            ...p,
            imageUrl: parsedImages[0] || null,
            images: parsedImages,
            isActive: p.is_active,
            reserved_stock: reserved,
            available_stock: p.stock - reserved
          };
        });
      
      const uniqueCats = [...new Set(mappedProducts.map(p => p.category).filter(Boolean))];
      if (uniqueCats.length > 0) {
        setCategories(uniqueCats);
      }
      setProducts(mappedProducts);
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
      
      if (existing) {
        let newQty = existing.quantity + quantityToAdd;
        if (!storeSettings.allow_backorders && newQty > product.available_stock) {
          newQty = product.available_stock;
        }
        return prev.map(item => item.id === product.id ? { ...item, quantity: newQty } : item);
      }
      
      let initialQty = quantityToAdd;
      if (!storeSettings.allow_backorders && initialQty > product.available_stock) {
        initialQty = product.available_stock;
      }
      
      if (!storeSettings.allow_backorders && product.available_stock < 1) {
        return prev;
      }
      
      return [...prev, { ...product, quantity: initialQty }];
    });
    setIsCartOpen(true);
  };

  const removeFromCart = (productId) => setCart(prev => prev.filter(item => item.id !== productId));

  const updateQuantity = (productId, quantity) => {
    if (quantity < 1) return removeFromCart(productId);
    
    const productInStore = products.find(p => p.id === productId);
    let newQty = quantity;
    if (!storeSettings.allow_backorders && productInStore && newQty > productInStore.available_stock) {
       newQty = productInStore.available_stock;
    }
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
      
      if (data && data[0]) {
        await logInventoryChange(data[0].id, productData.stock, productData.stock, 'Ingreso', 'Carga inicial del producto');
      }
      await fetchProducts();
    } catch (error) {
      console.error('Error adding product:', error);
    }
  };

  const updateProduct = async (id, updatedData, changeReason = 'Ajuste Manual', changeNote = '') => {
    try {
      // Calcular diferencia de stock para el log
      const oldProduct = products.find(p => p.id === id);
      const stockDiff = updatedData.stock - (oldProduct?.stock || 0);

      const payload = {
        name: updatedData.name,
        description: updatedData.description,
        price: updatedData.price,
        discount: updatedData.discount,
        category: updatedData.category,
        stock: updatedData.stock,
        image_url: updatedData.images && updatedData.images.length > 0 ? JSON.stringify(updatedData.images) : (updatedData.imageUrl || null),
        features: updatedData.features || [],
        barcode: updatedData.barcode || null
      };
      const { error } = await supabase.from('products').update(payload).eq('id', id);
      if (error) throw error;
      
      if (stockDiff !== 0) {
        await logInventoryChange(id, stockDiff, updatedData.stock, changeReason, changeNote);
      }
      await fetchProducts();
    } catch (error) {
      console.error('Error updating product:', error);
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
      
      if ((order.status === 'reservado' || order.status === 'pendiente') && confirmStatuses.includes(newStatus)) {
        for (const item of order.items) {
          const { data: prod } = await supabase.from('products').select('stock').eq('id', item.id).single();
          if (prod) {
            const newStock = prod.stock - item.quantity;
            await supabase.from('products').update({ stock: newStock }).eq('id', item.id);
            await supabase.from('inventory_logs').insert([{
              product_id: item.id,
              change_amount: -item.quantity,
              stock_after: newStock,
              reason: 'Venta',
              note: `Venta confirmada - Orden #${order.id.split('-')[0]}`
            }]);
          }
        }
      }

      const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', order.id);
      if (error) throw error;
      
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

  const checkoutOrder = async (checkoutData) => {
    try {
      const productIds = cart.map(item => item.id);
      const { data: currentStockData, error: stockError } = await supabase
        .from('products').select('id, name, stock').in('id', productIds);
        
      if (stockError) throw stockError;

      // 1. Validar Stock (A menos que Backorders esté activo)
      if (!storeSettings.allow_backorders) {
        for (const cartItem of cart) {
          const dbProduct = currentStockData.find(p => p.id === cartItem.id);
          if (!dbProduct || dbProduct.stock < cartItem.quantity) {
            throw new Error(`Ups. Alguien acaba de comprar "${cartItem.name}". No hay suficiente stock para cubrir tu pedido.`);
          }
        }
      }

      // 2. Procesar Pedido
      const total = cart.reduce((sum, item) => {
        const finalPrice = item.discount > 0 ? item.price * (1 - item.discount / 100) : item.price;
        return sum + (finalPrice * item.quantity);
      }, 0);

      // Si algún producto quedó en negativo, marcamos como reserva interna
      let isBackorder = false;
      if (storeSettings.allow_backorders) {
        isBackorder = cart.some(item => {
          const dbp = currentStockData.find(p => p.id === item.id);
          return (dbp.stock - item.quantity) < 0;
        });
      }

      const payload = {
        customer_name: checkoutData.name,
        customer_email: checkoutData.email,
        customer_phone: checkoutData.phone,
        customer_document: checkoutData.document,
        shipping_address: checkoutData.address,
        payment_method: checkoutData.paymentMethod,
        total: total,
        items: cart,
        status: isBackorder ? 'pendiente (reserva)' : 'reservado'
      };

      // 3. Crear Orden Primero para obtener su ID
      
        const { data: orderData, error: orderError } = await supabase.from('orders').insert([payload]).select().single();
        if (orderError) throw orderError;
  
        // Update user metadata if logged in
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


      // 4. El stock NO se descuenta fsicamente aca. Queda como 'reservado' y pasa a ser 'reservado' dinamicamente.
      setCart([]);
      setIsCartOpen(false);
      await fetchProducts();

      return { success: true, orderId: orderData.id, total: total };
    } catch (error) {
      console.error('Error processing checkout:', error);
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
