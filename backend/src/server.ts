import 'dotenv/config';
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import prisma from './prisma';
import { z } from 'zod';
import Razorpay from 'razorpay';
import { createHmac, randomUUID } from 'crypto';

type IdempotentStoredResponse = {
  status: number;
  body: any;
};

type ProductRow = {
  id: number;
  name: string;
  pricePaise: number;
  warehouses: {
    warehouseId: number;
    warehouseName: string;
    totalStock: number;
    reservedStock: number;
    availableStock: number;
  }[];
};

type DemoReservation = {
  id: string;
  productId: number;
  warehouseId: number;
  quantity: number;
  amountPaise: number;
  currency: string;
  status: 'PENDING' | 'CONFIRMED' | 'RELEASED';
  expiresAt: Date;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
};

const useDemoData = !process.env.DATABASE_URL;
const useRazorpay = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

const razorpayClient = useRazorpay
  ? new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID as string,
      key_secret: process.env.RAZORPAY_KEY_SECRET as string
    })
  : null;

const currency = 'INR';
const productPricing = new Map<number, number>([
  [1, 129900],
  [2, 24900],
  [3, 189900]
]);

const idempotencyStore = new Map<string, IdempotentStoredResponse>();

type ReservationListItem = {
  id: string;
  productId: number;
  productName: string;
  warehouseId: number;
  warehouseName: string;
  quantity: number;
  amountPaise: number;
  currency: string;
  status: 'PENDING' | 'CONFIRMED' | 'RELEASED';
  expiresAt: Date;
  createdAt?: Date;
};

const demoState = {
  products: [
    { id: 1, name: 'iPhone 15', pricePaise: 129900 },
    { id: 2, name: 'AirPods Pro', pricePaise: 24900 },
    { id: 3, name: 'MacBook Pro', pricePaise: 189900 }
  ],
  warehouses: [
    { id: 1, name: 'Delhi Warehouse' },
    { id: 2, name: 'Bengaluru Warehouse' }
  ],
  inventories: [
    { productId: 1, warehouseId: 1, totalStock: 10, reservedStock: 0 },
    { productId: 1, warehouseId: 2, totalStock: 5, reservedStock: 0 },
    { productId: 2, warehouseId: 1, totalStock: 10, reservedStock: 0 },
    { productId: 2, warehouseId: 2, totalStock: 5, reservedStock: 0 },
    { productId: 3, warehouseId: 1, totalStock: 10, reservedStock: 0 },
    { productId: 3, warehouseId: 2, totalStock: 5, reservedStock: 0 }
  ],
  reservations: [] as DemoReservation[]
};

function getDemoProducts(): ProductRow[] {
  return demoState.products.map((product) => ({
    id: product.id,
    name: product.name,
    pricePaise: product.pricePaise,
    warehouses: demoState.inventories
      .filter((inventory) => inventory.productId === product.id)
      .map((inventory) => {
        const warehouse = demoState.warehouses.find((entry) => entry.id === inventory.warehouseId)!;
        return {
          warehouseId: inventory.warehouseId,
          warehouseName: warehouse.name,
          totalStock: inventory.totalStock,
          reservedStock: inventory.reservedStock,
          availableStock: inventory.totalStock - inventory.reservedStock
        };
      })
  }));
}

function findDemoInventory(productId: number, warehouseId: number) {
  return demoState.inventories.find((inventory) => inventory.productId === productId && inventory.warehouseId === warehouseId);
}

function findDemoReservation(id: string) {
  return demoState.reservations.find((reservation) => reservation.id === id);
}

function getProductPricePaise(productId: number) {
  return useDemoData
    ? demoState.products.find((product) => product.id === productId)?.pricePaise || 0
    : productPricing.get(productId) || 0;
}

function verifyRazorpaySignature(orderId: string, paymentId: string, signature: string) {
  if (!process.env.RAZORPAY_KEY_SECRET) return false;
  const expectedSignature = createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
  return expectedSignature === signature;
}

function getDemoReservations(): ReservationListItem[] {
  return demoState.reservations.map((reservation) => ({
    id: reservation.id,
    productId: reservation.productId,
    productName: demoState.products.find((product) => product.id === reservation.productId)?.name || `Product ${reservation.productId}`,
    warehouseId: reservation.warehouseId,
    warehouseName: demoState.warehouses.find((warehouse) => warehouse.id === reservation.warehouseId)?.name || `Warehouse ${reservation.warehouseId}`,
    quantity: reservation.quantity,
    amountPaise: reservation.amountPaise,
    currency: reservation.currency,
    status: reservation.status,
    expiresAt: reservation.expiresAt
  }));
}

