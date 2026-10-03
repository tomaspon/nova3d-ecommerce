import { describe, it, expect } from 'vitest';
import { isAwaitingPayment, isPaid, isCanceled, trackingStep, holdsReservation } from './orderStatus';

const minutesAgo = (n) => new Date(Date.now() - n * 60000).toISOString();

describe('clasificación de estados', () => {
  it('reservado y pendiente esperan pago', () => {
    expect(isAwaitingPayment('reservado')).toBe(true);
    expect(isAwaitingPayment('pendiente')).toBe(true);
    expect(isAwaitingPayment('pagado')).toBe(false);
    expect(isAwaitingPayment(null)).toBe(false);
  });

  it('una venta sigue contando como pagada en todas las etapas del envío', () => {
    for (const status of ['pagado', 'preparando', 'enviado', 'despachado', 'entregado', 'ENVIADO']) {
      expect(isPaid(status)).toBe(true);
    }
    for (const status of ['reservado', 'pendiente', 'cancelado', 'cancelado (tiempo agotado)']) {
      expect(isPaid(status)).toBe(false);
    }
  });

  it('reconoce las variantes de cancelado', () => {
    expect(isCanceled('cancelado')).toBe(true);
    expect(isCanceled('cancelado (tiempo agotado)')).toBe(true);
    expect(isCanceled('cancelado/devuelto')).toBe(true);
    expect(isCanceled('pagado')).toBe(false);
  });
});

describe('trackingStep', () => {
  it('recién comprado o pagado queda en Ordenado', () => {
    expect(trackingStep('reservado')).toBe(1);
    expect(trackingStep('pagado')).toBe(1);
  });

  it('avanza con el envío', () => {
    expect(trackingStep('preparando')).toBe(2);
    expect(trackingStep('enviado')).toBe(3);
    expect(trackingStep('despachado')).toBe(3);
    expect(trackingStep('entregado')).toBe(4);
  });
});

describe('holdsReservation', () => {
  it('MercadoPago retiene stock 10 minutos', () => {
    expect(holdsReservation({ status: 'reservado', payment_method: 'MercadoPago', created_at: minutesAgo(9) })).toBe(true);
    expect(holdsReservation({ status: 'reservado', payment_method: 'MercadoPago', created_at: minutesAgo(11) })).toBe(false);
  });

  it('una transferencia retiene stock 48 horas', () => {
    expect(holdsReservation({ status: 'reservado', payment_method: 'Transferencia', created_at: minutesAgo(60 * 47) })).toBe(true);
    expect(holdsReservation({ status: 'reservado', payment_method: 'Transferencia', created_at: minutesAgo(60 * 49) })).toBe(false);
  });

  it('una orden pagada o cancelada ya no reserva: su stock se descontó o se liberó', () => {
    expect(holdsReservation({ status: 'pagado', payment_method: 'MercadoPago', created_at: minutesAgo(1) })).toBe(false);
    expect(holdsReservation({ status: 'cancelado (tiempo agotado)', payment_method: 'MercadoPago', created_at: minutesAgo(1) })).toBe(false);
  });
});
