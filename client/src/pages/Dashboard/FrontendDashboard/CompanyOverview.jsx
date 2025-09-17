// src/pages/Dashboard/FrontendDashboard/CompanyOverview.jsx
import React from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";

const cards = [
  { title: "Website Builder", path: "website-builder" },
  { title: "Nomad Listing", path: "nomad-listings" },
  { title: "POC Details", path: "poc-details" },
];

const CompanyOverview = () => {
  const { companyId:companyName } = useParams();
  const navigate = useNavigate();
  const location = useLocation()
  const {companyId} = location?.state || ""

  return (
    <div className="p-6">
      <h1 className="text-title font-pmedium text-primary uppercase mb-6">
        Company Overview
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {cards.map((card) => (
          <div
            key={card.title}
            className="cursor-pointer border border-gray-200 rounded-2xl p-6 shadow hover:shadow-lg transition bg-white"
            onClick={() =>
              navigate(`/dashboard/companies/${companyName}/${card.path}`,{state:{companyId}})
            }>
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

export default CompanyOverview;
