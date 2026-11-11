import { prisma } from "@/lib/prisma";

interface SendMessageParams {
  to: string;
  body: string;
  mediaUrl?: string; // Image URL for WhatsApp
}

interface BroadcastParams {
  title: string;
  message: string;
  imageUrl?: string;
  targetUrl?: string;
  channel?: "WHATSAPP" | "SMS" | "BOTH";
}

function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, "");
  if (cleaned.startsWith("+")) return cleaned;
  // Default to India (+91) for 10-digit numbers
  return cleaned.length === 10 ? `+91${cleaned}` : `+${cleaned}`;
}

async function sendTwilioMessage(
  type: "WHATSAPP" | "SMS",
  { to, body, mediaUrl }: SendMessageParams
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
  const toAddress = type === "WHATSAPP" ? `whatsapp:${normalizedTo}` : normalizedTo;

  const formData = new URLSearchParams();
  formData.append("To", toAddress);
  formData.append("From", from);
  formData.append("Body", body);

  if (type === "WHATSAPP" && mediaUrl) {
    formData.append("MediaUrl", mediaUrl);
  }

  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    console.error(`Twilio ${type} failed for ${normalizedTo}:`, errText);
    return false;
  }

  return true;
}

export async function broadcastToCustomers({
  title,
  message,
  imageUrl,
  targetUrl,
  channel = "BOTH",
}: BroadcastParams) {
  const subscribers = await prisma.customerSubscriber.findMany({
    where: { isActive: true },
  });

  const fullText = targetUrl
    ? `*${title}*\n\n${message}\n\nShop now: ${targetUrl}`
    : `*${title}*\n\n${message}`;

  const smsText = targetUrl
    ? `${title}: ${message} - ${targetUrl}`
    : `${title}: ${message}`;

  let sentCount = 0;
  let failedCount = 0;

  for (const sub of subscribers) {
    if ((channel === "WHATSAPP" || channel === "BOTH") && sub.whatsappOptIn) {
      const ok = await sendTwilioMessage("WHATSAPP", {
        to: sub.phone,
        body: fullText,
        mediaUrl: imageUrl,
      });
      if (ok) sentCount++;
      else failedCount++;
    }

    if ((channel === "SMS" || channel === "BOTH") && sub.smsOptIn) {
      const ok = await sendTwilioMessage("SMS", {
        to: sub.phone,
        body: smsText,
      });
      if (ok) sentCount++;
      else failedCount++;
    }
  }

  const campaign = await prisma.notificationCampaign.create({
    data: {
      title,
      message,
      imageUrl,
      targetUrl,
      channel,
      sentCount,
      failedCount,
    },
  });

  return campaign;
}