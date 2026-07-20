import { MdOutlineContactPhone, MdOutlineRateReview } from "react-icons/md";
import { RiHotelLine } from "react-icons/ri";
import { useLocation, useParams } from "react-router-dom";
import Card from "../../../../components/Card";
import PageFrame from "../../../../components/Pages/PageFrame";

const WonoNomadsHome = () => {
  const location = useLocation();
  const { companyId } = useParams();
  const isHostCompany = location.pathname.includes("/host-companies/");
  const listingsRoute = isHostCompany
    ? `/dashboard/host-companies/${companyId}/nomad-listing`
    : `/dashboard/companies/${companyId}/nomad-listings`;

  return (
    <div className="p-4 flex flex-col gap-4">
      <PageFrame>
        <div className="flex flex-col gap-5">
          <h2 className="text-title font-pmedium text-primary uppercase">
            Wono Nomads
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card
              icon={<RiHotelLine />}
              title="Nomad Listings"
              route={listingsRoute}
            />
            <Card
              icon={<MdOutlineRateReview />}
              title="Nomad Reviews"
              route="nomad-reviews"
            />
            <Card
              icon={<MdOutlineContactPhone />}
              title="Nomads Leads"
              route="nomads-leads"
            />
          </div>
        </div>
      </PageFrame>
    </div>
  );
};

export default WonoNomadsHome;
