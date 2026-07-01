export function extractPrintableStringsFromBuffer(
  buffer: Buffer,
  minLength = 4
): string[] {
  const strings: string[] = [];
  let current = "";

  for (const byte of buffer) {
    if (byte >= 32 && byte <= 126) {
      current += String.fromCharCode(byte);
    } else {
      if (current.length >= minLength) {
        strings.push(current);
      }
      current = "";
    }
  }

  if (current.length >= minLength) {
    strings.push(current);
  }

  return Array.from(new Set(strings)).slice(0, 5000);
}