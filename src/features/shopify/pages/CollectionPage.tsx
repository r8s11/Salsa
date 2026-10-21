import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Icon } from "@iconify/react";
import arrowIcon from "@iconify-icons/solar/arrow-right-linear";
import closeIcon from "@iconify-icons/solar/close-circle-linear";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import Button from "../../../components/ui/Button";
import { useDocumentMeta } from "../../../shared/seo/useDocumentMeta";
import { canonicalUrl } from "../../../utils/seo";
import { isShopifyConfigured, storefront } from "../api/storefront";
import type { CatalogProduct, CollectionProducts, ShopifyImage } from "../api/types";
import { ALL_PRODUCTS_CONFIG, ALL_PRODUCTS_HANDLE, SHOP_COLLECTIONS, collectionConfig, collectionPath } from "../collections";
import { useCart } from "../cart/useCart";
import { formatMoney } from "../money";
import { FilterGroups, FilterSheet } from "./CollectionFilters";
import ProductCard from "./ProductCard";
import ShopMasthead from "./ShopMasthead";
import {
  SORT_OPTIONS, activeFilterCount, catalogFacets, clearedFilters, filterProducts, readFilters, sortProducts, writeFilters,
  type FilterState, type SortValue,
} from "./catalogFilters";
import "../shop.css";
import "./retail-catalog.css";
import "./collection.css";

async function loadCollection(handle: string): Promise<CollectionProducts | null> {
  if (handle !== ALL_PRODUCTS_HANDLE) return storefront.getCollectionProducts(handle);
  const products = await storefront.listAllProducts("featured");
  return { handle, title: ALL_PRODUCTS_CONFIG.label, description: "", image: null, products };
}

