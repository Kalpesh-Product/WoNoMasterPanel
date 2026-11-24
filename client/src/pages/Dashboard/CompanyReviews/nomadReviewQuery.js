const PAGE_SIZE = 25;

export const DEFAULT_COMPANY_REVIEWS_PATH = "/dashboard/company-reviews";
export const NOMAD_LISTING_REVIEWS_PATH = `${DEFAULT_COMPANY_REVIEWS_PATH}/nomad-listing-reviews`;

export const nomadReviewQueryOptions = (axiosPrivate, userId, status = "all", search = "") => ({
  queryKey: ["companyReviews", "all-nomad-listings", userId, status, search],
  initialPageParam: 1,
  staleTime: 30_000,
  queryFn: async ({ pageParam, signal }) => {
    const { data } = await axiosPrivate.get("/api/admin/reviews", {
      signal,
      params: {
        reviewScope: "nomads",
        allCompanies: true,
        page: pageParam,
        limit: PAGE_SIZE,
        ...(status !== "all" ? { status } : {}),
        ...(search ? { search } : {}),
      },
      headers: { "Cache-Control": "no-cache" },
    });
    const reviews = data?.reviews ?? data?.data?.reviews ?? data?.data ?? data;
    const pagination = data?.pagination ?? {};
    const reviewIds = new Set();
    const pageReviews = Array.isArray(reviews) ? reviews.slice(0, PAGE_SIZE) : [];
    const uniqueReviews = pageReviews.filter((review) => {
      const id = review?._id || review?.id;
      if (!id) return true;
      if (reviewIds.has(id)) return false;
      reviewIds.add(id);
      return true;
    });

    return {
      reviews: uniqueReviews,
      page: Number(pagination.page || pageParam),
      total: Number(pagination.total || 0),
      hasNextPage: Boolean(pagination.hasNextPage),
    };
  },
  getNextPageParam: (lastPage) => lastPage.hasNextPage ? lastPage.page + 1 : undefined,
});
