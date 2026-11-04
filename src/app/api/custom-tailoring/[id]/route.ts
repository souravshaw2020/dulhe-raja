import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/custom-tailoring/[id]
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const profile = await prisma.customTailoringProfile.findUnique({
      where: { id },
    });

    if (!profile) {
      return NextResponse.json(
        { error: "Custom tailoring profile not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error("Error fetching tailoring profile:", error);
    return NextResponse.json(
      { error: "Failed to fetch tailoring profile" },
      { status: 500 }
    );
  }
}