'use client';

import React, { useEffect, useMemo, useState } from 'react';

type Reservation = {
  id: string;
  productId: number;
  productName: string;
  warehouseId: number;
  warehouseName: string;
  quantity: number;
  amountPaise: number;
  currency: string;
  status: 'PENDING' | 'CONFIRMED' | 'RELEASED';
  expiresAt: string;
  createdAt?: string;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000';
const statusOptions: Array<Reservation['status'] | 'ALL'> = ['ALL', 'PENDING', 'CONFIRMED', 'RELEASED'];
const currencyFormatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

function formatMoney(amountPaise: number) {
  return currencyFormatter.format(amountPaise / 100);
}

export default function ReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [statusFilter, setStatusFilter] = useState<'ALL' | Reservation['status']>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(apiBaseUrl + '/api/reservations')
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load reservations');
        return response.json();
      })
      .then((data) => {
        setReservations(data);
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filteredReservations = useMemo(
    () => (statusFilter === 'ALL' ? reservations : reservations.filter((reservation) => reservation.status === statusFilter)),
    [reservations, statusFilter]
  );

  return (
    <main className="stack">
      <section className="section-hero">
        <div>
          <span className="eyebrow">Reservation history</span>
          <h1 className="page-title">Track pending and finalized holds</h1>
          <p className="page-copy">Filter reservations by status to inspect active holds, completed checkouts, and released stock in one view.</p>
        </div>

        <div className="filter-row">
          {statusOptions.map((status) => (
            <button
              key={status}
              type="button"
              className={`filter-pill ${statusFilter === status ? 'filter-pill--active' : ''}`}
              onClick={() => setStatusFilter(status)}
            >
              {status}
            </button>
          ))}
        </div>
      </section>

      {loading && <div className="status-card">Loading reservations...</div>}
      {error && <div className="status-card status-card--error">{error}</div>}

      {!loading && !error && filteredReservations.length === 0 && <div className="status-card">No reservations match the selected filter.</div>}

      <section className="reservation-history-grid">
        {filteredReservations.map((reservation) => (
          <article key={reservation.id} className="history-card">
            <div className="history-card__top">
              <div>
                <span className={`history-kicker history-kicker--${reservation.status.toLowerCase()}`}>{reservation.status}</span>
                <h2>#{reservation.id.slice(0, 8)}</h2>
              </div>
              <span className="history-quantity">Qty {reservation.quantity}</span>
            </div>

            <div className="history-meta">
              <div>
                <div className="history-label">Product</div>
                <div className="history-value">{reservation.productName}</div>
              </div>
              <div>
                <div className="history-label">Warehouse</div>
                <div className="history-value">{reservation.warehouseName}</div>
              </div>
              <div>
                <div className="history-label">Expires</div>
                <div className="history-value">{new Date(reservation.expiresAt).toLocaleString()}</div>
              </div>
              <div>
                <div className="history-label">Amount</div>
                <div className="history-value">{formatMoney(reservation.amountPaise)}</div>
              </div>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}