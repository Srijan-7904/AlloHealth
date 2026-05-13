# Allo Health

A full-stack inventory reservation and payment system with product reservation capabilities and integrated Razorpay checkout.

---

# 🚀 Features

- ✅ Inventory Reservation System
- ✅ Razorpay Payment Integration
- ✅ Reservation Expiry with TTL
- ✅ Idempotent APIs
- ✅ PostgreSQL + Prisma ORM
- ✅ Demo Mode without DB
- ✅ Responsive Modern UI
- ✅ Full TypeScript Support

---

# 🏗️ Project Structure

```bash
allo-health/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   ├── src/
│   │   ├── server.ts
│   │   └── prisma.ts
│   └── package.json
│
├── frontend/
│   ├── public/
│   ├── screenshots/
│   │   ├── home.png
│   │   ├── reservation.png
│   │   ├── checkout.png
│   │   ├── confirmation.png
│   │   └── mobile.png
│   │
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   └── lib/
│   │
│   └── package.json
│
└── README.md
```

---

# 🛠️ Tech Stack

## Backend

- Node.js
- Express.js
- TypeScript
- Prisma ORM
- PostgreSQL
- Razorpay
- Zod Validation

## Frontend

- Next.js 14
- React 18
- TailwindCSS
- React Query
- TypeScript

---

# ⚡ Getting Started

## Prerequisites

- Node.js 18+
- npm or yarn
- PostgreSQL (Optional)

---

# 📦 Installation

## 1️⃣ Clone Repository

```bash
git clone <repository-url>
cd allo-health
```

---

# 🔧 Backend Setup

## Install Dependencies

```bash
cd backend
npm install
```

## Create `.env`

```env
PORT=4000
RESERVATION_TTL_SECONDS=600

# Optional
DATABASE_URL=postgresql://user:password@localhost:5432/allo_health

# Razorpay
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=xxxxxxxx
```

## Run Database Migration

```bash
npm run prisma:migrate
```

## Seed Database

```bash
npm run prisma:seed
```

## Start Backend

```bash
npm run dev
```

Backend runs on:

```bash
http://localhost:4000
```

---

# 💻 Frontend Setup

## Install Dependencies

```bash
cd frontend
npm install
```

## Create `.env.local`

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
```

## Start Frontend

```bash
npm run dev
```

Frontend runs on:

```bash
http://localhost:3000
```

---

# 📸 Screenshots

## 🏠 Home Page

Main inventory dashboard with available products.

<img width="1755" height="868" alt="image" src="https://github.com/user-attachments/assets/e626a80a-ca8c-4e96-8b0e-5fff0645120e" />

---

## 📦 Product Reservation

Reserve products with quantity selection.

<img width="1533" height="846" alt="image" src="https://github.com/user-attachments/assets/d4c82d8a-230a-4506-a780-7df047600dfc" />
<img width="1735" height="851" alt="image" src="https://github.com/user-attachments/assets/414db589-115e-44e6-8129-c82f4013ce59" />


---

## 💳 Razorpay Checkout

Integrated Razorpay payment flow.
<img width="1757" height="860" alt="image" src="https://github.com/user-attachments/assets/01e2f53b-ce79-42ca-8c8f-f9a05e394237" />

---

## ✅ Reservation Confirmation

Successful reservation confirmation screen.

<img width="1367" height="832" alt="image" src="https://github.com/user-attachments/assets/690cbbf6-b4e4-4ee7-a824-e89a79471008" />

---

## 📱 Mobile Responsive UI

Responsive mobile-friendly design.

<img width="593" height="753" alt="image" src="https://github.com/user-attachments/assets/8efd98d1-e7e6-4474-a841-13f4633c1556" />

---

# 🔌 API Documentation

# Create Reservation

```http
POST /api/reservations
```

## Headers

```http
Content-Type: application/json
Idempotency-Key: unique-key
```

## Body

```json
{
  "productId": 1,
  "warehouseId": 1,
  "quantity": 2
}
```

---

# Create Razorpay Order

```http
POST /api/reservations/:id/razorpay-order
```

---

# Confirm Reservation

```http
POST /api/reservations/:id/confirm
```

## Body

```json
{
  "razorpayPaymentId": "pay_...",
  "razorpayOrderId": "order_...",
  "razorpaySignature": "..."
}
```

---

# 💳 Payment Flow

1. Create Reservation
2. Generate Razorpay Order
3. Complete Checkout
4. Verify Payment
5. Confirm Reservation

---

# 🔄 Idempotency Support

All POST APIs support safe retries using:

```http
Idempotency-Key
```

Example:

```bash
curl -X POST http://localhost:4000/api/reservations \
-H "Content-Type: application/json" \
-H "Idempotency-Key: reserve-123" \
-d '{"productId":1,"warehouseId":1,"quantity":2}'
```

---

# ⏳ Reservation Expiry

Reservations expire automatically based on:

```env
RESERVATION_TTL_SECONDS
```

Cleanup endpoint:

```http
POST /api/reservations/cleanup
```

---

# 🧪 Demo Mode

Works fully without database setup.

## Demo Features

- In-memory inventory
- Mock payment flow
- No PostgreSQL required
- No Razorpay keys required

Perfect for:
- Local testing
- College projects
- Quick demos

---

# 📜 Development Scripts

## Backend

```bash
npm run dev
npm run build
npm start
npm run prisma:migrate
npm run prisma:seed
```

## Frontend

```bash
npm run dev
npm run build
npm start
```

---

# 🚀 Production Build

## Backend

```bash
cd backend
npm run build
npm start
```

## Frontend

```bash
cd frontend
npm run build
npm start
```

---

# 🌍 Environment Variables

## Backend Variables

| Variable | Description |
|----------|-------------|
| PORT | Backend Port |
| DATABASE_URL | PostgreSQL URL |
| RESERVATION_TTL_SECONDS | Reservation expiry |
| RAZORPAY_KEY_ID | Razorpay key |
| RAZORPAY_KEY_SECRET | Razorpay secret |

---

## Frontend Variables

| Variable | Description |
|----------|-------------|
| NEXT_PUBLIC_BACKEND_URL | Backend API URL |

---

# 🐛 Troubleshooting

## Database Connection Error

- Check PostgreSQL is running
- Verify DATABASE_URL
- App works in demo mode without DB

---

## Razorpay Issues

If Razorpay keys are missing:

- Mock checkout is automatically enabled
- Useful for development/testing

---

## Frontend Cannot Reach Backend

Verify:

```bash
http://localhost:4000
```

is running.

---

# 📈 Future Improvements

- AI-based inventory prediction
- Agentic AI ordering assistant
- Admin analytics dashboard
- Email/SMS notifications
- Multi-warehouse support
- Redis caching
- Docker deployment
- CI/CD pipeline

---

# 👨‍💻 Author

## Srijan Jaiswal

B.Tech CSE Student  
Full Stack Developer | DevOps Enthusiast

- AWS
- Docker
- Prisma
- Next.js
- TypeScript
- PostgreSQL

---

# 📄 License

This project is licensed under the MIT License.
