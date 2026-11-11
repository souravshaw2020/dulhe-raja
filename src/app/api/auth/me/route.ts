import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";

// GET /api/auth/me
export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({
    authenticated: true,
    email: session.email,
    role: session.role,
  });
}