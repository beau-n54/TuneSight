import Link from "next/link";
import { LIST_MAX_PAGE } from "@/lib/security/listBounds";
export default function ListPagination({ path, page, hasMore }: { path: string; page: number; hasMore: boolean }) {
  return <nav aria-label="List pages" className="my-4 flex items-center gap-4 text-sm">
    {page > 0 && <Link className="underline" href={`${path}?page=${page-1}`}>Previous</Link>}
    <span>Page {page+1} · up to 50 records</span>
    {hasMore && page < LIST_MAX_PAGE && <Link className="underline" href={`${path}?page=${page+1}`}>Next</Link>}
  </nav>;
}
