import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Category, Prisma } from "@prisma/client";

import { z } from "zod";


const variantSchema = z.object({
  color: z.string().min(1, "Color is required"),
  size: z.string().min(1, "Size is required"),
  sku: z.string().min(3, "SKU must be at least 3 characters"),
  stock: z.number().int().nonnegative().default(0),
  priceAdjustment: z.number().optional(),
});

const imageSchema = z.object({
  s3Url: z.string().url("Must be a valid URL"),
  altText: z.string().optional(),
  isPrimary: z.boolean().default(false),
});


const productSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  description: z.string().optional(),
  category: z.enum(["SHERWANI", "KURTA", "PYJAMA", "INDO_WESTERN"]),
  fabricType: z.string().min(1, "Fabric type is required"),
  basePrice: z.number().positive("Base price must be greater than 0"),
  allowsCustomTailoring: z.boolean().default(true),
  variants: z.array(variantSchema).min(1, "At least one variant is required"),
  images: z.array(imageSchema).min(1, "At least one image is required"),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    

    const result = productSchema.safeParse(body);

    
    if (!result.success) {
      return NextResponse.json(
        { 
          error: "Invalid product data", 
          details: result.error.format()
        }, 
        { status: 400 }
      );
    }

    
    const validatedData = result.data;

    const newProduct = await prisma.product.create({
      data: {
        name: validatedData.name,
        description: validatedData.description,
        category: validatedData.category,
        fabricType: validatedData.fabricType,
        basePrice: validatedData.basePrice,
        allowsCustomTailoring: validatedData.allowsCustomTailoring,
        variants: {
          create: validatedData.variants, 
        },
        images: {
          create: validatedData.images,
        },
      },
      include: {
        variants: true,
        images: true,
      },
    });

    return NextResponse.json(newProduct, { status: 201 });
    
  } catch (error) {
    console.error("Error creating product:", error);
    return NextResponse.json(
      { error: "Failed to save the product to the catalog" },
      { status: 500 }
    );
  }
}


export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  
  
  const searchQuery = searchParams.get('q')?.trim();
  const categoryParam = searchParams.get('category');
  const minPriceParam = searchParams.get('minPrice');
  const maxPriceParam = searchParams.get('maxPrice');
  const sortParam = searchParams.get('sort');
  const sizeParam = searchParams.get('size');
  const colorParam = searchParams.get('color');
  const inStockOnly = searchParams.get('inStock') === 'true';
  
  
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '10', 10);
  const safePage = Math.max(1, page);
  const safeLimit = Math.max(1, Math.min(100, limit));
  const skip = (safePage - 1) * safeLimit;

  
  const whereClause: Prisma.ProductWhereInput = {};

  
  if (searchQuery) {
    whereClause.OR = [
      { name: { contains: searchQuery, mode: 'insensitive' } },
      { description: { contains: searchQuery, mode: 'insensitive' } }
    ];
  }

  
  if (categoryParam) {
    const validCategories = Object.values(Category) as string[];
    if (!validCategories.includes(categoryParam)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }
    whereClause.category = categoryParam as Category;
  }

  
  if (minPriceParam || maxPriceParam) {
    whereClause.basePrice = {};
    if (minPriceParam) whereClause.basePrice.gte = parseFloat(minPriceParam);
    if (maxPriceParam) whereClause.basePrice.lte = parseFloat(maxPriceParam);
  }

  
  const andConditions: Prisma.ProductWhereInput[] = [];
  if (sizeParam) andConditions.push({ variants: { some: { size: sizeParam } } });
  if (colorParam) andConditions.push({ variants: { some: { color: colorParam } } });
  if (inStockOnly) andConditions.push({ variants: { some: { stock: { gt: 0 } } } });

  if (andConditions.length > 0) {
    whereClause.AND = andConditions;
  }

  
  let orderByClause: Prisma.ProductOrderByWithRelationInput = { createdAt: 'desc' };
  if (sortParam === 'price_asc') orderByClause = { basePrice: 'asc' };
  else if (sortParam === 'price_desc') orderByClause = { basePrice: 'desc' };
  else if (sortParam === 'newest') orderByClause = { createdAt: 'desc' };

  try {
    
    const [totalProducts, products] = await Promise.all([
      prisma.product.count({ where: whereClause }),
      prisma.product.findMany({
        where: whereClause,
        skip,
        take: safeLimit,
        include: {
          images: { where: { isPrimary: true }, take: 1 },
          variants: { select: { size: true, color: true, stock: true } }
        },
        orderBy: orderByClause
      })
    ]);

    return NextResponse.json({
      data: products,
      metadata: {
        total: totalProducts,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(totalProducts / safeLimit),
      }
    });
  } catch (error) {
    console.error("Database query failed:", error);
    return NextResponse.json({ error: 'Failed to fetch catalog' }, { status: 500 });
  }
}