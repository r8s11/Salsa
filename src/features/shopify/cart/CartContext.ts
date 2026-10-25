import { createContext } from "react";
import type { Cart } from "../api/types";

export interface CartState {
  cart: Cart | null;
  isLoading: boolean;
  isBusy: boolean;
  error: string | null;
  notice: string | null;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  restoreFocus: () => void;
  addVariant: (variantId: string, quantity?: number) => Promise<boolean>;
  updateLine: (lineId: string, quantity: number) => Promise<boolean>;
  removeLine: (lineId: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}

export const CartContext = createContext<CartState | null>(null);
