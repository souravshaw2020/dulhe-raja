import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth";

const addImageSchema = z.object({
  s3Url: z.string().url("Valid S3 URL is required"),
  altText: z.string().optional(),
  isPrimary: z.boolean().default(false),
});

// POST /api/products/[id]/images
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  try {
    const { id: productId } = await params;
    const body = await request.json();

    const result = addImageSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid image data", details: result.error.format() },
        { status: 400 }
      );
    }

    if (result.data.isPrimary) {
      await prisma.productImage.updateMany({
        where: { productId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const newImage = await prisma.productImage.create({
      data: {
        productId,
        ...result.data,
      },
    });

    return NextResponse.json(newImage, { status: 201 });
  } catch (error) {
    console.error("Error adding product image:", error);
    return NextResponse.json({ error: "Failed to add image" }, { status: 500 });
  }
}