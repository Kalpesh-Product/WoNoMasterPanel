export const DESTINATIONS_DATA_BASE_PATH = "/dashboard/destinations-data";
export const DESTINATION_SUMMARY_PAGE_SIZE = 25;

export const destinationSummaryQueryOptions = (
  axios,
  tab,
  { search = "", continent = "", country = "", state = "" } = {},
) => ({
  queryKey: ["destinations-data-summary", tab, search, continent, country, state],
  initialPageParam: 1,
  staleTime: (query) => query.state.data?.pages[0]?.isRefreshing ? 0 : 30_000,
  refetchInterval: (query) => {
    const firstPage = query.state.data?.pages[0];
    if (!firstPage?.isRefreshing) return false;
    return firstPage.isInitialLoading ? 1000 : 5000;
  },
  queryFn: async ({ pageParam, signal }) => {
    const response = await axios.get("/api/hosts/destinations-data", {
      signal,
      params: {
        page: pageParam,
        limit: DESTINATION_SUMMARY_PAGE_SIZE,
        tab,
        search,
        continent,
        country,
        state,
      },
    });
    return response.data;
  },
  getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.page + 1 : undefined,
});
