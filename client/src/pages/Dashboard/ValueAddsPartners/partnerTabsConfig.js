import axios from "axios";
import { NOMADS_BACKEND_URL } from "../../../constants/api";

// Shared config so the visible tab and the background prefetch use the same
// React Query cache entry (and therefore never fetch the same pool twice).
export const PARTNER_TABS = [
  { key: "visa-support", endpoint: "/api/visa-support/partners" },
  { key: "activation-support", endpoint: "/api/activation-support/partners" },
  { key: "company-setup", endpoint: "/api/company-setup-support/partners" },
  { key: "consultation", endpoint: "/api/consultation-support/partners" },
  { key: "workation", endpoint: "/api/workation-support/partners" },
];

export const partnerQueryKey = (key) => ["valueAddsPartners", key];

export const partnerQueryOptions = (key) => {
  const endpoint = PARTNER_TABS.find((tab) => tab.key === key)?.endpoint;

  return {
    queryKey: partnerQueryKey(key),
    queryFn: async () => {
      const response = await axios.get(`${NOMADS_BACKEND_URL}${endpoint}`, {
        timeout: 30000,
      });
      return response?.data?.data || [];
    },
    retry: false,
    // Cached pools can be reused when switching tabs; status toggles
    // invalidate the query explicitly.
    staleTime: 60 * 1000,
  };
};
