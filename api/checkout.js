import { MercadoPagoConfig, Preference } from 'mercadopago';
import { getSupabase, RESERVATION_MINUTES } from './_lib/payments.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { orderId, payer } = req.body || {};

    if (!orderId) {
      return res.status(400).json({ message: 'Bad Request: Missing orderId' });
    }

    // Los artículos y precios salen de la base, no de lo que manda el navegador:
    // así nadie puede pagar un importe distinto al real.
    const supabase = getSupabase();
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, items, status')
      .eq('id', orderId)
      .maybeSingle();

    if (orderError) throw orderError;
    if (!order || !Array.isArray(order.items) || order.items.length === 0) {
      return res.status(404).json({ message: 'Orden no encontrada' });
    }

    const productIds = order.items.map(item => item.id);
    const { data: dbProducts, error: productsError } = await supabase
      .from('products')
      .select('id, name, price, discount')
      .in('id', productIds);

    if (productsError) throw productsError;

    const mpItems = [];
    let total = 0;
    for (const item of order.items) {
      const product = dbProducts.find(p => p.id === item.id);
      const quantity = Number(item.quantity);
      if (!product || !Number.isInteger(quantity) || quantity < 1) {
        return res.status(400).json({ message: 'Bad Request: la orden tiene artículos inválidos' });
      }

      const hasDiscount = product.discount > 0;
      const finalPrice = hasDiscount ? product.price * (1 - product.discount / 100) : Number(product.price);
      const unitPrice = Number(finalPrice.toFixed(2));
      total += unitPrice * quantity;

      mpItems.push({
        id: product.id,
        title: product.name,
        quantity,
        unit_price: unitPrice,
        currency_id: 'ARS',
      });
    }

    // El total de la orden queda con el importe calculado acá; el pago se compara contra este valor
    total = Number(total.toFixed(2));
    const { error: totalError } = await supabase.from('orders').update({ total }).eq('id', orderId);
    if (totalError) throw totalError;

    const client = new MercadoPagoConfig({
      accessToken: process.env.MP_ACCESS_TOKEN || ''
    });

    const preference = new Preference(client);

    const baseUrl = req.headers.origin || 'https://nova3d-ecommerce.vercel.app';

    // El link de pago vence junto con la reserva de stock
    const expirationDate = new Date(Date.now() + RESERVATION_MINUTES * 60000).toISOString();

    const body = {
      items: mpItems,
      payer: {
        name: payer?.name || 'Cliente',
        email: payer?.email || 'test@test.com',
      },
      back_urls: {
        success: `${baseUrl}/seguimiento?order=${orderId}&payment=success`,
        pending: `${baseUrl}/seguimiento?order=${orderId}&payment=pending`,
        failure: `${baseUrl}/seguimiento?order=${orderId}&payment=failure`
      },
      auto_return: 'approved',
      external_reference: orderId,
      expires: true,
      expiration_date_to: expirationDate,
      notification_url: `${baseUrl}/api/webhook`,
      statement_descriptor: 'NOVA 3D',
    };

    const response = await preference.create({ body });

    res.status(200).json({
      init_point: response.init_point,
      id: response.id
    });

  } catch (error) {
    console.error('Error creando preferencia MP:', error);
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
}
