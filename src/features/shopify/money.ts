import type { Money } from "./api/types";

export function formatMoney(money: Money): string {
  const amount = Number(money.amount);
  if (!Number.isFinite(amount)) return `${money.amount} ${money.currencyCode}`;

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: money.currencyCode,
  }).format(amount);
}
