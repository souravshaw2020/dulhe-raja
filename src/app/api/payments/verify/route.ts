import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { z } from "zod";

const verifyPaymentSchema = z.object({
  orderId: z.string().min(1),
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
});

// POST /api/payments/verify (Customer checkout callback)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = verifyPaymentSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid payment payload", details: result.error.format() },
        { status: 400 },
      );
    }

    const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } =
      result.data;

    // Verify HMAC SHA256 Signature
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      console.error("RAZORPAY_KEY_SECRET is not configured");
      return NextResponse.json(
        { error: "Payment gateway misconfigured" },
        { status: 500 },
      );
    }

    const generatedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");

    const genBuf = Buffer.from(generatedSignature);
    const sigBuf = Buffer.from(razorpaySignature);

    if (
      genBuf.length !== sigBuf.length ||
      !crypto.timingSafeEqual(genBuf, sigBuf)
    ) {
      await prisma.order.update({
        where: { id: orderId },
        data: { paymentStatus: "FAILED" },
      });
      return NextResponse.json(
        { error: "Invalid payment signature" },
        { status: 400 },
      );
    }

    // Mark order as paid & confirmed
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: "PAID",
        status: "CONFIRMED",
      },
    });

    return NextResponse.json({
      success: true,
      order: updatedOrder,
    });
  } catch (error) {
    console.error("Payment verification failed:", error);
    return NextResponse.json({ error: "Verification error" }, { status: 500 });
  }
}
