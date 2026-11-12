import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const addToCartSchema = z.object({
  sessionId: z.string().min(1),
  productId: z.string().min(1),
  variantId: z.string().optional(),
  quantity: z.number().int().positive().default(1),
});

const updateCartSchema = z.object({
  id: z.string().min(1, "Cart item ID is required"),
  sessionId: z.string().min(1, "Session ID is required"),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
});

// GET /api/cart?sessionId=xyz
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    return NextResponse.json({ error: "Session ID required" }, { status: 400 });
  }

  try {
    const items = await prisma.cartItem.findMany({
      where: { sessionId },
      include: {
        product: {
          include: {
            images: { where: { isPrimary: true }, take: 1 },
          },
        },
        variant: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const subtotal = items.reduce((acc, item) => {
      const base = Number(item.product.basePrice);
      const adjustment = item.variant?.priceAdjustment
        ? Number(item.variant.priceAdjustment)
        : 0;
      return acc + (base + adjustment) * item.quantity;
    }, 0);

    return NextResponse.json({ items, subtotal });
  } catch (error) {
    console.error("Error retrieving cart:", error);
    return NextResponse.json(
      { error: "Failed to fetch cart" },
      { status: 500 },
    );
  }
}

// POST /api/cart
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = addToCartSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid cart data", details: result.error.format() },
        { status: 400 },
      );
    }

    const { sessionId, productId, variantId, quantity } = result.data;

    const existing = await prisma.cartItem.findFirst({
      where: { sessionId, productId, variantId: variantId || null },
    });

    if (existing) {
      const updated = await prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + quantity },
        include: { product: true, variant: true },
      });
      return NextResponse.json(updated);
    }

    const newItem = await prisma.cartItem.create({
      data: { sessionId, productId, variantId, quantity },
      include: { product: true, variant: true },
    });

    return NextResponse.json(newItem, { status: 201 });
  } catch (error) {
    console.error("Error adding to cart:", error);
    return NextResponse.json(
      { error: "Failed to update cart" },
      { status: 500 },
    );
  }
}

// DELETE /api/cart?id=cartItemId&sessionId=xyz
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const sessionId = searchParams.get("sessionId");

  if (!id || !sessionId) {
    return NextResponse.json(
      { error: "Cart item ID and sessionId required" },
      { status: 400 },
    );
  }

  try {
    const deleted = await prisma.cartItem.deleteMany({
      where: { id, sessionId },
    });

    if (deleted.count === 0) {
      return NextResponse.json(
        { error: "Cart item not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ message: "Item removed from cart" });
  } catch (error) {
    console.error("Error deleting cart item:", error);
    return NextResponse.json(
      { error: "Failed to remove item" },
      { status: 500 },
    );
  }
}

// PATCH /api/cart - Update item quantity
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const result = updateCartSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input", details: result.error.format() },
        { status: 400 },
      );
    }

    const { id, sessionId, quantity } = result.data;

    const updated = await prisma.cartItem.updateMany({
      where: { id, sessionId },
      data: { quantity },
    });

    if (updated.count === 0) {
      return NextResponse.json({ error: "Cart item not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, id, quantity });
  } catch (error) {
    console.error("Error updating cart quantity:", error);
    return NextResponse.json({ error: "Failed to update cart item" }, { status: 500 });
  }
}
