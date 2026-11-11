import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth";

// POST /api/auth/logout
export async function POST() {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}