/**
 * Presentation config for the shop's named collection routes.
 *
 * Shopify stays the source of truth for which products a collection holds:
 * this file only carries route copy. `/shop/:handle` resolves any Shopify
 * collection handle; the entries below add editorial copy and an honest
 * empty state when the merchant has not published that collection yet.
 */
export interface ShopCollectionConfig {
  handle: string;
  label: string;
  /** One-line hint used in navigation menus. */
  hint: string;
  headline: string;
  /** Used when the Shopify collection has no description of its own. */
  description: string;
  /** Copy for a collection that is expected but not yet stocked. */
  emptyTitle: string;
  emptyBody: string;
}

/** Virtual handle for the whole catalog; not a Shopify collection. */
export const ALL_PRODUCTS_HANDLE = "all";

export const SHOP_COLLECTIONS: ShopCollectionConfig[] = [
  {
    handle: "men",
    label: "Men",
    hint: "Tees, hoodies, performance",
    headline: "Men's streetwear & performance",
    description: "Tees that breathe through a three-hour social, a hoodie for the walk home, and a performance cut for the ones who train.",
    emptyTitle: "The men's collection is on its way",
    emptyBody: "Nothing is listed here yet. Everything we stock is in Shop all.",
  },
  {
    handle: "women",
    label: "Women",
    hint: "Tees, tanks, leggings",
    headline: "Women's movement edit",
    description: "Lightweight tanks and V-necks for class, high-rise leggings and joggers for everything after. Cut to move with you, not against you.",
    emptyTitle: "The women's collection is on its way",
    emptyBody: "Nothing is listed here yet. Everything we stock is in Shop all.",
  },
  {
    handle: "accessories",
    label: "Accessories",
    hint: "Beanies, headbands",
    headline: "The small details",
    description: "Embroidered beanies for the walk home and moisture-wicking headbands for the practice room.",
    emptyTitle: "Accessories are on their way",
    emptyBody: "Nothing is listed here yet. Everything we stock is in Shop all.",
  },
  {
    handle: "shoes",
    label: "Shoes",
    hint: "Coming soon",
    headline: "Footwear is coming",
    description: "Dance sneakers, Latin heels and practice flats are in the works.",
    emptyTitle: "No shoes in the shop yet",
    emptyBody: "Nothing is on sale yet. While footwear is sourced, the rest of the gear is ready to go.",
  },
];

export const ALL_PRODUCTS_CONFIG: ShopCollectionConfig = {
  handle: ALL_PRODUCTS_HANDLE,
  label: "Shop all",
  hint: "Everything, one grid",
  headline: "Shop all",
  description: "Every piece of official Salsa Segura gear, in one place.",
  emptyTitle: "New gear is on its way",
  emptyBody: "There are no products to browse right now. Check back soon.",
};

export function collectionConfig(handle: string): ShopCollectionConfig | undefined {
  if (handle === ALL_PRODUCTS_HANDLE) return ALL_PRODUCTS_CONFIG;
  return SHOP_COLLECTIONS.find((entry) => entry.handle === handle);
}

export function collectionPath(handle: string): string {
  return `/shop/${encodeURIComponent(handle)}`;
}

/**
 * Shared by the site header, the shop masthead and the mobile menu. The
 * first entry is the storefront landing; the full grid (`/shop/all`) is
 * reached from the storefront's own calls to action and Keep browsing.
 */
export const SHOP_NAV: Array<{ to: string; label: string; hint: string }> = [
  { to: "/shop", label: "Shopfront", hint: "Featured, new arrivals, collections" },
  ...SHOP_COLLECTIONS.map((entry) => ({ to: collectionPath(entry.handle), label: entry.label, hint: entry.hint })),
];
