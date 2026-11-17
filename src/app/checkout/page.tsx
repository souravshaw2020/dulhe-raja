"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { formatINR, getCartSessionId } from "@/lib/session";
import styles from "./page.module.css";

interface CartItemRow {
  id: string;
  quantity: number;
  product: { id: string; name: string; basePrice: string | number };
  variant: {
    id: string;
    size: string;
    color: string;
    priceAdjustment: string | number | null;
  } | null;
}

interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

export default function CheckoutPage() {
  const router = useRouter();
  const [items, setItems] = useState<CartItemRow[]>([]);
  const [subtotal, setSubtotal] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    shippingAddress: "",
    city: "",
    postalCode: "",
  });

  useEffect(() => {
    const sessionId = getCartSessionId();
    if (!sessionId) return;
    fetch(`/api/cart?sessionId=${encodeURIComponent(sessionId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { items: CartItemRow[]; subtotal: number } | null) => {
        if (data) {
          setItems(data.items || []);
          setSubtotal(data.subtotal || 0);
        }
      });
  }, []);

  const handleCheckout = async (e: FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;

    setSubmitting(true);
    setError(null);
    const sessionId = getCartSessionId();
    const rawTailor = localStorage.getItem("dulhe_raja_tailoring_map");
    const tailoringMap = rawTailor
      ? (JSON.parse(rawTailor) as Record<string, string>)
      : {};

    try {
      // 1. Create Order in DB
      const orderRes = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          sessionId,
          items: items.map((item) => ({
            productId: item.product.id,
            variantId: item.variant?.id,
            tailoringProfileId: tailoringMap[item.product.id],
            quantity: item.quantity,
          })),
        }),
      });

      const orderData = (await orderRes.json()) as {
        id?: string;
        orderNumber?: string;
        error?: string;
      };

      if (!orderRes.ok || !orderData.id || !orderData.orderNumber) {
        setError(orderData.error || "Could not create order.");
        setSubmitting(false);
        return;
      }

      window.dispatchEvent(new Event("cart-updated"));
      localStorage.removeItem("dulhe_raja_tailoring_map");

      // 2. Initialize Razorpay Order
      const payRes = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: orderData.id }),
      });

      const payData = (await payRes.json()) as {
        razorpayOrderId?: string;
        amount?: number;
        currency?: string;
        keyId?: string;
        error?: string;
      };

      if (!payRes.ok || !payData.razorpayOrderId || !window.Razorpay) {
        // Order created, redirect to tracking page even if gateway isn't configured in dev
        router.push(
          `/track-order?orderNumber=${encodeURIComponent(orderData.orderNumber)}`,
        );
        return;
      }

      // 3. Open Razorpay Checkout Modal
      const rzp = new window.Razorpay({
        key: payData.keyId,
        amount: payData.amount,
        currency: payData.currency || "INR",
        name: "Dulhe Raja",
        description: `Order ${orderData.orderNumber}`,
        order_id: payData.razorpayOrderId,
        prefill: {
          name: form.customerName,
          email: form.customerEmail,
          contact: form.customerPhone,
        },
        handler: async (response: RazorpayResponse) => {
          await fetch("/api/payments/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId: orderData.id,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            }),
          });
          router.push(
            `/track-order?orderNumber=${encodeURIComponent(orderData.orderNumber!)}`,
          );
        },
        modal: {
          ondismiss: () => {
            router.push(
              `/track-order?orderNumber=${encodeURIComponent(orderData.orderNumber!)}`,
            );
          },
        },
      });

      rzp.open();
    } catch {
      setError("Network error during checkout.");
      setSubmitting(false);
    }
  };

  return (
    <main className={styles.wrapper}>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="afterInteractive"
      />
      <div className={styles.eyebrow}>Secure Checkout</div>
      <h1 className={styles.title}>Shipping &amp; Payment</h1>

      <div className={styles.layout}>
        <form className={styles.form} onSubmit={handleCheckout}>
          <h2>Delivery Details</h2>
          <input
            required
            placeholder="Full Name"
            value={form.customerName}
            onChange={(e) => setForm({ ...form, customerName: e.target.value })}
          />
          <input
            required
            type="email"
            placeholder="Email Address"
            value={form.customerEmail}
            onChange={(e) =>
              setForm({ ...form, customerEmail: e.target.value })
            }
          />
          <input
            required
            type="tel"
            placeholder="Phone Number (10 digits)"
            className={styles.full}
            value={form.customerPhone}
            onChange={(e) =>
              setForm({ ...form, customerPhone: e.target.value })
            }
          />
          <input
            required
            placeholder="Street Address"
            className={styles.full}
            value={form.shippingAddress}
            onChange={(e) =>
              setForm({ ...form, shippingAddress: e.target.value })
            }
          />
          <input
            required
            placeholder="City"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
          />
          <input
            required
            placeholder="PIN / Postal Code"
            value={form.postalCode}
            onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
          />

          {error && <p className={styles.error}>{error}</p>}

          <button
            type="submit"
            disabled={submitting || items.length === 0}
            className={styles.payBtn}
          >
            {submitting
              ? "Processing..."
              : `Place Order & Pay ${formatINR(subtotal)}`}
          </button>
        </form>

        <aside className={styles.summary}>
          <h2>Bag Summary</h2>
          {items.map((item) => {
            const unit =
              Number(item.product.basePrice) +
              (item.variant?.priceAdjustment
                ? Number(item.variant.priceAdjustment)
                : 0);
            return (
              <div key={item.id} className={styles.summaryLine}>
                <span>
                  {item.product.name} × {item.quantity}
                </span>
                <span>{formatINR(unit * item.quantity)}</span>
              </div>
            );
          })}
          <div className={styles.total}>
            <span>Total</span>
            <span>{formatINR(subtotal)}</span>
          </div>
        </aside>
      </div>
    </main>
  );
}
