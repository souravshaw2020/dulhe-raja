"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { formatINR, getCartSessionId } from "@/lib/session";
import styles from "./page.module.css";

interface CartItemRow {
  id: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    basePrice: string | number;
    images: { s3Url: string }[];
  };
  variant: {
    id: string;
    color: string;
    size: string;
    priceAdjustment: string | number | null;
  } | null;
}

export default function CartPage() {
  const [items, setItems] = useState<CartItemRow[]>([]);
  const [subtotal, setSubtotal] = useState(0);
  const [tailoringMap, setTailoringMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadCart = async () => {
    const sessionId = getCartSessionId();
    if (!sessionId) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(
        `/api/cart?sessionId=${encodeURIComponent(sessionId)}`,
      );
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        setErrorMsg(err.error || "Failed to load your bag.");
        return;
      }
      const data = (await res.json()) as {
        items: CartItemRow[];
        subtotal: number;
      };
      setItems(data.items || []);
      setSubtotal(data.subtotal || 0);
      setErrorMsg(null);
    } catch {
      setErrorMsg("Network error loading your bag.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCart();
    try {
      const rawMap = localStorage.getItem("dulhe_raja_tailoring_map");
      if (rawMap) {
        setTailoringMap(JSON.parse(rawMap) as Record<string, string>);
      }
    } catch {
      localStorage.removeItem("dulhe_raja_tailoring_map");
    }
  }, []);

  const updateQuantity = async (id: string, nextQty: number) => {
    if (nextQty < 1) return;
    setErrorMsg(null);
    const sessionId = getCartSessionId();

    try {
      const res = await fetch("/api/cart", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, sessionId, quantity: nextQty }),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        setErrorMsg(err.error || "Could not update item quantity.");
        return;
      }

      window.dispatchEvent(new Event("cart-updated"));
      await loadCart();
    } catch {
      setErrorMsg("Network error updating item quantity.");
    }
  };

  const removeItem = async (id: string) => {
    setErrorMsg(null);
    const sessionId = getCartSessionId();

    try {
      const res = await fetch(
        `/api/cart?id=${encodeURIComponent(id)}&sessionId=${encodeURIComponent(sessionId)}`,
        { method: "DELETE" },
      );

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        setErrorMsg(err.error || "Could not remove item from bag.");
        return;
      }

      window.dispatchEvent(new Event("cart-updated"));
      await loadCart();
    } catch {
      setErrorMsg("Network error removing item.");
    }
  };

  return (
    <main className={styles.wrapper}>
      <div className={styles.eyebrow}>Your Selection</div>
      <h1 className={styles.title}>Shopping Bag</h1>

      {errorMsg && (
        <p style={{ color: "#b42318", fontSize: "13px", marginBottom: "16px" }}>
          {errorMsg}
        </p>
      )}

      {loading ? (
        <p style={{ color: "#7b665b" }}>Loading your bag...</p>
      ) : items.length === 0 ? (
        <div style={{ padding: "32px 0" }}>
          <p style={{ color: "#7b665b", marginBottom: "18px" }}>
            Your bag is currently empty.
          </p>
          <Link
            href="/products"
            className={styles.checkoutBtn}
            style={{ maxWidth: "240px" }}
          >
            Explore Collection
          </Link>
        </div>
      ) : (
        <div className={styles.layout}>
          <div className={styles.list}>
            {items.map((item) => {
              const unitPrice =
                Number(item.product.basePrice) +
                (item.variant?.priceAdjustment
                  ? Number(item.variant.priceAdjustment)
                  : 0);

              return (
                <div key={item.id} className={styles.item}>
                  <div className={styles.thumb}>
                    <Image
                      src={item.product.images[0]?.s3Url || "/globe.svg"}
                      alt={item.product.name}
                      fill
                      sizes="90px"
                      style={{ objectFit: "cover" }}
                    />
                  </div>

                  <div>
                    <Link href={`/products/${item.product.id}`}>
                      <h3 className={styles.itemName}>{item.product.name}</h3>
                    </Link>
                    <p className={styles.itemMeta}>
                      {item.variant
                        ? `${item.variant.color} / Size ${item.variant.size}`
                        : "Standard"}{" "}
                      · {formatINR(unitPrice)}
                    </p>
                    {tailoringMap[item.product.id] && (
                      <span className={styles.tailorBadge}>
                        Custom Tailoring Attached
                      </span>
                    )}
                  </div>

                  <div className={styles.controls}>
                    <div className={styles.qtyBox}>
                      <button
                        type="button"
                        onClick={() =>
                          updateQuantity(item.id, item.quantity - 1)
                        }
                      >
                        -
                      </button>
                      <span>{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() =>
                          updateQuantity(item.id, item.quantity + 1)
                        }
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      className={styles.removeBtn}
                      onClick={() => removeItem(item.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <aside className={styles.summary}>
            <h2>Order Summary</h2>
            <div className={styles.summaryRow}>
              <span>Items Subtotal</span>
              <span>{formatINR(subtotal)}</span>
            </div>
            <div className={styles.summaryRow}>
              <span>Shipping</span>
              <span>Complimentary</span>
            </div>
            <div className={styles.totalRow}>
              <span>Total</span>
              <span>{formatINR(subtotal)}</span>
            </div>
            <Link href="/checkout" className={styles.checkoutBtn}>
              Proceed to Checkout
            </Link>
          </aside>
        </div>
      )}
    </main>
  );
}
