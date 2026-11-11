import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";
import { broadcastToCustomers } from "@/lib/notifications";
import { z } from "zod";

const broadcastSchema = z.object({
  title: z.string().min(2, "Title is required"),
  message: z.string().min(5, "Message is required"),
  imageUrl: z.string().url().optional(),
  targetUrl: z.string().url().optional(),
  channel: z.enum(["WHATSAPP", "SMS", "BOTH"]).default("BOTH"),
});

// POST /api/notifications/broadcast (Admin only)
export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const result = broadcastSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid broadcast payload", details: result.error.format() },
        { status: 400 }
      );
    }

    const campaign = await broadcastToCustomers(result.data);
    return NextResponse.json(campaign, { status: 201 });
  } catch (error: unknown) {
    console.error("Broadcast error:", error);
    return NextResponse.json(
      { error: "Failed to send broadcast" },
      { status: 500 }
    );
  }
}

// GET /api/notifications/broadcast (Admin only - campaign history)
export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const campaigns = await prisma.notificationCampaign.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(campaigns);
  } catch (error: unknown) {
    console.error("Error fetching campaigns:", error);
    return NextResponse.json(
      { error: "Failed to fetch campaigns" },
      { status: 500 }
    );
  }
}