import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { OrderStatus, PaymentStatus } from "@prisma/client";

// GET /api/orders/[id] (Accepts order ID or orderNumber)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
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
    return NextResponse.json({ error: "Failed to retrieve order details" }, { status: 500 });
  }
}

const updateOrderStatusSchema = z.object({
  status: z.enum(["PENDING", "CONFIRMED", "IN_TAILORING", "SHIPPED", "DELIVERED", "CANCELLED"]).optional(),
  paymentStatus: z.enum(["PENDING", "PAID", "FAILED", "REFUNDED"]).optional(),
});

// PATCH /api/orders/[id]
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const result = updateOrderStatusSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid status data", details: result.error.format() },
        { status: 400 }
      );
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: result.data,
      include: {
        items: {
          include: {
            product: true,
            variant: true,
            tailoringProfile: true,
          },
        },
      },
    });

    return NextResponse.json(updatedOrder);
  } catch (error) {
    console.error("Error updating order:", error);
    return NextResponse.json({ error: "Failed to update order status" }, { status: 500 });
  }
}