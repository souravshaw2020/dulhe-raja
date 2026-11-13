import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const tailoringSchema = z.object({
  customerName: z.string().min(2, "Name is required"),
  customerPhone: z.string().min(10, "Valid phone number required"),
  customerEmail: z.string().email().optional(),
  chest: z.number().positive("Chest measurement required"),
  waist: z.number().positive("Waist measurement required"),
  shoulderWidth: z.number().positive("Shoulder measurement required"),
  armLength: z.number().positive("Arm length required"),
  kurtaLength: z.number().positive().optional(),
  neck: z.number().positive().optional(),
  hip: z.number().positive().optional(),
  fittingType: z.enum(["SLIM", "REGULAR", "COMFORT"]).default("REGULAR"),
  notes: z.string().optional(),
});

// POST /api/custom-tailoring
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = tailoringSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid measurement data", details: result.error.format() },
        { status: 400 }
      );
    }

    const profile = await prisma.customTailoringProfile.create({
      data: result.data,
    });

    return NextResponse.json(profile, { status: 201 });
  } catch (error) {
    console.error("Error creating tailoring profile:", error);
    return NextResponse.json({ error: "Failed to save measurements" }, { status: 500 });
  }
}