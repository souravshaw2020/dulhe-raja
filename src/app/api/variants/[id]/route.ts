import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth";

const updateVariantSchema = z.object({
  stock: z.number().int().nonnegative().optional(),
  priceAdjustment: z.number().optional().nullable(),
  color: z.string().min(1).optional(),
  size: z.string().min(1).optional(),
});

// PATCH /api/variants/[id]
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  try {
    const { id } = await params;
    const body = await request.json();

    const parseResult = updateVariantSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid variant data", details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const updatedVariant = await prisma.productVariant.update({
      where: { id },
      data: parseResult.data,
    });

    return NextResponse.json(updatedVariant);
  } catch (error) {
    console.error("Error updating variant:", error);
    return NextResponse.json({ error: "Failed to update variant" }, { status: 500 });
  }
}

// DELETE /api/variants/[id]
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  try {
    const { id } = await params;

    await prisma.productVariant.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Variant removed successfully" });
  } catch (error) {
    console.error("Error deleting variant:", error);
    return NextResponse.json({ error: "Failed to delete variant" }, { status: 500 });
  }
}