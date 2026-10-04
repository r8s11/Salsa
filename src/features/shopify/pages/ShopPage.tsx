import { useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useState } from "react";
import Button from "../../../components/ui/Button";
import { useDocumentMeta } from "../../../shared/seo/useDocumentMeta";
import { canonicalUrl } from "../../../utils/seo";
import { isShopifyConfigured, storefront } from "../api/storefront";
import type { ProductSummary, ShopifyImage } from "../api/types";
import { useCart } from "../cart/useCart";
import { formatMoney } from "../money";
import "../shop.css";

const FALLBACK_IMAGE_WIDTH = 720;
const FALLBACK_IMAGE_HEIGHT = 900;

function ShopProductCard({ product, index }: { product: ProductSummary; index: number }) {
  const [imageUnavailable, setImageUnavailable] = useState(false);
  const image: ShopifyImage | null = product.featuredImage;
  const hasImageDimensions = Boolean(image && image.width && image.height && image.width > 0 && image.height > 0);
  const imageWidth = hasImageDimensions ? image?.width ?? FALLBACK_IMAGE_WIDTH : FALLBACK_IMAGE_WIDTH;
  const imageHeight = hasImageDimensions ? image?.height ?? FALLBACK_IMAGE_HEIGHT : FALLBACK_IMAGE_HEIGHT;

  return (
    <li className="shop-card" key={product.id}>
      <Link
        className="shop-card__link"
        to={`/shop/products/${encodeURIComponent(product.handle)}`}
        aria-label={`${product.title}, starting at ${formatMoney(product.priceRange.minVariantPrice)}`}
      >
        <span className="shop-card__image-wrap" style={{ aspectRatio: `${imageWidth} / ${imageHeight}` }}>
          {image && !imageUnavailable ? (
            <img
              className="shop-card__image"
              src={image.url}
              alt={image.altText ?? ""}
              loading={index === 0 ? "eager" : "lazy"}
              fetchPriority={index === 0 ? "high" : "auto"}
              width={imageWidth}
              height={imageHeight}
              onError={() => setImageUnavailable(true)}
            />
          ) : (
            <span className="shop-card__image-placeholder" aria-label={`${product.title} image unavailable`}>
              Image unavailable
            </span>
          )}
        </span>
        <span className="shop-card__details">
          <span className="shop-card__title">{product.title}</span>
          <span className="shop-card__price">From {formatMoney(product.priceRange.minVariantPrice)}</span>
        </span>
      </Link>
    </li>
  );
}

function ProductSkeletons() {
  return (
    <ul className="shop-grid shop-grid--skeleton" aria-label="Loading shop products" aria-hidden="true">
      {Array.from({ length: 6 }, (_, index) => (
        <li className="shop-skeleton" key={index}>
          <span className="shop-skeleton__image" />
          <span className="shop-skeleton__line" />
          <span className="shop-skeleton__line shop-skeleton__line--short" />
        </li>
      ))}
    </ul>
  );
}

export default function ShopPage() {
  useDocumentMeta({
    title: "Shop",
    description: "Explore official Salsa Segura gear made for our salsa community.",
    canonical: canonicalUrl("/shop"),
  });

  const configured = isShopifyConfigured();
  const { cart, error: cartError, setOpen } = useCart();
  const productsQuery = useInfiniteQuery({
    queryKey: ["shopify", "products"],
    queryFn: ({ pageParam }) => storefront.listProducts(pageParam ?? undefined),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.pageInfo.hasNextPage ? (lastPage.pageInfo.endCursor ?? undefined) : undefined,
    enabled: configured,
    retry: false,
  });
  const products = productsQuery.data?.pages.flatMap((page) => page.nodes) ?? [];

  return (
    <section className="shop-page shop-page--catalog" aria-labelledby="shop-heading">
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

      <header className="shop-hero">
        <h1 id="shop-heading">Salsa Segura shop</h1>
        <div className="shop-hero__intro">
          <p>Wear the rhythm. Explore official Salsa Segura gear made for our salsa community.</p>
          {products.length > 0 && <a className="shop-hero__products-link" href="#shop-products">Shop products</a>}
        </div>
      </header>

      {cartError && <p className="shop-page__notice" role="alert">Your cart could not be updated. Please try again.</p>}
      {!configured ? (
        <div className="shop-state" role="status">
          <h2>The shop isn't available right now</h2>
          <p>Please check back soon for Salsa Segura gear.</p>
        </div>
      ) : productsQuery.isLoading ? (
        <div className="shop-loading" role="status" aria-label="Loading products" aria-busy="true">
          <p>Loading shop products…</p>
          <ProductSkeletons />
        </div>
      ) : productsQuery.isError && products.length === 0 ? (
        <div className="shop-state shop-state--error" role="alert">
          <h2>We couldn't load products</h2>
          <p>Please try again in a moment.</p>
          <Button variant="secondary" onClick={() => void productsQuery.refetch()}>Try again</Button>
        </div>
      ) : products.length === 0 ? (
        <div className="shop-state" role="status">
          <h2>New gear is on its way</h2>
          <p>There are no products to browse right now. Check back soon.</p>
        </div>
      ) : (
        <>
          <ul
            id="shop-products"
            className="shop-grid"
            aria-label="Shop products"
            aria-busy={productsQuery.isFetchingNextPage || productsQuery.isRefetching}
          >
            {products.map((product, index) => (
              <ShopProductCard product={product} index={index} key={product.id} />
            ))}
          </ul>
          {productsQuery.isError && !productsQuery.isFetchNextPageError && (
            <div className="shop-page__load-error" role="alert">
              <p>We couldn't refresh the shop. Your loaded products are still available.</p>
              <Button variant="ghost" onClick={() => void productsQuery.refetch()}>Try again</Button>
            </div>
          )}
          {productsQuery.hasNextPage && (
            <div className="shop-page__load-more">
              <Button
                variant="secondary"
                onClick={() => void productsQuery.fetchNextPage()}
                loading={productsQuery.isFetchingNextPage}
                loadingLabel="Loading more products…"
              >
                Load more
              </Button>
            </div>
          )}
          {productsQuery.isFetchNextPageError && (
            <div className="shop-page__load-error" role="alert">
              <p>We couldn't load more products.</p>
              <Button variant="ghost" onClick={() => void productsQuery.fetchNextPage()}>Try again</Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
