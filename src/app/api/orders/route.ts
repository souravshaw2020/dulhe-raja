import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { OrderStatus, PaymentStatus, Prisma } from "@prisma/client";
import { getAdminSession } from "@/lib/auth";
import { normalizePhone } from "@/lib/notifications";

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
  sessionId: z.string().optional(),
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

    const productIds = items.map((i) => i.productId);
    const dbProducts = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { variants: true },
    });

    let totalAmount = 0;
    const orderItemsData: Prisma.OrderItemCreateWithoutOrderInput[] = [];

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
        if (!variant) {
          return NextResponse.json(
            {
              error: `Variant ${item.variantId} does not belong to product ${prod.name}`,
            },
            { status: 400 },
          );
        }
        if (variant.stock < item.quantity) {
          return NextResponse.json(
            {
              error: `Insufficient stock for ${prod.name} (${variant.size}, ${variant.color})`,
            },
            { status: 409 },
          );
        }
        if (variant.priceAdjustment) {
          price += Number(variant.priceAdjustment);
        }
      }

      totalAmount += price * item.quantity;
      orderItemsData.push({
        product: { connect: { id: item.productId } },
        ...(item.variantId
          ? { variant: { connect: { id: item.variantId } } }
          : {}),
        ...(item.tailoringProfileId
          ? { tailoringProfile: { connect: { id: item.tailoringProfileId } } }
          : {}),
        quantity: item.quantity,
        unitPrice: price,
      });
    }

    const orderNumber = `DR-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    const order = await prisma.$transaction(async (tx) => {
      // Atomic stock decrement to prevent overselling
      for (const item of items) {
        if (item.variantId) {
          const updated = await tx.productVariant.updateMany({
            where: { id: item.variantId, stock: { gte: item.quantity } },
            data: { stock: { decrement: item.quantity } },
          });
          if (updated.count === 0) {
            throw new Error(`INSUFFICIENT_STOCK:${item.variantId}`);
          }
        }
      }

      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          ...customerInfo,
          totalAmount,
          items: { create: orderItemsData },
        },
        include: {
          items: {
            include: { product: true, variant: true, tailoringProfile: true },
          },
        },
      });

      if (sessionId) {
        await tx.cartItem.deleteMany({ where: { sessionId } });
      }

      return newOrder;
    });

    const normalizedPhone = normalizePhone(customerInfo.customerPhone);
    await prisma.customerSubscriber.upsert({
      where: { phone: normalizedPhone },
      update: { name: customerInfo.customerName },
      create: {
        name: customerInfo.customerName,
        phone: normalizedPhone,
      },
    });

    return NextResponse.json(order, { status: 201 });
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      error.message.startsWith("INSUFFICIENT_STOCK:")
    ) {
      return NextResponse.json(
        { error: "One or more items just went out of stock" },
        { status: 409 },
      );
    }
    console.error("Order processing error:", error);
    return NextResponse.json(
      { error: "Failed to place order" },
      { status: 500 },
    );
  }
}

// GET /api/orders
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");
  const phone = searchParams.get("phone");
  const statusParam = searchParams.get("status");
  const paymentStatusParam = searchParams.get("paymentStatus");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const limit = Math.max(
    1,
    Math.min(100, parseInt(searchParams.get("limit") || "10", 10) || 10),
  );
  const skip = (page - 1) * limit;

  if (!email && !phone) {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const where: Prisma.OrderWhereInput = {};
  if (email) where.customerEmail = { equals: email, mode: "insensitive" };
  if (phone) where.customerPhone = phone;
  if (
    statusParam &&
    Object.values(OrderStatus).includes(statusParam as OrderStatus)
  ) {
    where.status = statusParam as OrderStatus;
  }
  if (
    paymentStatusParam &&
    Object.values(PaymentStatus).includes(paymentStatusParam as PaymentStatus)
  ) {
    where.paymentStatus = paymentStatusParam as PaymentStatus;
  }

  try {
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: {
            include: {
              product: {
                include: { images: { where: { isPrimary: true }, take: 1 } },
              },
              variant: true,
              tailoringProfile: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    return NextResponse.json({
      orders,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 },
    );
  }
}
