"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { formatINR } from "@/lib/session";
// import { getCartSessionId } from "@/lib/session";
import styles from "@/app/page.module.css";

export interface StorefrontProduct {
  id: string;
  name: string;
  category: string;
  basePrice: number;
  imageUrl: string;
  altText: string;
  defaultVariantId?: string;
}

const FILTER_TABS = [
  { key: "ALL", label: "All styles" },
  { key: "SHERWANI", label: "Sherwani" },
  { key: "KURTA", label: "Kurta" },
  { key: "PYJAMA", label: "Pyjama" },
  { key: "INDO_WESTERN", label: "Indo-Western" },
];

export default function ShopShowcase({
  initialProducts,
}: {
  initialProducts: StorefrontProduct[];
}) {
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [search, setSearch] = useState("");
  // const [toastMsg, setToastMsg] = useState<string | null>(null);

  // const showToast = (msg: string) => {
  //   setToastMsg(msg);
  //   setTimeout(() => setToastMsg(null), 2800);
  // };

  // const handleAddToBag = async (product: StorefrontProduct) => {
  //   const sessionId = getCartSessionId();
  //   try {
  //     const res = await fetch("/api/cart", {
  //       method: "POST",
  //       headers: { "Content-Type": "application/json" },
  //       body: JSON.stringify({
  //         sessionId,
  //         productId: product.id,
  //         variantId: product.defaultVariantId,
  //         quantity: 1,
  //       }),
  //     });
  //     if (!res.ok) {
  //       showToast("Could not add item to bag.");
  //       return;
  //     }
  //     window.dispatchEvent(new Event("cart-updated"));
  //     showToast(`${product.name} added to your bag.`);
  //   } catch {
  //     showToast("Network error adding item.");
  //   }
  // };

  const filtered = initialProducts.filter((p) => {
    const matchesCat =
      activeCategory === "ALL" || p.category === activeCategory;
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q);
    return matchesCat && matchesSearch;
  });

  return (
    <section
      className={`${styles.section} ${styles.productsSection}`}
      id="shop"
    >
      <div className={styles.sectionHead}>
        <div>
          <div className={styles.eyebrow}>The Royal Dulhe Raja edit</div>
          <h2>Shop customer favourites</h2>
        </div>
        <p className={styles.sectionIntro}>
          Explore the styles that bring tradition and a fresh point of view
          together.
        </p>
      </div>

      <div className={styles.filters}>
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveCategory(tab.key)}
            className={`${styles.filter} ${
              activeCategory === tab.key ? styles.filterActive : ""
            }`}
          >
            {tab.label}
          </button>
        ))}

        <input
          id="product-search"
          aria-label="Search products"
          placeholder="Search styles…"
          className={styles.searchInput}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <p style={{ padding: "24px 0", color: "#7b665b", fontSize: "13px" }}>
          No styles match that search. Try another name or category.
        </p>
      ) : (
        <div className={styles.products}>
          {filtered.map((product, index) => (
            <article key={product.id} className={styles.product}>
              <div className={styles.productImage}>
                <span className={styles.tag}>
                  {product.category.replace("_", " ")}
                </span>
                <Link
                  href={`/products/${product.id}`}
                  style={{
                    position: "relative",
                    display: "block",
                    width: "100%",
                    height: "100%",
                  }}
                >
                  <Image
                    src={product.imageUrl}
                    alt={product.altText}
                    fill
                    loading={index < 2 ? "eager" : "lazy"}
                    sizes="(max-width: 650px) 50vw, 25vw"
                    className={styles.productImgEl}
                  />
                </Link>
                {/* { <button
                  type="button"
                  className={styles.quickAdd}
                  onClick={() => handleAddToBag(product)}
                >
                  Add to bag
                </button> } */}
              </div>
              <Link
                href={`/products/${product.id}`}
                className={styles.productInfo}
                style={{ display: "block" }}
              >
                <h3>{product.name}</h3>
                <div className={styles.productMeta}>
                  <span className={styles.price}>
                    {formatINR(product.basePrice)}
                  </span>
                  <span className={styles.productType}>
                    {product.category.replace("_", " ")}
                  </span>
                </div>
              </Link>
            </article>
          ))}
        </div>
      )}

      {/* { <div
        className={`${styles.toast} ${toastMsg ? styles.toastShow : ""}`}
        role="status"
        aria-live="polite"
      >
        {toastMsg}
      </div> } */}
    </section>
  );
}
