// src/pages/Dashboard/FrontendDashboard/CompanyOverview.jsx
import React from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import PageFrame from "../../../components/Pages/PageFrame";
import { statusPillClass } from "../../../lib/status-pill";

const cards = [
  { title: "Website Builder", path: "website-builder" },
  { title: "Wono Nomads", path: "wono-nomads" },
  { title: "Nomad Listings", path: "nomad-listings" },
  { title: "POC Details", path: "poc-details" },
];

const CompanyOverview = () => {
  const { companyId: companySlug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const navState = location?.state || {};

  const companyNameFromSession = String(sessionStorage.getItem("companyName") || "").trim();
  const companyName = String(navState.companyName || companyNameFromSession || companySlug || "Company")
    .replace(/-/g, " ")
    .trim();
  const companyId = navState.companyId || sessionStorage.getItem("companyId") || "";

  return (
    <div className="p-2 lg:p-2.5 min-h-full text-[#0F172A] font-sans text-[12px]">
      <PageFrame>
        <div className="flex flex-col gap-4">
          <div className="mb-1 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-pmedium uppercase tracking-[0.24em] text-gray-500">
                Company Hub
              </p>
              <h1 className="mt-2 text-4xl font-pmedium uppercase tracking-tight text-primary">
                {companyName} Overview
              </h1>
              <p className="mt-3 max-w-3xl text-content text-gray-600">
                Open the company’s nested modules from one place.
              </p>
            </div>
            <span className={statusPillClass(companyId ? "Active" : "Pending")}>
              {companyId ? "Company Selected" : "Selection Missing"}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {cards.map((card) => (
              <div
                key={card.title}
                className="cursor-pointer rounded-[1.75rem] border border-slate-100 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                onClick={() =>
                  navigate(`/dashboard/companies/${companySlug}/${card.path}`, {
                    state: { companyId, companyName: navState.companyName || companyName },
                  })
                }
              >
                <p className="text-[10px] font-pmedium uppercase tracking-[0.24em] text-slate-400">
                  Module
                </p>
                <h2 className="mt-3 text-subtitle font-pmedium text-slate-900">
                  {card.title}
                </h2>
                <p className="mt-2 text-sm font-pregular text-slate-500">
                  Go to {card.title} section
                </p>
              </div>
            ))}
          </div>
        </div>
      </PageFrame>
    </div>
  );
};

export default CompanyOverview;
