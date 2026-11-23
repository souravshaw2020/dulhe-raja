import { Suspense } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ProductDetailClient, { ProductDetailData } from "./ProductDetailClient";
import { ProductImage } from "@prisma/client";
import Loader from "@/components/Loader";

async function ProductContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      images: { orderBy: { isPrimary: "desc" } },
      variants: true,
    },
  });

  if (!product) {
    notFound();
  }

  const serialized: ProductDetailData = {
    id: product.id,
    name: product.name,
    description: product.description,
    category: product.category,
    fabricType: product.fabricType,
    basePrice: Number(product.basePrice),
    allowsCustomTailoring: product.allowsCustomTailoring,
    images: product.images.map((img: ProductImage) => ({
      id: img.id,
      s3Url: img.s3Url,
      altText: img.altText,
      isPrimary: img.isPrimary,
    })),
    variants: product.variants.map((v) => ({
      id: v.id,
      color: v.color,
      size: v.size,
      sku: v.sku,
      stock: v.stock,
      priceAdjustment: v.priceAdjustment ? Number(v.priceAdjustment) : 0,
    })),
  };

  return <ProductDetailClient product={serialized} />;
}

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <>
          <Loader variant="page" />
          <p style={{ padding: "3rem" }}>Loading product...</p>
        </>
      }
    >
      <ProductContent params={params} />
    </Suspense>
  );
}
