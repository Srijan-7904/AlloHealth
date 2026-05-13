# Allo Health

A full-stack inventory reservation and payment system with product reservation capabilities and integrated Razorpay checkout.

## Project Structure

```
├── backend/                # Express API + Prisma ORM
│   ├── src/
│   │   ├── server.ts      # Main server entry
│   │   └── prisma.ts      # Database client
│   ├── prisma/
│   │   ├── schema.prisma  # Database schema
│   │   └── seed.ts        # Database seeding
│   └── package.json
└── frontend/              # Next.js application
    ├── src/
    │   ├── app/           # Next.js app directory
    │   ├── components/    # React components
    │   └── lib/           # Utilities
    └── package.json
```

## Features

- **Inventory Reservation**: Create and manage product reservations with automatic TTL expiry
- **Payment Integration**: Razorpay checkout for secure payment processing
- **Idempotent Requests**: Safe retry handling with idempotency keys
- **Demo Mode**: Full functionality works without database setup
- **Type Safety**: TypeScript across frontend and backend
- **Responsive UI**: TailwindCSS with modern design

## Tech Stack

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Language**: TypeScript
- **ORM**: Prisma
- **Database**: PostgreSQL (optional, works in demo mode)
- **Payments**: Razorpay
- **Validation**: Zod

### Frontend
- **Framework**: Next.js 14
- **UI Library**: React 18
- **Styling**: TailwindCSS
- **Data Fetching**: React Query
- **Language**: TypeScript

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- (Optional) PostgreSQL database

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd allo-health
```

2. Install backend dependencies
```bash
cd backend
npm install
```

3. Install frontend dependencies
```bash
cd ../frontend
npm install
```

### Backend Setup

1. Create a `.env` file in the `backend` directory:

```env
PORT=4000
RESERVATION_TTL_SECONDS=600
```

**Optional variables** (for database and payments):
```env
DATABASE_URL=postgresql://user:password@localhost:5432/allo_health
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
```

2. Set up the database (if using PostgreSQL):
```bash
npm run prisma:migrate
npm run prisma:seed
```

3. Start the development server:
```bash
npm run dev
```

The backend will run on `http://localhost:4000`. If `DATABASE_URL` is not set, the server runs in **demo mode** with in-memory sample data.

### Frontend Setup

1. Create a `.env.local` file in the `frontend` directory (optional):

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
```

If not set, defaults to `http://localhost:4000`.

2. Start the development server:
```bash
npm run dev
```

The frontend will run on `http://localhost:3000`.

## API Documentation

### Create Reservation

```bash
POST /api/reservations
Content-Type: application/json
Idempotency-Key: unique-key

{
  "productId": 1,
  "warehouseId": 1,
  "quantity": 2
}
```

### Create Razorpay Order

```bash
POST /api/reservations/:id/razorpay-order
Content-Type: application/json
Idempotency-Key: unique-key

{}
```

### Confirm Reservation

```bash
POST /api/reservations/:id/confirm
Content-Type: application/json
Idempotency-Key: unique-key

{
  "razorpayPaymentId": "pay_...",
  "razorpayOrderId": "order_...",
  "razorpaySignature": "..."
}
```

## Payment Flow

1. **Create Reservation** - Reserve inventory with `POST /api/reservations`
2. **Generate Order** - Request Razorpay order with `POST /api/reservations/:id/razorpay-order`
3. **Checkout** - Complete payment through Razorpay in browser
4. **Confirm** - Verify payment with `POST /api/reservations/:id/confirm`

In demo mode (no Razorpay keys), checkout uses a mock path for testing.

## Idempotency

All POST endpoints support idempotent requests. Include an `Idempotency-Key` header to safely retry requests:

```bash
curl -X POST http://localhost:4000/api/reservations \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: reserve-123" \
  -d '{"productId":1,"warehouseId":1,"quantity":2}'
```

The same key will return the cached response instead of creating duplicates.

## Reservation Expiry

Reservations automatically expire based on `RESERVATION_TTL_SECONDS`. Call the cleanup endpoint to release expired reservations:

```bash
POST /api/reservations/cleanup
```

In production, wire this to a cron job or worker.

## Development Scripts

### Backend

```bash
npm run dev              # Start dev server with hot reload
npm run build            # Build TypeScript
npm start                # Run production build
npm run prisma:migrate   # Run database migrations
npm run prisma:seed      # Seed database with sample data
```

### Frontend

```bash
npm run dev              # Start Next.js dev server
npm run build            # Build for production
npm start                # Start production server
```

## Building for Production

### Backend

```bash
cd backend
npm run build
npm start
```

### Frontend

```bash
cd frontend
npm run build
npm start
```

## Environment Variables Reference

### Backend

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | Server port |
| `DATABASE_URL` | - | PostgreSQL connection string (optional, demo mode if absent) |
| `RESERVATION_TTL_SECONDS` | `600` | Reservation expiry time in seconds |
| `RAZORPAY_KEY_ID` | - | Razorpay API key (optional) |
| `RAZORPAY_KEY_SECRET` | - | Razorpay API secret (optional) |

### Frontend

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_BACKEND_URL` | `http://localhost:4000` | Backend API URL |

## Demo Mode

The application fully works without a database:

- No `DATABASE_URL` required
- In-memory sample inventory data
- Works without Razorpay keys (uses mock checkout)
- Perfect for local development and demos

## Troubleshooting

### Backend won't connect to database
- Check your `DATABASE_URL` is correct
- Ensure PostgreSQL is running
- The app will work in demo mode without a database

### Frontend can't reach backend
- Verify backend is running on `http://localhost:4000`
- Check `NEXT_PUBLIC_BACKEND_URL` environment variable
- Ensure CORS is enabled on the backend

### Razorpay not working
- If `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` are not set, the app uses mock checkout
- This is normal for development

## License

[Add your license here]

## Contact

[Add contact information here]
