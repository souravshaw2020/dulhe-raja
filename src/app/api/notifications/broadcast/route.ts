import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";
import { broadcastToCustomers } from "@/lib/notifications";
import { z } from "zod";

const broadcastSchema = z
  .object({
    campaignType: z.enum([
      "NEW_CATEGORY_ARRIVALS",
      "COLLECTION",
      "DISCOUNT_SALE",
    ]),
    channel: z.enum(["WHATSAPP", "SMS", "BOTH"]).default("BOTH"),
    category: z
      .enum(["SHERWANI", "KURTA", "PYJAMA", "INDO_WESTERN"])
      .optional(),
    daysBack: z.number().int().min(1).max(90).default(7),
    discountPercent: z.number().int().min(1).max(95).optional(),
    productIds: z.array(z.string().min(1)).optional(),
    title: z.string().min(2).optional(),
    message: z.string().min(5).optional(),
    imageUrl: z.string().url().optional(),
    targetUrl: z.string().url().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.campaignType === "NEW_CATEGORY_ARRIVALS" && !data.category) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "category is required for NEW_CATEGORY_ARRIVALS",
        path: ["category"],
      });
    }
    if (
      (data.campaignType === "COLLECTION" ||
        data.campaignType === "DISCOUNT_SALE") &&
      (!data.title || !data.message)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "title and message are required for COLLECTION and DISCOUNT_SALE",
        path: ["title"],
      });
    }
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
        { status: 400 },
      );
    }

    const campaign = await broadcastToCustomers(result.data);

    if (!campaign) {
      return NextResponse.json(
        {
          error: `No new products found in ${result.data.category} over the last ${result.data.daysBack} days`,
        },
        { status: 404 },
      );
    }

    return NextResponse.json(campaign, { status: 201 });
  } catch (error: unknown) {
    console.error("Broadcast error:", error);
    return NextResponse.json(
      { error: "Failed to send broadcast" },
      { status: 500 },
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
      { status: 500 },
    );
  }
}