function getIdempotencyKey(req: express.Request) {
  const headerValue = req.header('Idempotency-Key');
  return headerValue && headerValue.trim() ? headerValue.trim() : null;
}

function getIdempotencyStoreKey(req: express.Request, resourceId?: string) {
  const key = getIdempotencyKey(req);
  if (!key) return null;
  return [req.method, req.path, resourceId || '', key].join('|');
}

function sendIdempotentResponse(req: express.Request, res: express.Response, body: any, status = 200) {
  const storeKey = getIdempotencyStoreKey(req);
  if (storeKey) {
    idempotencyStore.set(storeKey, { status, body });
  }
  return res.status(status).json(body);
}

function replayIdempotentResponse(req: express.Request, res: express.Response, resourceId?: string) {
  const storeKey = getIdempotencyStoreKey(req, resourceId);
  if (!storeKey) return null;
  const stored = idempotencyStore.get(storeKey);
  if (!stored) return null;
  return res.status(stored.status).json(stored.body);
}

class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const RESERVATION_TTL_SECONDS = Number(process.env.RESERVATION_TTL_SECONDS || 600);

app.get('/api/products', async (req, res) => {
  if (useDemoData) {
    return res.json(getDemoProducts());
  }

  const products = await prisma.product.findMany({ include: { inventories: { include: { warehouse: true } } } });
  const result = products.map((p) => ({
    id: p.id,
    name: p.name,
    pricePaise: p.pricePaise,
    warehouses: p.inventories.map((inv) => ({
      warehouseId: inv.warehouseId,
      warehouseName: inv.warehouse.name,
      totalStock: inv.totalStock,
      reservedStock: inv.reservedStock,
      availableStock: inv.totalStock - inv.reservedStock
    }))
  }));
  res.json(result);
});

app.get('/api/warehouses', async (req, res) => {
  if (useDemoData) {
    return res.json(demoState.warehouses);
  }

  const warehouses = await prisma.warehouse.findMany();
  res.json(warehouses);
});

const reservationBody = z.object({ productId: z.number(), warehouseId: z.number(), quantity: z.number().min(1) });
const razorpayConfirmBody = z.object({
  provider: z.enum(['razorpay', 'mock']).optional(),
  razorpayOrderId: z.string().optional(),
  razorpayPaymentId: z.string().optional(),
  razorpaySignature: z.string().optional()
});

