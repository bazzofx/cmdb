// Shared display/summary formatting used by views, reports and exports.
// Keeping these in one place means a percentage, list or date is rendered the
// same way everywhere.

/** Trim any value to a string, treating null/undefined as empty. */
export const text = (value: unknown): string =>
  value === null || value === undefined ? '' : String(value).trim();

/** Rounded percentage that never divides by zero. */
export const percent = (part: number, total: number): number =>
  total > 0 ? Math.round((part / total) * 100) : 0;

/** Distinct, non-empty, trimmed strings. Sorted alphabetically by default. */
export const unique = (
  values: Array<string | undefined | null>,
  options: { sort?: boolean } = {}
): string[] => {
  const list = Array.from(new Set(values.map(text).filter(Boolean)));
  return options.sort === false ? list : list.sort((a, b) => a.localeCompare(b));
};

/** Comma list capped at `max` values, with a `+N` suffix for the remainder. */
export const formatList = (values: Array<string | undefined | null>, max = 3): string => {
  const list = unique(values);
  if (list.length === 0) return '';
  if (list.length <= max) return list.join(', ');
  return `${list.slice(0, max).join(', ')} +${list.length - max}`;
};

/** ISO date (`YYYY-MM-DD`, UTC). Invalid or empty input is echoed/blank. */
export const formatDate = (value?: string | null): string => {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? text(value) : parsed.toISOString().slice(0, 10);
};

/** Today as `YYYY-MM-DD` (used in export filenames). */
export const todayIso = (): string => new Date().toISOString().slice(0, 10);
