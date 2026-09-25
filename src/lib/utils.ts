import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Extracts clean stock symbol from Trading 212 format
 * e.g., "AAPL_US_EQ" -> "AAPL", "VUSA_UK_EQ" -> "VUSA"
 */
export function cleanSymbol(symbol: string): string {
  if (!symbol) return '';
  // Remove suffixes like _US_EQ, _UK_EQ, _BE_EQ, etc.
  return symbol.replace(/_[A-Z]{2}_[A-Z]{2,}$/i, '').toUpperCase();
}

/**
 * Checks if a symbol has a Trading 212 suffix
 */
export function hasT212Suffix(symbol: string): boolean {
  return /_[A-Z]{2}_[A-Z]{2,}$/i.test(symbol);
}
