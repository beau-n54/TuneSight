export const LIST_PAGE_SIZE = 50;
export const LIST_MAX_PAGE = 999;
export function listPage(value: unknown): number {
  return typeof value === "string" && /^\d{1,3}$/.test(value) ? Math.min(Number(value), LIST_MAX_PAGE) : 0;
}
