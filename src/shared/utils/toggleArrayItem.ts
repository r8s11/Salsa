/**
 * Toggle a value in an array — add if absent, remove if present.
 * Used extensively in filter drawers/toolbars for checkbox-based multi-select filters.
 */
export function toggleArrayItem<T>(array: readonly T[], value: T): T[] {
  return array.includes(value) ? array.filter((item) => item !== value) : [...array, value];
}
