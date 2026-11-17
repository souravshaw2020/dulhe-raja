import { Suspense } from "react";
import TrackOrderClient from "./TrackOrderClient";

export default function TrackOrderPage() {
  return (
    <Suspense
      fallback={<p style={{ padding: "3rem" }}>Loading order tracker...</p>}
    >
      <TrackOrderClient />
    </Suspense>
  );
}
