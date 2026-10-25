import { useState } from "react";
import type { ProductSummary } from "../api/types";

export default function ProductImage({ product, eager = false, className = "" }: {
  product: ProductSummary;
  eager?: boolean;
  className?: string;
}) {
  const image = product.featuredImage;
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (!image || failedUrl === image.url) {
    return <span className={`shop-image-missing ${className}`} role="img" aria-label={`${product.title} image unavailable`}>Image unavailable</span>;
  }
  return <img className={className} src={image.url} alt={image.altText || product.title}
    width={image.width || 720} height={image.height || 900}
    loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : "auto"}
    onError={() => setFailedUrl(image.url)} />;
}
