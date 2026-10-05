import { useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Icon } from "@iconify/react";
import bagIcon from "@iconify-icons/solar/bag-4-linear";
import arrowIcon from "@iconify-icons/solar/arrow-right-up-linear";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import { formatMoney } from "../money";
import ProductImage from "./ProductImage";
import ProductLink from "./ProductLink";
import type { ProductSummary } from "../api/types";
import { useCatalogMotion } from "./useCatalogMotion";

export default function RetailCatalog({ products, cartQuantity, onOpenCart, isFetching, children }: {
  products: ProductSummary[];
  cartQuantity: number;
  onOpenCart: () => void;
  isFetching: boolean;
  children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  useCatalogMotion(root, products.length);
  const featured = products.find((product) => product.featuredImage);

  return (
    <div className="retail-catalog" ref={root}>
      <header className="retail-catalog__header">
        <p className="retail-catalog__identity">Salsa Segura shop</p>
        <button
          className="retail-catalog__cart"
          type="button"
          onClick={onOpenCart}
          aria-label={`Open cart, ${cartQuantity} ${cartQuantity === 1 ? "item" : "items"}`}
        >
          <Icon icon={bagIcon} aria-hidden="true" width={21} />
          <span>Cart</span>
          <span className="retail-catalog__cart-count" aria-live="polite">{cartQuantity}</span>
        </button>
      </header>

      <section className={`retail-hero${featured ? "" : " retail-hero--text"}`} aria-labelledby="shop-heading">
        <div className="retail-hero__copy">
          <h1 id="shop-heading" aria-label="Wear the rhythm.">
            <span className="retail-word" aria-hidden="true">Wear</span>{" "}
            <span className="retail-word" aria-hidden="true">the</span>{" "}
            <span className="retail-word" aria-hidden="true">rhythm.</span>
          </h1>
          <p>For the nights that turn into mornings.<br />And the rhythm you take home.</p>
          {products.length > 0 && <a className="retail-catalog__action" href="#retail-collection-heading">
            Shop the collection <Icon icon={arrowIcon} aria-hidden="true" width={21} />
          </a>}
          <p className="retail-hero__note">Official gear. Same dance-floor spirit.</p>
        </div>
        {featured && <figure className="retail-hero__feature">
          {/* Photography comes from this merchant's published Shopify catalog,
              not a testimonial, generated customer, or third-party stock asset. */}
          <div className="retail-hero__media">
            <ProductImage product={featured} className="retail-hero__image" eager />
          </div>
          <figcaption><span>{featured.title}</span><span>Salsa Segura</span></figcaption>
        </figure>}
      </section>

      {products.length > 0 && <section className="retail-catalog__collection" aria-labelledby="retail-collection-heading">
        <div className="retail-catalog__collection-heading">
          <h2 id="retail-collection-heading" tabIndex={-1} aria-label="The collection">
            <span className="retail-word" aria-hidden="true">The</span>{" "}
            <span className="retail-word" aria-hidden="true">collection</span>
          </h2>
          <p>{products.length} {products.length === 1 ? "piece" : "pieces"}</p>
        </div>
        <ul id="shop-products" className="retail-catalog__grid" aria-label="Shop products" aria-busy={isFetching}>
          {products.map((product) => (
            <li className="retail-card" key={product.id}>
              <ProductLink product={product} className="retail-card__link">
                <span className="retail-card__media">
                  <ProductImage product={product} className="retail-card__image" />
                </span>
                <span className="retail-card__caption">
                  <span className="retail-card__name">{product.title}</span>
                  <span className="retail-card__price">From {formatMoney(product.priceRange.minVariantPrice)}</span>
                  <span className="retail-card__view">View product <Icon icon={arrowIcon} aria-hidden="true" width={18} /></span>
                </span>
              </ProductLink>
            </li>
          ))}
        </ul>
      </section>}
      {children}

      {products.length > 0 && <>
        <section className="retail-catalog__guidance" aria-label="Shopping with Salsa Segura">
          <div><h3>Make it yours</h3><p>Open a product to explore its images, sizes, and available options.</p></div>
          <div><h3>Your bag, your pace</h3><p>Choose a quantity and review your items before heading to checkout.</p></div>
          <div><h3>Checkout with Shopify</h3><p>Shipping and applicable taxes are calculated at checkout.</p></div>
        </section>
        <aside className="retail-catalog__closing" aria-labelledby="retail-closing-heading">
          <div>
            <h2 id="retail-closing-heading" aria-label="See you on the dance floor.">
              <span className="retail-word" aria-hidden="true">See</span>{" "}
              <span className="retail-word" aria-hidden="true">you</span>{" "}
              <span className="retail-word" aria-hidden="true">on</span>{" "}
              <span className="retail-word" aria-hidden="true">the</span>{" "}
              <span className="retail-word" aria-hidden="true">dance</span>{" "}
              <span className="retail-word" aria-hidden="true">floor.</span>
            </h2>
            <p>The gear is only the beginning. Find your next night out on the Salsa Segura calendar.</p>
          </div>
          <Link to="/calendar">Explore upcoming events <Icon icon={arrowIcon} aria-hidden="true" width={22} /></Link>
        </aside>
      </>}
      <p className="retail-catalog__credits">
        <a href="https://icon-sets.iconify.design/solar/">Solar icons by 480 Design</a>,{" "}
        <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>.
      </p>
    </div>
  );
}
