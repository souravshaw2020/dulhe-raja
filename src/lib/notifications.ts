import { prisma } from "@/lib/prisma";
import { CampaignType, Category, NotificationChannel } from "@prisma/client";

interface TemplateVars {
  title: string;
  details: string;
  url: string;
}

interface SendMessageParams {
  to: string;
  body: string;
  mediaUrl?: string;
  templateVars?: TemplateVars;
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

export function normalizePhone(phone: string): string {
  const trimmed = phone.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");

  if (hasPlus) return `+${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) {
    return `+91${digits.slice(1)}`;
  }
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return `+${digits}`;
}

export function isValidPhone(phone: string): boolean {
  const digits = normalizePhone(phone).replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

function isReachableMediaUrl(url?: string): url is string {
  if (!url) return false;
  return (
    url.startsWith("https://") &&
    !url.includes("example-s3-bucket.com") &&
    !url.includes("localhost")
  );
}

function extractS3MediaPath(mediaUrl?: string): string {
  const defaultPath =
    process.env.TWILIO_WHATSAPP_DEFAULT_MEDIA_PATH?.trim() ||
    "products/default.jpg";

  if (!mediaUrl || !isReachableMediaUrl(mediaUrl)) {
    return defaultPath;
  }

  const bucket = process.env.AWS_S3_BUCKET_NAME?.trim();
  const region = process.env.AWS_REGION?.trim();
  if (bucket && region) {
    const s3Prefix = `https://${bucket}.s3.${region}.amazonaws.com/`;
    if (mediaUrl.startsWith(s3Prefix)) {
      return mediaUrl.slice(s3Prefix.length);
    }
  }

  try {
    const parsed = new URL(mediaUrl);
    return parsed.pathname.replace(/^\/+/, "") || defaultPath;
  } catch {
    return defaultPath;
  }
}

// Meta rejects newlines, tabs, and 4+ consecutive spaces inside ContentVariables
function sanitizeTemplateVar(text: string, maxLen = 240): string {
  return text
    .replace(/[\r\n\t]+/g, " | ")
    .replace(/ {4,}/g, " ")
    .trim()
    .slice(0, maxLen);
}

async function sendTwilioMessage(
  type: "WHATSAPP" | "SMS",
  { to, body, mediaUrl, templateVars }: SendMessageParams,
): Promise<boolean> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const rawFrom =
    type === "WHATSAPP"
      ? process.env.TWILIO_WHATSAPP_FROM?.trim()
      : process.env.TWILIO_SMS_FROM?.trim();

  if (!accountSid || !authToken || !rawFrom) {
    console.error(`Missing Twilio config for ${type}`);
    return false;
  }

  const normalizedTo = normalizePhone(to);
  const toAddress =
    type === "WHATSAPP" ? `whatsapp:${normalizedTo}` : normalizedTo;
  const fromAddress =
    type === "WHATSAPP" && !rawFrom.startsWith("whatsapp:")
      ? `whatsapp:${rawFrom}`
      : rawFrom;

  const contentSid = process.env.TWILIO_WHATSAPP_CONTENT_SID?.trim();
  const formData = new URLSearchParams();
  formData.append("To", toAddress);
  formData.append("From", fromAddress);

  if (type === "WHATSAPP" && contentSid && templateVars) {
    const mediaPath = extractS3MediaPath(mediaUrl);
    formData.append("ContentSid", contentSid);
    formData.append(
      "ContentVariables",
      JSON.stringify({
        "1": sanitizeTemplateVar(templateVars.title, 100),
        "2": sanitizeTemplateVar(templateVars.details, 240),
        "3": templateVars.url,
        "4": mediaPath,
      }),
    );
  } else {
    formData.append("Body", body);
    if (type === "WHATSAPP" && isReachableMediaUrl(mediaUrl)) {
      formData.append("MediaUrl", mediaUrl);
    }
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
    console.error(
      `Twilio ${type} failed (From: ${fromAddress}, To: ${toAddress}):`,
      errText,
    );
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

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
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
      where: { category, createdAt: { gte: sinceDate } },
      include: { images: { orderBy: { isPrimary: "desc" }, take: 1 } },
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
      include: { images: { orderBy: { isPrimary: "desc" }, take: 1 } },
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

  const appliedDiscount =
    campaignType === "DISCOUNT_SALE" ? discountPercent : undefined;

  const discountLine = appliedDiscount
    ? `Flat ${appliedDiscount}% OFF!\n\n`
    : "";

  const resolvedUrl = targetUrl || appUrl;

  const whatsappBody = targetUrl
    ? `*${title}*\n\n${discountLine}${message}\n\nShop now: ${targetUrl}`
    : `*${title}*\n\n${discountLine}${message}`;

  const smsBody = targetUrl
    ? `${title}${appliedDiscount ? ` (${appliedDiscount}% OFF)` : ""}: ${message} - ${targetUrl}`
    : `${title}${appliedDiscount ? ` (${appliedDiscount}% OFF)` : ""}: ${message}`;

  const subscribers = await prisma.customerSubscriber.findMany({
    where: { isActive: true },
  });

  const tasks: (() => Promise<boolean>)[] = [];

  for (const sub of subscribers) {
    if ((channel === "WHATSAPP" || channel === "BOTH") && sub.whatsappOptIn) {
      tasks.push(() =>
        sendTwilioMessage("WHATSAPP", {
          to: sub.phone,
          body: whatsappBody,
          mediaUrl: imageUrl,
          templateVars: {
            title,
            details: `${discountLine}${message}`,
            url: resolvedUrl,
          },
        }),
      );
    }

    if ((channel === "SMS" || channel === "BOTH") && sub.smsOptIn) {
      tasks.push(() =>
        sendTwilioMessage("SMS", {
          to: sub.phone,
          body: smsBody,
        }),
      );
    }
  }

  let sentCount = 0;
  let failedCount = 0;
  const BATCH_SIZE = 10;

  for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
    const batch = tasks.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map((run) => run()));
    for (const res of results) {
      if (res.status === "fulfilled" && res.value) sentCount++;
      else failedCount++;
    }
  }

  return prisma.notificationCampaign.create({
    data: {
      campaignType,
      category,
      discountPercent: appliedDiscount,
      title,
      message,
      imageUrl,
      targetUrl: resolvedUrl,
      channel,
      sentCount,
      failedCount,
    },
  });
}
