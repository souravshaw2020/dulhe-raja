"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { formatINR, getCartSessionId } from "@/lib/session";
import styles from "./page.module.css";

interface VariantData {
  id: string;
  color: string;
  size: string;
  sku: string;
  stock: number;
  priceAdjustment: number;
}

interface ImageData {
  id: string;
  s3Url: string;
  altText: string | null;
  isPrimary: boolean;
}

export interface ProductDetailData {
  id: string;
  name: string;
  description: string | null;
  category: string;
  fabricType: string;
  basePrice: number;
  allowsCustomTailoring: boolean;
  images: ImageData[];
  variants: VariantData[];
}

export default function ProductDetailClient({
  product,
}: {
  product: ProductDetailData;
}) {
  const [activeImage, setActiveImage] = useState(
    product.images[0]?.s3Url || "/globe.svg",
  );
  const [selectedVariantId, setSelectedVariantId] = useState(
    product.variants[0]?.id || "",
  );
  const [quantity, setQuantity] = useState(1);
  const [bagMsg, setBagMsg] = useState<string | null>(null);

  const [showTailoring, setShowTailoring] = useState(false);
  const [tailorStatus, setTailorStatus] = useState<string | null>(null);
  const [tailorForm, setTailorForm] = useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    chest: "",
    waist: "",
    shoulderWidth: "",
    armLength: "",
    kurtaLength: "",
    fittingType: "REGULAR",
    notes: "",
  });

  const selectedVariant = product.variants.find(
    (v) => v.id === selectedVariantId,
  );
  const finalPrice =
    product.basePrice + (selectedVariant?.priceAdjustment || 0);
  const outOfStock = selectedVariant ? selectedVariant.stock <= 0 : false;

  const handleAddToCart = async () => {
    setBagMsg(null);
    const sessionId = getCartSessionId();
    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          productId: product.id,
          variantId: selectedVariant?.id,
          quantity,
        }),
      });
      if (!res.ok) {
        setBagMsg("Could not add to bag.");
        return;
      }
      window.dispatchEvent(new Event("cart-updated"));
      setBagMsg("Added to your bag.");
    } catch {
      setBagMsg("Network error.");
    }
  };

  const handleSaveTailoring = async (e: FormEvent) => {
    e.preventDefault();
    setTailorStatus("Saving measurements...");
    try {
      const res = await fetch("/api/custom-tailoring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: tailorForm.customerName,
          customerPhone: tailorForm.customerPhone,
          customerEmail: tailorForm.customerEmail || undefined,
          chest: Number(tailorForm.chest),
          waist: Number(tailorForm.waist),
          shoulderWidth: Number(tailorForm.shoulderWidth),
          armLength: Number(tailorForm.armLength),
          kurtaLength: tailorForm.kurtaLength
            ? Number(tailorForm.kurtaLength)
            : undefined,
          fittingType: tailorForm.fittingType,
          notes: tailorForm.notes || undefined,
        }),
      });

      const data = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !data.id) {
        setTailorStatus(data.error || "Invalid measurement values.");
        return;
      }

      const rawMap = localStorage.getItem("dulhe_raja_tailoring_map");
      const map = rawMap ? (JSON.parse(rawMap) as Record<string, string>) : {};
      map[product.id] = data.id;
      localStorage.setItem("dulhe_raja_tailoring_map", JSON.stringify(map));

      setTailorStatus(
        "Measurements saved and linked to this item for checkout.",
      );
    } catch {
      setTailorStatus("Network error saving measurements.");
    }
  };

  return (
    <main className={styles.wrapper}>
      <div className={styles.breadcrumb}>
        <Link href="/">Home</Link> / <Link href="/products">Shop</Link> /{" "}
        <span>{product.name}</span>
      </div>

      <div className={styles.layout}>
        <div className={styles.gallery}>
          <div className={styles.mainImageWrap}>
            <Image
              src={activeImage}
              alt={product.name}
              fill
              sizes="(max-width: 820px) 100vw, 50vw"
              className={styles.mainImg}
            />
          </div>
          {product.images.length > 1 && (
            <div className={styles.thumbs}>
              {product.images.map((img) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setActiveImage(img.s3Url)}
                  className={`${styles.thumbBtn} ${
                    activeImage === img.s3Url ? styles.thumbActive : ""
                  }`}
                >
                  <Image
                    src={img.s3Url}
                    alt={img.altText || product.name}
                    fill
                    sizes="72px"
                    style={{ objectFit: "cover" }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={styles.details}>
          <span className={styles.eyebrow}>
            {product.category.replace("_", " ")} · {product.fabricType}
          </span>
          <h1 className={styles.title}>{product.name}</h1>

          <div className={styles.priceRow}>
            <span className={styles.price}>{formatINR(finalPrice)}</span>
            {selectedVariant && (
              <span className={styles.stock}>
                {selectedVariant.stock > 0
                  ? `${selectedVariant.stock} in stock · SKU ${selectedVariant.sku}`
                  : "Out of stock"}
              </span>
            )}
          </div>

          {product.description && (
            <p className={styles.desc}>{product.description}</p>
          )}

          {product.variants.length > 0 && (
            <div>
              <span className={styles.label}>Select Color &amp; Size</span>
              <div className={styles.variantGrid}>
                {product.variants.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setSelectedVariantId(v.id)}
                    className={`${styles.variantBtn} ${
                      selectedVariantId === v.id ? styles.variantActive : ""
                    }`}
                  >
                    {v.color} / {v.size}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className={styles.qtyRow}>
            <input
              type="number"
              min={1}
              max={selectedVariant?.stock || 10}
              value={quantity}
              onChange={(e) =>
                setQuantity(Math.max(1, Number(e.target.value) || 1))
              }
              className={styles.qtyInput}
              aria-label="Quantity"
            />
            <button
              type="button"
              disabled={outOfStock}
              onClick={handleAddToCart}
              className={styles.addBtn}
            >
              {outOfStock ? "Out of Stock" : "Add to Bag"}
            </button>
          </div>

          {bagMsg && (
            <p className={styles.feedback}>
              {bagMsg}{" "}
              <Link href="/cart" style={{ textDecoration: "underline" }}>
                View Bag
              </Link>
            </p>
          )}

          {product.allowsCustomTailoring && (
            <div className={styles.tailoringBox}>
              <button
                type="button"
                className={styles.tailoringToggle}
                onClick={() => setShowTailoring((s) => !s)}
              >
                <span>Bespoke Custom Tailoring (Inches)</span>
                <span>{showTailoring ? "Hide" : "Add Measurements +"}</span>
              </button>

              {showTailoring && (
                <form
                  className={styles.tailoringForm}
                  onSubmit={handleSaveTailoring}
                >
                  <input
                    required
                    placeholder="Full Name"
                    value={tailorForm.customerName}
                    onChange={(e) =>
                      setTailorForm({
                        ...tailorForm,
                        customerName: e.target.value,
                      })
                    }
                  />
                  <input
                    required
                    placeholder="Phone (10 digits)"
                    value={tailorForm.customerPhone}
                    onChange={(e) =>
                      setTailorForm({
                        ...tailorForm,
                        customerPhone: e.target.value,
                      })
                    }
                  />
                  <input
                    type="email"
                    placeholder="Email (optional)"
                    className={styles.fullSpan}
                    value={tailorForm.customerEmail}
                    onChange={(e) =>
                      setTailorForm({
                        ...tailorForm,
                        customerEmail: e.target.value,
                      })
                    }
                  />
                  <input
                    required
                    type="number"
                    step="0.1"
                    placeholder="Chest (in)"
                    value={tailorForm.chest}
                    onChange={(e) =>
                      setTailorForm({ ...tailorForm, chest: e.target.value })
                    }
                  />
                  <input
                    required
                    type="number"
                    step="0.1"
                    placeholder="Waist (in)"
                    value={tailorForm.waist}
                    onChange={(e) =>
                      setTailorForm({ ...tailorForm, waist: e.target.value })
                    }
                  />
                  <input
                    required
                    type="number"
                    step="0.1"
                    placeholder="Shoulder Width (in)"
                    value={tailorForm.shoulderWidth}
                    onChange={(e) =>
                      setTailorForm({
                        ...tailorForm,
                        shoulderWidth: e.target.value,
                      })
                    }
                  />
                  <input
                    required
                    type="number"
                    step="0.1"
                    placeholder="Arm Length (in)"
                    value={tailorForm.armLength}
                    onChange={(e) =>
                      setTailorForm({
                        ...tailorForm,
                        armLength: e.target.value,
                      })
                    }
                  />
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Kurta Length (optional)"
                    value={tailorForm.kurtaLength}
                    onChange={(e) =>
                      setTailorForm({
                        ...tailorForm,
                        kurtaLength: e.target.value,
                      })
                    }
                  />
                  <select
                    value={tailorForm.fittingType}
                    onChange={(e) =>
                      setTailorForm({
                        ...tailorForm,
                        fittingType: e.target.value,
                      })
                    }
                  >
                    <option value="SLIM">Slim Fit</option>
                    <option value="REGULAR">Regular Fit</option>
                    <option value="COMFORT">Comfort Fit</option>
                  </select>
                  <textarea
                    rows={2}
                    placeholder="Tailoring notes (e.g. collar style, sleeve cuff)"
                    className={styles.fullSpan}
                    value={tailorForm.notes}
                    onChange={(e) =>
                      setTailorForm({ ...tailorForm, notes: e.target.value })
                    }
                  />
                  <button type="submit" className={styles.saveTailorBtn}>
                    Save Custom Measurements
                  </button>
                  {tailorStatus && (
                    <p className={`${styles.feedback} ${styles.fullSpan}`}>
                      {tailorStatus}
                    </p>
                  )}
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
