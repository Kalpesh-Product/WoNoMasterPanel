import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import useAxiosPrivate from "../../../../hooks/useAxiosPrivate";
import WebsiteBuilderReviews from "../WebsiteBuilder/WebsiteBuilderReviews";

const NomadReviews = () => {
  const axios = useAxiosPrivate();
  const location = useLocation();
  const isHostCompany = location.pathname.includes("/host-companies/");
  const nativeCompanyId = sessionStorage.getItem("companyId") || "";

  const { data: linkMeta, isPending } = useQuery({
    queryKey: ["nomad-review-company-link", isHostCompany, nativeCompanyId],
    enabled: !!nativeCompanyId,
    retry: false,
    queryFn: async () => {
      const endpoint = isHostCompany
        ? `/api/hosts/host-companies/${nativeCompanyId}/nomad-link`
        : `/api/hosts/companies/${nativeCompanyId}/nomad-source`;
      const response = await axios.get(endpoint);
      return response.data || {};
    },
  });

  if (isPending && nativeCompanyId) {
    return (
      <div className="p-2 lg:p-2.5 animate-pulse">
        <div className="h-6 w-48 bg-slate-100 rounded-xl mb-4" />
        <div className="h-4 w-80 bg-slate-100 rounded-xl mb-6" />
        <div className="h-80 rounded-2xl border border-slate-100 bg-white" />
      </div>
    );
  }

  const effectiveCompanyId = isHostCompany
    ? linkMeta?.linkedNomadsCompanyId || linkMeta?.ownCompanyId || nativeCompanyId
    : linkMeta?.effectiveNomadsCompanyId || nativeCompanyId;

  return (
    <WebsiteBuilderReviews
      reviewScope="nomads"
      pageTitle="Nomads Reviews"
      pageDescription="Visitor-submitted and Google Maps reviews for the company's nomad listings."
      queryKeyPrefix="nomadReviews"
      companyIdOverride={effectiveCompanyId}
    />
  );
};

export default NomadReviews;
