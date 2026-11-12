import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { OrderStatus, PaymentStatus } from "@prisma/client";
import { getAdminSession } from "@/lib/auth";

// GET /api/orders/[id] (Accepts order ID or orderNumber)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const order = await prisma.order.findFirst({
      where: {
        OR: [{ id }, { orderNumber: id }],
      },
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
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error("Error fetching order:", error);
    return NextResponse.json(
      { error: "Failed to retrieve order details" },
      { status: 500 },
    );
  }
}

const updateOrderStatusSchema = z.object({
  status: z
    .enum([
      "PENDING",
      "CONFIRMED",
      "IN_TAILORING",
      "SHIPPED",
      "DELIVERED",
      "CANCELLED",
    ])
    .optional(),
  paymentStatus: z.enum(["PENDING", "PAID", "FAILED", "REFUNDED"]).optional(),
});

// PATCH /api/orders/[id] (Admin only - restores stock on CANCELLED)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    const parseResult = updateOrderStatusSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Invalid status parameters",
          details: parseResult.error.format(),
        },
        { status: 400 },
      );
    }

    const { status, paymentStatus } = parseResult.data;

    const updatedOrder = await prisma.$transaction(async (tx) => {
      const existing = await tx.order.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!existing) {
        return null;
      }

      // Restore variant stock when transitioning into CANCELLED
      if (status === "CANCELLED" && existing.status !== "CANCELLED") {
        for (const item of existing.items) {
          if (item.variantId) {
            await tx.productVariant.update({
              where: { id: item.variantId },
              data: { stock: { increment: item.quantity } },
            });
          }
        }
      }

      return tx.order.update({
        where: { id },
        data: {
          ...(status && { status: status as OrderStatus }),
          ...(paymentStatus && {
            paymentStatus: paymentStatus as PaymentStatus,
          }),
        },
      });
    });

    if (!updatedOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json(updatedOrder);
  } catch (error) {
    console.error("Error updating order:", error);
    return NextResponse.json(
      { error: "Failed to update order status" },
      { status: 500 },
    );
  }
}
