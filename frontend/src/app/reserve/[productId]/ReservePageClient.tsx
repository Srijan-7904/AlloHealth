'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '../../../components/toast';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
    };
  }
}

type Reservation = {
  id: string;
  productId: number;
  warehouseId: number;
  quantity: number;
  amountPaise: number;
  currency: string;
  status: string;
  expiresAt: string;
  razorpayOrderId?: string;
};

type RazorpayOrderResponse = {
  provider: 'razorpay' | 'mock';
  keyId: string;
  orderId: string;
  amountPaise: number;
  currency: string;
  reservationId: string;
  productName: string;
  warehouseName: string;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000';
const frontendRazorpayKeyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '';
const currencyFormatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

function formatMoney(amountPaise: number) {
  return currencyFormatter.format(amountPaise / 100);
}

function loadRazorpayScript() {
  return new Promise<boolean>((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const existingScript = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(true), { once: true });
      existingScript.addEventListener('error', () => resolve(false), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function ReservePage() {
  const params = useParams<{ productId: string }>();
  const searchParams = useSearchParams();
  const productId = Number(params.productId);
  const warehouseId = Number(searchParams.get('warehouseId') || 0);
  const [quantity, setQuantity] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState('');
  const [testCheckoutOpen, setTestCheckoutOpen] = useState(false);
  const [pendingTestOrder, setPendingTestOrder] = useState<RazorpayOrderResponse | null>(null);
  const router = useRouter();
  const { pushToast } = useToast();

  useEffect(() => {
    if (!reservation) {
      setCountdown('');
      return;
    }
    const updateCountdown = () => {
      const remainingMs = new Date(reservation.expiresAt).getTime() - Date.now();
      if (remainingMs <= 0) {
        setCountdown('Expired');
        return;
      }
      const totalSeconds = Math.floor(remainingMs / 1000);
      const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
      const seconds = (totalSeconds % 60).toString().padStart(2, '0');
      setCountdown(`${minutes}:${seconds}`);
    };
    updateCountdown();
    const interval = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(interval);
  }, [reservation]);

  const isExpired = useMemo(() => countdown === 'Expired', [countdown]);

  async function createReservation() {
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch(apiBaseUrl + '/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, warehouseId, quantity })
      });
      if (!res.ok) {
        const body = await res.json();
        setError(body.error || 'Failed');
        pushToast({ title: 'Reservation failed', description: body.error || 'Failed to reserve stock.', variant: 'error' });
        return;
      }
      const data = await res.json();
      setReservation(data.reservation || data);
      pushToast({ title: 'Reservation created', description: `Held ${quantity} unit(s) for checkout.`, variant: 'success' });
    } catch (e: any) {
      setError(e.message);
      pushToast({ title: 'Reservation failed', description: e.message, variant: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function confirmPayment(orderResponse: RazorpayOrderResponse, payment: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string } | null) {
    const res = await fetch(apiBaseUrl + `/api/reservations/${orderResponse.reservationId}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        orderResponse.provider === 'mock'
          ? { provider: 'mock' }
          : {
            provider: 'razorpay',
            razorpayOrderId: payment?.razorpay_order_id,
            razorpayPaymentId: payment?.razorpay_payment_id,
            razorpaySignature: payment?.razorpay_signature
          }
      )
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'Payment verification failed');
    }
    const data = await res.json();
    setReservation(data.reservation || data);
    pushToast({ title: 'Payment confirmed', description: 'Reservation converted into confirmed stock.', variant: 'success' });
    router.push('/products');
  }

  async function startRazorpayCheckout() {
    if (!reservation) return;
    if (isExpired) {
      setError('Reservation expired');
      pushToast({ title: 'Reservation expired', description: 'Please create a new reservation.', variant: 'error' });
      return;
    }
    setIsPaying(true);
    setError(null);
    try {
      const orderRes = await fetch(apiBaseUrl + `/api/reservations/${reservation.id}/razorpay-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': `razorpay-order-${reservation.id}` }
      });
      if (!orderRes.ok) {
        const body = await orderRes.json();
        throw new Error(body.error || 'Unable to create checkout order');
      }
      const order: RazorpayOrderResponse = await orderRes.json();
      if (order.provider === 'mock') {
        setPendingTestOrder(order);
        setTestCheckoutOpen(true);
        pushToast({ title: 'Test checkout opened', description: 'Demo mode is using the in-app checkout flow.', variant: 'info' });
        return;
      }
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded || !window.Razorpay) {
        throw new Error('Unable to load Razorpay checkout');
      }
      const razorpay = new window.Razorpay({
        key: order.keyId,
        amount: order.amountPaise,
        currency: order.currency,
        name: 'Allo Inventory',
        description: `${order.productName} - ${order.warehouseName}`,
        order_id: order.orderId,
        handler: async (response: any) => {
          try {
            await confirmPayment(order, response);
          } catch (paymentError: any) {
            const message = paymentError.message || 'Payment verification failed';
            setError(message);
            pushToast({ title: 'Payment failed', description: message, variant: 'error' });
          }
        },
        modal: { ondismiss: () => { pushToast({ title: 'Payment cancelled', description: 'Checkout window was closed.', variant: 'info' }); } },
        prefill: { name: 'Customer' },
        theme: { color: '#0f766e' }
      });
      razorpay.open();
    } catch (e: any) {
      const message = e.message || 'Unable to open payment checkout';
      setError(message);
      pushToast({ title: 'Checkout failed', description: message, variant: 'error' });
    } finally {
      setIsPaying(false);
    }
  }

  async function releaseReservation() {
    if (!reservation) return;
    const response = await fetch(apiBaseUrl + `/api/reservations/${reservation.id}/release`, { method: 'POST' });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || 'Unable to cancel reservation');
    }
    const data = await response.json();
    setReservation(data.reservation || data);
    pushToast({ title: 'Reservation released', description: 'The hold was released back to inventory.', variant: 'info' });
    router.push('/products');
  }

  return (
    <main className="reserve-layout">
      <section className="reserve-panel">
        <span className="eyebrow">Reservation flow</span>
        <h1 className="page-title">Create a reservation</h1>
        <p className="page-copy">Hold stock first, then pay with Razorpay to convert the reservation into confirmed inventory.</p>
        <div className="reservation-summary">
          <div>
            <div className="summary-label">Product</div>
            <div className="summary-value">#{productId}</div>
          </div>
          <div>
            <div className="summary-label">Warehouse</div>
            <div className="summary-value">#{warehouseId || 'Select from products'}</div>
          </div>
        </div>
        <div className="field-group">
          <label className="field-label" htmlFor="quantity">Quantity</label>
          <div className="quantity-stepper">
            <button type="button" className="stepper-button" onClick={() => setQuantity((value) => Math.max(1, value - 1))}>−</button>
            <input id="quantity" type="number" min={1} value={quantity} onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))} className="number-input" />
            <button type="button" className="stepper-button" onClick={() => setQuantity((value) => value + 1)}>+</button>
          </div>
        </div>
        <div className="action-row">
          <button onClick={createReservation} className="button button--primary button--wide" disabled={isSubmitting || isPaying}>
            {isSubmitting ? 'Creating...' : 'Reserve stock'}
          </button>
          <button onClick={() => router.push('/products')} className="button button--secondary button--wide">Back to products</button>
        </div>
        {error && <div className="notice notice--error">{error}</div>}
      </section>
      <aside className="reserve-sidebar">
        <div className="info-card info-card--sticky">
          <div className="info-card__label">What happens next</div>
          <ul className="feature-list feature-list--compact">
            <li>Stock is held immediately after reservation</li>
            <li>Pay with Razorpay before the hold expires</li>
            <li>Successful payment confirms the reservation</li>
          </ul>
        </div>
        {reservation && (
          <div className="reservation-card">
            <div className="reservation-card__header">
              <div>
                <span className="reservation-card__label">Reservation created</span>
                <h2>#{reservation.id.slice(0, 8)}</h2>
              </div>
              <span className={`status-chip status-chip--${reservation.status.toLowerCase()}`}>{reservation.status}</span>
            </div>
            <div className="reservation-details">
              <div>
                <span className="detail-label">Expires</span>
                <span className="detail-value">{new Date(reservation.expiresAt).toLocaleString()}</span>
              </div>
              <div>
                <span className="detail-label">Countdown</span>
                <span className={`detail-value ${isExpired ? 'warehouse-stock--low' : ''}`}>{countdown || '--:--'}</span>
              </div>
              <div>
                <span className="detail-label">Quantity</span>
                <span className="detail-value">{reservation.quantity}</span>
              </div>
              <div>
                <span className="detail-label">Amount</span>
                <span className="detail-value">{formatMoney(reservation.amountPaise)}</span>
              </div>
            </div>
            <div className="action-row action-row--stacked">
              <button onClick={startRazorpayCheckout} className="button button--success button--wide" disabled={isPaying || isExpired}>
                {isPaying ? 'Opening checkout...' : 'Confirm purchase with Razorpay'}
              </button>
              <button onClick={releaseReservation} className="button button--ghost button--wide">Cancel reservation</button>
            </div>
          </div>
        )}
      </aside>
      {testCheckoutOpen && pendingTestOrder && (
        <div className="test-checkout-backdrop" role="dialog" aria-modal="true" aria-labelledby="test-checkout-title">
          <div className="test-checkout-card">
            <div className="test-checkout__header">
              <div>
                <div className="eyebrow">Test payment</div>
                <h2 id="test-checkout-title">Complete demo checkout</h2>
              </div>
              <button type="button" className="test-checkout__close" onClick={() => { setTestCheckoutOpen(false); setPendingTestOrder(null); pushToast({ title: 'Payment cancelled', description: 'Checkout was closed.', variant: 'info' }); }}>×</button>
            </div>
            <div className="test-checkout__summary">
              <div><span className="summary-label">Product</span><span className="summary-value">{pendingTestOrder.productName}</span></div>
              <div><span className="summary-label">Warehouse</span><span className="summary-value">{pendingTestOrder.warehouseName}</span></div>
              <div><span className="summary-label">Amount</span><span className="summary-value">{formatMoney(pendingTestOrder.amountPaise)}</span></div>
            </div>
            <div className="test-checkout__actions">
              <button type="button" className="button button--primary button--wide" onClick={async () => {
                try {
                  await confirmPayment(pendingTestOrder, null);
                  setTestCheckoutOpen(false);
                  setPendingTestOrder(null);
                } catch (paymentError: any) {
                  const message = paymentError.message || 'Payment verification failed';
                  setError(message);
                  pushToast({ title: 'Payment failed', description: message, variant: 'error' });
                }
              }}>Pay now</button>
              <button type="button" className="button button--secondary button--wide" onClick={() => { setTestCheckoutOpen(false); setPendingTestOrder(null); pushToast({ title: 'Payment cancelled', description: 'Checkout was closed.', variant: 'info' }); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
