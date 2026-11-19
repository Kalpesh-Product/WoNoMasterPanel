import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_PAGE_SIZE = 25;

/**
 * Reveals an in-memory list in small batches as the user scrolls.
 * The data itself is already fetched (and cached) in the background, so even
 * large partner pools paint only a handful of rows on the first render.
 */
const useLazyRows = (rows = [], pageSize = DEFAULT_PAGE_SIZE) => {
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const loadMoreRef = useRef(null);

  // New data set (or a new search/filter result) starts from the first batch.
  useEffect(() => {
    setVisibleCount(pageSize);
  }, [rows, pageSize]);

  const visibleRows = useMemo(
    () => rows.slice(0, visibleCount),
    [rows, visibleCount],
  );
  const hasMore = visibleCount < rows.length;

  const loadMore = useCallback(() => {
    setVisibleCount((current) => Math.min(current + pageSize, rows.length));
  }, [pageSize, rows.length]);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !hasMore || typeof IntersectionObserver === "undefined") {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: "250px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadMore, visibleCount]);

  return { visibleRows, hasMore, loadMore, loadMoreRef };
};

export default useLazyRows;
