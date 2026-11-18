"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { formatINR } from "@/lib/session";
import styles from "./page.module.css";

type AdminTab = "products" | "orders" | "broadcasts" | "csv";

interface ProductRow {
  id: string;
  name: string;
  category: string;
  fabricType: string;
  basePrice: string | number;
  variants: {
    id: string;
    color: string;
    size: string;
    sku: string;
    stock: number;
  }[];
}

interface OrderRow {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  totalAmount: string | number;
  status: string;
  paymentStatus: string;
  createdAt: string;
  items: {
    id: string;
    quantity: number;
    product: { name: string };
    tailoringProfile: {
      id: string;
      chest: string | number;
      waist: string | number;
    } | null;
  }[];
}

interface CampaignRow {
  id: string;
  campaignType: string;
  title: string;
  channel: string;
  sentCount: number;
  failedCount: number;
  createdAt: string;
}

const EXPORT_TABLES = [
  "products",
  "variants",
  "images",
  "orders",
  "order-items",
  "tailoring",
  "subscribers",
  "campaigns",
  "cart",
];

export default function AdminPage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [loginError, setLoginError] = useState<string | null>(null);

  const [tab, setTab] = useState<AdminTab>("products");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Data states
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [subscriberCount, setSubscriberCount] = useState(0);

  // Product creation state
  const [newProd, setNewProd] = useState({
    name: "",
    description: "",
    category: "SHERWANI",
    fabricType: "",
    basePrice: "",
    color: "Ivory",
    size: "40",
    sku: "",
    stock: "5",
    s3Url: "",
  });
  const [uploadingImg, setUploadingImg] = useState(false);

  // Broadcast state
  const [broadcast, setBroadcast] = useState({
    campaignType: "NEW_CATEGORY_ARRIVALS",
    channel: "BOTH",
    category: "SHERWANI",
    daysBack: "7",
    discountPercent: "20",
    title: "",
    message: "",
    imageUrl: "",
    targetUrl: "",
  });

  // CSV Import state
  const [importTable, setImportTable] = useState("products");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<string | null>(null);

  const loadAdminData = async () => {
    const [prodRes, ordRes, campRes, subRes] = await Promise.all([
      fetch("/api/products?limit=50"),
      fetch("/api/orders?limit=50"),
      fetch("/api/notifications/broadcast"),
      fetch("/api/subscribers"),
    ]);

    if (prodRes.ok) {
      const pJson = (await prodRes.json()) as { data: ProductRow[] };
      setProducts(pJson.data || []);
    }
    if (ordRes.ok) {
      const oJson = (await ordRes.json()) as { orders: OrderRow[] };
      setOrders(oJson.orders || []);
    }
    if (campRes.ok) {
      setCampaigns((await campRes.json()) as CampaignRow[]);
    }
    if (subRes.ok) {
      const subs = (await subRes.json()) as unknown[];
      setSubscriberCount(subs.length);
    }
  };

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => {
        if (res.ok) {
          setAuthenticated(true);
          loadAdminData();
        }
      })
      .finally(() => setAuthChecked(true));
  }, []);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(loginForm),
    });
    if (!res.ok) {
      setLoginError("Invalid email or password.");
      return;
    }
    setAuthenticated(true);
    loadAdminData();
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setAuthenticated(false);
  };

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImg(true);
    setStatusMsg(null);
    try {
      const signRes = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      });
      const signData = (await signRes.json()) as {
        signedUrl?: string;
        fileUrl?: string;
        error?: string;
      };
      if (!signRes.ok || !signData.signedUrl || !signData.fileUrl) {
        setStatusMsg(signData.error || "Failed to get S3 upload URL.");
        return;
      }

      const putRes = await fetch(signData.signedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!putRes.ok) {
        setStatusMsg("S3 upload failed. Check bucket CORS settings.");
        return;
      }

      setNewProd((prev) => ({ ...prev, s3Url: signData.fileUrl! }));
      setStatusMsg("Image uploaded to S3.");
    } catch {
      setStatusMsg("Error uploading image.");
    } finally {
      setUploadingImg(false);
    }
  };

  const handleCreateProduct = async (e: FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);

    if (!newProd.s3Url.trim().startsWith("http")) {
      setStatusMsg(
        "Please upload an image or enter a valid https:// image URL.",
      );
      return;
    }

    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newProd.name.trim(),
          description: newProd.description.trim() || undefined,
          category: newProd.category,
          fabricType: newProd.fabricType.trim(),
          basePrice: Number(newProd.basePrice),
          allowsCustomTailoring: true,
          variants: [
            {
              color: newProd.color.trim(),
              size: newProd.size.trim(),
              sku: newProd.sku.trim(),
              stock: Number(newProd.stock) || 0,
            },
          ],
          images: [{ s3Url: newProd.s3Url.trim(), isPrimary: true }],
        }),
      });

      const data = (await res.json()) as { error?: string; details?: unknown };
      if (!res.ok) {
        setStatusMsg(
          data.details
            ? `${data.error}: ${JSON.stringify(data.details)}`
            : data.error || "Failed to create product.",
        );
        return;
      }

      setStatusMsg("Product created.");
      setNewProd({
        name: "",
        description: "",
        category: "SHERWANI",
        fabricType: "",
        basePrice: "",
        color: "Ivory",
        size: "40",
        sku: "",
        stock: "5",
        s3Url: "",
      });
      await loadAdminData();
    } catch {
      setStatusMsg("Network error creating product.");
    }
  };

  const handleDeleteProduct = async (id: string) => {
    setStatusMsg(null);
    try {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setStatusMsg(data.error || "Failed to delete product.");
        return;
      }
      setStatusMsg("Product deleted.");
      await loadAdminData();
    } catch {
      setStatusMsg("Network error deleting product.");
    }
  };

  const handleUpdateStock = async (variantId: string, stock: number) => {
    setStatusMsg(null);
    try {
      const res = await fetch(`/api/variants/${variantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stock: Math.max(0, stock) }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setStatusMsg(data.error || "Failed to update variant stock.");
        return;
      }
      setStatusMsg("Variant stock updated.");
      await loadAdminData();
    } catch {
      setStatusMsg("Network error updating stock.");
    }
  };

  const handleOrderUpdate = async (
    orderId: string,
    patch: { status?: string; paymentStatus?: string },
  ) => {
    setStatusMsg(null);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setStatusMsg(data.error || "Failed to update order.");
        return;
      }
      setStatusMsg("Order updated.");
      await loadAdminData();
    } catch {
      setStatusMsg("Network error updating order.");
    }
  };

  const handleSendBroadcast = async (e: FormEvent) => {
    e.preventDefault();
    setStatusMsg("Sending broadcast...");

    const payload: Record<string, unknown> = {
      campaignType: broadcast.campaignType,
      channel: broadcast.channel,
    };

    if (broadcast.campaignType === "NEW_CATEGORY_ARRIVALS") {
      payload.category = broadcast.category;
      payload.daysBack = Number(broadcast.daysBack) || 7;
    } else {
      payload.title = broadcast.title.trim();
      payload.message = broadcast.message.trim();
      if (broadcast.imageUrl.trim())
        payload.imageUrl = broadcast.imageUrl.trim();
      if (broadcast.targetUrl.trim())
        payload.targetUrl = broadcast.targetUrl.trim();
      if (broadcast.campaignType === "DISCOUNT_SALE") {
        payload.discountPercent = Number(broadcast.discountPercent) || 10;
      }
    }

    try {
      const res = await fetch("/api/notifications/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as {
        sentCount?: number;
        failedCount?: number;
        error?: string;
        details?: unknown;
      };

      if (!res.ok) {
        setStatusMsg(
          data.details
            ? `${data.error}: ${JSON.stringify(data.details)}`
            : data.error || "Broadcast failed.",
        );
        return;
      }

      setStatusMsg(
        `Broadcast sent: ${data.sentCount ?? 0} delivered, ${data.failedCount ?? 0} failed.`,
      );
      await loadAdminData();
    } catch {
      setStatusMsg("Network error sending broadcast.");
    }
  };

  const handleCsvImport = async (e: FormEvent) => {
    e.preventDefault();
    if (!importFile) return;
    setImportResult("Importing CSV...");

    const formData = new FormData();
    formData.append("file", importFile);

    try {
      const res = await fetch(`/api/import/${importTable}`, {
        method: "POST",
        body: formData,
      });

      const data = (await res.json()) as {
        imported?: number;
        updated?: number;
        skipped?: number;
        error?: string;
      };

      if (!res.ok) {
        setImportResult(data.error || "CSV import failed.");
        return;
      }

      setImportResult(
        `Done: ${data.imported ?? 0} imported, ${data.updated ?? 0} updated, ${data.skipped ?? 0} skipped.`,
      );
      await loadAdminData();
    } catch {
      setImportResult("Network error importing CSV.");
    }
  };

  if (!authChecked) {
    return <main className={styles.wrapper}>Checking admin session...</main>;
  }

  if (!authenticated) {
    return (
      <main className={styles.wrapper}>
        <form className={styles.loginBox} onSubmit={handleLogin}>
          <div className={styles.eyebrow}>Dulhe Raja Admin</div>
          <h1 className={styles.title} style={{ marginBottom: "20px" }}>
            Sign In
          </h1>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}
          >
            <input
              type="email"
              required
              placeholder="Admin Email"
              className={styles.input}
              value={loginForm.email}
              onChange={(e) =>
                setLoginForm({ ...loginForm, email: e.target.value })
              }
            />
            <input
              type="password"
              required
              placeholder="Password"
              className={styles.input}
              value={loginForm.password}
              onChange={(e) =>
                setLoginForm({ ...loginForm, password: e.target.value })
              }
            />
            {loginError && (
              <p style={{ color: "#b42318", fontSize: "12px" }}>{loginError}</p>
            )}
            <button type="submit" className={styles.btn}>
              Sign In
            </button>
          </div>
        </form>
      </main>
    );
  }

  return (
    <main className={styles.wrapper}>
      <div className={styles.topbar}>
        <div>
          <div className={styles.eyebrow}>Shree Shyam Creation</div>
          <h1 className={styles.title}>Admin Dashboard</h1>
        </div>
        <div className={styles.topActions}>
          <Link href="/api-docs" className={styles.btnOutline}>
            API Docs
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className={styles.btnOutline}
          >
            Logout
          </button>
        </div>
      </div>

      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tab} ${tab === "products" ? styles.tabActive : ""}`}
          onClick={() => setTab("products")}
        >
          Products ({products.length})
        </button>
        <button
          type="button"
          className={`${styles.tab} ${tab === "orders" ? styles.tabActive : ""}`}
          onClick={() => setTab("orders")}
        >
          Orders ({orders.length})
        </button>
        <button
          type="button"
          className={`${styles.tab} ${tab === "broadcasts" ? styles.tabActive : ""}`}
          onClick={() => setTab("broadcasts")}
        >
          Broadcasts ({subscriberCount} Subscribers)
        </button>
        <button
          type="button"
          className={`${styles.tab} ${tab === "csv" ? styles.tabActive : ""}`}
          onClick={() => setTab("csv")}
        >
          CSV Import / Export
        </button>
      </div>

      {statusMsg && (
        <p className={styles.statusMsg} style={{ marginBottom: "16px" }}>
          {statusMsg}
        </p>
      )}

      {tab === "products" && (
        <>
          <section className={styles.panel}>
            <h2>Add New Product</h2>
            <form className={styles.formGrid} onSubmit={handleCreateProduct}>
              <input
                required
                placeholder="Product Name"
                className={styles.input}
                value={newProd.name}
                onChange={(e) =>
                  setNewProd({ ...newProd, name: e.target.value })
                }
              />
              <select
                className={styles.select}
                value={newProd.category}
                onChange={(e) =>
                  setNewProd({ ...newProd, category: e.target.value })
                }
              >
                <option value="SHERWANI">SHERWANI</option>
                <option value="KURTA">KURTA</option>
                <option value="PYJAMA">PYJAMA</option>
                <option value="INDO_WESTERN">INDO_WESTERN</option>
              </select>
              <input
                required
                placeholder="Fabric Type (e.g. Raw Silk)"
                className={styles.input}
                value={newProd.fabricType}
                onChange={(e) =>
                  setNewProd({ ...newProd, fabricType: e.target.value })
                }
              />
              <input
                required
                type="number"
                placeholder="Base Price (INR)"
                className={styles.input}
                value={newProd.basePrice}
                onChange={(e) =>
                  setNewProd({ ...newProd, basePrice: e.target.value })
                }
              />
              <input
                required
                placeholder="Initial Color"
                className={styles.input}
                value={newProd.color}
                onChange={(e) =>
                  setNewProd({ ...newProd, color: e.target.value })
                }
              />
              <input
                required
                placeholder="Initial Size (e.g. 40)"
                className={styles.input}
                value={newProd.size}
                onChange={(e) =>
                  setNewProd({ ...newProd, size: e.target.value })
                }
              />
              <input
                required
                placeholder="Unique SKU"
                className={styles.input}
                value={newProd.sku}
                onChange={(e) =>
                  setNewProd({ ...newProd, sku: e.target.value })
                }
              />
              <input
                required
                type="number"
                placeholder="Initial Stock"
                className={styles.input}
                value={newProd.stock}
                onChange={(e) =>
                  setNewProd({ ...newProd, stock: e.target.value })
                }
              />
              <div className={styles.full}>
                <label
                  style={{
                    display: "block",
                    fontSize: "12px",
                    marginBottom: "6px",
                  }}
                >
                  Upload Image to S3 (or paste URL below):
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  onChange={handleImageUpload}
                />
                {uploadingImg && (
                  <span style={{ fontSize: "12px", marginLeft: "8px" }}>
                    Uploading...
                  </span>
                )}
              </div>
              <input
                required
                placeholder="Primary Image URL (auto-filled after S3 upload)"
                className={`${styles.input} ${styles.full}`}
                value={newProd.s3Url}
                onChange={(e) =>
                  setNewProd({ ...newProd, s3Url: e.target.value })
                }
              />
              <textarea
                rows={2}
                placeholder="Description (optional)"
                className={`${styles.textarea} ${styles.full}`}
                value={newProd.description}
                onChange={(e) =>
                  setNewProd({ ...newProd, description: e.target.value })
                }
              />
              <button type="submit" className={`${styles.btn} ${styles.full}`}>
                Create Product
              </button>
            </form>
          </section>

          <section className={styles.panel}>
            <h2>Catalog Inventory</h2>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Variants &amp; Stock</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.name}</strong>
                        <div style={{ fontSize: "11px", color: "#7b665b" }}>
                          {p.fabricType}
                        </div>
                      </td>
                      <td>{p.category.replace("_", " ")}</td>
                      <td>{formatINR(p.basePrice)}</td>
                      <td>
                        {p.variants.map((v) => (
                          <div
                            key={v.id}
                            style={{
                              display: "flex",
                              gap: "8px",
                              alignItems: "center",
                              marginBottom: "4px",
                            }}
                          >
                            <span>
                              {v.color} / {v.size} ({v.sku}):
                            </span>
                            <input
                              type="number"
                              defaultValue={v.stock}
                              style={{
                                width: "64px",
                                padding: "3px 6px",
                                border: "1px solid #d9c8b7",
                              }}
                              onBlur={(e) =>
                                handleUpdateStock(v.id, Number(e.target.value))
                              }
                            />
                          </div>
                        ))}
                      </td>
                      <td>
                        <button
                          type="button"
                          className={styles.btnDanger}
                          onClick={() => handleDeleteProduct(p.id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {tab === "orders" && (
        <section className={styles.panel}>
          <h2>Orders &amp; Tailoring</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Customer</th>
                  <th>Items &amp; Tailoring</th>
                  <th>Total</th>
                  <th>Order Status</th>
                  <th>Payment</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((ord) => (
                  <tr key={ord.id}>
                    <td>
                      <strong>{ord.orderNumber}</strong>
                    </td>
                    <td>
                      {ord.customerName}
                      <div style={{ fontSize: "11px", color: "#7b665b" }}>
                        {ord.customerPhone}
                      </div>
                    </td>
                    <td>
                      {ord.items.map((it) => (
                        <div key={it.id} style={{ marginBottom: "4px" }}>
                          {it.product.name} × {it.quantity}
                          {it.tailoringProfile && (
                            <span
                              style={{
                                display: "block",
                                fontSize: "11px",
                                color: "var(--site-primary)",
                              }}
                            >
                              Tailoring: Chest{" "}
                              {String(it.tailoringProfile.chest)}&quot;, Waist{" "}
                              {String(it.tailoringProfile.waist)}&quot;
                            </span>
                          )}
                        </div>
                      ))}
                    </td>
                    <td>{formatINR(ord.totalAmount)}</td>
                    <td>
                      <select
                        className={styles.select}
                        value={ord.status}
                        onChange={(e) =>
                          handleOrderUpdate(ord.id, { status: e.target.value })
                        }
                      >
                        <option value="PENDING">PENDING</option>
                        <option value="CONFIRMED">CONFIRMED</option>
                        <option value="IN_TAILORING">IN_TAILORING</option>
                        <option value="SHIPPED">SHIPPED</option>
                        <option value="DELIVERED">DELIVERED</option>
                        <option value="CANCELLED">CANCELLED</option>
                      </select>
                    </td>
                    <td>
                      <select
                        className={styles.select}
                        value={ord.paymentStatus}
                        onChange={(e) =>
                          handleOrderUpdate(ord.id, {
                            paymentStatus: e.target.value,
                          })
                        }
                      >
                        <option value="PENDING">PENDING</option>
                        <option value="PAID">PAID</option>
                        <option value="FAILED">FAILED</option>
                        <option value="REFUNDED">REFUNDED</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "broadcasts" && (
        <>
          <section className={styles.panel}>
            <h2>Send WhatsApp / SMS Broadcast</h2>
            <form className={styles.formGrid} onSubmit={handleSendBroadcast}>
              <select
                className={styles.select}
                value={broadcast.campaignType}
                onChange={(e) =>
                  setBroadcast({ ...broadcast, campaignType: e.target.value })
                }
              >
                <option value="NEW_CATEGORY_ARRIVALS">
                  New Category Arrivals (Auto-list)
                </option>
                <option value="COLLECTION">Collection Announcement</option>
                <option value="DISCOUNT_SALE">Discounted Sale</option>
              </select>

              <select
                className={styles.select}
                value={broadcast.channel}
                onChange={(e) =>
                  setBroadcast({ ...broadcast, channel: e.target.value })
                }
              >
                <option value="BOTH">WhatsApp &amp; SMS</option>
                <option value="WHATSAPP">WhatsApp Only</option>
                <option value="SMS">SMS Only</option>
              </select>

              {broadcast.campaignType === "NEW_CATEGORY_ARRIVALS" ? (
                <>
                  <select
                    className={styles.select}
                    value={broadcast.category}
                    onChange={(e) =>
                      setBroadcast({ ...broadcast, category: e.target.value })
                    }
                  >
                    <option value="SHERWANI">SHERWANI</option>
                    <option value="KURTA">KURTA</option>
                    <option value="PYJAMA">PYJAMA</option>
                    <option value="INDO_WESTERN">INDO_WESTERN</option>
                  </select>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    placeholder="Days Back (e.g. 7)"
                    className={styles.input}
                    value={broadcast.daysBack}
                    onChange={(e) =>
                      setBroadcast({ ...broadcast, daysBack: e.target.value })
                    }
                  />
                </>
              ) : (
                <>
                  <input
                    required
                    placeholder="Campaign Title"
                    className={styles.input}
                    value={broadcast.title}
                    onChange={(e) =>
                      setBroadcast({ ...broadcast, title: e.target.value })
                    }
                  />
                  {broadcast.campaignType === "DISCOUNT_SALE" && (
                    <input
                      type="number"
                      min={1}
                      max={95}
                      placeholder="Discount %"
                      className={styles.input}
                      value={broadcast.discountPercent}
                      onChange={(e) =>
                        setBroadcast({
                          ...broadcast,
                          discountPercent: e.target.value,
                        })
                      }
                    />
                  )}
                  <input
                    placeholder="Image URL (optional)"
                    className={styles.input}
                    value={broadcast.imageUrl}
                    onChange={(e) =>
                      setBroadcast({ ...broadcast, imageUrl: e.target.value })
                    }
                  />
                  <input
                    placeholder="Target Shop URL (optional)"
                    className={styles.input}
                    value={broadcast.targetUrl}
                    onChange={(e) =>
                      setBroadcast({ ...broadcast, targetUrl: e.target.value })
                    }
                  />
                  <textarea
                    required
                    rows={3}
                    placeholder="Campaign Message"
                    className={`${styles.textarea} ${styles.full}`}
                    value={broadcast.message}
                    onChange={(e) =>
                      setBroadcast({ ...broadcast, message: e.target.value })
                    }
                  />
                </>
              )}

              <button type="submit" className={`${styles.btn} ${styles.full}`}>
                Send Broadcast to Active Subscribers
              </button>
            </form>
          </section>

          <section className={styles.panel}>
            <h2>Recent Campaigns</h2>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Type</th>
                    <th>Channel</th>
                    <th>Sent / Failed</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => (
                    <tr key={c.id}>
                      <td>{c.title}</td>
                      <td>{c.campaignType}</td>
                      <td>{c.channel}</td>
                      <td>
                        {c.sentCount} sent / {c.failedCount} failed
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {tab === "csv" && (
        <>
          <section className={styles.panel}>
            <h2>Export Database Tables (CSV)</h2>
            <div className={styles.csvGrid}>
              {EXPORT_TABLES.map((tbl) => (
                <a
                  key={tbl}
                  href={`/api/export/${tbl}`}
                  className={styles.btnOutline}
                  download
                >
                  Download {tbl}.csv
                </a>
              ))}
            </div>
          </section>

          <section className={styles.panel}>
            <h2>Bulk Import CSV</h2>
            <form className={styles.formGrid} onSubmit={handleCsvImport}>
              <select
                className={styles.select}
                value={importTable}
                onChange={(e) => setImportTable(e.target.value)}
              >
                <option value="products">products</option>
                <option value="variants">variants</option>
                <option value="subscribers">subscribers</option>
                <option value="tailoring">tailoring</option>
              </select>
              <input
                type="file"
                accept=".csv,text/csv"
                required
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              />
              <button type="submit" className={`${styles.btn} ${styles.full}`}>
                Upload &amp; Import CSV
              </button>
            </form>
            {importResult && <p className={styles.statusMsg}>{importResult}</p>}
          </section>
        </>
      )}
    </main>
  );
}
