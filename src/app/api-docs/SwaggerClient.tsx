"use client";

import { useEffect } from "react";
import Script from "next/script";

declare global {
  interface Window {
    SwaggerUIBundle?: (config: Record<string, unknown>) => void;
  }
}

export default function SwaggerClient() {
  const initSwagger = () => {
    if (window.SwaggerUIBundle) {
      window.SwaggerUIBundle({
        url: "/api/docs/spec",
        dom_id: "#swagger-ui",
        deepLinking: false,
        persistAuthorization: true,
        withCredentials: true,
      });
    }
  };

  useEffect(() => {
    initSwagger();
  }, []);

  return (
    <main style={{ minHeight: "100vh", background: "#ffffff" }}>
      <link
        rel="stylesheet"
        href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"
      />
      <Script
        src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"
        strategy="afterInteractive"
        onLoad={initSwagger}
      />
      <div id="swagger-ui" />
    </main>
  );
}
