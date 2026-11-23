import { Suspense } from "react";
import TrackOrderClient from "./TrackOrderClient";
import Loader from "@/components/Loader";

export default function TrackOrderPage() {
  return (
    <Suspense
      fallback={<p style={{ padding: "3rem", justifySelf: "center" }}><Loader variant="page" />Loading order tracker...</p>}
    >
      <TrackOrderClient />
    </Suspense>
  );
}
