import React from 'react';

export default function Page() {
  return (
    <main className="page-grid hero-surface">
      <section className="hero-card">
        <span className="eyebrow">Inventory reservation demo</span>
        <h1 className="hero-title">A cleaner way to inspect stock and reserve it fast.</h1>
        <p className="hero-copy">
          Browse live inventory by warehouse, reserve the quantity you need, then confirm or release from a focused workflow.
        </p>
        <div className="hero-actions">
          <a href="/products" className="button button--primary">View products</a>
          <a href="/products#how-it-works" className="button button--secondary">See how it works</a>
        </div>
      </section>

      <aside className="stack">
        <div className="info-card info-card--accent">
          <div className="info-card__label">Live demo</div>
          <div className="info-card__value">3 products · 2 warehouses</div>
          <div className="info-card__meta">Ready to test without setup.</div>
        </div>

        <div className="info-card">
          <div className="info-card__label">Flow</div>
          <ol className="feature-list">
            <li>Open products</li>
            <li>Choose a warehouse</li>
            <li>Reserve, confirm, or cancel</li>
          </ol>
        </div>
      </aside>
    </main>
  );
}
