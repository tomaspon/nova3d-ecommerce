import { MercadoPagoConfig, Preference } from 'mercadopago';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { orderId, items, payer } = req.body;

    if (!orderId || !items || !items.length) {
      return res.status(400).json({ message: 'Bad Request: Missing items or orderId' });
    }

    const client = new MercadoPagoConfig({ 
      accessToken: process.env.MP_ACCESS_TOKEN || '' 
    });

    const preference = new Preference(client);

    const mpItems = items.map(item => {
      const hasDiscount = item.discount > 0;
      const finalPrice = hasDiscount ? item.price * (1 - item.discount / 100) : item.price;
      
      return {
        id: item.id,
        title: item.name,
        quantity: item.quantity,
        unit_price: Number(finalPrice.toFixed(2)),
        currency_id: 'ARS',
      };
    });

    const baseUrl = req.headers.origin || 'https://nova3d-ecommerce.vercel.app';

    // Se expira en 10 minutos
    const expirationDate = new Date(Date.now() + 5 * 60000).toISOString();

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
