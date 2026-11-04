import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const addToCartSchema = z.object({
  sessionId: z.string().min(1),
  productId: z.string().min(1),
  variantId: z.string().optional(),
  quantity: z.number().int().positive().default(1),
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
      const adjustment = item.variant?.priceAdjustment ? Number(item.variant.priceAdjustment) : 0;
      return acc + (base + adjustment) * item.quantity;
    }, 0);

    return NextResponse.json({ items, subtotal });
  } catch (error) {
    console.error("Error retrieving cart:", error);
    return NextResponse.json({ error: "Failed to fetch cart" }, { status: 500 });
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
        { status: 400 }
      );
    }

    const { sessionId, productId, variantId, quantity } = result.data;

    const existingItem = await prisma.cartItem.findFirst({
      where: { sessionId, productId, variantId: variantId ?? null },
    });

    if (existingItem) {
      const updated = await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: existingItem.quantity + quantity },
      });
      return NextResponse.json(updated);
    }

    const newItem = await prisma.cartItem.create({
      data: { sessionId, productId, variantId, quantity },
    });

    return NextResponse.json(newItem, { status: 201 });
  } catch (error) {
    console.error("Error adding to cart:", error);
    return NextResponse.json({ error: "Failed to update cart" }, { status: 500 });
  }
}

// DELETE /api/cart?id=xyz
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Cart item ID required" }, { status: 400 });
  }

  try {
    await prisma.cartItem.delete({ where: { id } });
    return NextResponse.json({ message: "Item removed from cart" });
  } catch (error) {
    console.error("Error deleting cart item:", error);
    return NextResponse.json({ error: "Failed to remove item" }, { status: 500 });
  }
}

const updateCartSchema = z.object({
  id: z.string().min(1, "Cart item ID is required"),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
});

// PATCH /api/cart - Update item quantity
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const result = updateCartSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input", details: result.error.format() },
        { status: 400 }
      );
    }

    const { id, quantity } = result.data;

    const updatedItem = await prisma.cartItem.update({
      where: { id },
      data: { quantity },
      include: {
        product: true,
        variant: true,
      },
    });

    return NextResponse.json(updatedItem);
  } catch (error) {
    console.error("Error updating cart quantity:", error);
    return NextResponse.json({ error: "Failed to update cart item" }, { status: 500 });
  }
}