app.post('/api/reservations', async (req, res) => {
  const replayed = replayIdempotentResponse(req, res);
  if (replayed) return replayed;

  const parsed = reservationBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const { productId, warehouseId, quantity } = parsed.data;
  const expiresAt = new Date(Date.now() + RESERVATION_TTL_SECONDS * 1000);
  const amountPaise = useDemoData ? getProductPricePaise(productId) * quantity : 0;
  if (useDemoData && !amountPaise) return res.status(404).json({ error: 'Product price not configured' });

  if (useDemoData) {
    const inv = findDemoInventory(productId, warehouseId);
    if (!inv) return res.status(404).json({ error: 'Inventory not found' });

    const available = inv.totalStock - inv.reservedStock;
    if (available < quantity) return res.status(409).json({ error: 'Not enough stock available' });

    inv.reservedStock += quantity;
    const reservation: DemoReservation = {
      id: randomUUID(),
      productId,
      warehouseId,
      quantity,
      amountPaise,
      currency,
      status: 'PENDING',
      expiresAt
    };
    demoState.reservations.push(reservation);
    return sendIdempotentResponse(req, res, { reservation, inventory: inv });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const rows: any[] = await tx.$queryRaw`
        SELECT * FROM "Inventory" WHERE "productId" = ${productId} AND "warehouseId" = ${warehouseId} FOR UPDATE
      `;
      const inv = rows[0];
      if (!inv) throw new ApiError(404, 'Inventory not found');
      const available = inv.totalStock - inv.reservedStock;
      if (available < quantity) throw new ApiError(409, 'Not enough stock available');

      const product = await tx.product.findUnique({ where: { id: productId } });
      if (!product || !product.pricePaise) throw new ApiError(404, 'Product price not configured');

      const updated = await tx.inventory.update({ where: { id: inv.id }, data: { reservedStock: { increment: quantity } } });
      const reservation = await tx.reservation.create({ data: { productId, warehouseId, quantity, expiresAt, amountPaise: product.pricePaise * quantity, currency } });
      return { reservation, inventory: updated };
    });

    return sendIdempotentResponse(req, res, result);
  } catch (err: any) {
    if (err instanceof ApiError) return res.status(err.status).json({ error: err.message });
    console.error(err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

app.post('/api/reservations/:id/razorpay-order', async (req, res) => {
  try {
    const { id } = req.params;
    const replayed = replayIdempotentResponse(req, res, id);
    if (replayed) return replayed;

    if (useDemoData) {
      const reservation = findDemoReservation(id);
      if (!reservation) return res.status(404).json({ error: 'Reservation not found' });
      if (reservation.status !== 'PENDING') return res.status(400).json({ error: 'Reservation not pending' });
      if (reservation.expiresAt < new Date()) return res.status(410).json({ error: 'Reservation expired' });

      let orderProvider: 'razorpay' | 'mock' = 'mock';
      let orderKeyId = 'mock_key';

      if (razorpayClient && process.env.RAZORPAY_KEY_ID) {
        try {
          if (!reservation.razorpayOrderId) {
            const order = await razorpayClient.orders.create({
              amount: reservation.amountPaise,
              currency: reservation.currency,
              receipt: reservation.id,
              notes: {
                reservationId: reservation.id,
                productId: String(reservation.productId),
                warehouseId: String(reservation.warehouseId)
              }
            });
            reservation.razorpayOrderId = order.id;
          }

          orderProvider = 'razorpay';
          orderKeyId = process.env.RAZORPAY_KEY_ID;
        } catch (err: any) {
          console.warn('Razorpay order creation failed, using mock checkout for demo mode.', err?.statusCode || err?.code || err);
        }
      }

      if (!reservation.razorpayOrderId) {
        reservation.razorpayOrderId = `order_demo_${randomUUID()}`;
      }

      return sendIdempotentResponse(req, res, {
        provider: orderProvider,
        keyId: orderKeyId,
        orderId: reservation.razorpayOrderId,
        amountPaise: reservation.amountPaise,
        currency: reservation.currency,
        reservationId: reservation.id,
        productName: demoState.products.find((product) => product.id === reservation.productId)?.name || 'Product',
        warehouseName: demoState.warehouses.find((warehouse) => warehouse.id === reservation.warehouseId)?.name || 'Warehouse'
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUnique({ where: { id } });
      if (!reservation) throw new ApiError(404, 'Reservation not found');
      if (reservation.status !== 'PENDING') throw new ApiError(400, 'Reservation not pending');
      if (reservation.expiresAt < new Date()) throw new ApiError(410, 'Reservation expired');

      if (reservation.razorpayOrderId) {
        return {
          provider: 'razorpay' as const,
          keyId: process.env.RAZORPAY_KEY_ID || '',
          orderId: reservation.razorpayOrderId,
          amountPaise: reservation.amountPaise,
          currency: reservation.currency,
          reservationId: reservation.id,
          productName: (await tx.product.findUnique({ where: { id: reservation.productId } }))?.name || 'Product',
          warehouseName: (await tx.warehouse.findUnique({ where: { id: reservation.warehouseId } }))?.name || 'Warehouse'
        };
      }

      if (!razorpayClient || !process.env.RAZORPAY_KEY_ID) throw new ApiError(503, 'Razorpay is not configured');

      const product = await tx.product.findUnique({ where: { id: reservation.productId } });
      const warehouse = await tx.warehouse.findUnique({ where: { id: reservation.warehouseId } });

      const order = await razorpayClient.orders.create({
        amount: reservation.amountPaise,
        currency: reservation.currency,
        receipt: reservation.id,
        notes: {
          reservationId: reservation.id,
          productId: String(reservation.productId),
          warehouseId: String(reservation.warehouseId)
        }
      });

      await tx.reservation.update({
        where: { id },
        data: { razorpayOrderId: order.id }
      });

      return {
        provider: 'razorpay' as const,
        keyId: process.env.RAZORPAY_KEY_ID,
        orderId: order.id,
        amountPaise: reservation.amountPaise,
        currency: reservation.currency,
        reservationId: reservation.id,
        productName: product?.name || 'Product',
        warehouseName: warehouse?.name || 'Warehouse'
      };
    });

    return sendIdempotentResponse(req, res, result);
  } catch (err: any) {
    if (err instanceof ApiError) return res.status(err.status).json({ error: err.message });
    console.error(err);
    return res.status(500).json({ error: 'Unable to create Razorpay order' });
  }
});

app.post('/api/reservations/:id/confirm', async (req, res) => {
  const { id } = req.params;

  const replayed = replayIdempotentResponse(req, res, id);
  if (replayed) return replayed;

  const parsedPayment = razorpayConfirmBody.safeParse(req.body || {});
  if (!parsedPayment.success) return res.status(400).json({ error: 'Invalid payment payload' });
  const paymentPayload = parsedPayment.data;

  if (useDemoData) {
    const reservation = findDemoReservation(id);
    if (!reservation) return res.status(404).json({ error: 'Reservation not found' });
    if (reservation.status === 'CONFIRMED') {
      return sendIdempotentResponse(req, res, { reservation });
    }
    if (reservation.status !== 'PENDING') return res.status(400).json({ error: 'Reservation not pending' });
    if (reservation.expiresAt < new Date()) return res.status(410).json({ error: 'Reservation expired' });

    if (reservation.razorpayOrderId) {
      const provider = paymentPayload.provider;
      if (!provider) return res.status(400).json({ error: 'Payment verification required' });
      if (provider === 'razorpay') {
        if (!paymentPayload.razorpayOrderId || !paymentPayload.razorpayPaymentId || !paymentPayload.razorpaySignature) {
          return res.status(400).json({ error: 'Missing Razorpay payment fields' });
        }
        const signatureIsValid = verifyRazorpaySignature(paymentPayload.razorpayOrderId, paymentPayload.razorpayPaymentId, paymentPayload.razorpaySignature);
        if (!signatureIsValid) return res.status(400).json({ error: 'Invalid Razorpay signature' });
        if (paymentPayload.razorpayOrderId !== reservation.razorpayOrderId) return res.status(400).json({ error: 'Order mismatch' });
        reservation.razorpayPaymentId = paymentPayload.razorpayPaymentId;
        reservation.razorpaySignature = paymentPayload.razorpaySignature;
      }
    }

    const inv = findDemoInventory(reservation.productId, reservation.warehouseId);
    if (!inv) return res.status(404).json({ error: 'Inventory not found' });
    if (inv.reservedStock < reservation.quantity) return res.status(500).json({ error: 'Reserved stock inconsistency' });

    inv.totalStock -= reservation.quantity;
    inv.reservedStock -= reservation.quantity;
    reservation.status = 'CONFIRMED';
    return sendIdempotentResponse(req, res, { reservation });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUnique({ where: { id } });
      if (!reservation) throw new ApiError(404, 'Reservation not found');
      if (reservation.status === 'CONFIRMED') {
        return { reservation };
      }
      if (reservation.status !== 'PENDING') throw new ApiError(400, 'Reservation not pending');
      if (reservation.expiresAt < new Date()) throw new ApiError(410, 'Reservation expired');

      if (reservation.razorpayOrderId) {
        if (!paymentPayload.provider) {
          throw new ApiError(400, 'Payment verification required');
        }
        if (!paymentPayload.razorpayOrderId || !paymentPayload.razorpayPaymentId || !paymentPayload.razorpaySignature) {
          throw new ApiError(400, 'Missing Razorpay payment fields');
        }
        if (paymentPayload.razorpayOrderId !== reservation.razorpayOrderId) throw new ApiError(400, 'Order mismatch');
        const signatureIsValid = verifyRazorpaySignature(paymentPayload.razorpayOrderId, paymentPayload.razorpayPaymentId, paymentPayload.razorpaySignature);
        if (!signatureIsValid) throw new ApiError(400, 'Invalid Razorpay signature');
      }

      const rows: any[] = await tx.$queryRaw`
        SELECT * FROM "Inventory" WHERE "productId" = ${reservation.productId} AND "warehouseId" = ${reservation.warehouseId} FOR UPDATE
      `;
      const inv = rows[0];
      if (!inv) throw new ApiError(404, 'Inventory not found');
      if (inv.reservedStock < reservation.quantity) throw new ApiError(500, 'Reserved stock inconsistency');

      await tx.inventory.update({ where: { id: inv.id }, data: { totalStock: { decrement: reservation.quantity }, reservedStock: { decrement: reservation.quantity } } });
      const updatedRes = await tx.reservation.update({
        where: { id },
        data: {
          status: 'CONFIRMED',
          razorpayOrderId: paymentPayload.razorpayOrderId || reservation.razorpayOrderId,
          razorpayPaymentId: paymentPayload.razorpayPaymentId,
          razorpaySignature: paymentPayload.razorpaySignature
        }
      });
      return { reservation: updatedRes };
    });

    return sendIdempotentResponse(req, res, result);
  } catch (err: any) {
    if (err instanceof ApiError) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Internal error' });
  }
});

app.post('/api/reservations/:id/release', async (req, res) => {
  const { id } = req.params;

  if (useDemoData) {
    const reservation = findDemoReservation(id);
    if (!reservation) return res.status(404).json({ error: 'Reservation not found' });
    if (reservation.status !== 'PENDING') return res.status(400).json({ error: 'Reservation not pending' });

    const inv = findDemoInventory(reservation.productId, reservation.warehouseId);
    if (!inv) return res.status(404).json({ error: 'Inventory not found' });

    inv.reservedStock -= reservation.quantity;
    reservation.status = 'RELEASED';
    return res.json({ reservation });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUnique({ where: { id } });
      if (!reservation) throw new ApiError(404, 'Reservation not found');
      if (reservation.status !== 'PENDING') throw new ApiError(400, 'Reservation not pending');

      const rows: any[] = await tx.$queryRaw`
        SELECT * FROM "Inventory" WHERE "productId" = ${reservation.productId} AND "warehouseId" = ${reservation.warehouseId} FOR UPDATE
      `;
      const inv = rows[0];
      if (!inv) throw new ApiError(404, 'Inventory not found');

      await tx.inventory.update({ where: { id: inv.id }, data: { reservedStock: { decrement: reservation.quantity } } });
      const updatedRes = await tx.reservation.update({ where: { id }, data: { status: 'RELEASED' } });
      return { reservation: updatedRes };
    });

    res.json(result);
  } catch (err: any) {
    if (err instanceof ApiError) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Internal error' });
  }
});

