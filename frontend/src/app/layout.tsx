import './globals.css';
import { ToastProvider } from '../components/toast';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          <div className="site-shell">
            <header className="site-header">
              <div>
                <div className="site-brand">Allo Inventory</div>
                <div className="site-subtitle">Reserve stock with confidence</div>
              </div>
              <nav className="site-nav">
                <a href="/">Home</a>
                <a href="/products">Products</a>
                <a href="/reservations">Reservations</a>
              </nav>
            </header>
            <div className="site-shell__inner">{children}</div>
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
