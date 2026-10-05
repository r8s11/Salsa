import { useInfiniteQuery } from "@tanstack/react-query";
import Button from "../../../components/ui/Button";
import { useDocumentMeta } from "../../../shared/seo/useDocumentMeta";
import { canonicalUrl } from "../../../utils/seo";
import { isShopifyConfigured, storefront } from "../api/storefront";
import { useCart } from "../cart/useCart";
import RetailCatalog from "./RetailCatalog";
import "../shop.css";
import "./retail-catalog.css";

function ProductSkeletons() {
  return (
    <ul className="shop-grid shop-grid--skeleton" aria-hidden="true">
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
      <RetailCatalog products={products} cartQuantity={cart?.totalQuantity ?? 0}
        onOpenCart={() => setOpen(true)} isFetching={productsQuery.isFetching}>
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
            <Button variant="secondary" disabled={productsQuery.isFetching} onClick={() => void productsQuery.refetch()}>Try again</Button>
          </div>
        ) : products.length === 0 ? (
          <div className="shop-state" role="status">
            <h2>New gear is on its way</h2>
            <p>There are no products to browse right now. Check back soon.</p>
          </div>
        ) : (
          <>
            {productsQuery.isError && !productsQuery.isFetchNextPageError && (
              <div className="shop-page__load-error" role="alert">
                <p>We couldn't refresh the shop. Your loaded products are still available.</p>
                <Button variant="ghost" disabled={productsQuery.isFetching} onClick={() => void productsQuery.refetch()}>Try again</Button>
              </div>
            )}
            {productsQuery.hasNextPage && (
              <div className="shop-page__load-more">
                <Button variant="secondary" onClick={() => void productsQuery.fetchNextPage()}
                  disabled={productsQuery.isFetching} loading={productsQuery.isFetchingNextPage} loadingLabel="Loading more products…">
                  Load more
                </Button>
              </div>
            )}
            {productsQuery.isFetchNextPageError && (
              <div className="shop-page__load-error" role="alert">
                <p>We couldn't load more products.</p>
                <Button variant="ghost" disabled={productsQuery.isFetching} onClick={() => void productsQuery.fetchNextPage()}>Try again</Button>
              </div>
            )}
          </>
        )}
      </RetailCatalog>
    </section>
  );
}
