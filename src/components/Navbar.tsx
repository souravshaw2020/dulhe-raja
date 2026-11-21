"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { getCartSessionId } from "@/lib/session";
import styles from "./Navbar.module.css";

export default function Navbar() {
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    const loadCount = async () => {
      const sessionId = getCartSessionId();
      if (!sessionId) return;
      try {
        const res = await fetch(
          `/api/cart?sessionId=${encodeURIComponent(sessionId)}`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as { items?: { quantity: number }[] };
        const total = (data.items || []).reduce(
          (sum, item) => sum + item.quantity,
          0,
        );
        setCartCount(total);
      } catch {
        // ignore transient network errors
      }
    };

    loadCount();
    window.addEventListener("cart-updated", loadCount);
    return () => window.removeEventListener("cart-updated", loadCount);
  }, []);

  return (
    <>
      <div className={styles.announcement}>
        Wedding season, made unforgettable &nbsp;·&nbsp; Find your perfect fit
      </div>
      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="Dulhe Raja home">
          <Image
            src="/royal-dulhe-raja-logo.png"
            alt="Royal Dulhe Raja Logo"
            width={44}
            height={44}
            priority
            className={styles.brandLogo}
          />
          <span>
            <span className={styles.brandName}>Royal Dulhe Raja</span>
            <span className={styles.brandSub}>The occasion edit</span>
          </span>
        </Link>

        <nav className={styles.nav} aria-label="Main navigation">
          <Link href="/products">Shop all</Link>
          <Link href="/products?category=SHERWANI">Sherwanis</Link>
          <Link href="/products?category=KURTA">Kurtas</Link>
          <Link href="/products?category=PYJAMA">Pyjamas</Link>
          <Link href="/products?category=INDO_WESTERN">Indo-Western</Link>
          <Link href="/track-order">Track Order</Link>
        </nav>

        <div className={styles.headerActions}>
          <Link
            href="/products"
            className={styles.iconBtn}
            aria-label="Search products"
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
            >
              <circle cx="10.8" cy="10.8" r="6.8" />
              <path d="m16 16 5 5" />
            </svg>
          </Link>
          <Link
            href="/cart"
            className={styles.iconBtn}
            aria-label="View shopping bag"
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
            >
              <path d="M5 8h14l1 13H4L5 8Z" />
              <path d="M9 9V6a3 3 0 0 1 6 0v3" />
            </svg>
            <span className={styles.cartCount}>{cartCount}</span>
          </Link>
          <Link href="/admin" className={styles.adminLink}>
            Admin
          </Link>
        </div>
      </header>
    </>
  );
}
