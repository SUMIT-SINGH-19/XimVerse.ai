import type { Metadata } from "next";
import { ProductCatalogue } from "@/components/exporter/products/product-catalogue";
import { EXPORTER_PRODUCTS, SUMIT_PRODUCTS_INSIGHT } from "@/lib/exporter-products";

export const metadata: Metadata = { title: "Products" };

export default function ExporterProductsPage() {
  return <ProductCatalogue initialProducts={EXPORTER_PRODUCTS} insight={SUMIT_PRODUCTS_INSIGHT} />;
}
