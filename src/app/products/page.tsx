import { Suspense } from "react";
import ProductsClient from "./ProductsClient";
import Loader from "@/components/Loader";

export default function ProductsPage() {
  return (
    <Suspense
      fallback={
        <>
          <Loader variant="page" />
          <p style={{ padding: "3rem" }}>Loading catalog...</p>
        </>
      }
    >
      <ProductsClient />
    </Suspense>
  );
}
