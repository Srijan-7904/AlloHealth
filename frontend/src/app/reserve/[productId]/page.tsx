import ReservePageClient from './ReservePageClient';

/**
 * Generate static params for all product IDs so Next.js 
 * can pre‑render the dynamic route during static export.
 */
export async function generateStaticParams() {
  try {
    const apiBase = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000';
    const res = await fetch(`${apiBase}/api/products`);
    if (!res.ok) return [];
    const products = await res.json();
    return products.map((p: any) => ({ productId: p.id.toString() }));
  } catch (e) {
    // Return empty array on failure to prevent build break
    return [];
  }
}

export default function ReservePage() {
  return <ReservePageClient />;
}