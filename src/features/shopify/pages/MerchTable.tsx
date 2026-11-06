import { useId, useRef, useState } from "react";
import { productPrice } from "../money";
import type { CatalogProduct } from "../api/types";
import { useCart } from "../cart/useCart";
import { quickAddSizes } from "./catalogFilters";
import ProductImage from "./ProductImage";
import ProductLink from "./ProductLink";

/** Gold hang-tag carrying the Shopify price. Decorative twin of the link's accessible price. */
export function PriceTag({ product }: { product: CatalogProduct }) {
  return <span className="merch-tag" aria-hidden="true">{productPrice(product)}</span>;
}

/** Size chips and Add for the table's lead piece. Size is never chosen for the shopper. */
function TableBuy({ product }: { product: CatalogProduct }) {
  const { addVariant, setOpen, isBusy } = useCart();
  const sizes = quickAddSizes(product);
  const [chosen, setChosen] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [adding, setAdding] = useState(false);
  const group = useRef<HTMLDivElement>(null);
  const labelId = useId();

  const add = async () => {
    if (!chosen) {
      setStatus("Choose a size first.");
      group.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
      return;
    }
    setAdding(true);
    setStatus("");
    try {
      if (await addVariant(chosen, 1)) setOpen(true);
      else setStatus("That didn't reach your cart. Try again.");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="merch-buy">
      <span className="merch-buy__label" id={labelId}>Size</span>
      <div className="merch-buy__sizes" role="radiogroup" aria-labelledby={labelId} ref={group}>
        {sizes.map((size) => (
          <button key={size.variantId} type="button" role="radio" aria-checked={chosen === size.variantId}
            disabled={!size.available} data-sold-out={!size.available || undefined}
            aria-label={size.available ? size.label : `${size.label}, sold out`}
            onClick={() => { setChosen(size.variantId); setStatus(""); }}>
            {size.label}
          </button>
        ))}
      </div>
      <button type="button" className="merch-buy__add" disabled={isBusy} aria-busy={adding || undefined} onClick={() => { void add(); }}>
        {adding ? "Adding…" : "Add to cart"}
      </button>
      <p className="merch-buy__status" role="status">{status}</p>
    </div>
  );
}

/** The landing's merch table: up to five real pieces laid on one lit surface.
 * The lead piece is the first that one size choice can buy; it sells in place. */
export default function MerchTable({ products, label }: { products: CatalogProduct[]; label: string }) {
  const pieces = products.slice(0, 5);
  const leadIndex = Math.max(0, pieces.findIndex((product) => quickAddSizes(product).length > 0));
  const lead = pieces[leadIndex];
  const ordered = lead ? [lead, ...pieces.filter((_, index) => index !== leadIndex)] : [];
  const sellable = lead ? quickAddSizes(lead).length > 0 : false;

  return (
    <div className="merch-table" data-count={ordered.length}>
      <ul className="merch-table__pieces" aria-label={label}>
        {ordered.map((product, index) => (
          <li key={product.id} className={`merch-piece${index === 0 ? " merch-piece--lead" : ""}`}>
            <ProductLink product={product} className="merch-piece__link">
              <span className="merch-piece__media">
                <ProductImage product={product} className="merch-piece__image" eager={index < 3} />
                {!product.availableForSale && <span className="retail-card__badge">Sold out</span>}
              </span>
              <span className="merch-piece__name">{product.title}</span>
            </ProductLink>
            <PriceTag product={product} />
            {index === 0 && sellable && <TableBuy product={product} />}
          </li>
        ))}
      </ul>
    </div>
  );
}
