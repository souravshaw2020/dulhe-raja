import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";
import { buildCsv } from "@/lib/csv";

const EXPORT_TABLES = new Set([
  "products",
  "variants",
  "images",
  "orders",
  "order-items",
  "tailoring",
  "subscribers",
  "campaigns",
  "cart",
]);

// GET /api/export/[table] (Admin only)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ table: string }> },
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { table } = await params;

    if (!EXPORT_TABLES.has(table)) {
      return NextResponse.json(
        {
          error: "Invalid export table",
          availableTables: Array.from(EXPORT_TABLES),
        },
        { status: 400 },
      );
    }

    let csv = "";
    let filename = `${table}.csv`;

    switch (table) {
      case "products": {
        const rows = await prisma.product.findMany({
          orderBy: { createdAt: "desc" },
        });
        csv = buildCsv(
          [
            "id",
            "name",
            "description",
            "category",
            "fabricType",
            "basePrice",
            "allowsCustomTailoring",
            "createdAt",
            "updatedAt",
          ],
          rows,
        );
        break;
      }

      case "variants": {
        const rows = await prisma.productVariant.findMany({
          orderBy: { productId: "asc" },
        });
        csv = buildCsv(
          [
            "id",
            "productId",
            "color",
            "size",
            "sku",
            "stock",
            "priceAdjustment",
          ],
          rows,
        );
        filename = "product-variants.csv";
        break;
      }

      case "images": {
        const rows = await prisma.productImage.findMany({
          orderBy: { productId: "asc" },
        });
        csv = buildCsv(
          ["id", "productId", "s3Url", "altText", "isPrimary"],
          rows,
        );
        filename = "product-images.csv";
        break;
      }

      case "orders": {
        const rows = await prisma.order.findMany({
          orderBy: { createdAt: "desc" },
        });
        csv = buildCsv(
          [
            "id",
            "orderNumber",
            "customerName",
            "customerEmail",
            "customerPhone",
            "shippingAddress",
            "city",
            "postalCode",
            "totalAmount",
            "status",
            "paymentStatus",
            "createdAt",
            "updatedAt",
          ],
          rows,
        );
        break;
      }

      case "order-items": {
        const rows = await prisma.orderItem.findMany({
          orderBy: { orderId: "asc" },
        });
        csv = buildCsv(
          [
            "id",
            "orderId",
            "productId",
            "variantId",
            "tailoringProfileId",
            "quantity",
            "unitPrice",
          ],
          rows,
        );
        filename = "order-items.csv";
        break;
      }

      case "tailoring": {
        const rows = await prisma.customTailoringProfile.findMany({
          orderBy: { createdAt: "desc" },
        });
        csv = buildCsv(
          [
            "id",
            "customerName",
            "customerPhone",
            "customerEmail",
            "chest",
            "waist",
            "shoulderWidth",
            "armLength",
            "kurtaLength",
            "neck",
            "hip",
            "fittingType",
            "notes",
            "createdAt",
          ],
          rows,
        );
        filename = "custom-tailoring-profiles.csv";
        break;
      }

      case "subscribers": {
        const rows = await prisma.customerSubscriber.findMany({
          orderBy: { createdAt: "desc" },
        });
        csv = buildCsv(
          [
            "id",
            "name",
            "phone",
            "whatsappOptIn",
            "smsOptIn",
            "isActive",
            "createdAt",
            "updatedAt",
          ],
          rows,
        );
        filename = "customer-subscribers.csv";
        break;
      }

      case "campaigns": {
        const rows = await prisma.notificationCampaign.findMany({
          orderBy: { createdAt: "desc" },
        });
        csv = buildCsv(
          [
            "id",
            "campaignType",
            "category",
            "discountPercent",
            "title",
            "message",
            "imageUrl",
            "targetUrl",
            "channel",
            "sentCount",
            "failedCount",
            "createdAt",
          ],
          rows,
        );
        filename = "notification-campaigns.csv";
        break;
      }

      case "cart": {
        const rows = await prisma.cartItem.findMany({
          orderBy: { createdAt: "desc" },
        });
        csv = buildCsv(
          [
            "id",
            "sessionId",
            "productId",
            "variantId",
            "quantity",
            "createdAt",
            "updatedAt",
          ],
          rows,
        );
        filename = "cart-items.csv";
        break;
      }
    }

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("CSV export error:", error);
    return NextResponse.json(
      { error: "Failed to export CSV" },
      { status: 500 },
    );
  }
}
