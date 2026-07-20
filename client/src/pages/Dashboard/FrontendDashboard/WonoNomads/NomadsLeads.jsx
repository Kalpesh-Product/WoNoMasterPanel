import { useQuery } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import { useLocation } from "react-router-dom";
import useAxiosPrivate from "../../../../hooks/useAxiosPrivate";
import CompanyLeads from "../CompanyLeads";

const NomadsLeads = () => {
  const axios = useAxiosPrivate();
  const location = useLocation();
  const selectedCompany = useSelector((state) => state.company.selectedCompany);
  const isHostCompany = location.pathname.includes("/host-companies/");
  const nativeCompanyId =
    selectedCompany?.companyId || sessionStorage.getItem("companyId") || "";

  const { data: linkMeta, isPending } = useQuery({
    queryKey: ["nomad-lead-company-link", isHostCompany, nativeCompanyId],
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
    <CompanyLeads
      leadScope="nomads"
      pageTitle="Nomads Leads"
      pageDescription="Enquiries received from the company's listings on Wono Nomads."
      queryKeyPrefix="nomadsLeads"
      companyIdOverride={effectiveCompanyId}
    />
  );
};

export default NomadsLeads;
