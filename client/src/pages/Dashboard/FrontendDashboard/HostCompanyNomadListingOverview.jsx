import { useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "react-router-dom";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import NomadListingsOverview, {
  NomadListingsSkeleton,
} from "./NomadListingsOverview";
import PageFrame from "../../../components/Pages/PageFrame";

export default function HostCompanyNomadListingOverview() {
  const axios = useAxiosPrivate();
  const { companyId: companySlug } = useParams();
  const location = useLocation();
  const navState = location?.state || {};
  const companyId =
    navState.companyId || sessionStorage.getItem("companyId") || companySlug;

  const { data: linkMeta, isPending } = useQuery({
    queryKey: ["host-company-nomad-link", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const res = await axios.get(`/api/hosts/host-companies/${companyId}/nomad-link`);
      return res.data || {};
    },
  });

  if (isPending) {
    return (
      <div className="p-2 lg:p-2.5 min-h-full">
        <PageFrame>
          <NomadListingsSkeleton />
        </PageFrame>
      </div>
    );
  }

  // Explicitly linked via the Companies-side "Transfer" action, OR the host's
  // own request has already been approved into a real Companies entry — in
  // both cases the data is fully set up, nothing left to do here.
  const isExplicitlyLinked = !!linkMeta?.linkedNomadsCompanyId;
  const isAlreadyInCompanies = !!linkMeta?.alreadyInCompanies;

  // Falls back to the Host Company's own companyId — that's where the
  // Nomads listing actually lives if the host added it themselves and
  // hasn't been linked/approved into Companies yet.
  const effectiveCompanyId = linkMeta?.linkedNomadsCompanyId || linkMeta?.ownCompanyId;

  const statusLabel = isAlreadyInCompanies
    ? "Linked to Companies"
    : linkMeta?.companiesListingRequestedAt
      ? "Requested — pending review"
      : null;

  return (
    <div className="flex flex-col gap-3">
      {statusLabel && (
        <div className="text-xs font-pmedium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 w-fit">
          {statusLabel}
        </div>
      )}
      <NomadListingsOverview
        hideTransfer
        companyIdOverride={effectiveCompanyId}
        companyNameOverride={linkMeta?.companyName}
        showTransferToCompanyButton={
          !isAlreadyInCompanies && !!linkMeta?.companiesListingRequestedAt
        }
        transferToCompanyData={{
          companyId: linkMeta?.ownCompanyId,
          companyName: linkMeta?.companyName,
          companyCity: linkMeta?.companyCity,
          companyState: linkMeta?.companyState,
          companyCountry: linkMeta?.companyCountry,
          companyContinent: linkMeta?.companyContinent,
        }}
      />
    </div>
  );
}
