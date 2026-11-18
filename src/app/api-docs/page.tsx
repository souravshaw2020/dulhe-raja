import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getAdminSession } from "@/lib/auth";
import SwaggerClient from "./SwaggerClient";

async function ProtectedSwagger() {
  await connection();

  const session = await getAdminSession();
  if (!session) {
    redirect("/admin");
  }

  return <SwaggerClient />;
}

export default function ApiDocsPage() {
  return (
    <Suspense
      fallback={<p style={{ padding: "2rem" }}>Checking admin session...</p>}
    >
      <ProtectedSwagger />
    </Suspense>
  );
}
