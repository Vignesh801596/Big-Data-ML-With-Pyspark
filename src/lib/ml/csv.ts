// Minimal RFC4180-ish CSV parser (quotes, escaped quotes, CRLF).
export type ParsedCsv = { headers: string[]; rows: string[][]; raggedRows: number };

export function parseCsv(text: string): ParsedCsv {
  const clean = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  // Detect delimiter from the header line (comma, semicolon, or tab).
  const firstLine = clean.slice(0, clean.indexOf("\n") === -1 ? clean.length : clean.indexOf("\n"));
  const count = (ch: string) => firstLine.split(ch).length - 1;
  const delim = [",", ";", "\t"].reduce((best, ch) => (count(ch) > count(best) ? ch : best), ",");
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (inQuotes) {
      if (c === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"') inQuotes = true;
    else if (c === delim) {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else field += c;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const nonEmpty = rows.filter((r) => r.some((v) => v.trim() !== ""));
  if (nonEmpty.length === 0) return { headers: [], rows: [], raggedRows: 0 };

  const headers = nonEmpty[0]!.map((h, i) => (h.trim() === "" ? `column_${i + 1}` : h.trim()));
  let raggedRows = 0;
  const body = nonEmpty.slice(1).map((r) => {
    if (r.length !== headers.length) raggedRows++;
    const out = r.slice(0, headers.length).map((v) => v.trim());
    while (out.length < headers.length) out.push("");
    return out;
  });
  return { headers, rows: body, raggedRows };
}

export const MISSING_TOKENS = new Set(["", "na", "n/a", "nan", "null", "none", "?", "-"]);

export function isMissing(value: string): boolean {
  return MISSING_TOKENS.has(value.trim().toLowerCase());
}

export function toNumber(value: string): number | null {
  if (isMissing(value)) return null;
  const n = Number(value.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}
