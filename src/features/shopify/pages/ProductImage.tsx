import { useState } from "react";
import type { ProductSummary } from "../api/types";
import { productAlt, shopifySrcSet } from "./shopImage";

const DEFAULT_SIZES = "(max-width: 639px) 80vw, 420px";

export default function ProductImage({ product, eager = false, className = "", sizes = DEFAULT_SIZES }: {
  product: ProductSummary;
  eager?: boolean;
  className?: string;
  sizes?: string;
}) {
  const image = product.featuredImage;
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (!image || failedUrl === image.url) {
    return <span className={`shop-image-missing ${className}`} role="img" aria-label={`${product.title} image unavailable`}>Image unavailable</span>;
  }
  return <img className={className} src={image.url} srcSet={shopifySrcSet(image.url, image.width)} sizes={sizes}
    alt={productAlt(image.altText, product.title)}
    width={image.width || 720} height={image.height || 900}
    loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : "auto"}
    onError={() => setFailedUrl(image.url)} />;
}
