# Backend

This API supports inventory reservations, Razorpay checkout creation, and payment verification.

## Environment

Set these variables for a real database + Razorpay setup:

```bash
DATABASE_URL=postgresql://...
PORT=4000
RESERVATION_TTL_SECONDS=600
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
```

If `DATABASE_URL` is missing, the server runs in demo mode with in-memory sample data so the app can still be exercised locally.
If `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` are set, demo mode still creates live Razorpay orders for checkout; otherwise it falls back to the mock checkout path.

## Payment flow

1. Create a reservation with `POST /api/reservations`.
2. Ask the server for a Razorpay order with `POST /api/reservations/:id/razorpay-order`.
3. Complete checkout in the browser.
4. Confirm the reservation with `POST /api/reservations/:id/confirm` using the Razorpay payment IDs and signature.

Once a Razorpay order exists for a reservation, confirmation requires a verified payment payload. This prevents a manual confirm from bypassing the payment step.
If Razorpay keys are not configured, the app falls back to a mock checkout path so the end-to-end flow can still be demonstrated locally.

## Idempotency

Send an `Idempotency-Key` header with `POST /api/reservations`, `POST /api/reservations/:id/razorpay-order`, and `POST /api/reservations/:id/confirm`.

If the same key is reused for the same endpoint, the server returns the original stored response instead of repeating the side effect. The store is in memory in the running server process, so it is best for development and demo use.

Example:

```bash
curl -X POST http://localhost:4000/api/reservations \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: reserve-123" \
  -d '{"productId":1,"warehouseId":1,"quantity":2}'
```

## Expiry

Expired reservations are released by the existing cleanup endpoint. In production you can wire that endpoint to a cron job, or call it from a worker on a schedule.