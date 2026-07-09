import React from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";

const cards = [{ title: "Nomad Listing", path: "nomad-listing" }];

const CompaniesRequestOverview = () => {
  const { companyId: companySlug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    companyId,
    companyName,
    companyCity,
    companyState,
    companyCountry,
    companyContinent,
  } = location?.state || {};

  return (
    <div className="p-4 border-default border-borderGray rounded-xl">
      <h1 className="text-title font-pmedium text-primary uppercase mb-6">
        {companyName || "Request"} Overview
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {cards.map((card) => (
          <div
            key={card.title}
            className="cursor-pointer border border-gray-200 rounded-2xl p-6 shadow hover:shadow-lg transition bg-white"
            onClick={() =>
              navigate(`/dashboard/companies/requests/${companySlug}/${card.path}`, {
                state: {
                  companyId,
                  companyName,
                  companyCity,
                  companyState,
                  companyCountry,
                  companyContinent,
                },
              })
            }
          >
            <h2 className="text-subtitle font-pmedium text-gray-800">
              {card.title}
            </h2>
            <p className="text-sm font-pregular text-gray-500 mt-2">
              Go to {card.title} section
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CompaniesRequestOverview;