app.get('/api/reservations', async (req, res) => {
  if (useDemoData) {
    return res.json(getDemoReservations());
  }

  const reservations = await prisma.reservation.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      product: true,
      warehouse: true
    }
  });

  return res.json(
    reservations.map((reservation) => ({
      id: reservation.id,
      productId: reservation.productId,
      productName: reservation.product.name,
      warehouseId: reservation.warehouseId,
      warehouseName: reservation.warehouse.name,
      quantity: reservation.quantity,
      amountPaise: reservation.amountPaise,
      currency: reservation.currency,
      status: reservation.status,
      expiresAt: reservation.expiresAt,
      createdAt: reservation.createdAt
    }))
  );
});

app.post('/api/cleanup', async (req, res) => {
  const now = new Date();

  if (useDemoData) {
    const expired = demoState.reservations.filter((reservation) => reservation.status === 'PENDING' && reservation.expiresAt < now);
    for (const reservation of expired) {
      const inv = findDemoInventory(reservation.productId, reservation.warehouseId);
      if (inv) inv.reservedStock -= reservation.quantity;
      reservation.status = 'RELEASED';
    }
    return res.json({ released: expired.length });
  }

  try {
    const expired = await prisma.reservation.findMany({ where: { status: 'PENDING', expiresAt: { lt: now } } });
    for (const r of expired) {
      await prisma.$transaction(async (tx) => {
        const rows: any[] = await tx.$queryRaw`
          SELECT * FROM "Inventory" WHERE "productId" = ${r.productId} AND "warehouseId" = ${r.warehouseId} FOR UPDATE
        `;
        const inv = rows[0];
        if (inv) await tx.inventory.update({ where: { id: inv.id }, data: { reservedStock: { decrement: r.quantity } } });
        await tx.reservation.update({ where: { id: r.id }, data: { status: 'RELEASED' } });
      });
    }
    res.json({ released: expired.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Cleanup failed' });
  }
});

const port = Number(process.env.PORT || 4000);
app.listen(port, () => console.log(`Backend listening on http://localhost:${port}`));
