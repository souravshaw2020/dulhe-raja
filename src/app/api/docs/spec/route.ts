import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { getAdminSession } from "@/lib/auth";

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const filePath = path.join(
      process.cwd(),
      "src/lib/dulhe-raja-openapi.yaml",
    );
    const yaml = await readFile(filePath, "utf8");
    return new NextResponse(yaml, {
      status: 200,
      headers: { "Content-Type": "application/yaml; charset=utf-8" },
    });
  } catch (error) {
    console.error("Failed to read OpenAPI spec:", error);
    return NextResponse.json({ error: "Spec not found" }, { status: 404 });
  }
}
