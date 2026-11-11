import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { getAdminSession } from "@/lib/auth";

const createVariantSchema = z.object({
  color: z.string().min(1, "Color is required"),
  size: z.string().min(1, "Size is required"),
  sku: z.string().min(3, "SKU must be at least 3 characters"),
  stock: z.number().int().nonnegative().default(0),
  priceAdjustment: z.number().optional().nullable(),
});

// POST /api/products/[id]/variants
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: productId } = await params;
    const body = await request.json();

    const parseResult = createVariantSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid variant data", details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const newVariant = await prisma.productVariant.create({
      data: {
        productId,
        ...parseResult.data,
      },
    });

    return NextResponse.json(newVariant, { status: 201 });
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "SKU already exists" },
        { status: 409 }
      );
    }

    console.error("Error creating variant:", error);
    return NextResponse.json(
      { error: "Failed to create variant" },
      { status: 500 }
    );
  }
}