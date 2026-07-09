import { useLocation, useParams } from "react-router-dom";
import NomadListingsOverview from "./NomadListingsOverview";

// Lets staff preview a pending request's already-existing Nomads listing(s)
// before deciding whether to create a matching Companies entry. The
// companyId here IS the Host Company's own id directly (no Companies-side
// entry exists yet for a pending request), so no nomad-source resolution is
// needed — pass it straight through as an override.
export default function CompaniesRequestNomadListing() {
  const { companyId: routeCompanyId } = useParams();
  const location = useLocation();
  const navState = location?.state || {};
  const companyId = navState.companyId || routeCompanyId;
  const companyName = navState.companyName || "";

  return (
    <NomadListingsOverview
      hideTransfer
      companyIdOverride={companyId}
      companyNameOverride={companyName}
      showTransferToCompanyButton
      transferToCompanyData={{
        companyId,
        companyName,
        companyCity: navState.companyCity,
        companyState: navState.companyState,
        companyCountry: navState.companyCountry,
        companyContinent: navState.companyContinent,
      }}
    />
  );
}
