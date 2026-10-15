/**
 * RFC-4180 CSV, shared by the pool scripts.
 *
 * These parse files that set and overwrite answer keys, so the edge cases are
 * not academic: a question containing a comma, an option containing a quote, a
 * cell Excel wrapped across two lines. Getting one wrong writes a wrong answer
 * into the pool, and a wrong answer key costs a player reputation they earned.
 * Hence the tests in __tests__/csv.test.ts.
 */

export function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function csvRow(cells: string[]): string {
  return cells.map(csvCell).join(",");
}

export function toCsv(header: string[], rows: string[][]): string {
  return [csvRow(header), ...rows.map(csvRow)].join("\n") + "\n";
}

/** Parses CSV, including quoted fields containing commas, quotes and newlines. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  // A UTF-8 BOM is what Excel writes by default, and it would otherwise become
  // part of the first header name.
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < src.length; i++) {
    const c = src[i];

    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else if (c === "\r" && src[i + 1] === "\n") {
        // Excel writes an embedded newline as CRLF. Keeping the \r would leave
        // it inside the value, and a value with a trailing \r matches nothing.
        cell += "\n";
        i++;
      } else {
        cell += c;
      }
      continue;
    }

    if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (c !== "\r") {
      cell += c;
    }
  }

  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/**
 * Index the header so columns can be addressed by name.
 *
 * Column order is whatever the spreadsheet ended up with after someone moved
 * things around, so nothing here may depend on position.
 */
export function headerIndex(header: string[]): Map<string, number> {
  const map = new Map<string, number>();
  header.forEach((name, i) => {
    const key = name.trim().toLowerCase();
    if (key && !map.has(key)) map.set(key, i);
  });
  return map;
}

export function requireColumns(
  index: Map<string, number>,
  names: string[],
): string[] {
  return names.filter((n) => !index.has(n));
}
