"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { formatINR, getCartSessionId } from "@/lib/session";
import styles from "./page.module.css";

interface ProductItem {
  id: string;
  name: string;
  category: string;
  fabricType: string;
  basePrice: string | number;
  images: { s3Url: string; altText: string | null }[];
  variants: { id: string; size: string; color: string; stock: number }[];
}

interface FilterMeta {
  categories: string[];
  sizes: string[];
  colors: string[];
}

export default function ProductsClient() {
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get("category") || "";

  const [category, setCategory] = useState(initialCategory);
  const [query, setQuery] = useState("");
  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [inStock, setInStock] = useState(false);
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);

  const [products, setProducts] = useState<ProductItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [meta, setMeta] = useState<FilterMeta>({
    categories: ["SHERWANI", "KURTA", "PYJAMA", "INDO_WESTERN"],
    sizes: [],
    colors: [],
  });
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    setCategory(searchParams.get("category") || "");
    setPage(1);
  }, [searchParams]);

  useEffect(() => {
    fetch("/api/categories")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: FilterMeta | null) => {
        if (data) setMeta(data);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const loadProducts = async () => {
      setLoading(true);
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (category) params.set("category", category);
      if (size) params.set("size", size);
      if (color) params.set("color", color);
      if (minPrice) params.set("minPrice", minPrice);
      if (maxPrice) params.set("maxPrice", maxPrice);
      if (inStock) params.set("inStock", "true");
      if (sort) params.set("sort", sort);
      params.set("page", String(page));
      params.set("limit", "9");

      try {
        const res = await fetch(`/api/products?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const json = (await res.json()) as {
          data: ProductItem[];
          pagination: { totalPages: number };
        };
        setProducts(json.data || []);
        setTotalPages(Math.max(1, json.pagination?.totalPages || 1));
      } catch {
        // ignore abort
      } finally {
        setLoading(false);
      }
    };

    loadProducts();
    return () => controller.abort();
  }, [query, category, size, color, minPrice, maxPrice, inStock, sort, page]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2600);
  };

  const handleAddToBag = async (product: ProductItem) => {
    const sessionId = getCartSessionId();
    const defaultVariant =
      product.variants.find((v) => v.stock > 0) || product.variants[0];

    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          productId: product.id,
          variantId: defaultVariant?.id,
          quantity: 1,
        }),
      });
      if (!res.ok) {
        showToast("Could not add item to bag.");
        return;
      }
      window.dispatchEvent(new Event("cart-updated"));
      showToast(`${product.name} added to your bag.`);
    } catch {
      showToast("Network error.");
    }
  };

  const resetFilters = () => {
    setCategory("");
    setQuery("");
    setSize("");
    setColor("");
    setMinPrice("");
    setMaxPrice("");
    setInStock(false);
    setSort("newest");
    setPage(1);
  };

  return (
    <main className={styles.wrapper}>
      <div className={styles.header}>
        <div>
          <div className={styles.eyebrow}>Dulhe Raja Catalog</div>
          <h1 className={styles.title}>
            {category ? category.replace("_", " ") : "All Occasion Wear"}
          </h1>
        </div>

        <div className={styles.controls}>
          <input
            type="search"
            placeholder="Search sherwanis, kurtas..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            className={styles.searchInput}
          />
          <select
            aria-label="Sort products"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
            className={styles.select}
          >
            <option value="newest">Newest First</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>
      </div>

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <div className={styles.filterGroup}>
            <h3>Category</h3>
            <div className={styles.pillList}>
              <button
                type="button"
                className={`${styles.pill} ${category === "" ? styles.pillActive : ""}`}
                onClick={() => {
                  setCategory("");
                  setPage(1);
                }}
              >
                All
              </button>
              {meta.categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`${styles.pill} ${category === cat ? styles.pillActive : ""}`}
                  onClick={() => {
                    setCategory(cat);
                    setPage(1);
                  }}
                >
                  {cat.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>

          {meta.sizes.length > 0 && (
            <div className={styles.filterGroup}>
              <h3>Size</h3>
              <div className={styles.pillList}>
                {meta.sizes.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`${styles.pill} ${size === s ? styles.pillActive : ""}`}
                    onClick={() => {
                      setSize(size === s ? "" : s);
                      setPage(1);
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {meta.colors.length > 0 && (
            <div className={styles.filterGroup}>
              <h3>Color</h3>
              <div className={styles.pillList}>
                {meta.colors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`${styles.pill} ${color === c ? styles.pillActive : ""}`}
                    onClick={() => {
                      setColor(color === c ? "" : c);
                      setPage(1);
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className={styles.filterGroup}>
            <h3>Price Range (INR)</h3>
            <div className={styles.priceInputs}>
              <input
                type="number"
                placeholder="Min"
                value={minPrice}
                onChange={(e) => {
                  setMinPrice(e.target.value);
                  setPage(1);
                }}
              />
              <input
                type="number"
                placeholder="Max"
                value={maxPrice}
                onChange={(e) => {
                  setMaxPrice(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>

          <label className={styles.checkLabel}>
            <input
              type="checkbox"
              checked={inStock}
              onChange={(e) => {
                setInStock(e.target.checked);
                setPage(1);
              }}
            />
            In stock only
          </label>

          <button
            type="button"
            onClick={resetFilters}
            className={styles.resetBtn}
          >
            Reset Filters
          </button>
        </aside>

        <div>
          {loading ? (
            <p style={{ color: "#7b665b" }}>Loading styles...</p>
          ) : products.length === 0 ? (
            <p style={{ color: "#7b665b" }}>
              No matching styles found. Try clearing some filters.
            </p>
          ) : (
            <div className={styles.grid}>
              {products.map((product) => (
                <article key={product.id} className={styles.card}>
                  <div className={styles.imageWrap}>
                    <span className={styles.tag}>
                      {product.category.replace("_", " ")}
                    </span>
                    <Link href={`/products/${product.id}`}>
                      <Image
                        src={product.images[0]?.s3Url || "/globe.svg"}
                        alt={product.images[0]?.altText || product.name}
                        fill
                        sizes="(max-width: 900px) 50vw, 25vw"
                        className={styles.img}
                      />
                    </Link>
                    <button
                      type="button"
                      className={styles.quickAdd}
                      onClick={() => handleAddToBag(product)}
                    >
                      Add to bag
                    </button>
                  </div>
                  <Link
                    href={`/products/${product.id}`}
                    className={styles.info}
                  >
                    <h3>{product.name}</h3>
                    <div className={styles.meta}>
                      <span className={styles.price}>
                        {formatINR(product.basePrice)}
                      </span>
                      <span className={styles.fabric}>
                        {product.fabricType}
                      </span>
                    </div>
                  </Link>
                </article>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button
                type="button"
                className={styles.pageBtn}
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </button>
              <span>
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                className={styles.pageBtn}
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      <div
        className={`${styles.toast} ${toastMsg ? styles.toastShow : ""}`}
        role="status"
      >
        {toastMsg}
      </div>
    </main>
  );
}
