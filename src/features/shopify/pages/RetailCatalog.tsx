import { useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Icon } from "@iconify/react";
import arrowIcon from "@iconify-icons/solar/arrow-right-up-linear";
import nextIcon from "@iconify-icons/solar/arrow-right-linear";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import { formatMoney } from "../money";
import type { CatalogProduct, CollectionTile } from "../api/types";
import { ALL_PRODUCTS_HANDLE, SHOP_COLLECTIONS, collectionPath } from "../collections";
import ProductCard from "./ProductCard";
import ProductImage from "./ProductImage";
import ProductLink from "./ProductLink";
import ShopMasthead from "./ShopMasthead";
import { useCatalogMotion } from "./useCatalogMotion";

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

function CategoryTiles({ tiles }: { tiles: CollectionTile[] | undefined }) {
  return (
    <ul className="retail-tiles" aria-label="Collections">
      {SHOP_COLLECTIONS.map((entry) => {
        const tile = tiles?.find((candidate) => candidate.handle === entry.handle);
        const stocked = Boolean(tile && tile.productCount > 0);
        const image = tile?.image ?? tile?.coverImage ?? null;
        const count = tile ? `${tile.productCount}${tile.hasMoreProducts ? "+" : ""} ${tile.productCount === 1 && !tile.hasMoreProducts ? "piece" : "pieces"}` : "";
        return (
          <li key={entry.handle}>
            <Link to={collectionPath(entry.handle)} className={`retail-tile${stocked && image ? "" : " retail-tile--soon"}`}>
              {stocked && image && <img src={image.url} alt="" loading="lazy" width={image.width || 720} height={image.height || 720} />}
              <span className="retail-tile__label">
                <strong>{entry.label}</strong>
                <small>{tiles === undefined ? "\u00a0" : stocked ? count : "Coming soon"}</small>
              </span>
              <span className="retail-tile__arrow" aria-hidden="true"><Icon icon={nextIcon} width={18} /></span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function ProductRow({ id, title, products, action, four = false }: {
  id: string;
  title: string;
  products: CatalogProduct[];
  action?: ReactNode;
  four?: boolean;
}) {
  return (
    <section className="retail-catalog__collection" aria-labelledby={id}>
      <div className="retail-catalog__collection-heading">
        <SplitHeading id={id} text={title} tabIndex={-1} />
        {action}
      </div>
      <ul className={`retail-catalog__grid${four ? " retail-catalog__grid--four" : ""}`} aria-label={title}>
        {products.map((product) => <ProductCard key={product.id} product={product} />)}
      </ul>
    </section>
  );
}

export default function RetailCatalog({ featured, arrivals, tiles, children }: {
  featured: CatalogProduct[];
  arrivals: CatalogProduct[];
  tiles: CollectionTile[] | undefined;
  /** Loading, error and empty states render in place of the product rows. */
  children?: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const listed = featured.length + arrivals.length;
  useCatalogMotion(root, listed);
  const hero = [...featured, ...arrivals].find((product) => product.featuredImage);
  const women = tiles?.find((tile) => tile.handle === "women" && tile.productCount > 0);
  const editorialImage = women?.image ?? women?.coverImage ?? null;
  const shopAll = collectionPath(ALL_PRODUCTS_HANDLE);

  return (
    <div className="retail-catalog" ref={root}>
      <ShopMasthead />

      <section className={`retail-hero${hero ? "" : " retail-hero--text"}`} aria-labelledby="shop-heading">
        <div className="retail-hero__copy">
          <h1 id="shop-heading" aria-label="Wear the rhythm.">
            <span className="retail-word" aria-hidden="true">Wear</span>{" "}
            <span className="retail-word" aria-hidden="true">the</span>{" "}
            <span className="retail-word" aria-hidden="true">rhythm.</span>
          </h1>
          <p>For the nights that turn into mornings.<br />And the rhythm you take home.</p>
          <Link className="retail-catalog__action" to={shopAll}>
            Shop the collection <Icon icon={arrowIcon} aria-hidden="true" width={21} />
          </Link>
          <p className="retail-hero__note">Official gear. Same dance-floor spirit.</p>
        </div>
        {hero && <figure className="retail-hero__feature">
          {/* Photography comes from this merchant's published Shopify catalog,
              not a testimonial, generated customer, or third-party stock asset. */}
          <div className="retail-hero__media">
            <ProductImage product={hero} className="retail-hero__image" eager />
          </div>
          <ProductLink product={hero} className="retail-hero__tag">
            <span className="retail-hero__tag-name">{hero.title}</span>
            <span className="retail-hero__tag-meta">From {formatMoney(hero.priceRange.minVariantPrice)} · View product</span>
          </ProductLink>
        </figure>}
      </section>

      <section className="retail-catalog__section" aria-labelledby="retail-collections-heading">
        <div className="retail-catalog__collection-heading">
          <h2 id="retail-collections-heading">Shop by collection</h2>
        </div>
        <CategoryTiles tiles={tiles} />
      </section>

      {children}

      {featured.length > 0 && <ProductRow id="retail-featured-heading" title="Featured" products={featured}
        action={<Link className="retail-catalog__more" to={shopAll}>Shop all <Icon icon={nextIcon} aria-hidden="true" width={18} /></Link>} />}

      {listed > 0 && <section className={`retail-editorial${editorialImage ? "" : " retail-editorial--text"}`} aria-labelledby="retail-editorial-heading">
        {editorialImage && <figure className="retail-editorial__media">
          <img src={editorialImage.url} alt={editorialImage.altText ?? ""} loading="lazy" width={editorialImage.width || 720} height={editorialImage.height || 900} />
        </figure>}
        <div className="retail-editorial__copy">
          <h2 id="retail-editorial-heading">Built for the last song of the night.</h2>
          <p>Salsa Segura began as the calendar dancers plan their week around. The gear follows the same rule: nothing that gets in the way of the dance. Soft cotton that breathes through a three-hour social, a hoodie for the walk home, and a embroidered mark you'll recognise across the room.</p>
          <dl className="retail-editorial__facts">
            <div><dt>Fit</dt><dd>Unisex and women's cuts, from XS to 5XL depending on the piece.</dd></div>
            <div><dt>Mark</dt><dd>The Salsa Segura dancer, embroidered or printed.</dd></div>
            <div><dt>Checkout</dt><dd>Secure Shopify checkout. Your cart stays with you between visits.</dd></div>
          </dl>
          <Link className="retail-editorial__link" to={collectionPath("women")}>Explore Women <Icon icon={nextIcon} aria-hidden="true" width={18} /></Link>
        </div>
      </section>}

      {arrivals.length > 0 && <ProductRow id="retail-arrivals-heading" title="New arrivals" products={arrivals} four
        action={<p>The latest additions to the shop.</p>} />}

      <aside className="retail-catalog__closing" aria-labelledby="retail-closing-heading">
        <div>
          <SplitHeading id="retail-closing-heading" text="See you on the dance floor." />
          <p>The gear is only the beginning. Find your next night out on the Salsa Segura calendar.</p>
        </div>
        <ul className="retail-catalog__community">
          <li><Link to="/calendar">Explore upcoming events <Icon icon={arrowIcon} aria-hidden="true" width={20} /></Link></li>
          <li><Link to="/discover">Find a class <Icon icon={arrowIcon} aria-hidden="true" width={20} /></Link></li>
          <li><Link to="/founders">Host an event <Icon icon={arrowIcon} aria-hidden="true" width={20} /></Link></li>
        </ul>
      </aside>
      <p className="retail-catalog__credits">
        <a href="https://icon-sets.iconify.design/solar/">Solar icons by 480 Design</a>,{" "}
        <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>.
      </p>
    </div>
  );
}
