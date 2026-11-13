import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";
import { z } from "zod";

const updateTailoringSchema = z.object({
  customerName: z.string().min(2).optional(),
  customerPhone: z.string().min(10).optional(),
  customerEmail: z.string().email().optional().nullable(),
  chest: z.number().positive().optional(),
  waist: z.number().positive().optional(),
  shoulderWidth: z.number().positive().optional(),
  armLength: z.number().positive().optional(),
  kurtaLength: z.number().positive().optional().nullable(),
  neck: z.number().positive().optional().nullable(),
  hip: z.number().positive().optional().nullable(),
  fittingType: z.enum(["SLIM", "REGULAR", "COMFORT"]).optional(),
  notes: z.string().optional().nullable(),
});

// GET /api/custom-tailoring/[id]
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    const profile = await prisma.customTailoringProfile.findUnique({
      where: { id },
    });

    if (!profile) {
      return NextResponse.json(
        { error: "Custom tailoring profile not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error("Error fetching tailoring profile:", error);
    return NextResponse.json(
      { error: "Failed to fetch tailoring profile" },
      { status: 500 },
    );
  }
}

// PATCH /api/custom-tailoring/[id] (Admin only)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const result = updateTailoringSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid measurement data", details: result.error.format() },
        { status: 400 },
      );
    }

    const updated = await prisma.customTailoringProfile.update({
      where: { id },
      data: result.data,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating tailoring profile:", error);
    return NextResponse.json(
      { error: "Failed to update tailoring profile" },
      { status: 500 },
    );
  }
}

// DELETE /api/custom-tailoring/[id] (Admin only)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    await prisma.customTailoringProfile.delete({
      where: { id },
    });

    return NextResponse.json({
      message: "Tailoring profile deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting tailoring profile:", error);
    return NextResponse.json(
      { error: "Failed to delete tailoring profile" },
      { status: 500 },
    );
  }
}
