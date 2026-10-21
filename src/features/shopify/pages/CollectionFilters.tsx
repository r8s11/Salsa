import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Icon } from "@iconify/react";
import closeIcon from "@iconify-icons/solar/close-circle-linear";
import { formatMoney } from "../money";
import { activeFilterCount, clearedFilters, type CatalogFacets, type FilterState } from "./catalogFilters";

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];
}

const money = (amount: number, currencyCode: string | null) =>
  currencyCode ? formatMoney({ amount: String(amount), currencyCode }) : String(amount);

function Group({ title, children, open = true }: { title: string; children: ReactNode; open?: boolean }) {
  return (
    <details className="shop-filter" open={open}>
      <summary>{title}</summary>
      <div className="shop-filter__body">{children}</div>
    </details>
  );
}

/** Facet controls; shared by the desktop rail and the phone sheet. */
export function FilterGroups({ facets, state, onChange, idPrefix }: {
  facets: CatalogFacets;
  state: FilterState;
  onChange: (next: FilterState) => void;
  idPrefix: string;
}) {
  const ceiling = facets.priceCeiling;
  const price = state.maxPrice === null ? ceiling : Math.min(state.maxPrice, ceiling);
  return (
    <>
      {facets.types.length > 1 && (
        <Group title="Type">
          {facets.types.map((type) => (
            <label className="shop-check" key={type.key}>
              <input type="checkbox" checked={state.types.includes(type.key)}
                onChange={() => onChange({ ...state, types: toggle(state.types, type.key) })} />
              <span>{type.label}</span>
              <span className="shop-check__count">{type.count}</span>
            </label>
          ))}
        </Group>
      )}
      {facets.sizes.length > 1 && (
        <Group title="Size">
          <div className="shop-chips">
            {facets.sizes.map((size) => (
              <button type="button" className="shop-chip" key={size.key} aria-pressed={state.sizes.includes(size.key)}
                onClick={() => onChange({ ...state, sizes: toggle(state.sizes, size.key) })}>
                {size.label}
              </button>
            ))}
          </div>
        </Group>
      )}
      {facets.colors.length > 1 && (
        <Group title="Colour" open={facets.colors.length <= 10 || state.colors.length > 0}>
          <div className="shop-chips">
            {facets.colors.map((color) => (
              <button type="button" className="shop-chip shop-chip--color" key={color.key} aria-pressed={state.colors.includes(color.key)}
                onClick={() => onChange({ ...state, colors: toggle(state.colors, color.key) })}>
                {color.swatch && <i aria-hidden="true" style={{ background: color.swatch }} />}
                {color.label}
              </button>
            ))}
          </div>
        </Group>
      )}
      {ceiling > 0 && (
        <Group title="Price">
          <label className="shop-range" htmlFor={`${idPrefix}-price`}>
            <span>Up to {money(price, facets.currencyCode)}</span>
            <input id={`${idPrefix}-price`} type="range" min={0} max={ceiling} step={1} value={price}
              aria-valuetext={`Up to ${money(price, facets.currencyCode)}`}
              onChange={(event) => {
                const value = Number(event.target.value);
                onChange({ ...state, maxPrice: value >= ceiling ? null : value });
              }} />
          </label>
        </Group>
      )}
      <Group title="Availability" open={state.inStock}>
        <label className="shop-check">
          <input type="checkbox" checked={state.inStock} onChange={() => onChange({ ...state, inStock: !state.inStock })} />
          <span>In stock only</span>
        </label>
      </Group>
    </>
  );
}

/** Phone filter sheet. Filters apply live; the foot reports the result count. */
export function FilterSheet({ facets, state, onChange, resultCount }: {
  facets: CatalogFacets;
  state: FilterState;
  onChange: (next: FilterState) => void;
  resultCount: number;
}) {
  const active = activeFilterCount(state);
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button type="button" className="shop-toolbar__filter">
          Filter{active > 0 && <span className="retail-catalog__cart-count">{active}</span>}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="shop-sheet__overlay" />
        <Dialog.Content className="shop-sheet" aria-describedby={undefined}>
          <div className="shop-sheet__head">
            <Dialog.Title>Filter{active > 0 && <small>{active} active</small>}</Dialog.Title>
            <Dialog.Close className="shop-sheet__close" aria-label="Close filters">
              <Icon icon={closeIcon} aria-hidden="true" width={24} />
            </Dialog.Close>
          </div>
          <div className="shop-sheet__body" data-lenis-prevent>
            <FilterGroups facets={facets} state={state} onChange={onChange} idPrefix="sheet" />
          </div>
          <div className="shop-sheet__foot">
            <button type="button" className="shop-button shop-button--outline" disabled={active === 0}
              onClick={() => onChange(clearedFilters(state))}>Clear</button>
            <Dialog.Close className="shop-button shop-button--gold">
              Show {resultCount} {resultCount === 1 ? "piece" : "pieces"}
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
