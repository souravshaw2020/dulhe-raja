import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth";

const updateProductSchema = z.object({
  name: z.string().min(3).optional(),
  description: z.string().optional(),
  category: z.enum(["SHERWANI", "KURTA", "PYJAMA", "INDO_WESTERN"]).optional(),
  fabricType: z.string().min(1).optional(),
  basePrice: z.number().positive().optional(),
  allowsCustomTailoring: z.boolean().optional(),
});

// GET /api/products/[id]
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        images: true,
        variants: true,
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error("Error fetching product:", error);
    return NextResponse.json({ error: "Failed to fetch product" }, { status: 500 });
  }
}

// PATCH /api/products/[id]
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
if (!session) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

  try {
    const { id } = await params;
    const body = await request.json();

    const parseResult = updateProductSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid data", details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: parseResult.data,
      include: {
        images: true,
        variants: true,
      },
    });

    return NextResponse.json(updatedProduct);
  } catch (error) {
    console.error("Error updating product:", error);
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 });
  }
}

// DELETE /api/products/[id]
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
if (!session) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

  try {
    const { id } = await params;

    await prisma.product.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("Error deleting product:", error);
    return NextResponse.json({ error: "Failed to delete product" }, { status: 500 });
  }
}