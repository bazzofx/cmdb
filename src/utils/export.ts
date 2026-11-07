// Shared CSV serialisation and browser download helpers.
// Before this module, five views each re-implemented Blob/object-URL/anchor
// downloads and three hand-built CSV strings without quote escaping.

const csvCell = (value: unknown): string => {
  const raw = value === null || value === undefined ? '' : String(value);
  return `"${raw.replace(/"/g, '""')}"`;
};

/** Builds an Excel-friendly UTF-8 CSV (BOM + CRLF, quoted cells). */
export function toCsv(
  headers: string[],
  rows: Array<Array<string | number | boolean | null | undefined>>
): string {
  const lines = [headers.map(csvCell).join(',')];
  for (const row of rows) lines.push(row.map(csvCell).join(','));
  return `\uFEFF${lines.join('\r\n')}`;
}

/** Triggers a browser download for an arbitrary blob. */
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** Triggers a browser download for text content. */
export function downloadText(
  filename: string,
  content: string,
  mimeType = 'text/plain;charset=utf-8'
): void {
  downloadBlob(filename, new Blob([content], { type: mimeType }));
}

/** Builds and downloads a CSV in one call. */
export function downloadCsv(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number | boolean | null | undefined>>
): void {
  downloadText(filename, toCsv(headers, rows), 'text/csv;charset=utf-8');
}
