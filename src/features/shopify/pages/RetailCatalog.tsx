import { Children, useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Icon } from "@iconify/react";
import arrowIcon from "@iconify-icons/solar/arrow-right-up-linear";
import nextIcon from "@iconify-icons/solar/arrow-right-linear";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import type { CatalogProduct, CollectionTile } from "../api/types";
import { ALL_PRODUCTS_HANDLE, SHOP_COLLECTIONS, collectionPath } from "../collections";
import MerchTable from "./MerchTable";
import ProductCard from "./ProductCard";
import ShopMasthead from "./ShopMasthead";
import { useCatalogMotion } from "./useCatalogMotion";
import "./merch-table.css";

/** Word spans for the heading motion; the heading keeps one unsplit accessible name. */
function SplitHeading({ id, text, tabIndex }: { id: string; text: string; tabIndex?: number }) {
  const words = text.split(" ");
  return (
    <h2 id={id} aria-label={text} tabIndex={tabIndex}>
      {words.map((word, index) => (
        <span key={`${word}-${index}`}>
          <span className="retail-word" aria-hidden="true">{word}</span>{index < words.length - 1 ? " " : ""}
        </span>
      ))}
    </h2>
  );
}

/** Collections as the table's front edge: big words with Shopify's real counts. */
function CollectionWords({ tiles, tilesError }: { tiles: CollectionTile[] | undefined; tilesError?: boolean }) {
  return (
    <ul className="merch-collections" aria-label="Collections">
      {SHOP_COLLECTIONS.map((entry) => {
        const tile = tiles?.find((candidate) => candidate.handle === entry.handle);
        const stocked = Boolean(tile && tile.productCount > 0);
        const count = tile ? `${tile.productCount}${tile.hasMoreProducts ? "+" : ""} ${tile.productCount === 1 && !tile.hasMoreProducts ? "piece" : "pieces"}` : "";
        const label = tilesError ? "Unavailable" : tiles === undefined ? "\u00a0" : stocked ? count : "Coming soon";
        return (
          <li key={entry.handle}>
            <Link to={collectionPath(entry.handle)} className={`merch-collection${stocked ? "" : " merch-collection--soon"}`}>
              <strong>{entry.label}</strong>
              <small>{label}</small>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export default function RetailCatalog({ featured, arrivals, tiles, tilesError, children }: {
  featured: CatalogProduct[];
  arrivals: CatalogProduct[];
  tiles: CollectionTile[] | undefined;
  /** True when the collection listing request failed; collections show an
    * unavailable state rather than pretending they are empty. */
  tilesError?: boolean;
  /** Loading, error and empty states render in place of the table. */
  children?: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const listed = featured.length + arrivals.length;
  useCatalogMotion(root, listed);
  // The merchant's Featured pieces lead the table; the newest pieces fill the rest of it.
  const onTable = [...featured, ...arrivals].slice(0, 5);
  const tableLabel = featured.length > 0 ? "Featured and new" : "New arrivals";
  const rest = arrivals.slice(Math.max(0, 5 - featured.length), Math.max(0, 5 - featured.length) + 4);
  const hasState = Children.toArray(children).length > 0;
  const women = tiles?.find((tile) => tile.handle === "women" && tile.productCount > 0);
  const editorialImage = women?.image ?? women?.coverImage ?? null;
  const shopAll = collectionPath(ALL_PRODUCTS_HANDLE);

  return (
    <div className="retail-catalog" ref={root}>
      <ShopMasthead />

      <section className={`merch-hero${onTable.length ? "" : " merch-hero--text"}`} aria-labelledby="shop-heading">
        <div className="merch-hero__copy">
          <h1 id="shop-heading" aria-label="Wear the rhythm.">
            <span className="retail-word" aria-hidden="true">Wear</span>{" "}
            <span className="retail-word" aria-hidden="true">the</span>{" "}
            <span className="retail-word" aria-hidden="true">rhythm.</span>
          </h1>
          <p>For the nights that turn into mornings. And the rhythm you take home.</p>
          <Link className="merch-hero__all" to={shopAll}>
            Shop everything <Icon icon={nextIcon} aria-hidden="true" width={18} />
          </Link>
        </div>
        {hasState && <div className="merch-hero__state">{children}</div>}
        {onTable.length > 0 && <MerchTable products={onTable} label={tableLabel} />}
      </section>

      <nav className="merch-hero__collections" aria-label="Shop by collection">
        <CollectionWords tiles={tiles} tilesError={tilesError} />
      </nav>

      {listed > 0 && <section className={`retail-editorial${editorialImage ? "" : " retail-editorial--text"}`} aria-labelledby="retail-editorial-heading">
        {editorialImage && <figure className="retail-editorial__media">
          <img src={editorialImage.url} alt={editorialImage.altText ?? ""} loading="lazy" width={editorialImage.width || 720} height={editorialImage.height || 900} />
        </figure>}
        <div className="retail-editorial__copy">
          <h2 id="retail-editorial-heading">Built for the last song of the night.</h2>
          <p>Salsa Segura began as the calendar dancers plan their week around. The gear follows the same rule: nothing that gets in the way of the dance. Soft cotton that breathes through a three-hour social, a hoodie for the walk home, and an embroidered mark you'll recognise across the room.</p>
          <dl className="retail-editorial__facts">
            <div><dt>Fit</dt><dd>Unisex and women's cuts, from XS to 5XL depending on the piece.</dd></div>
            <div><dt>Mark</dt><dd>The Salsa Segura dancer, embroidered or printed.</dd></div>
            <div><dt>Checkout</dt><dd>Secure Shopify checkout. Your cart stays with you between visits.</dd></div>
          </dl>
          <Link className="retail-editorial__link" to={collectionPath("women")}>Explore Women <Icon icon={nextIcon} aria-hidden="true" width={18} /></Link>
        </div>
      </section>}

      {rest.length > 0 && <section className="retail-catalog__collection" aria-labelledby="retail-arrivals-heading">
        <div className="retail-catalog__collection-heading">
          <SplitHeading id="retail-arrivals-heading" text="New arrivals" tabIndex={-1} />
          <Link className="retail-catalog__more" to={shopAll}>Shop all <Icon icon={nextIcon} aria-hidden="true" width={18} /></Link>
        </div>
        <ul className="retail-catalog__grid retail-catalog__grid--four merch-surface" aria-label="New arrivals">
          {rest.map((product) => <ProductCard key={product.id} product={product} />)}
        </ul>
      </section>}

      <aside className="retail-catalog__closing" aria-labelledby="retail-closing-heading">
        <div>
          <SplitHeading id="retail-closing-heading" text="See you on the dance floor." />
          <p>The gear is only the beginning. Find your next night out on the Salsa Segura calendar.</p>
        </div>
        <ul className="retail-catalog__community">
          <li><Link to="/calendar">Explore upcoming events <Icon icon={arrowIcon} aria-hidden="true" width={20} /></Link></li>
          <li><Link to="/discover">Find a class <Icon icon={arrowIcon} aria-hidden="true" width={20} /></Link></li>
          <li><Link to="/founders">Request host access <Icon icon={arrowIcon} aria-hidden="true" width={20} /></Link></li>
        </ul>
      </aside>
      <p className="retail-catalog__credits">
        <a href="https://icon-sets.iconify.design/solar/">Solar icons by 480 Design</a>,{" "}
        <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>.
      </p>
    </div>
  );
}
