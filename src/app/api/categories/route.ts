import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Category } from "@prisma/client";
import { getAdminSession } from "@/lib/auth";

// GET /api/categories
export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  try {
    const [fabricTypes, variants, priceBounds] = await Promise.all([
      prisma.product.findMany({
        select: { fabricType: true },
        distinct: ["fabricType"],
      }),
      prisma.productVariant.findMany({
        select: { size: true, color: true },
        distinct: ["size", "color"],
      }),
      prisma.product.aggregate({
        _min: { basePrice: true },
        _max: { basePrice: true },
      }),
    ]);

    const sizes = Array.from(new Set(variants.map((v) => v.size)));
    const colors = Array.from(new Set(variants.map((v) => v.color)));

    return NextResponse.json({
      categories: Object.values(Category),
      fabrics: fabricTypes.map((f) => f.fabricType),
      sizes,
      colors,
      priceRange: {
        min: priceBounds._min.basePrice ? Number(priceBounds._min.basePrice) : 0,
        max: priceBounds._max.basePrice ? Number(priceBounds._max.basePrice) : 0,
      },
    });
  } catch (error) {
    console.error("Error fetching filter metadata:", error);
    return NextResponse.json({ error: "Failed to fetch categories and filters" }, { status: 500 });
  }
}