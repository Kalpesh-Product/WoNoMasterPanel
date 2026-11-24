import { NOMADS_API_BASE_URL } from "../../../constants/api";

export const destinationReviewQueries = [
  ["eventReviews", "event-reviews"],
  ["placeReviews", "place-reviews"],
  ["restaurantReviews", "restaurantreviews"],
].map(([key, endpoint]) => ({
  queryKey: [key],
  staleTime: 30_000,
  queryFn: async ({ signal }) => {
    const response = await fetch(`${NOMADS_API_BASE_URL}/${endpoint}/all`, {
      cache: "no-cache",
      signal,
    });
    if (!response.ok) throw new Error(`Review request failed (${response.status})`);

    const payload = await response.json();
    const reviews = payload?.data ?? payload?.reviews ?? payload;
    if (!Array.isArray(reviews)) throw new Error("Unexpected review response");
    return reviews;
  },
}));
