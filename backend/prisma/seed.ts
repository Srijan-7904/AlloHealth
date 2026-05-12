import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.reservation.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();

  const wh1 = await prisma.warehouse.create({ data: { name: 'Delhi Warehouse', location: 'Delhi' } });
  const wh2 = await prisma.warehouse.create({ data: { name: 'Bengaluru Warehouse', location: 'Bengaluru' } });

  const products = await prisma.product.createMany({
    data: [
      { name: 'iPhone 15', description: 'Demo phone', pricePaise: 129900 },
      { name: 'AirPods Pro', description: 'Wireless earbuds', pricePaise: 24900 },
      { name: 'MacBook Pro', description: 'Laptop', pricePaise: 189900 }
    ]
  });

  const allProducts = await prisma.product.findMany();

  for (const p of allProducts) {
    await prisma.inventory.create({ data: { productId: p.id, warehouseId: wh1.id, totalStock: 10, reservedStock: 0 } });
    await prisma.inventory.create({ data: { productId: p.id, warehouseId: wh2.id, totalStock: 5, reservedStock: 0 } });
  }

  console.log('Seed completed');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
