import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";
import { z } from "zod";

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
        { status: 400 }
      );
    }

    const { name, phone, whatsappOptIn, smsOptIn } = result.data;

    const subscriber = await prisma.customerSubscriber.upsert({
      where: { phone },
      update: { name, whatsappOptIn, smsOptIn, isActive: true },
      create: { name, phone, whatsappOptIn, smsOptIn },
    });

    return NextResponse.json(subscriber, { status: 201 });
  } catch (error: unknown) {
    console.error("Error saving subscriber:", error);
    return NextResponse.json(
      { error: "Failed to subscribe" },
      { status: 500 }
    );
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
      { status: 500 }
    );
  }
}