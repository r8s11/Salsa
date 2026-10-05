import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Minus, Plus } from "lucide-react";
import Button from "../../../components/ui/Button";
import ButtonLink from "../../../components/ui/ButtonLink";
import { useDocumentMeta } from "../../../shared/seo/useDocumentMeta";
import { canonicalUrl, injectStructuredData } from "../../../utils/seo";
import { isShopifyConfigured, storefront } from "../api/storefront";
import type { ShopifyImage } from "../api/types";
import { useCart } from "../cart/useCart";
import { formatMoney } from "../money";
import "../shop.css";
import "./product.css";
import "./retail-purchase.css";

interface ProductFeedback {
  handle: string;
  message: string;
  kind: "success" | "error";
}

function plainDescription(description: string): string {
  return description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export default function ProductPage() {
  const { handle = "" } = useParams<{ handle: string }>();
  return <ProductDetails key={handle} handle={handle} />;
}

function ProductDetails({ handle }: { handle: string }) {
  const configured = isShopifyConfigured();
  const { cart, isLoading: isCartLoading, isBusy, error: cartError, notice, setOpen, addVariant } = useCart();
  const [selection, setSelection] = useState<{ handle: string; variantId: string | null }>({
    handle,
    variantId: null,
  });
  const [quantity, setQuantity] = useState(1);
  const [failedImages, setFailedImages] = useState<ReadonlyArray<string>>([]);
  const markImageFailed = (url: string) => {
    setFailedImages((current) => (current.includes(url) ? current : [...current, url]));
  };
  const [activeImage, setActiveImage] = useState<{ handle: string; variantId: string; url: string } | null>(null);
  const [feedback, setFeedback] = useState<ProductFeedback | null>(null);
  const requestToken = useRef(0);

  useEffect(() => () => {
    requestToken.current += 1;
  }, []);

  const productQuery = useQuery({
    queryKey: ["shopify", "product", handle],
    queryFn: () => storefront.getProduct(handle),
    enabled: configured && handle.length > 0,
    retry: false,
  });
  const product = productQuery.data?.handle === handle ? productQuery.data : null;
  const variants = useMemo(() => product?.variants.nodes ?? [], [product]);
  const selectedVariant =
    (selection.handle === handle ? variants.find((variant) => variant.id === selection.variantId) : undefined) ??
    variants.find((variant) => variant.availableForSale) ??
    variants[0] ??
    null;
  const price = selectedVariant?.price ?? product?.priceRange.minVariantPrice;
  const compareAt = selectedVariant?.compareAtPrice;
  const showCompareAt = Boolean(
    price &&
      compareAt &&
      compareAt.currencyCode === price.currencyCode &&
      Number.isFinite(Number(compareAt.amount)) &&
      Number(compareAt.amount) > Number(price.amount)
  );
  const canonical = canonicalUrl(`/shop/products/${encodeURIComponent(handle)}`);
  const description = product ? plainDescription(product.description) : "";

  useDocumentMeta({
    title: product ? product.title : "Shop",
    description: description || "Explore Salsa Segura shop products.",
    canonical,
  });

  const galleryImages = useMemo(() => {
    if (!product) return [];
    const seen = new Set<string>();
    const images: ShopifyImage[] = [];
    const add = (image: ShopifyImage | null | undefined) => {
      if (!image || seen.has(image.url)) return;
      seen.add(image.url);
      images.push(image);
    };
    add(product.featuredImage);
    for (const image of product.images.nodes) add(image);
    for (const variant of variants) add(variant.image);
    return images;
  }, [product, variants]);
  const defaultImage = selectedVariant?.image ?? product?.featuredImage ?? galleryImages[0] ?? null;
  const selectedGalleryImage =
    activeImage?.handle === handle && activeImage.variantId === (selectedVariant?.id ?? "")
      ? galleryImages.find((image) => image.url === activeImage.url)
      : null;
  const image = selectedGalleryImage ?? defaultImage;
  const optionsLabel = (variant: (typeof variants)[number]) =>
    variant.selectedOptions.length
      ? variant.selectedOptions.map(({ name, value }) => `${name}: ${value}`).join(" / ")
      : variant.title;

  useEffect(() => {
    if (!product) return;
    const structuredData = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.title,
      ...(description ? { description } : {}),
      ...(galleryImages.length ? { image: galleryImages.map(({ url }) => url) } : {}),
      url: canonical,
      ...(variants.length
        ? {
            offers: variants.map((variant) => ({
              "@type": "Offer",
              price: variant.price.amount,
              priceCurrency: variant.price.currencyCode,
              availability: variant.availableForSale
                ? "https://schema.org/InStock"
                : "https://schema.org/OutOfStock",
              url: canonical,
            })),
          }
        : {}),
    };
    injectStructuredData(JSON.stringify(structuredData).replace(/</g, "\\u003c"), "shop-product-structured-data");
    return () => document.getElementById("shop-product-structured-data")?.remove();
  }, [canonical, description, galleryImages, product, variants]);

  const clearFeedback = () => {
    requestToken.current += 1;
    setFeedback(null);
  };
  const addSelectedVariant = async () => {
    if (!selectedVariant?.availableForSale || isBusy || isCartLoading) return;
    clearFeedback();
    const token = ++requestToken.current;
    const currentHandle = handle;
    const currentVariant = selectedVariant.id;
    const currentQuantity = quantity;
    const imageSource = document.querySelector(".shop-product__image");
    try {
      const added = await addVariant(currentVariant, currentQuantity);
      if (added && requestToken.current === token) {
        void import("../cart/flyToCart").then(({ flyToCart }) => flyToCart(imageSource)).catch(() => undefined);
      }
      if (requestToken.current !== token) return;
      setFeedback({
        handle: currentHandle,
        kind: added ? "success" : "error",
        message: added ? "Added to cart." : "We couldn't add this item to your cart. Try again.",
      });
    } catch {
      if (requestToken.current === token) {
        setFeedback({ handle: currentHandle, kind: "error", message: "We couldn't add this item to your cart. Try again." });
      }
    }
  };

  const productIntro = product && <>
    <h1 id="product-heading" tabIndex={-1}>{product.title}</h1>
    <div className="shop-product__price" aria-live="polite">
      {price && <span>{formatMoney(price)}</span>}
      {showCompareAt && compareAt && <span className="shop-product__compare-at">Was {formatMoney(compareAt)}</span>}
    </div>
  </>;
  const purchaseControls = <>
    <div className="shop-product__quantity" aria-label="Quantity">
      <Button variant="secondary" aria-label="Decrease quantity" disabled={quantity <= 1 || isBusy}
        onClick={() => { setQuantity((current) => Math.max(1, current - 1)); clearFeedback(); }}>
        <Minus size={18} aria-hidden="true" />
      </Button>
      <output aria-label="Quantity" aria-live="polite">{quantity}</output>
      <Button variant="secondary" aria-label="Increase quantity" disabled={isBusy}
        onClick={() => { setQuantity((current) => current + 1); clearFeedback(); }}>
        <Plus size={18} aria-hidden="true" />
      </Button>
    </div>
    <Button variant="primary" block disabled={!selectedVariant?.availableForSale || isBusy || isCartLoading}
      loading={isBusy} loadingLabel="Adding to cart…" onClick={() => void addSelectedVariant()}>
      {selectedVariant?.availableForSale ? "Add to cart" : "Sold out"}
    </Button>
  </>;

  return (
    <section className="shop-page shop-page--product" aria-labelledby="product-heading">
      <div className="shop-page__topbar">
        <Button
          variant="secondary"
          className="shop-page__cart-button"
          onClick={() => setOpen(true)}
          aria-label={`Open cart, ${cart?.totalQuantity ?? 0} items`}
        >
          Cart <span className="shop-page__cart-count" aria-hidden="true">{cart?.totalQuantity ?? 0}</span>
        </Button>
      </div>

      <nav className="shop-breadcrumb" aria-label="Breadcrumb">
        <ButtonLink variant="ghost" size="compact" to="/shop">Back to shop</ButtonLink>
      </nav>

      {cartError && !(feedback?.handle === handle && feedback.kind === "error") && <p className="shop-page__notice" role="alert">{cartError}</p>}
      {!configured ? (
        <div className="shop-state shop-state--error" role="alert">
          <h1 id="product-heading">The shop isn't available right now</h1>
          <p>The Salsa Segura shop is temporarily unavailable. Please check back soon.</p>
        </div>
      ) : productQuery.isLoading ? (
        <div className="shop-state" role="status" aria-busy="true">
          <h1 id="product-heading">Loading product…</h1>
        </div>
      ) : productQuery.isError ? (
        <div className="shop-state shop-state--error" role="alert">
          <h1 id="product-heading">We couldn't load this product</h1>
          <p>Please try again in a moment.</p>
          <Button variant="secondary" onClick={() => void productQuery.refetch()}>Try again</Button>
        </div>
      ) : !product ? (
        <div className="shop-state shop-state--error" role="status">
          <h1 id="product-heading">Product not found</h1>
          <p>This product may have moved or is no longer available.</p>
          <ButtonLink to="/shop">Browse the shop</ButtonLink>
        </div>
      ) : (
        <article className="shop-product">
          <div className="shop-product__gallery">
            <div className="shop-product__media">
              {image && !failedImages.includes(image.url) ? (
                <img
                  className="shop-product__image"
                  style={{ viewTransitionName: "shop-product" }}
                  src={image.url}
                  alt={image.altText ?? product.title}
                  width={image.width ?? 720}
                  height={image.height ?? 900}
                  fetchPriority="high"
                  onError={() => markImageFailed(image.url)}
                />
              ) : (
                <div className="shop-product__image-placeholder" role="img" aria-label={`${product.title} image unavailable`}>
                  Salsa Segura
                </div>
              )}
            </div>
            {galleryImages.length > 1 && (
              <div className="shop-product__thumbnails" role="group" aria-label="Product images">
                {galleryImages.map((galleryImage, index) => {
                  const isActive = image?.url === galleryImage.url;
                  return (
                    <button
                      key={galleryImage.url}
                      className="shop-product__thumbnail"
                      type="button"
                      aria-label={`View image ${index + 1}`}
                      aria-pressed={isActive}
                      onClick={() => {
                        clearFeedback();
                        setActiveImage({
                          handle,
                          variantId: selectedVariant?.id ?? "",
                          url: galleryImage.url,
                        });
                      }}
                    >
                      {failedImages.includes(galleryImage.url) ? (
                        <span className="shop-product__thumbnail-placeholder" aria-hidden="true" />
                      ) : (
                        <img src={galleryImage.url} alt="" loading="lazy" onError={() => markImageFailed(galleryImage.url)} />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="shop-product__content">
            <div className="shop-product__intro">{productIntro}</div>
            {variants.length > 0 && (
              <fieldset className="shop-product__variant-field shop-product__options">
                <legend>Choose an option</legend>
                <div className="shop-product__option-list">
                  {variants.map((variant) => (
                    <button type="button" key={variant.id} className="shop-product__option-button"
                      disabled={!variant.availableForSale || isBusy}
                      aria-pressed={selectedVariant?.id === variant.id}
                      aria-label={`${optionsLabel(variant)}${variant.availableForSale ? "" : " — Sold out"}`}
                      onClick={() => {
                        setSelection({ handle, variantId: variant.id });
                        setActiveImage(null);
                        clearFeedback();
                      }}>
                      {variant.selectedOptions.length
                        ? variant.selectedOptions.map(({ value }) => value).join(" / ")
                        : variant.title}
                    </button>
                  ))}
                </div>
                <p className="shop-product__field-help">Unavailable options are disabled.</p>
              </fieldset>
            )}
            {selectedVariant && (
              <p className={`shop-product__availability${selectedVariant.availableForSale ? " shop-product__availability--available" : ""}`}>
                {selectedVariant.availableForSale ? "Available" : "Sold out"}
              </p>
            )}
            <div className="shop-product__buy">{purchaseControls}</div>
            {feedback?.handle === handle && (
              <p
                className={`shop-product__feedback${feedback.kind === "error" ? " shop-product__feedback--error" : ""}`}
                role={feedback.kind === "success" ? "status" : "alert"}
                aria-label="Cart feedback"
              >
                {feedback.kind === "success" && notice ? notice : feedback.message}
              </p>
            )}
            {!variants.length && <p className="shop-product__field-help">No purchase options are available.</p>}
            <p className="shop-product__fine-print">Secure checkout is provided by Shopify.</p>
            {product.description && <details className="shop-product__details-disclosure">
              <summary>Product details</summary>
              <p className="shop-product__description">{product.description}</p>
            </details>}
          </div>
        </article>
      )}
    </section>
  );
}
