import { PrismaClient, Category } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';


const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);


const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding Dulhe Raja catalog...');

  await prisma.product.deleteMany();

  const premiumSherwani = await prisma.product.create({
    data: {
      name: 'Royal Zardosi Velvet Sherwani',
      description: 'Handcrafted maroon velvet sherwani with heavy gold zardosi embroidery, perfect for the main wedding ceremony.',
      category: Category.SHERWANI,
      fabricType: 'Velvet',
      basePrice: 18500.00,
      allowsCustomTailoring: true,
      variants: {
        create: [
          { color: 'Maroon & Gold', size: 'M', sku: 'SHR-VEL-MAR-M', stock: 2 },
          { color: 'Maroon & Gold', size: 'L', sku: 'SHR-VEL-MAR-L', stock: 4 },
          { color: 'Maroon & Gold', size: 'XL', sku: 'SHR-VEL-MAR-XL', stock: 1, priceAdjustment: 1000.00 },
        ],
      },
      images: {
        create: [
          { s3Url: 'https://example-s3-bucket.com/sherwani-maroon-front.jpg', altText: 'Front view of maroon sherwani', isPrimary: true },
          { s3Url: 'https://example-s3-bucket.com/sherwani-maroon-detail.jpg', altText: 'Close up of zardosi work', isPrimary: false },
        ],
      },
    },
  });

  
  const silkKurta = await prisma.product.create({
    data: {
      name: 'Classic Mustard Silk Kurta',
      description: 'Lightweight raw silk kurta for Haldi or Sangeet functions.',
      category: Category.KURTA,
      fabricType: 'Raw Silk',
      basePrice: 3500.00,
      allowsCustomTailoring: false,
      variants: {
        create: [
          { color: 'Mustard Yellow', size: 'S', sku: 'KUR-SLK-MUS-S', stock: 10 },
          { color: 'Mustard Yellow', size: 'M', sku: 'KUR-SLK-MUS-M', stock: 15 },
        ],
      },
      images: {
        create: [
          { s3Url: 'https://example-s3-bucket.com/kurta-mustard-front.jpg', altText: 'Mustard yellow kurta', isPrimary: true },
        ],
      },
    },
  });

  console.log(`Successfully seeded ${premiumSherwani.name} and ${silkKurta.name}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });