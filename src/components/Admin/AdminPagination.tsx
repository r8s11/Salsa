import { ChevronLeft, ChevronRight } from "lucide-react";
import { PAGE_SIZE_OPTIONS } from "../../features/admin/model/eventsQuery";
import "./AdminPagination.css";

interface AdminPaginationProps {
  page: number;
  pageCount: number;
  total: number;
  from: number;
  to: number;
  size: number;
  onPageChange: (page: number) => void;
  onSizeChange: (size: number) => void;
}

// Always shows first and last; the active page plus one neighbour either
// side; each remaining gap collapses to a single non-interactive "…".
// Never renders more than 7 page buttons.
function pageWindow(page: number, pageCount: number): (number | "ellipsis")[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, pageCount, page, page - 1, page + 1]);
  const sorted = Array.from(pages)
    .filter((value) => value >= 1 && value <= pageCount)
    .sort((a, b) => a - b);

  const result: (number | "ellipsis")[] = [];
  sorted.forEach((value, index) => {
    if (index > 0 && value - sorted[index - 1] > 1) {
      result.push("ellipsis");
    }
    result.push(value);
  });
  return result;
}

export default function AdminPagination({
  page,
  pageCount,
  total,
  from,
  to,
  size,
  onPageChange,
  onSizeChange,
}: AdminPaginationProps) {
  return (
    <nav className="admin-pagination" aria-label="Pagination">
      <p className="admin-pagination__summary">
        Showing {from}–{to} of {total}
      </p>

      <div className="admin-pagination__controls">
        <label className="admin-pagination__size">
          Rows per page:
          <select
            className="admin-select"
            value={size}
            onChange={(event) => onSizeChange(Number(event.target.value))}
          >
            {PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="admin-icon-btn"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          <ChevronLeft size={18} />
        </button>

        {pageCount > 1 &&
          pageWindow(page, pageCount).map((entry, index) =>
            entry === "ellipsis" ? (
              <span
                key={`ellipsis-${index}`}
                className="admin-pagination__ellipsis"
                aria-hidden="true"
              >
                …
              </span>
            ) : (
              <button
                key={entry}
                type="button"
                className={
                  entry === page
                    ? "admin-pagination__page-btn admin-pagination__page-btn--active"
                    : "admin-pagination__page-btn"
                }
                aria-current={entry === page ? "page" : undefined}
                onClick={() => onPageChange(entry)}
              >
                {entry}
              </button>
            )
          )}

        <button
          type="button"
          className="admin-icon-btn"
          aria-label="Next page"
          disabled={page >= pageCount}
          onClick={() => onPageChange(Math.min(pageCount, page + 1))}
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </nav>
  );
}
