import type { Money } from "./api/types";

export function formatMoney(money: Money): string {
  const amount = Number(money.amount);
  if (!Number.isFinite(amount)) return `${money.amount} ${money.currencyCode}`;

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: money.currencyCode,
    }).format(amount);
  } catch {
    return `${money.amount} ${money.currencyCode}`;
  }
}

/** A product's display price: the exact price when every variant costs the
 * same, otherwise "From <lowest>". Never "From" when the price is fixed. */
export function productPrice(product: { priceRange: { minVariantPrice: Money; maxVariantPrice: Money } }): string {
  const { minVariantPrice, maxVariantPrice } = product.priceRange;
  const varies = Number(minVariantPrice.amount) !== Number(maxVariantPrice.amount);
  return varies ? `From ${formatMoney(minVariantPrice)}` : formatMoney(minVariantPrice);
}

/** Accessible price wording for links: "starting at" only when prices vary. */
export function productPriceAria(product: { priceRange: { minVariantPrice: Money; maxVariantPrice: Money } }): string {
  const { minVariantPrice, maxVariantPrice } = product.priceRange;
  return Number(minVariantPrice.amount) !== Number(maxVariantPrice.amount)
    ? `starting at ${formatMoney(minVariantPrice)}`
    : formatMoney(minVariantPrice);
}
