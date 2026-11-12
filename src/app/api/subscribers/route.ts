import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";
import { z } from "zod";
import { normalizePhone } from "@/lib/notifications";

const subscribeSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().min(10, "Valid phone number is required"),
  whatsappOptIn: z.boolean().default(true),
  smsOptIn: z.boolean().default(true),
});

// POST /api/subscribers (Public opt-in)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = subscribeSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid subscriber data", details: result.error.format() },
        { status: 400 },
      );
    }

    const { name, phone, whatsappOptIn, smsOptIn } = result.data;

    const normalizedPhone = normalizePhone(phone);
    const subscriber = await prisma.customerSubscriber.upsert({
      where: { phone: normalizedPhone },
      update: { name, whatsappOptIn, smsOptIn, isActive: true },
      create: { name, phone: normalizedPhone, whatsappOptIn, smsOptIn },
    });

    return NextResponse.json(subscriber, { status: 201 });
  } catch (error: unknown) {
    console.error("Error saving subscriber:", error);
    return NextResponse.json({ error: "Failed to subscribe" }, { status: 500 });
  }
}

// GET /api/subscribers (Admin only)
export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const subscribers = await prisma.customerSubscriber.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(subscribers);
  } catch (error: unknown) {
    console.error("Error fetching subscribers:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscribers" },
      { status: 500 },
    );
  }
}

// DELETE /api/subscribers?phone=9876543210 (Public opt-out)
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const phone = searchParams.get("phone");

  if (!phone) {
    return NextResponse.json({ error: "Phone number required" }, { status: 400 });
  }

  try {
    const normalizedPhone = normalizePhone(phone);
    await prisma.customerSubscriber.update({
      where: { phone: normalizedPhone },
      data: { isActive: false, whatsappOptIn: false, smsOptIn: false },
    });

    return NextResponse.json({ message: "Unsubscribed successfully" });
  } catch (error) {
    console.error("Error unsubscribing:", error);
    return NextResponse.json({ error: "Subscriber not found" }, { status: 404 });
  }
}