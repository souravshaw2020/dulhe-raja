import { Suspense } from "react";
import ProductsClient from "./ProductsClient";
import Loader from "@/components/Loader";

export default function ProductsPage() {
  return (
    <Suspense fallback={<p style={{ padding: "3rem", justifySelf: "center" }}><Loader variant="page" />Loading catalog...</p>}>
      <ProductsClient />
    </Suspense>
  );
}
