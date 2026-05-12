'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useToast } from '../../components/toast';

type Product = {
  id: number;
  name: string;
  pricePaise: number;
  warehouses: { warehouseId: number; warehouseName: string; totalStock: number; reservedStock: number; availableStock: number }[];
};

const apiBaseUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000';
const currencyFormatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

function formatMoney(amountPaise: number) {
  return currencyFormatter.format(amountPaise / 100);
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('ALL');
  const { pushToast } = useToast();

  useEffect(() => {
    fetch(apiBaseUrl + '/api/products')
      .then((r) => {
        if (!r.ok) throw new Error('Unable to load products');
        return r.json();
      })
      .then((data) => {
        setProducts(data);
        setError(null);
      })
      .catch((err) => {
        setError(err.message);
        pushToast({ title: 'Failed to load products', description: err.message, variant: 'error' });
      })
      .finally(() => setLoading(false));
  }, [apiBaseUrl, pushToast]);

  const warehouseOptions = useMemo(() => {
    const options = new Map<string, string>();
    products.forEach((product) => {
      product.warehouses.forEach((warehouse) => {
        options.set(String(warehouse.warehouseId), warehouse.warehouseName);
      });
    });
    return Array.from(options.entries()).map(([id, label]) => ({ id, label }));
  }, [products]);

  const visibleProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter((product) => {
      const matchesSearch = !query || product.name.toLowerCase().includes(query) || product.warehouses.some((warehouse) => warehouse.warehouseName.toLowerCase().includes(query));
      const matchesWarehouse = warehouseFilter === 'ALL' || product.warehouses.some((warehouse) => String(warehouse.warehouseId) === warehouseFilter);
      return matchesSearch && matchesWarehouse;
    });
  }, [products, search, warehouseFilter]);

  const totalWarehouses = products.reduce((count, product) => count + product.warehouses.length, 0);
  const totalAvailable = products.reduce((count, product) => count + product.warehouses.reduce((sum, warehouse) => sum + warehouse.availableStock, 0), 0);
  const lowStockThreshold = 3;

  return (
    <main className="stack">
      <section className="section-hero" id="how-it-works">
        <div>
          <span className="eyebrow">Catalog overview</span>
          <h1 className="page-title">Products by warehouse</h1>
          <p className="page-copy">A focused dashboard to inspect stock, compare warehouses, and open a reservation flow in one click.</p>
        </div>
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-card__label">Products</div>
            <div className="stat-card__value">{products.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__label">Warehouses</div>
            <div className="stat-card__value">{totalWarehouses}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__label">Available units</div>
            <div className="stat-card__value">{totalAvailable}</div>
          </div>
        </div>

        <div className="filter-row filter-row--products">
          <label className="search-field">
            <span>Search</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products or warehouses" />
          </label>

          <label className="search-field">
            <span>Warehouse</span>
            <select value={warehouseFilter} onChange={(event) => setWarehouseFilter(event.target.value)}>
              <option value="ALL">All warehouses</option>
              {warehouseOptions.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {loading && <div className="status-card">Loading inventory...</div>}
      {error && <div className="status-card status-card--error">{error}</div>}

      {!loading && !error && visibleProducts.length === 0 && <div className="status-card">No products found for the current search.</div>}

      <section className="product-grid">
        {visibleProducts.map((product) => (
          <article key={product.id} className="product-card">
            <div className="product-card__header">
              <div>
                <span className="product-kicker">Product {product.id}</span>
                <h2>{product.name}</h2>
                <div className="product-price">From {formatMoney(product.pricePaise)}</div>
              </div>
              <div className="product-badge">{product.warehouses.length} warehouses</div>
            </div>

            <div className="warehouse-list">
              {product.warehouses
                .filter((warehouse) => warehouseFilter === 'ALL' || String(warehouse.warehouseId) === warehouseFilter)
                .map((warehouse) => {
                const totalStock = Math.max(warehouse.totalStock, 1);
                const availablePercent = Math.max(0, Math.min(100, Math.round((warehouse.availableStock / totalStock) * 100)));
                const isLowStock = warehouse.availableStock <= lowStockThreshold;

                return (
                  <div key={warehouse.warehouseId} className={`warehouse-row ${isLowStock ? 'warehouse-row--low' : ''}`}>
                    <div className="warehouse-row__top">
                      <div>
                        <div className="warehouse-name">{warehouse.warehouseName}</div>
                        <div className="warehouse-meta">Reserved {warehouse.reservedStock} of {warehouse.totalStock}</div>
                      </div>
                      <div className={`warehouse-stock ${isLowStock ? 'warehouse-stock--low' : ''}`}>
                        {warehouse.availableStock} available
                      </div>
                    </div>
                    <div className="progress-bar" aria-hidden="true">
                      <span style={{ width: `${availablePercent}%` }} />
                    </div>
                    <div className="warehouse-row__bottom">
                      <span className={`warehouse-pill ${isLowStock ? 'warehouse-pill--low' : ''}`}>
                        {isLowStock ? 'Low stock' : 'In stock'}
                      </span>
                      <a href={`/reserve/${product.id}?warehouseId=${warehouse.warehouseId}`} className="button button--small button--primary">Reserve</a>
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
