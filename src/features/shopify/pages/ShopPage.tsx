import { useQuery } from "@tanstack/react-query";
import Button from "../../../components/ui/Button";
import { useDocumentMeta } from "../../../shared/seo/useDocumentMeta";
import { canonicalUrl } from "../../../utils/seo";
import { isShopifyConfigured, storefront } from "../api/storefront";
import { useCart } from "../cart/useCart";
import RetailCatalog from "./RetailCatalog";
import "../shop.css";
import "./retail-catalog.css";

/** Shopify's automatic "Home page" collection; the merchant curates Featured there. */
const FEATURED_HANDLE = "frontpage";

function ProductSkeletons() {
  return (
    <ul className="retail-catalog__grid" aria-hidden="true">
      {Array.from({ length: 3 }, (_, index) => (
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
  const { error: cartError } = useCart();
  const featuredQuery = useQuery({
    queryKey: ["shopify", "collection", FEATURED_HANDLE],
    queryFn: () => storefront.getCollectionProducts(FEATURED_HANDLE),
    enabled: configured,
    retry: false,
  });
  const arrivalsQuery = useQuery({
    queryKey: ["shopify", "products", "newest"],
    queryFn: () => storefront.listProducts(undefined, "newest", 8),
    enabled: configured,
    retry: false,
  });
  const tilesQuery = useQuery({
    queryKey: ["shopify", "collections"],
    queryFn: () => storefront.listCollections(),
    enabled: configured,
    retry: false,
  });

  const featured = (featuredQuery.data?.products ?? []).slice(0, 4);
  const featuredIds = new Set(featured.map((product) => product.id));
  const arrivals = (arrivalsQuery.data?.nodes ?? []).filter((product) => !featuredIds.has(product.id)).slice(0, 4);
  const loading = featuredQuery.isLoading || arrivalsQuery.isLoading;
  const failed = featuredQuery.isError && arrivalsQuery.isError;
  const retry = () => { void featuredQuery.refetch(); void arrivalsQuery.refetch(); void tilesQuery.refetch(); };

  return (
    <section className="shop-page shop-page--catalog" aria-labelledby="shop-heading">
      <RetailCatalog featured={featured} arrivals={arrivals} tiles={tilesQuery.data ?? (tilesQuery.isError ? [] : undefined)}>
        {cartError && <p className="shop-page__notice" role="alert">Your cart could not be updated. Please try again.</p>}
        {!configured ? (
          <div className="shop-state" role="status">
            <h2>The shop isn't available right now</h2>
            <p>Please check back soon for Salsa Segura gear.</p>
          </div>
        ) : loading ? (
          <div className="shop-loading" role="status" aria-label="Loading products" aria-busy="true">
            <ProductSkeletons />
          </div>
        ) : failed ? (
          <div className="shop-state shop-state--error" role="alert">
            <h2>We couldn't load products</h2>
            <p>Please try again in a moment.</p>
            <Button variant="secondary" onClick={retry}>Try again</Button>
          </div>
        ) : featured.length + arrivals.length === 0 ? (
          <div className="shop-state" role="status">
            <h2>New gear is on its way</h2>
            <p>There are no products to browse right now. Check back soon.</p>
          </div>
        ) : null}
      </RetailCatalog>
    </section>
  );
}
