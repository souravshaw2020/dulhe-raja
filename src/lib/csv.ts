type CsvCell =
  | string
  | number
  | boolean
  | Date
  | null
  | undefined
  | { toString(): string };

function escapeCsvCell(value: CsvCell): string {
  if (value === null || value === undefined) return "";
  const str = value instanceof Date ? value.toISOString() : String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCsv<T extends Record<string, CsvCell>>(
  headers: (keyof T)[],
  rows: T[],
): string {
  const headerLine = headers.map((h) => escapeCsvCell(String(h))).join(",");
  const dataLines = rows.map((row) =>
    headers.map((h) => escapeCsvCell(row[h])).join(","),
  );
  // Prepend UTF-8 BOM so Excel opens ₹ and special characters cleanly
  return "\uFEFF" + [headerLine, ...dataLines].join("\r\n");
}
