import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const orderItemInputSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().optional(),
  tailoringProfileId: z.string().optional(),
  quantity: z.number().int().positive(),
});

const createOrderSchema = z.object({
  customerName: z.string().min(2),
  customerEmail: z.string().email(),
  customerPhone: z.string().min(10),
  shippingAddress: z.string().min(5),
  city: z.string().min(2),
  postalCode: z.string().min(4),
  items: z.array(orderItemInputSchema).min(1),
  sessionId: z.string().optional(), // Clears cart if provided
});

// POST /api/orders
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = createOrderSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid order data", details: result.error.format() },
        { status: 400 },
      );
    }

    const { items, sessionId, ...customerInfo } = result.data;

    // Fetch product pricing from DB to prevent client-side price tampering
    const productIds = items.map((i) => i.productId);
    const dbProducts = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { variants: true },
    });

    let totalAmount = 0;
    type OrderItemInput = {
      productId: string;
      variantId?: string;
      tailoringProfileId?: string;
      quantity: number;
      unitPrice: number;
    };

    const orderItemsData: OrderItemInput[] = [];

    for (const item of items) {
      const prod = dbProducts.find((p) => p.id === item.productId);
      if (!prod) {
        return NextResponse.json(
          { error: `Product ${item.productId} not found` },
          { status: 404 },
        );
      }

      let price = Number(prod.basePrice);
      if (item.variantId) {
        const variant = prod.variants.find((v) => v.id === item.variantId);
        if (variant?.priceAdjustment) {
          price += Number(variant.priceAdjustment);
        }
      }

      totalAmount += price * item.quantity;
      orderItemsData.push({
        productId: item.productId,
        variantId: item.variantId,
        tailoringProfileId: item.tailoringProfileId,
        quantity: item.quantity,
        unitPrice: price,
      });
    }

    const orderNumber = `DR-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    const order = await prisma.$transaction(async (tx) => {
      // 1. Create order and order items
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          ...customerInfo,
          totalAmount,
          items: {
            create: orderItemsData,
          },
        },
        include: {
          items: {
            include: { product: true, variant: true, tailoringProfile: true },
          },
        },
      });

      // 2. Decrement variant inventory
      for (const item of items) {
        if (item.variantId) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stock: { decrement: item.quantity } },
          });
        }
      }

      // 3. Clear cart if sessionId provided
      if (sessionId) {
        await tx.cartItem.deleteMany({
          where: { sessionId },
        });
      }

      return newOrder;
    });

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error("Order processing error:", error);
    return NextResponse.json(
      { error: "Failed to place order" },
      { status: 500 },
    );
  }
}
