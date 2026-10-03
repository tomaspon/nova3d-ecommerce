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
      .select('id, items, status, shipping_cost')
      .eq('id', orderId)
      .maybeSingle();

    if (orderError) throw orderError;
    if (!order || !Array.isArray(order.items) || order.items.length === 0) {
      return res.status(404).json({ message: 'Orden no encontrada' });
    }

    // La orden la crea la función create_order de la base, que guarda en cada artículo
    // el precio unitario ya calculado (unit_price) y el costo de envío en la orden.
    const mpItems = [];
    for (const item of order.items) {
      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unit_price);
      if (!Number.isInteger(quantity) || quantity < 1 || !(unitPrice >= 0) || item.unit_price == null) {
        return res.status(400).json({ message: 'Bad Request: la orden tiene artículos inválidos' });
      }
      mpItems.push({
        id: item.id,
        title: item.name,
        quantity,
        unit_price: unitPrice,
        currency_id: 'ARS',
      });
    }

    const shippingCost = Number(order.shipping_cost) || 0;
    if (shippingCost > 0) {
      mpItems.push({ id: 'envio', title: 'Envío', quantity: 1, unit_price: shippingCost, currency_id: 'ARS' });
    }

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
      statement_descriptor: 'MINIMAL',
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
