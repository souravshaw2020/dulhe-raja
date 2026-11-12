import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";
import { parseCsv } from "@/lib/csv";
import { normalizePhone } from "@/lib/notifications";
import { z } from "zod";

const IMPORT_TABLES = new Set([
  "products",
  "variants",
  "subscribers",
  "tailoring",
]);

const toBoolean = (val: string | undefined, defaultVal: boolean): boolean => {
  if (!val || val.trim() === "") return defaultVal;
  const lower = val.trim().toLowerCase();
  if (["true", "1", "yes"].includes(lower)) return true;
  if (["false", "0", "no"].includes(lower)) return false;
  return defaultVal;
};

const productRowSchema = z.object({
  name: z.string().min(3, "name must be at least 3 chars"),
  description: z.string().optional(),
  category: z.enum(["SHERWANI", "KURTA", "PYJAMA", "INDO_WESTERN"]),
  fabricType: z.string().min(1, "fabricType is required"),
  basePrice: z.coerce.number().positive("basePrice must be > 0"),
  allowsCustomTailoring: z.string().optional(),
  // Optional initial variant & image columns
  color: z.string().optional(),
  size: z.string().optional(),
  sku: z.string().optional(),
  stock: z.string().optional(),
  s3Url: z.string().optional(),
});

const variantRowSchema = z.object({
  productId: z.string().min(1, "productId is required"),
  color: z.string().min(1, "color is required"),
  size: z.string().min(1, "size is required"),
  sku: z.string().min(3, "sku must be at least 3 chars"),
  stock: z.coerce.number().int().nonnegative().default(0),
  priceAdjustment: z.string().optional(),
});

const subscriberRowSchema = z.object({
  name: z.string().optional(),
  phone: z.string().min(10, "phone must be at least 10 digits"),
  whatsappOptIn: z.string().optional(),
  smsOptIn: z.string().optional(),
  isActive: z.string().optional(),
});

const tailoringRowSchema = z.object({
  customerName: z.string().min(2, "customerName is required"),
  customerPhone: z.string().min(10, "customerPhone is required"),
  customerEmail: z.string().email().optional().or(z.literal("")),
  chest: z.coerce.number().positive("chest must be > 0"),
  waist: z.coerce.number().positive("waist must be > 0"),
  shoulderWidth: z.coerce.number().positive("shoulderWidth must be > 0"),
  armLength: z.coerce.number().positive("armLength must be > 0"),
  kurtaLength: z.string().optional(),
  neck: z.string().optional(),
  hip: z.string().optional(),
  fittingType: z
    .enum(["SLIM", "REGULAR", "COMFORT"])
    .optional()
    .or(z.literal("")),
  notes: z.string().optional(),
});

async function extractCsvText(request: Request): Promise<string | null> {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file");
    if (file instanceof File) {
      return await file.text();
    }
    return null;
  }

  if (contentType.includes("application/json")) {
    const body = (await request.json()) as { csv?: unknown };
    return typeof body.csv === "string" ? body.csv : null;
  }

  return await request.text();
}

