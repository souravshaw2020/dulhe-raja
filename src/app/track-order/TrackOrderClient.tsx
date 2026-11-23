"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatINR } from "@/lib/session";
import styles from "./page.module.css";
import Loader from "@/components/Loader";

interface OrderRecord {
  id: string;
  orderNumber: string;
  customerName: string;
  status: string;
  paymentStatus: string;
  totalAmount: string | number;
  shippingAddress: string;
  city: string;
  postalCode: string;
  createdAt: string;
  items: {
    id: string;
    quantity: number;
    unitPrice: string | number;
    product: { name: string };
    variant: { color: string; size: string } | null;
    tailoringProfile: { id: string } | null;
  }[];
}

export default function TrackOrderClient() {
  const searchParams = useSearchParams();
  const initialOrder = searchParams.get("orderNumber") || "";

  const [orderQuery, setOrderQuery] = useState(initialOrder);
  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchOrder = async (num: string) => {
    if (!num.trim()) return;
    setLoading(true);
    setError(null);
    setOrder(null);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(num.trim())}`);
      if (!res.ok) {
        setError("Order not found. Please check your order number.");
        return;
      }
      setOrder((await res.json()) as OrderRecord);
    } catch {
      setError("Network error looking up order.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialOrder) fetchOrder(initialOrder);
  }, [initialOrder]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    fetchOrder(orderQuery);
  };

  return (
    <main className={styles.wrapper}>
      <div className={styles.eyebrow}>Order Status</div>
      <h1 className={styles.title}>Track Your Order</h1>

      <form className={styles.searchForm} onSubmit={handleSubmit}>
        <input
          placeholder="Enter Order Number (e.g. DR-123456-789)"
          value={orderQuery}
          onChange={(e) => setOrderQuery(e.target.value)}
        />
        <button type="submit">Track</button>
      </form>

      {loading && <p style={{ color: "#7b665b", justifySelf: "center" }}><Loader variant="compact" />Looking up order...</p>}
      {error && <p style={{ color: "#b42318", fontSize: "13px" }}>{error}</p>}

      {order && (
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <div>
              <strong
                style={{
                  fontSize: "18px",
                  fontFamily: "var(--site-font-heading)",
                }}
              >
                {order.orderNumber}
              </strong>
              <p
                style={{
                  fontSize: "12px",
                  color: "#7b665b",
                  margin: "4px 0 0",
                }}
              >
                {order.customerName} · {order.shippingAddress}, {order.city}{" "}
                {order.postalCode}
              </p>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <span className={styles.badge}>
                Status: {order.status.replace("_", " ")}
              </span>
              <span className={styles.badge}>
                Payment: {order.paymentStatus}
              </span>
            </div>
          </div>

          {order.items.map((item) => (
            <div key={item.id} className={styles.itemRow}>
              <span>
                {item.product.name}
                {item.variant
                  ? ` (${item.variant.color}, ${item.variant.size})`
                  : ""}{" "}
                × {item.quantity}
                {item.tailoringProfile ? " · Custom Tailored" : ""}
              </span>
              <span>{formatINR(Number(item.unitPrice) * item.quantity)}</span>
            </div>
          ))}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              paddingTop: "14px",
              fontWeight: 700,
              color: "var(--site-primary)",
            }}
          >
            <span>Total Amount</span>
            <span>{formatINR(order.totalAmount)}</span>
          </div>
        </div>
      )}
    </main>
  );
}
