import { Suspense } from "react";
import TrackOrderClient from "./TrackOrderClient";
import Loader from "@/components/Loader";

export default function TrackOrderPage() {
  return (
    <Suspense
      fallback={
        <>
          <Loader variant="page" />
          <p style={{ padding: "3rem" }}>Loading order tracker...</p>
        </>
      }
    >
      <TrackOrderClient />
    </Suspense>
  );
}
