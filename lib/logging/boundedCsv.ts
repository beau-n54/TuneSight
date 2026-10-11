// Keep multipart source intake below Vercel's 4.5 MB request ceiling.
export const LOG_MAX_BYTES = 4 * 1024 * 1024;
export const LOG_MAX_ROWS = 100_000;
export const LOG_MAX_COLUMNS = 256;

function fields(line: string): string[] {
  const result: string[] = [];
  let current = "", quoted = false, closedQuote = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') { current += '"'; i++; }
      else if (quoted) { quoted = false; closedQuote = true; }
      else {
        if (closedQuote || current.trim() !== "") throw new Error("Misplaced CSV quote.");
        current = ""; quoted = true;
      }
    } else if (char === "," && !quoted) { result.push(current.trim()); current = ""; closedQuote = false; }
    else {
      if (closedQuote && char.trim() !== "") throw new Error("Unexpected content after CSV quote.");
      current += char;
    }
    if (result.length > LOG_MAX_COLUMNS) throw new Error("Too many log columns.");
  }
  if (quoted) throw new Error("Unterminated CSV field.");
  result.push(current.trim());
  return result;
}

export function parseBoundedLogCsv(text: string): { headers: string[]; rows: Record<string, unknown>[] } {
  if (new TextEncoder().encode(text).byteLength > LOG_MAX_BYTES || /\u0000/.test(text)) throw new Error("Invalid log size or content.");
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith("#"));
  if (lines.length < 2 || lines.length > LOG_MAX_ROWS + 1) throw new Error("Log row count is outside supported bounds.");
  const headers = fields(lines[0]);
  if (headers.length < 2 || headers.length > LOG_MAX_COLUMNS || headers.some(header => !header || header.length > 256) || new Set(headers.map(header => header.toLowerCase())).size !== headers.length) throw new Error("Ambiguous or invalid log headers.");
  const rows = lines.slice(1).map(line => {
    if (line.length > 64 * 1024) throw new Error("Log row is too large.");
    const values = fields(line);
    if (values.length !== headers.length) throw new Error("Log column count does not match headers.");
    return Object.fromEntries(headers.map((header, i) => {
      const raw = values[i];
      const value = raw === "" ? null : Number(raw);
      return [header, value !== null && Number.isFinite(value) ? value : null];
    }));
  });
  return { headers, rows };
}