// POST /api/import/[table] (Admin only)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ table: string }> },
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { table } = await params;

    if (!IMPORT_TABLES.has(table)) {
      return NextResponse.json(
        {
          error: "Invalid import table",
          availableTables: Array.from(IMPORT_TABLES),
        },
        { status: 400 },
      );
    }

    const csvText = await extractCsvText(request);
    if (!csvText || !csvText.trim()) {
      return NextResponse.json(
        { error: "CSV file or content is required" },
        { status: 400 },
      );
    }

    const rows = parseCsv(csvText);
    if (rows.length === 0) {
      return NextResponse.json(
        { error: "CSV must include a header row and at least one data row" },
        { status: 400 },
      );
    }

    let imported = 0;
    let updated = 0;
    const errors: { row: number; error: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2; // 1-indexed + header row
      const rawRow = rows[i];

      try {
        if (table === "products") {
          const parsed = productRowSchema.safeParse(rawRow);
          if (!parsed.success) {
            errors.push({
              row: rowNumber,
              error: parsed.error.issues.map((iss) => iss.message).join("; "),
            });
            continue;
          }

          const d = parsed.data;
          const hasVariant = Boolean(d.sku && d.color && d.size);
          const hasImage = Boolean(d.s3Url && d.s3Url.startsWith("http"));

          await prisma.product.create({
            data: {
              name: d.name,
              description: d.description || undefined,
              category: d.category,
              fabricType: d.fabricType,
              basePrice: d.basePrice,
              allowsCustomTailoring: toBoolean(d.allowsCustomTailoring, true),
              ...(hasVariant && d.sku && d.color && d.size
                ? {
                    variants: {
                      create: {
                        color: d.color,
                        size: d.size,
                        sku: d.sku,
                        stock: d.stock
                          ? Math.max(0, parseInt(d.stock, 10) || 0)
                          : 0,
                      },
                    },
                  }
                : {}),
              ...(hasImage && d.s3Url
                ? {
                    images: {
                      create: {
                        s3Url: d.s3Url,
                        isPrimary: true,
                      },
                    },
                  }
                : {}),
            },
          });
          imported++;
        } else if (table === "variants") {
          const parsed = variantRowSchema.safeParse(rawRow);
          if (!parsed.success) {
            errors.push({
              row: rowNumber,
              error: parsed.error.issues.map((iss) => iss.message).join("; "),
            });
            continue;
          }

          const d = parsed.data;
          const adjustment =
            d.priceAdjustment && d.priceAdjustment.trim() !== ""
              ? Number(d.priceAdjustment)
              : null;

          if (adjustment !== null && Number.isNaN(adjustment)) {
            errors.push({
              row: rowNumber,
              error: "Invalid priceAdjustment number",
            });
            continue;
          }

          const existing = await prisma.productVariant.findUnique({
            where: { sku: d.sku },
          });

          if (existing) {
            await prisma.productVariant.update({
              where: { sku: d.sku },
              data: {
                color: d.color,
                size: d.size,
                stock: d.stock,
                priceAdjustment: adjustment,
              },
            });
            updated++;
          } else {
            await prisma.productVariant.create({
              data: {
                productId: d.productId,
                color: d.color,
                size: d.size,
                sku: d.sku,
                stock: d.stock,
                priceAdjustment: adjustment,
              },
            });
            imported++;
          }
        } else if (table === "subscribers") {
          const parsed = subscriberRowSchema.safeParse(rawRow);
          if (!parsed.success) {
            errors.push({
              row: rowNumber,
              error: parsed.error.issues.map((iss) => iss.message).join("; "),
            });
            continue;
          }

          const d = parsed.data;
          const phone = normalizePhone(d.phone);
          const existing = await prisma.customerSubscriber.findUnique({
            where: { phone },
          });

          await prisma.customerSubscriber.upsert({
            where: { phone },
            update: {
              ...(d.name ? { name: d.name } : {}),
              whatsappOptIn: toBoolean(d.whatsappOptIn, true),
              smsOptIn: toBoolean(d.smsOptIn, true),
              isActive: toBoolean(d.isActive, true),
            },
            create: {
              name: d.name || undefined,
              phone,
              whatsappOptIn: toBoolean(d.whatsappOptIn, true),
              smsOptIn: toBoolean(d.smsOptIn, true),
              isActive: toBoolean(d.isActive, true),
            },
          });

          if (existing) updated++;
          else imported++;
        } else if (table === "tailoring") {
          const parsed = tailoringRowSchema.safeParse(rawRow);
          if (!parsed.success) {
            errors.push({
              row: rowNumber,
              error: parsed.error.issues.map((iss) => iss.message).join("; "),
            });
            continue;
          }

          const d = parsed.data;
          await prisma.customTailoringProfile.create({
            data: {
              customerName: d.customerName,
              customerPhone: normalizePhone(d.customerPhone),
              customerEmail: d.customerEmail || undefined,
              chest: d.chest,
              waist: d.waist,
              shoulderWidth: d.shoulderWidth,
              armLength: d.armLength,
              kurtaLength: d.kurtaLength ? Number(d.kurtaLength) : undefined,
              neck: d.neck ? Number(d.neck) : undefined,
              hip: d.hip ? Number(d.hip) : undefined,
              fittingType: d.fittingType || "REGULAR",
              notes: d.notes || undefined,
            },
          });
          imported++;
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Database error";
        errors.push({ row: rowNumber, error: message });
      }
    }

    return NextResponse.json(
      {
        table,
        totalRows: rows.length,
        imported,
        updated,
        skipped: errors.length,
        errors,
      },
      {
        status:
          errors.length > 0 && imported === 0 && updated === 0 ? 400 : 200,
      },
    );
  } catch (error) {
    console.error("CSV import error:", error);
    return NextResponse.json(
      { error: "Failed to import CSV" },
      { status: 500 },
    );
  }
}
