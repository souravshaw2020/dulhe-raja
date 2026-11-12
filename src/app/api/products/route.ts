import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Category, Prisma } from "@prisma/client";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth";

// ==========================================
// 1. ZOD SCHEMAS FOR VALIDATION (POST)
// ==========================================
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

// ==========================================
// 2. POST ROUTE: CREATE A NEW PRODUCT
// ==========================================
export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    // Validate incoming JSON against the Zod schema
    const result = productSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          error: "Invalid product data",
          details: result.error.format(),
        },
        { status: 400 },
      );
    }

    const validatedData = result.data;

    // Insert into the database with nested writes
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
      { status: 500 },
    );
  }
}

// ==========================================
// 3. GET ROUTE: FETCH, FILTER, & PAGINATE
// ==========================================
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // Extract URL parameters
  const searchQuery = searchParams.get("q")?.trim();
  const categoryParam = searchParams.get("category");
  const minPriceParam = searchParams.get("minPrice");
  const maxPriceParam = searchParams.get("maxPrice");
  const sortParam = searchParams.get("sort");
  const sizeParam = searchParams.get("size");
  const colorParam = searchParams.get("color");
  const inStockOnly = searchParams.get("inStock") === "true";

  // Pagination setup
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "10", 10);
  const safePage = Math.max(1, page);
  const safeLimit = Math.max(1, Math.min(100, limit));
  const skip = (safePage - 1) * safeLimit;

  // Initialize the dynamic WHERE clause
  const whereClause: Prisma.ProductWhereInput = {};

  // Apply Text Search
  if (searchQuery) {
    whereClause.OR = [
      { name: { contains: searchQuery, mode: "insensitive" } },
      { description: { contains: searchQuery, mode: "insensitive" } },
    ];
  }

  // Apply Category Filter
  if (categoryParam) {
    const validCategories = Object.values(Category) as string[];
    if (!validCategories.includes(categoryParam)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }
    whereClause.category = categoryParam as Category;
  }

  // Apply Price Filters
  if (minPriceParam || maxPriceParam) {
    whereClause.basePrice = {};
    if (minPriceParam && !Number.isNaN(parseFloat(minPriceParam))) {
      whereClause.basePrice.gte = parseFloat(minPriceParam);
    }
    if (maxPriceParam && !Number.isNaN(parseFloat(maxPriceParam))) {
      whereClause.basePrice.lte = parseFloat(maxPriceParam);
    }
  }

  // Apply Relational Filters (Size, Color, Stock)
  if (sizeParam || colorParam || inStockOnly) {
    whereClause.variants = {
      some: {
        ...(sizeParam && { size: { equals: sizeParam, mode: "insensitive" } }),
        ...(colorParam && {
          color: { equals: colorParam, mode: "insensitive" },
        }),
        ...(inStockOnly && { stock: { gt: 0 } }),
      },
    };
  }

  // Apply Sorting Logic
  let orderByClause: Prisma.ProductOrderByWithRelationInput = {
    createdAt: "desc",
  };
  if (sortParam === "price_asc") orderByClause = { basePrice: "asc" };
  else if (sortParam === "price_desc") orderByClause = { basePrice: "desc" };
  else if (sortParam === "oldest") orderByClause = { createdAt: "asc" };

  try {
    const [products, totalCount] = await Promise.all([
      prisma.product.findMany({
        where: whereClause,
        orderBy: orderByClause,
        skip,
        take: safeLimit,
        include: { variants: true, images: true },
      }),
      prisma.product.count({ where: whereClause }),
    ]);

    const totalPages = Math.ceil(totalCount / safeLimit);

    return NextResponse.json({
      data: products,
      pagination: {
        total: totalCount,
        page: safePage,
        limit: safeLimit,
        totalPages,
        hasNextPage: safePage < totalPages,
        hasPrevPage: safePage > 1,
      },
    });
  } catch (error) {
    console.error("Database query failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch catalog" },
      { status: 500 },
    );
  }
}
