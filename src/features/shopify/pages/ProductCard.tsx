import { useState } from "react";
import { Icon } from "@iconify/react";
import arrowIcon from "@iconify-icons/solar/arrow-right-up-linear";
import { formatMoney } from "../money";
import type { CatalogProduct } from "../api/types";
import { useCart } from "../cart/useCart";
import ProductImage from "./ProductImage";
import ProductLink from "./ProductLink";
import { quickAddSizes, variantSummary } from "./catalogFilters";

export default function ProductCard({ product, eager = false }: { product: CatalogProduct; eager?: boolean }) {
  const { addVariant, setOpen, isBusy } = useCart();
  const [adding, setAdding] = useState<string | null>(null);
  const quick = quickAddSizes(product);
  const { colors, sizeCount } = variantSummary(product);
  const alternate = product.images.find((image) => image.url !== product.featuredImage?.url);
  const swatches = colors.filter((color) => color.swatch);
  const variantLine = [
    colors.length ? `${colors.length} colours` : null,
    sizeCount > 1 ? `${sizeCount} sizes` : sizeCount === 1 ? "One size" : null,
  ].filter(Boolean).join(" · ");

  const add = async (variantId: string) => {
    setAdding(variantId);
    try {
      if (await addVariant(variantId, 1)) setOpen(true);
    } finally {
      setAdding(null);
    }
  };

  return (
    <li className={`retail-card${alternate ? " retail-card--alternate" : ""}`}>
      <ProductLink product={product} className="retail-card__link">
        <span className="retail-card__media">
          <ProductImage product={product} className="retail-card__image" eager={eager} />
          {alternate && <img className="retail-card__image retail-card__image--alternate" src={alternate.url} alt=""
            width={alternate.width || 720} height={alternate.height || 720} loading="lazy" aria-hidden="true" />}
          {!product.availableForSale && <span className="retail-card__badge">Sold out</span>}
        </span>
        <span className="retail-card__caption">
          <span className="retail-card__name">{product.title}</span>
          <span className="retail-card__price">From {formatMoney(product.priceRange.minVariantPrice)}</span>
          {variantLine && <span className="retail-card__variants">
            {swatches.length > 0 && <span className="retail-card__swatches" aria-hidden="true">
              {swatches.slice(0, 6).map((color) => <i key={color.name} style={{ background: color.swatch ?? undefined }} />)}
            </span>}
            {variantLine}
          </span>}
          <span className="retail-card__view">View product <Icon icon={arrowIcon} aria-hidden="true" width={18} /></span>
        </span>
      </ProductLink>
      {quick.length > 0 && (
        // Square overlay matching the media, so the row sits on the image's lower edge.
        <div className="retail-card__overlay">
          <div className="retail-card__quick" role="group" aria-label={`Quick add ${product.title}`}>
            {quick.slice(0, 6).map((size) => (
              <button key={size.variantId} type="button" disabled={!size.available || isBusy} data-sold-out={!size.available || undefined}
                aria-label={size.available ? `Add ${product.title}, size ${size.label}, to cart` : `${product.title}, size ${size.label}, sold out`}
                aria-busy={adding === size.variantId || undefined}
                onClick={() => { void add(size.variantId); }}>
                {size.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </li>
  );
}
