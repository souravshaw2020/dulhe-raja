import { Suspense } from "react";
import ProductsClient from "./ProductsClient";

export default function ProductsPage() {
  return (
    <Suspense fallback={<p style={{ padding: "3rem" }}>Loading catalog...</p>}>
      <ProductsClient />
    </Suspense>
  );
}