function GridSkeleton() {
  return (
    <ul className="retail-catalog__grid" aria-hidden="true">
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

function HeroMedia({ image, products }: { image: ShopifyImage | null; products: CatalogProduct[] }) {
  if (image) {
    return <figure className="collection-hero__media"><img src={image.url} alt={image.altText ?? ""} /></figure>;
  }
  const covers = products.flatMap((product) => product.featuredImage ? [{ id: product.id, url: product.featuredImage.url }] : []).slice(0, 2);
  if (covers.length === 0) return null;
  return (
    <figure className={`collection-hero__media${covers.length === 2 ? " collection-hero__media--pair" : ""}`}>
      {covers.map((cover) => <span key={cover.id}><img src={cover.url} alt="" /></span>)}
    </figure>
  );
}

function KeepBrowsing({ current }: { current: string }) {
  const entries = [ALL_PRODUCTS_CONFIG, ...SHOP_COLLECTIONS].filter((entry) => entry.handle !== current);
  return (
    <nav className="collection-next" aria-labelledby="collection-next-heading">
      <h2 id="collection-next-heading">Keep browsing</h2>
      <ul>
        {entries.map((entry) => (
          <li key={entry.handle}>
            <Link to={collectionPath(entry.handle)}>{entry.label}<span>{entry.hint}</span></Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default function CollectionPage() {
  const handle = useParams().collection ?? ALL_PRODUCTS_HANDLE;
  const config = collectionConfig(handle);
  const configured = isShopifyConfigured();
  const { error: cartError } = useCart();
  const [params, setParams] = useSearchParams();
  const search = params.toString();
  const filters = useMemo(() => readFilters(new URLSearchParams(search)), [search]);

  const query = useQuery({
    queryKey: ["shopify", "collection", handle],
    queryFn: () => loadCollection(handle),
    enabled: configured,
    retry: false,
  });
  const collection = query.data ?? null;
  const products = useMemo(() => collection?.products ?? [], [collection]);
  const facets = useMemo(() => catalogFacets(products), [products]);
  const visible = useMemo(() => sortProducts(filterProducts(products, filters), filters.sort), [products, filters]);

  const title = config?.label ?? collection?.title ?? "Collection";
  useDocumentMeta({
    title: handle === ALL_PRODUCTS_HANDLE ? "Shop all" : `${title} · Shop`,
    description: collection?.description || config?.description || "Official Salsa Segura gear.",
    canonical: canonicalUrl(collectionPath(handle)),
  });

  // A new collection route starts unfiltered at the top.
  useEffect(() => { window.scrollTo({ top: 0 }); }, [handle]);

  const update = (next: FilterState) => setParams(writeFilters(next), { replace: true, preventScrollReset: true });
  const active = activeFilterCount(filters);
  const description = collection?.description || config?.description || "";
  const headline = config?.headline ?? collection?.title ?? "Collection";
  const missing = query.isSuccess && collection === null;

  const chips: Array<{ label: string; clear: () => void }> = [
    ...filters.types.map((key) => ({ label: facets.types.find((type) => type.key === key)?.label ?? key, clear: () => update({ ...filters, types: filters.types.filter((value) => value !== key) }) })),
    ...filters.sizes.map((key) => ({ label: `Size ${key}`, clear: () => update({ ...filters, sizes: filters.sizes.filter((value) => value !== key) }) })),
    ...filters.colors.map((key) => ({ label: facets.colors.find((color) => color.key === key)?.label ?? key, clear: () => update({ ...filters, colors: filters.colors.filter((value) => value !== key) }) })),
    ...(filters.maxPrice === null || !facets.currencyCode ? [] : [{ label: `Up to ${formatMoney({ amount: String(filters.maxPrice), currencyCode: facets.currencyCode })}`, clear: () => update({ ...filters, maxPrice: null }) }]),
    ...(filters.inStock ? [{ label: "In stock", clear: () => update({ ...filters, inStock: false }) }] : []),
  ];

  let body;
  if (!configured) {
    body = <div className="shop-state" role="status"><h2>The shop isn't available right now</h2><p>Please check back soon for Salsa Segura gear.</p></div>;
  } else if (query.isLoading) {
    body = <div className="shop-loading" role="status" aria-label="Loading products" aria-busy="true"><GridSkeleton /></div>;
  } else if (query.isError) {
    body = (
      <div className="shop-state shop-state--error" role="alert">
        <h2>We couldn't load this collection</h2>
        <p>Please try again in a moment.</p>
        <Button variant="secondary" disabled={query.isFetching} onClick={() => void query.refetch()}>Try again</Button>
      </div>
    );
  } else if (missing && !config) {
    body = (
      <div className="shop-state" role="status">
        <h2>Collection not found</h2>
        <p>This collection isn't in the shop. Everything we stock is in Shop all.</p>
        <Link className="retail-catalog__action" to={collectionPath(ALL_PRODUCTS_HANDLE)}>Shop all <Icon icon={arrowIcon} aria-hidden="true" width={20} /></Link>
      </div>
    );
  } else if (products.length === 0) {
    body = (
      <div className="collection-empty" role="status">
        <h2>{config?.emptyTitle ?? "Nothing here yet"}</h2>
        <p>{config?.emptyBody ?? "Everything we stock is in Shop all."}</p>
        <div className="collection-empty__actions">
          {handle !== ALL_PRODUCTS_HANDLE && <Link className="retail-catalog__action" to={collectionPath(ALL_PRODUCTS_HANDLE)}>Shop all <Icon icon={arrowIcon} aria-hidden="true" width={20} /></Link>}
          <Link className="collection-empty__secondary" to="/calendar">Find your next night out</Link>
        </div>
      </div>
    );
  } else {
    body = (
      <div className="collection-catalog">
        <aside className="collection-rail" aria-label="Filters">
          <div className="collection-rail__head">
            <h2>Filter</h2>
            {active > 0 && <button type="button" onClick={() => update(clearedFilters(filters))}>Clear all ({active})</button>}
          </div>
          <FilterGroups facets={facets} state={filters} onChange={update} idPrefix="rail" />
        </aside>
        <div className="collection-results">
          <div className="shop-toolbar">
            <h2 className="shop-toolbar__count" aria-live="polite">
              <strong>{visible.length}</strong> {visible.length === 1 ? "piece" : "pieces"}
              {active > 0 && <span className="sr-only"> match your filters</span>}
            </h2>
            <div className="shop-toolbar__controls">
              <FilterSheet facets={facets} state={filters} onChange={update} resultCount={visible.length} />
              <label className="shop-sort">
                <span>Sort</span>
                <select value={filters.sort} onChange={(event) => update({ ...filters, sort: event.target.value as SortValue })}>
                  {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
            </div>
          </div>
          {chips.length > 0 && (
            <ul className="shop-active" aria-label="Active filters">
              {chips.map((chip) => (
                <li key={chip.label}>
                  <button type="button" onClick={chip.clear} aria-label={`Remove filter ${chip.label}`}>
                    {chip.label}<Icon icon={closeIcon} aria-hidden="true" width={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {visible.length === 0 ? (
            <div className="collection-empty" role="status">
              <h3>Nothing matches these filters</h3>
              <p>Remove a filter, or browse everything in {handle === ALL_PRODUCTS_HANDLE ? "the shop" : title}.</p>
              <div className="collection-empty__actions">
                <button type="button" className="retail-catalog__action" onClick={() => update(clearedFilters(filters))}>Clear filters</button>
              </div>
            </div>
          ) : (
            <ul className="retail-catalog__grid" aria-label={`${title} products`} aria-busy={query.isFetching}>
              {visible.map((product, index) => <ProductCard key={product.id} product={product} eager={index < 3} />)}
            </ul>
          )}
        </div>
      </div>
    );
  }

  return (
    <section className="shop-page shop-page--collection" aria-labelledby="collection-heading">
      <div className="retail-catalog">
        <ShopMasthead />
        {cartError && <p className="shop-page__notice" role="alert">Your cart could not be updated. Please try again.</p>}
        <div className={`collection-hero${collection?.image || products.some((product) => product.featuredImage) ? "" : " collection-hero--text"}`}>
          <div className="collection-hero__copy">
            <nav className="shop-breadcrumb" aria-label="Breadcrumb">
              <Link to="/shop">Shop</Link>
              <span aria-current="page">{title}</span>
            </nav>
            <h1 id="collection-heading">{headline}</h1>
            {description && <p>{description}</p>}
            {products.length > 0 && (
              <p className="collection-hero__meta">
                <span><strong>{products.length}</strong> {products.length === 1 ? "piece" : "pieces"}</span>
                <span>From {formatMoney(products.reduce((low, product) =>
                  Number(product.priceRange.minVariantPrice.amount) < Number(low.amount) ? product.priceRange.minVariantPrice : low,
                products[0].priceRange.minVariantPrice))}</span>
              </p>
            )}
          </div>
          <HeroMedia image={collection?.image ?? null} products={products} />
        </div>
        {body}
        {!(missing && !config) && <KeepBrowsing current={handle} />}
        <p className="retail-catalog__credits">
          <a href="https://icon-sets.iconify.design/solar/">Solar icons by 480 Design</a>,{" "}
          <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>.
        </p>
      </div>
    </section>
  );
}
