"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { formatINR } from "@/lib/session";
import styles from "./page.module.css";
import Loader from "@/components/Loader";

type AdminTab = "products" | "orders" | "broadcasts" | "csv";

interface VariantDraft {
  color: string;
  size: string;
  sku: string;
  stock: string;
  priceAdjustment: string;
}

interface ImageDraft {
  s3Url: string;
  altText: string;
  isPrimary: boolean;
}

interface ProductRow {
  id: string;
  name: string;
  description: string | null;
  category: string;
  fabricType: string;
  basePrice: string | number;
  allowsCustomTailoring: boolean;
  variants: {
    id: string;
    color: string;
    size: string;
    sku: string;
    stock: number;
    priceAdjustment: string | number | null;
  }[];
  images: {
    id: string;
    s3Url: string;
    altText: string | null;
    isPrimary: boolean;
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

const CSV_REQUIRED_HEADERS: Record<string, string> = {
  products:
    "Required columns: name*, category* (SHERWANI | KURTA | PYJAMA | INDO_WESTERN), fabricType*, basePrice* (> 0). Optional: description, allowsCustomTailoring, color, size, sku, stock, s3Url",
  variants:
    "Required columns: productId*, color*, size*, sku* (min 3 chars), stock* (>= 0). Optional: priceAdjustment",
  subscribers:
    "Required columns: phone* (min 10 digits). Optional: name, whatsappOptIn (true/false), smsOptIn (true/false), isActive (true/false)",
  tailoring:
    "Required columns: customerName*, customerPhone*, chest*, waist*, shoulderWidth*, armLength*. Optional: customerEmail, kurtaLength, neck, hip, fittingType (SLIM | REGULAR | COMFORT), notes",
};

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

  // Create Product states
  const [newProd, setNewProd] = useState({
    name: "",
    description: "",
    category: "SHERWANI",
    fabricType: "Velvet",
    basePrice: "",
    allowsCustomTailoring: true,
  });

  const [variants, setVariants] = useState<VariantDraft[]>([
    {
      color: "Maroon & Gold",
      size: "M",
      sku: "SHR-VEL-MAR-M",
      stock: "2",
      priceAdjustment: "",
    },
  ]);

  const [images, setImages] = useState<ImageDraft[]>([
    { s3Url: "", altText: "", isPrimary: true },
  ]);

  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [prodErrors, setProdErrors] = useState<Record<string, string>>({});

  // Edit Existing Product state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editProd, setEditProd] = useState({
    name: "",
    description: "",
    category: "SHERWANI",
    fabricType: "",
    basePrice: "",
    allowsCustomTailoring: true,
  });
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  // Edit / Add Variant state
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [editVariant, setEditVariant] = useState({
    color: "",
    size: "",
    stock: "0",
    priceAdjustment: "",
  });

  const [addingVariantForProductId, setAddingVariantForProductId] = useState<
    string | null
  >(null);
  const [newVariant, setNewVariant] = useState({
    color: "",
    size: "",
    sku: "",
    stock: "1",
    priceAdjustment: "",
  });

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
  const [broadcastErrors, setBroadcastErrors] = useState<
    Record<string, string>
  >({});

  // CSV Import state
  const [importTable, setImportTable] = useState("products");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<string | null>(null);

  const loadAdminData = async () => {
    try {
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
    } catch {
      setStatusMsg("Failed to refresh dashboard data.");
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
      .catch(() => undefined)
      .finally(() => setAuthChecked(true));
  }, []);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    if (!loginForm.email.trim() || !loginForm.password.trim()) {
      setLoginError("Both email and password are required.");
      return;
    }
    try {
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
      await loadAdminData();
    } catch {
      setLoginError("Network error signing in.");
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setAuthenticated(false);
  };

  const addVariantRow = () => {
    setVariants((prev) => [
      ...prev,
      {
        color: prev[0]?.color || "",
        size: "L",
        sku: "",
        stock: "1",
        priceAdjustment: "",
      },
    ]);
  };

  const removeVariantRow = (idx: number) => {
    if (variants.length <= 1) return;
    setVariants((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateVariantRow = (
    idx: number,
    field: keyof VariantDraft,
    value: string,
  ) => {
    setVariants((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, [field]: value } : row)),
    );
  };

  const addImageRow = () => {
    setImages((prev) => [
      ...prev,
      { s3Url: "", altText: "", isPrimary: false },
    ]);
  };

  const removeImageRow = (idx: number) => {
    if (images.length <= 1) return;
    setImages((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      if (!next.some((img) => img.isPrimary) && next[0]) {
        next[0].isPrimary = true;
      }
      return next;
    });
  };

  const setPrimaryImageRow = (idx: number) => {
    setImages((prev) =>
      prev.map((img, i) => ({ ...img, isPrimary: i === idx })),
    );
  };

  const handleImageUploadForRow = async (
    idx: number,
    e: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingIdx(idx);
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

      setImages((prev) =>
        prev.map((img, i) =>
          i === idx ? { ...img, s3Url: signData.fileUrl! } : img,
        ),
      );
      setStatusMsg(`Image #${idx + 1} uploaded to S3.`);
    } catch {
      setStatusMsg("Error uploading image.");
    } finally {
      setUploadingIdx(null);
    }
  };

  const validateNewProduct = (): boolean => {
    const errs: Record<string, string> = {};

    if (newProd.name.trim().length < 3) {
      errs.name = "Product name must be at least 3 characters.";
    }
    if (!newProd.fabricType.trim()) {
      errs.fabricType = "Fabric type is required.";
    }
    const price = Number(newProd.basePrice);
    if (!newProd.basePrice || Number.isNaN(price) || price <= 0) {
      errs.basePrice = "Base price must be greater than 0.";
    }

    const skus = new Set<string>();
    variants.forEach((v, i) => {
      if (!v.color.trim()) errs[`variant_color_${i}`] = "Color is required.";
      if (!v.size.trim()) errs[`variant_size_${i}`] = "Size is required.";
      if (v.sku.trim().length < 3) {
        errs[`variant_sku_${i}`] = "SKU must be at least 3 characters.";
      } else if (skus.has(v.sku.trim())) {
        errs[`variant_sku_${i}`] = "Duplicate SKU in form.";
      } else {
        skus.add(v.sku.trim());
      }
      const st = parseInt(v.stock, 10);
      if (v.stock === "" || Number.isNaN(st) || st < 0) {
        errs[`variant_stock_${i}`] = "Stock must be 0 or more.";
      }
      if (
        v.priceAdjustment.trim() !== "" &&
        Number.isNaN(Number(v.priceAdjustment))
      ) {
        errs[`variant_adj_${i}`] = "Must be a valid number.";
      }
    });

    images.forEach((img, i) => {
      const url = img.s3Url.trim();
      if (!url || (!url.startsWith("https://") && !url.startsWith("http://"))) {
        errs[`image_url_${i}`] =
          "Valid http:// or https:// image URL is required.";
      }
    });

    if (!images.some((img) => img.isPrimary)) {
      errs.images = "Select one image as Primary.";
    }

    setProdErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleCreateProduct = async (e: FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);

    if (!validateNewProduct()) {
      setStatusMsg("Please fix the highlighted required fields below.");
      return;
    }

    const formattedImages = images.map((img) => ({
      s3Url: img.s3Url.trim(),
      altText: img.altText.trim() || undefined,
      isPrimary: img.isPrimary,
    }));

    const formattedVariants = variants.map((v) => ({
      color: v.color.trim(),
      size: v.size.trim(),
      sku: v.sku.trim(),
      stock: Math.max(0, parseInt(v.stock, 10) || 0),
      ...(v.priceAdjustment.trim() !== ""
        ? { priceAdjustment: Number(v.priceAdjustment) }
        : {}),
    }));

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
          allowsCustomTailoring: newProd.allowsCustomTailoring,
          variants: formattedVariants,
          images: formattedImages,
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

      setProdErrors({});
      setStatusMsg("Product created with all variants and images.");
      setNewProd({
        name: "",
        description: "",
        category: "SHERWANI",
        fabricType: "Velvet",
        basePrice: "",
        allowsCustomTailoring: true,
      });
      setVariants([
        { color: "", size: "M", sku: "", stock: "1", priceAdjustment: "" },
      ]);
      setImages([{ s3Url: "", altText: "", isPrimary: true }]);
      await loadAdminData();
    } catch {
      setStatusMsg("Network error creating product.");
    }
  };

  const startEditingProduct = (p: ProductRow) => {
    setEditingId(p.id);
    setEditErrors({});
    setEditProd({
      name: p.name,
      description: p.description || "",
      category: p.category,
      fabricType: p.fabricType,
      basePrice: String(p.basePrice),
      allowsCustomTailoring: p.allowsCustomTailoring,
    });
  };

  const handleSaveEditProduct = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    setStatusMsg(null);

    const errs: Record<string, string> = {};
    if (editProd.name.trim().length < 3) {
      errs.name = "Product name must be at least 3 characters.";
    }
    if (!editProd.fabricType.trim()) {
      errs.fabricType = "Fabric type is required.";
    }
    if (!editProd.basePrice || Number(editProd.basePrice) <= 0) {
      errs.basePrice = "Base price must be greater than 0.";
    }
    setEditErrors(errs);
    if (Object.keys(errs).length > 0) return;

    try {
      const res = await fetch(`/api/products/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editProd.name.trim(),
          description: editProd.description.trim(),
          category: editProd.category,
          fabricType: editProd.fabricType.trim(),
          basePrice: Number(editProd.basePrice),
          allowsCustomTailoring: editProd.allowsCustomTailoring,
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setStatusMsg(data.error || "Failed to update product.");
        return;
      }

      setStatusMsg("Product details updated.");
      setEditingId(null);
      await loadAdminData();
    } catch {
      setStatusMsg("Network error updating product.");
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

  const startEditingVariant = (v: ProductRow["variants"][number]) => {
    setEditingVariantId(v.id);
    setEditVariant({
      color: v.color,
      size: v.size,
      stock: String(v.stock),
      priceAdjustment:
        v.priceAdjustment !== null && v.priceAdjustment !== undefined
          ? String(v.priceAdjustment)
          : "",
    });
  };

  const handleSaveVariant = async (variantId: string) => {
    setStatusMsg(null);
    const parsedStock = parseInt(editVariant.stock, 10);
    if (
      !editVariant.color.trim() ||
      !editVariant.size.trim() ||
      Number.isNaN(parsedStock) ||
      parsedStock < 0
    ) {
      setStatusMsg("Variant color, size, and non-negative stock are required.");
      return;
    }

    const adj =
      editVariant.priceAdjustment.trim() !== ""
        ? Number(editVariant.priceAdjustment)
        : null;

    if (adj !== null && Number.isNaN(adj)) {
      setStatusMsg("Price adjustment must be a valid number.");
      return;
    }

    try {
      const res = await fetch(`/api/variants/${variantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          color: editVariant.color.trim(),
          size: editVariant.size.trim(),
          stock: parsedStock,
          priceAdjustment: adj,
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setStatusMsg(data.error || "Failed to update variant.");
        return;
      }

      setEditingVariantId(null);
      setStatusMsg("Variant updated.");
      await loadAdminData();
    } catch {
      setStatusMsg("Network error updating variant.");
    }
  };

  const handleDeleteVariant = async (variantId: string) => {
    setStatusMsg(null);
    try {
      const res = await fetch(`/api/variants/${variantId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setStatusMsg(data.error || "Failed to delete variant.");
        return;
      }
      setStatusMsg("Variant deleted.");
      await loadAdminData();
    } catch {
      setStatusMsg("Network error deleting variant.");
    }
  };

  const handleAddVariantToProduct = async (productId: string) => {
    setStatusMsg(null);
    if (
      !newVariant.color.trim() ||
      !newVariant.size.trim() ||
      newVariant.sku.trim().length < 3
    ) {
      setStatusMsg("Color, size, and SKU (min 3 chars) are required.");
      return;
    }

    try {
      const res = await fetch(`/api/products/${productId}/variants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          color: newVariant.color.trim(),
          size: newVariant.size.trim(),
          sku: newVariant.sku.trim(),
          stock: Math.max(0, parseInt(newVariant.stock, 10) || 0),
          priceAdjustment:
            newVariant.priceAdjustment.trim() !== ""
              ? Number(newVariant.priceAdjustment)
              : null,
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setStatusMsg(data.error || "Failed to add variant.");
        return;
      }

      setAddingVariantForProductId(null);
      setNewVariant({
        color: "",
        size: "",
        sku: "",
        stock: "1",
        priceAdjustment: "",
      });
      setStatusMsg("Variant added.");
      await loadAdminData();
    } catch {
      setStatusMsg("Network error adding variant.");
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
    setStatusMsg(null);

    const errs: Record<string, string> = {};
    if (broadcast.campaignType === "NEW_CATEGORY_ARRIVALS") {
      const days = Number(broadcast.daysBack);
      if (!days || days < 1 || days > 90) {
        errs.daysBack = "Days back must be between 1 and 90.";
      }
    } else {
      if (broadcast.title.trim().length < 2) {
        errs.title = "Campaign title is required (min 2 characters).";
      }
      if (broadcast.message.trim().length < 5) {
        errs.message = "Campaign message is required (min 5 characters).";
      }
      if (broadcast.campaignType === "DISCOUNT_SALE") {
        const disc = Number(broadcast.discountPercent);
        if (!disc || disc < 1 || disc > 95) {
          errs.discountPercent = "Discount % is required (1 to 95).";
        }
      }
      if (
        broadcast.imageUrl.trim() &&
        !broadcast.imageUrl.trim().startsWith("http")
      ) {
        errs.imageUrl = "Must be a valid http:// or https:// URL.";
      }
      if (
        broadcast.targetUrl.trim() &&
        !broadcast.targetUrl.trim().startsWith("http")
      ) {
        errs.targetUrl = "Must be a valid http:// or https:// URL.";
      }
    }

    setBroadcastErrors(errs);
    if (Object.keys(errs).length > 0) return;

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
    if (!importFile) {
      setImportResult("Please select a .csv file first.");
      return;
    }
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
    return (
      <main className={styles.wrapper}>
        <Loader variant="page" />
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className={styles.wrapper}>
        <form className={styles.loginBox} onSubmit={handleLogin} noValidate>
          <div className={styles.eyebrow}>Dulhe Raja Admin</div>
          <h1 className={styles.title} style={{ marginBottom: "8px" }}>
            Sign In
          </h1>
          <p className={styles.hint} style={{ marginBottom: "18px" }}>
            Fields marked with <span className={styles.req}>*</span> are
            required.
          </p>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "14px" }}
          >
            <div className={styles.field}>
              <label className={styles.fieldLabel}>
                Admin Email<span className={styles.req}>*</span>
              </label>
              <input
                type="email"
                required
                placeholder="admin@dulheraja.com"
                className={styles.input}
                value={loginForm.email}
                onChange={(e) =>
                  setLoginForm({ ...loginForm, email: e.target.value })
                }
              />
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>
                Password<span className={styles.req}>*</span>
              </label>
              <input
                type="password"
                required
                placeholder="Enter admin password"
                className={styles.input}
                value={loginForm.password}
                onChange={(e) =>
                  setLoginForm({ ...loginForm, password: e.target.value })
                }
              />
            </div>

            {loginError && <p className={styles.fieldError}>{loginError}</p>}
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
            <p className={styles.hint} style={{ marginBottom: "16px" }}>
              Fields marked with <span className={styles.req}>*</span> are
              required. At least 1 variant and 1 primary image are mandatory.
            </p>

            <form
              className={styles.formGrid}
              onSubmit={handleCreateProduct}
              noValidate
            >
              <div className={styles.field}>
                <label className={styles.fieldLabel}>
                  Product Name<span className={styles.req}>*</span>
                </label>
                <input
                  required
                  minLength={3}
                  placeholder="e.g. Royal Zardosi Velvet Sherwani"
                  className={`${styles.input} ${prodErrors.name ? styles.inputError : ""}`}
                  value={newProd.name}
                  onChange={(e) =>
                    setNewProd({ ...newProd, name: e.target.value })
                  }
                />
                {prodErrors.name && (
                  <span className={styles.fieldError}>{prodErrors.name}</span>
                )}
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>
                  Category<span className={styles.req}>*</span>
                </label>
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
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>
                  Fabric Type<span className={styles.req}>*</span>
                </label>
                <input
                  required
                  list="fabric-suggestions"
                  placeholder="e.g. Velvet, Raw Silk"
                  className={`${styles.input} ${prodErrors.fabricType ? styles.inputError : ""}`}
                  value={newProd.fabricType}
                  onChange={(e) =>
                    setNewProd({ ...newProd, fabricType: e.target.value })
                  }
                />
                {prodErrors.fabricType && (
                  <span className={styles.fieldError}>
                    {prodErrors.fabricType}
                  </span>
                )}
                <datalist id="fabric-suggestions">
                  <option value="Velvet" />
                  <option value="Raw Silk" />
                  <option value="Brocade" />
                  <option value="Jacquard Silk" />
                  <option value="Cotton Silk" />
                  <option value="Linen" />
                </datalist>
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>
                  Base Price (INR)<span className={styles.req}>*</span>
                </label>
                <input
                  required
                  type="number"
                  step="0.01"
                  min="1"
                  placeholder="e.g. 18500"
                  className={`${styles.input} ${prodErrors.basePrice ? styles.inputError : ""}`}
                  value={newProd.basePrice}
                  onChange={(e) =>
                    setNewProd({ ...newProd, basePrice: e.target.value })
                  }
                />
                {prodErrors.basePrice && (
                  <span className={styles.fieldError}>
                    {prodErrors.basePrice}
                  </span>
                )}
              </div>

              <div className={styles.full}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "13px",
                    fontWeight: 600,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={newProd.allowsCustomTailoring}
                    onChange={(e) =>
                      setNewProd({
                        ...newProd,
                        allowsCustomTailoring: e.target.checked,
                      })
                    }
                  />
                  Allows Bespoke Custom Tailoring
                </label>
              </div>

              {/* Conditional Info Banner for Custom Tailoring */}
              <div className={styles.infoBox}>
                {newProd.allowsCustomTailoring ? (
                  <>
                    <strong>Custom Tailoring Enabled:</strong> Customers on the
                    product page will see the bespoke measurement form (Chest*,
                    Waist*, Shoulder Width*, Arm Length*, plus optional Kurta
                    Length &amp; Fit Type).
                  </>
                ) : (
                  <>
                    <strong>Ready-to-Wear Mode:</strong> Custom measurement
                    inputs will be hidden on the storefront; customers will only
                    select from the standard size variants below.
                  </>
                )}
              </div>

              <div className={`${styles.field} ${styles.full}`}>
                <label className={styles.fieldLabel}>
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Handcrafted maroon velvet sherwani with heavy gold zardosi embroidery..."
                  className={styles.textarea}
                  value={newProd.description}
                  onChange={(e) =>
                    setNewProd({ ...newProd, description: e.target.value })
                  }
                />
              </div>

              {/* Multi-Variant Builder */}
              <div
                className={styles.full}
                style={{ borderTop: "1px solid #e7daca", paddingTop: "14px" }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "10px",
                  }}
                >
                  <div>
                    <strong style={{ fontSize: "13px" }}>
                      Product Variants<span className={styles.req}>*</span>
                    </strong>
                    <span className={styles.hint} style={{ display: "block" }}>
                      Color*, Size*, Unique SKU* (min 3 chars), and Stock*
                      (&gt;= 0) are required for every row.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={addVariantRow}
                    className={styles.btnOutline}
                  >
                    + Add Variant Row
                  </button>
                </div>

                {variants.map((v, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.2fr 0.7fr 1.2fr 0.7fr 1fr auto",
                      gap: "8px",
                      marginBottom: "10px",
                      alignItems: "start",
                    }}
                  >
                    <div className={styles.field}>
                      <label className={styles.fieldLabel}>
                        Color<span className={styles.req}>*</span>
                      </label>
                      <input
                        required
                        placeholder="Maroon & Gold"
                        className={`${styles.input} ${prodErrors[`variant_color_${idx}`] ? styles.inputError : ""}`}
                        value={v.color}
                        onChange={(e) =>
                          updateVariantRow(idx, "color", e.target.value)
                        }
                      />
                      {prodErrors[`variant_color_${idx}`] && (
                        <span className={styles.fieldError}>
                          {prodErrors[`variant_color_${idx}`]}
                        </span>
                      )}
                    </div>

                    <div className={styles.field}>
                      <label className={styles.fieldLabel}>
                        Size<span className={styles.req}>*</span>
                      </label>
                      <input
                        required
                        list="size-suggestions"
                        placeholder="S/M/L/XL"
                        className={`${styles.input} ${prodErrors[`variant_size_${idx}`] ? styles.inputError : ""}`}
                        value={v.size}
                        onChange={(e) =>
                          updateVariantRow(idx, "size", e.target.value)
                        }
                      />
                      {prodErrors[`variant_size_${idx}`] && (
                        <span className={styles.fieldError}>
                          {prodErrors[`variant_size_${idx}`]}
                        </span>
                      )}
                    </div>

                    <div className={styles.field}>
                      <label className={styles.fieldLabel}>
                        SKU<span className={styles.req}>*</span>
                      </label>
                      <input
                        required
                        minLength={3}
                        placeholder="SHR-VEL-MAR-M"
                        className={`${styles.input} ${prodErrors[`variant_sku_${idx}`] ? styles.inputError : ""}`}
                        value={v.sku}
                        onChange={(e) =>
                          updateVariantRow(idx, "sku", e.target.value)
                        }
                      />
                      {prodErrors[`variant_sku_${idx}`] && (
                        <span className={styles.fieldError}>
                          {prodErrors[`variant_sku_${idx}`]}
                        </span>
                      )}
                    </div>

                    <div className={styles.field}>
                      <label className={styles.fieldLabel}>
                        Stock<span className={styles.req}>*</span>
                      </label>
                      <input
                        required
                        type="number"
                        min="0"
                        placeholder="2"
                        className={`${styles.input} ${prodErrors[`variant_stock_${idx}`] ? styles.inputError : ""}`}
                        value={v.stock}
                        onChange={(e) =>
                          updateVariantRow(idx, "stock", e.target.value)
                        }
                      />
                      {prodErrors[`variant_stock_${idx}`] && (
                        <span className={styles.fieldError}>
                          {prodErrors[`variant_stock_${idx}`]}
                        </span>
                      )}
                    </div>

                    <div className={styles.field}>
                      <label className={styles.fieldLabel}>
                        +Price Adj (Opt)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="e.g. 1000"
                        className={`${styles.input} ${prodErrors[`variant_adj_${idx}`] ? styles.inputError : ""}`}
                        value={v.priceAdjustment}
                        onChange={(e) =>
                          updateVariantRow(
                            idx,
                            "priceAdjustment",
                            e.target.value,
                          )
                        }
                      />
                      {prodErrors[`variant_adj_${idx}`] && (
                        <span className={styles.fieldError}>
                          {prodErrors[`variant_adj_${idx}`]}
                        </span>
                      )}
                    </div>

                    {variants.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeVariantRow(idx)}
                        className={styles.btnDanger}
                        style={{ marginTop: "20px" }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <datalist id="size-suggestions">
                  <option value="S" />
                  <option value="M" />
                  <option value="L" />
                  <option value="XL" />
                  <option value="XXL" />
                  <option value="38" />
                  <option value="40" />
                  <option value="42" />
                  <option value="44" />
                </datalist>
              </div>

              {/* Multi-Image Builder */}
              <div
                className={styles.full}
                style={{ borderTop: "1px solid #e7daca", paddingTop: "14px" }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "10px",
                  }}
                >
                  <div>
                    <strong style={{ fontSize: "13px" }}>
                      Product Images<span className={styles.req}>*</span>
                    </strong>
                    <span className={styles.hint} style={{ display: "block" }}>
                      Upload a JPEG/PNG/WebP/AVIF to S3 or paste a full https://
                      URL. One image must be marked Primary*.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={addImageRow}
                    className={styles.btnOutline}
                  >
                    + Add Image Row
                  </button>
                </div>

                {prodErrors.images && (
                  <p className={styles.fieldError}>{prodErrors.images}</p>
                )}

                {images.map((img, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.4fr 1fr auto auto auto",
                      gap: "8px",
                      marginBottom: "10px",
                      alignItems: "start",
                    }}
                  >
                    <div className={styles.field}>
                      <label className={styles.fieldLabel}>
                        Image URL<span className={styles.req}>*</span>
                      </label>
                      <input
                        required
                        type="url"
                        placeholder="https://..."
                        className={`${styles.input} ${prodErrors[`image_url_${idx}`] ? styles.inputError : ""}`}
                        value={img.s3Url}
                        onChange={(e) =>
                          setImages((prev) =>
                            prev.map((row, i) =>
                              i === idx
                                ? { ...row, s3Url: e.target.value }
                                : row,
                            ),
                          )
                        }
                      />
                      {prodErrors[`image_url_${idx}`] && (
                        <span className={styles.fieldError}>
                          {prodErrors[`image_url_${idx}`]}
                        </span>
                      )}
                    </div>

                    <div className={styles.field}>
                      <label className={styles.fieldLabel}>
                        Alt Text (Opt)
                      </label>
                      <input
                        placeholder="e.g. Front view of sherwani"
                        className={styles.input}
                        value={img.altText}
                        onChange={(e) =>
                          setImages((prev) =>
                            prev.map((row, i) =>
                              i === idx
                                ? { ...row, altText: e.target.value }
                                : row,
                            ),
                          )
                        }
                      />
                    </div>

                    <label
                      style={{
                        fontSize: "12px",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        marginTop: "26px",
                      }}
                    >
                      <input
                        type="radio"
                        name="primaryImage"
                        checked={img.isPrimary}
                        onChange={() => setPrimaryImageRow(idx)}
                      />
                      Primary<span className={styles.req}>*</span>
                    </label>

                    <label
                      className={styles.btnOutline}
                      style={{
                        cursor: "pointer",
                        textAlign: "center",
                        marginTop: "20px",
                      }}
                    >
                      {uploadingIdx === idx ? "Uploading..." : "Upload S3"}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/avif"
                        style={{ display: "none" }}
                        onChange={(e) => handleImageUploadForRow(idx, e)}
                      />
                    </label>

                    {images.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeImageRow(idx)}
                        className={styles.btnDanger}
                        style={{ marginTop: "20px" }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <button type="submit" className={`${styles.btn} ${styles.full}`}>
                Create Product
              </button>
            </form>
          </section>

          {editingId && (
            <section className={styles.panel}>
              <h2>Edit Product Details</h2>
              <form
                className={styles.formGrid}
                onSubmit={handleSaveEditProduct}
                noValidate
              >
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>
                    Product Name<span className={styles.req}>*</span>
                  </label>
                  <input
                    required
                    minLength={3}
                    className={`${styles.input} ${editErrors.name ? styles.inputError : ""}`}
                    value={editProd.name}
                    onChange={(e) =>
                      setEditProd({ ...editProd, name: e.target.value })
                    }
                  />
                  {editErrors.name && (
                    <span className={styles.fieldError}>{editErrors.name}</span>
                  )}
                </div>

                <div className={styles.field}>
                  <label className={styles.fieldLabel}>
                    Category<span className={styles.req}>*</span>
                  </label>
                  <select
                    className={styles.select}
                    value={editProd.category}
                    onChange={(e) =>
                      setEditProd({ ...editProd, category: e.target.value })
                    }
                  >
                    <option value="SHERWANI">SHERWANI</option>
                    <option value="KURTA">KURTA</option>
                    <option value="PYJAMA">PYJAMA</option>
                    <option value="INDO_WESTERN">INDO_WESTERN</option>
                  </select>
                </div>

                <div className={styles.field}>
                  <label className={styles.fieldLabel}>
                    Fabric Type<span className={styles.req}>*</span>
                  </label>
                  <input
                    required
                    className={`${styles.input} ${editErrors.fabricType ? styles.inputError : ""}`}
                    value={editProd.fabricType}
                    onChange={(e) =>
                      setEditProd({ ...editProd, fabricType: e.target.value })
                    }
                  />
                  {editErrors.fabricType && (
                    <span className={styles.fieldError}>
                      {editErrors.fabricType}
                    </span>
                  )}
                </div>

                <div className={styles.field}>
                  <label className={styles.fieldLabel}>
                    Base Price (INR)<span className={styles.req}>*</span>
                  </label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    className={`${styles.input} ${editErrors.basePrice ? styles.inputError : ""}`}
                    value={editProd.basePrice}
                    onChange={(e) =>
                      setEditProd({ ...editProd, basePrice: e.target.value })
                    }
                  />
                  {editErrors.basePrice && (
                    <span className={styles.fieldError}>
                      {editErrors.basePrice}
                    </span>
                  )}
                </div>

                <label
                  className={styles.full}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "13px",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={editProd.allowsCustomTailoring}
                    onChange={(e) =>
                      setEditProd({
                        ...editProd,
                        allowsCustomTailoring: e.target.checked,
                      })
                    }
                  />
                  Allows Custom Tailoring
                </label>

                <div className={`${styles.field} ${styles.full}`}>
                  <label className={styles.fieldLabel}>
                    Description (Optional)
                  </label>
                  <textarea
                    rows={2}
                    className={styles.textarea}
                    value={editProd.description}
                    onChange={(e) =>
                      setEditProd({ ...editProd, description: e.target.value })
                    }
                  />
                </div>

                <div
                  className={styles.full}
                  style={{ display: "flex", gap: "10px" }}
                >
                  <button type="submit" className={styles.btn}>
                    Save Changes
                  </button>
                  <button
                    type="button"
                    className={styles.btnOutline}
                    onClick={() => setEditingId(null)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </section>
          )}

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
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.name}</strong>
                        <div style={{ fontSize: "11px", color: "#7b665b" }}>
                          {p.fabricType} ·{" "}
                          {p.allowsCustomTailoring
                            ? "Custom Tailoring"
                            : "Ready-to-Wear"}
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
                              flexWrap: "wrap",
                              gap: "6px",
                              alignItems: "center",
                              marginBottom: "8px",
                              paddingBottom: "6px",
                              borderBottom: "1px dashed #efe6da",
                            }}
                          >
                            {editingVariantId === v.id ? (
                              <>
                                <input
                                  placeholder="Color"
                                  value={editVariant.color}
                                  onChange={(e) =>
                                    setEditVariant({
                                      ...editVariant,
                                      color: e.target.value,
                                    })
                                  }
                                  style={{
                                    width: "100px",
                                    padding: "3px 6px",
                                    border: "1px solid #d9c8b7",
                                  }}
                                />
                                <input
                                  placeholder="Size"
                                  value={editVariant.size}
                                  onChange={(e) =>
                                    setEditVariant({
                                      ...editVariant,
                                      size: e.target.value,
                                    })
                                  }
                                  style={{
                                    width: "54px",
                                    padding: "3px 6px",
                                    border: "1px solid #d9c8b7",
                                  }}
                                />
                                <input
                                  type="number"
                                  min="0"
                                  placeholder="Stock"
                                  value={editVariant.stock}
                                  onChange={(e) =>
                                    setEditVariant({
                                      ...editVariant,
                                      stock: e.target.value,
                                    })
                                  }
                                  style={{
                                    width: "60px",
                                    padding: "3px 6px",
                                    border: "1px solid #d9c8b7",
                                  }}
                                />
                                <input
                                  type="number"
                                  step="0.01"
                                  placeholder="+Adj"
                                  value={editVariant.priceAdjustment}
                                  onChange={(e) =>
                                    setEditVariant({
                                      ...editVariant,
                                      priceAdjustment: e.target.value,
                                    })
                                  }
                                  style={{
                                    width: "76px",
                                    padding: "3px 6px",
                                    border: "1px solid #d9c8b7",
                                  }}
                                />
                                <button
                                  type="button"
                                  className={styles.btnOutline}
                                  onClick={() => handleSaveVariant(v.id)}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  className={styles.btnOutline}
                                  onClick={() => setEditingVariantId(null)}
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <span>
                                  {v.color} / {v.size} ({v.sku})
                                  {v.priceAdjustment
                                    ? ` +${formatINR(v.priceAdjustment)}`
                                    : ""}{" "}
                                  · Stock: <strong>{v.stock}</strong>
                                </span>
                                <button
                                  type="button"
                                  className={styles.btnOutline}
                                  onClick={() => startEditingVariant(v)}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className={styles.btnDanger}
                                  onClick={() => handleDeleteVariant(v.id)}
                                >
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        ))}

                        {addingVariantForProductId === p.id ? (
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "6px",
                              marginTop: "6px",
                            }}
                          >
                            <input
                              placeholder="Color*"
                              value={newVariant.color}
                              onChange={(e) =>
                                setNewVariant({
                                  ...newVariant,
                                  color: e.target.value,
                                })
                              }
                              style={{
                                width: "90px",
                                padding: "3px 6px",
                                border: "1px solid #d9c8b7",
                              }}
                            />
                            <input
                              placeholder="Size*"
                              value={newVariant.size}
                              onChange={(e) =>
                                setNewVariant({
                                  ...newVariant,
                                  size: e.target.value,
                                })
                              }
                              style={{
                                width: "54px",
                                padding: "3px 6px",
                                border: "1px solid #d9c8b7",
                              }}
                            />
                            <input
                              placeholder="SKU*"
                              value={newVariant.sku}
                              onChange={(e) =>
                                setNewVariant({
                                  ...newVariant,
                                  sku: e.target.value,
                                })
                              }
                              style={{
                                width: "110px",
                                padding: "3px 6px",
                                border: "1px solid #d9c8b7",
                              }}
                            />
                            <input
                              type="number"
                              min="0"
                              placeholder="Stock*"
                              value={newVariant.stock}
                              onChange={(e) =>
                                setNewVariant({
                                  ...newVariant,
                                  stock: e.target.value,
                                })
                              }
                              style={{
                                width: "60px",
                                padding: "3px 6px",
                                border: "1px solid #d9c8b7",
                              }}
                            />
                            <input
                              type="number"
                              step="0.01"
                              placeholder="+Adj"
                              value={newVariant.priceAdjustment}
                              onChange={(e) =>
                                setNewVariant({
                                  ...newVariant,
                                  priceAdjustment: e.target.value,
                                })
                              }
                              style={{
                                width: "70px",
                                padding: "3px 6px",
                                border: "1px solid #d9c8b7",
                              }}
                            />
                            <button
                              type="button"
                              className={styles.btnOutline}
                              onClick={() => handleAddVariantToProduct(p.id)}
                            >
                              Add
                            </button>
                            <button
                              type="button"
                              className={styles.btnOutline}
                              onClick={() => setAddingVariantForProductId(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className={styles.btnOutline}
                            onClick={() => {
                              setAddingVariantForProductId(p.id);
                              setNewVariant({
                                color: p.variants[0]?.color || "",
                                size: "",
                                sku: "",
                                stock: "1",
                                priceAdjustment: "",
                              });
                            }}
                          >
                            + Add Variant
                          </button>
                        )}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button
                            type="button"
                            className={styles.btnOutline}
                            onClick={() => startEditingProduct(p)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className={styles.btnDanger}
                            onClick={() => handleDeleteProduct(p.id)}
                          >
                            Delete
                          </button>
                        </div>
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
          <p className={styles.hint} style={{ marginBottom: "14px" }}>
            Note: Setting an order status to <strong>CANCELLED</strong>{" "}
            automatically restores variant stock in PostgreSQL.
          </p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Customer</th>
                  <th>Items &amp; Tailoring</th>
                  <th>Total</th>
                  <th>Order Status*</th>
                  <th>Payment*</th>
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
            <p className={styles.hint} style={{ marginBottom: "14px" }}>
              Fields marked with <span className={styles.req}>*</span> are
              required based on your selected Campaign Type.
            </p>

            <form
              className={styles.formGrid}
              onSubmit={handleSendBroadcast}
              noValidate
            >
              <div className={styles.field}>
                <label className={styles.fieldLabel}>
                  Campaign Type<span className={styles.req}>*</span>
                </label>
                <select
                  className={styles.select}
                  value={broadcast.campaignType}
                  onChange={(e) => {
                    setBroadcast({
                      ...broadcast,
                      campaignType: e.target.value,
                    });
                    setBroadcastErrors({});
                  }}
                >
                  <option value="NEW_CATEGORY_ARRIVALS">
                    New Category Arrivals (Auto-list)
                  </option>
                  <option value="COLLECTION">Collection Announcement</option>
                  <option value="DISCOUNT_SALE">Discounted Sale</option>
                </select>
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>
                  Delivery Channel<span className={styles.req}>*</span>
                </label>
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
              </div>

              {/* Conditional Info Banner for Broadcast Mode */}
              <div className={styles.infoBox}>
                {broadcast.campaignType === "NEW_CATEGORY_ARRIVALS" && (
                  <>
                    <strong>Condition — New Category Arrivals:</strong> Requires{" "}
                    <strong>Category*</strong> and{" "}
                    <strong>Days Back* (1–90)</strong>. Automatically queries
                    products created in that timeframe, builds a price + link
                    list, and attaches the newest product&apos;s primary image
                    on WhatsApp.
                  </>
                )}
                {broadcast.campaignType === "COLLECTION" && (
                  <>
                    <strong>Condition — Collection Announcement:</strong>{" "}
                    Requires <strong>Campaign Title*</strong> and{" "}
                    <strong>Campaign Message*</strong>. Image URL and Target
                    Shop URL are optional.
                  </>
                )}
                {broadcast.campaignType === "DISCOUNT_SALE" && (
                  <>
                    <strong>Condition — Discounted Sale:</strong> Requires{" "}
                    <strong>Campaign Title*</strong>,{" "}
                    <strong>Discount %* (1–95)</strong>, and{" "}
                    <strong>Campaign Message*</strong>. Automatically prepends
                    &quot;Flat X% OFF!&quot; to customer messages.
                  </>
                )}
              </div>

              {broadcast.campaignType === "NEW_CATEGORY_ARRIVALS" ? (
                <>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>
                      Target Category<span className={styles.req}>*</span>
                    </label>
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
                  </div>

                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>
                      Days Back (1–90)<span className={styles.req}>*</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={90}
                      required
                      className={`${styles.input} ${broadcastErrors.daysBack ? styles.inputError : ""}`}
                      value={broadcast.daysBack}
                      onChange={(e) =>
                        setBroadcast({ ...broadcast, daysBack: e.target.value })
                      }
                    />
                    {broadcastErrors.daysBack && (
                      <span className={styles.fieldError}>
                        {broadcastErrors.daysBack}
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>
                      Campaign Title<span className={styles.req}>*</span>
                    </label>
                    <input
                      required
                      placeholder="e.g. Royal Wedding Collection 2026"
                      className={`${styles.input} ${broadcastErrors.title ? styles.inputError : ""}`}
                      value={broadcast.title}
                      onChange={(e) =>
                        setBroadcast({ ...broadcast, title: e.target.value })
                      }
                    />
                    {broadcastErrors.title && (
                      <span className={styles.fieldError}>
                        {broadcastErrors.title}
                      </span>
                    )}
                  </div>

                  {broadcast.campaignType === "DISCOUNT_SALE" && (
                    <div className={styles.field}>
                      <label className={styles.fieldLabel}>
                        Discount Percentage (1–95%)
                        <span className={styles.req}>*</span>
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={95}
                        required
                        className={`${styles.input} ${broadcastErrors.discountPercent ? styles.inputError : ""}`}
                        value={broadcast.discountPercent}
                        onChange={(e) =>
                          setBroadcast({
                            ...broadcast,
                            discountPercent: e.target.value,
                          })
                        }
                      />
                      {broadcastErrors.discountPercent && (
                        <span className={styles.fieldError}>
                          {broadcastErrors.discountPercent}
                        </span>
                      )}
                    </div>
                  )}

                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>
                      Image URL (Optional)
                    </label>
                    <input
                      placeholder="https://... (attached on WhatsApp)"
                      className={`${styles.input} ${broadcastErrors.imageUrl ? styles.inputError : ""}`}
                      value={broadcast.imageUrl}
                      onChange={(e) =>
                        setBroadcast({ ...broadcast, imageUrl: e.target.value })
                      }
                    />
                    {broadcastErrors.imageUrl && (
                      <span className={styles.fieldError}>
                        {broadcastErrors.imageUrl}
                      </span>
                    )}
                  </div>

                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>
                      Target Shop URL (Optional)
                    </label>
                    <input
                      placeholder="https://..."
                      className={`${styles.input} ${broadcastErrors.targetUrl ? styles.inputError : ""}`}
                      value={broadcast.targetUrl}
                      onChange={(e) =>
                        setBroadcast({
                          ...broadcast,
                          targetUrl: e.target.value,
                        })
                      }
                    />
                    {broadcastErrors.targetUrl && (
                      <span className={styles.fieldError}>
                        {broadcastErrors.targetUrl}
                      </span>
                    )}
                  </div>

                  <div className={`${styles.field} ${styles.full}`}>
                    <label className={styles.fieldLabel}>
                      Campaign Message<span className={styles.req}>*</span>
                    </label>
                    <textarea
                      required
                      rows={3}
                      placeholder="Write promotional message (min 5 chars)..."
                      className={`${styles.textarea} ${broadcastErrors.message ? styles.inputError : ""}`}
                      value={broadcast.message}
                      onChange={(e) =>
                        setBroadcast({ ...broadcast, message: e.target.value })
                      }
                    />
                    {broadcastErrors.message && (
                      <span className={styles.fieldError}>
                        {broadcastErrors.message}
                      </span>
                    )}
                  </div>
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
            <form
              className={styles.formGrid}
              onSubmit={handleCsvImport}
              noValidate
            >
              <div className={styles.field}>
                <label className={styles.fieldLabel}>
                  Target Table<span className={styles.req}>*</span>
                </label>
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
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>
                  CSV File<span className={styles.req}>*</span>
                </label>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  required
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                />
              </div>

              <div className={styles.infoBox}>
                <strong>
                  Required CSV Headers for &ldquo;{importTable}&rdquo;:
                </strong>{" "}
                {CSV_REQUIRED_HEADERS[importTable]}
              </div>

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
