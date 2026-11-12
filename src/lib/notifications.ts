import { prisma } from "@/lib/prisma";
import { CampaignType, Category, NotificationChannel } from "@prisma/client";

interface SendMessageParams {
  to: string;
  body: string;
  mediaUrl?: string;
}

export interface BroadcastParams {
  campaignType: CampaignType;
  channel?: NotificationChannel;
  category?: Category;
  daysBack?: number;
  discountPercent?: number;
  productIds?: string[];
  title?: string;
  message?: string;
  imageUrl?: string;
  targetUrl?: string;
}

function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, "");
  if (cleaned.startsWith("+")) return cleaned;
  return cleaned.length === 10 ? `+91${cleaned}` : `+${cleaned}`;
}

async function sendTwilioMessage(
  type: "WHATSAPP" | "SMS",
  { to, body, mediaUrl }: SendMessageParams,
): Promise<boolean> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from =
    type === "WHATSAPP"
      ? process.env.TWILIO_WHATSAPP_FROM
      : process.env.TWILIO_SMS_FROM;

  if (!accountSid || !authToken || !from) {
    console.error(`Missing Twilio config for ${type}`);
    return false;
  }

  const normalizedTo = normalizePhone(to);
  const toAddress =
    type === "WHATSAPP" ? `whatsapp:${normalizedTo}` : normalizedTo;

  const formData = new URLSearchParams();
  formData.append("To", toAddress);
  formData.append("From", from);
  formData.append("Body", body);

  if (type === "WHATSAPP" && mediaUrl) {
    formData.append("MediaUrl", mediaUrl);
  }

  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString(
    "base64",
  );

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    },
  );

  if (!response.ok) {
    const errText = await response.text();
    console.error(`Twilio ${type} failed for ${normalizedTo}:`, errText);
    return false;
  }

  return true;
}

export async function broadcastToCustomers(params: BroadcastParams) {
  const {
    campaignType,
    channel = "BOTH",
    category,
    daysBack = 7,
    discountPercent,
    productIds,
  } = params;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  let title = params.title ?? "";
  let message = params.message ?? "";
  let imageUrl = params.imageUrl;
  let targetUrl = params.targetUrl;

  if (campaignType === "NEW_CATEGORY_ARRIVALS") {
    if (!category) {
      throw new Error("Category is required for NEW_CATEGORY_ARRIVALS");
    }

    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - daysBack);

    const recentProducts = await prisma.product.findMany({
      where: {
        category,
        createdAt: { gte: sinceDate },
      },
      include: {
        images: { orderBy: { isPrimary: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    if (recentProducts.length === 0) {
      return null;
    }

    const readableCategory = category.replace("_", " ");
    title =
      params.title ||
      `New ${readableCategory} Arrivals (${recentProducts.length} Styles)`;

    const itemLines = recentProducts.map(
      (p) =>
        `• ${p.name} - ₹${Number(p.basePrice)} (${appUrl}/products/${p.id})`,
    );

    message =
      params.message ||
      `Explore our latest ${readableCategory.toLowerCase()} arrivals:\n${itemLines.join("\n")}`;

    imageUrl = imageUrl || recentProducts[0]?.images[0]?.s3Url;
    targetUrl = targetUrl || `${appUrl}/products?category=${category}`;
  } else if (productIds && productIds.length > 0) {
    const featuredProducts = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: {
        images: { orderBy: { isPrimary: "desc" }, take: 1 },
      },
      take: 5,
    });

    if (featuredProducts.length > 0) {
      const featuredLines = featuredProducts.map(
        (p) =>
          `• ${p.name} - ₹${Number(p.basePrice)} (${appUrl}/products/${p.id})`,
      );
      message = `${message}\n\nFeatured:\n${featuredLines.join("\n")}`;
      imageUrl = imageUrl || featuredProducts[0]?.images[0]?.s3Url;
    }
  }

  const discountLine =
    campaignType === "DISCOUNT_SALE" && discountPercent
      ? `Flat ${discountPercent}% OFF!\n\n`
      : "";

  const whatsappBody = targetUrl
    ? `*${title}*\n\n${discountLine}${message}\n\nShop now: ${targetUrl}`
    : `*${title}*\n\n${discountLine}${message}`;

  const smsBody = targetUrl
    ? `${title}${discountPercent ? ` (${discountPercent}% OFF)` : ""}: ${message} - ${targetUrl}`
    : `${title}${discountPercent ? ` (${discountPercent}% OFF)` : ""}: ${message}`;

  const subscribers = await prisma.customerSubscriber.findMany({
    where: { isActive: true },
  });

  let sentCount = 0;
  let failedCount = 0;

  for (const sub of subscribers) {
    if ((channel === "WHATSAPP" || channel === "BOTH") && sub.whatsappOptIn) {
      const ok = await sendTwilioMessage("WHATSAPP", {
        to: sub.phone,
        body: whatsappBody,
        mediaUrl: imageUrl,
      });
      if (ok) sentCount++;
      else failedCount++;
    }

    if ((channel === "SMS" || channel === "BOTH") && sub.smsOptIn) {
      const ok = await sendTwilioMessage("SMS", {
        to: sub.phone,
        body: smsBody,
      });
      if (ok) sentCount++;
      else failedCount++;
    }
  }

  return prisma.notificationCampaign.create({
    data: {
      campaignType,
      category,
      discountPercent,
      title,
      message,
      imageUrl,
      targetUrl,
      channel,
      sentCount,
      failedCount,
    },
  });
}
