import React from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";

const cards = [
    { title: "Upgrade Plan", path: "upgrade-plan" },
    { title: "Module Access", path: "module-access" },
    // { title: "Website Credit Requests", path: "website-credit-requests" },
];

const HostCompanyOverview = () => {
    const { companyId: companySlug } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { companyId, companyName, selectedPlan, requestedPlan } = location?.state || {};
    const storedCompanyName = String(sessionStorage.getItem("companyName") || "").trim();
    const pageTitle = String(companyName || companySlug || "Host Company")
        .replace(/-/g, " ")
        .trim();
    const finalPageTitle = String(companyName || storedCompanyName || pageTitle || "Host Company")
        .replace(/-/g, " ")
        .trim();

    return (
        <div className="p-4 border-default border-borderGray rounded-xl">
            <h1 className="text-title font-pmedium text-primary uppercase mb-6">
                {finalPageTitle} Overview
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {cards.map((card) => (
                    <div
                        key={card.title}
                        className="cursor-pointer border border-gray-200 rounded-2xl p-6 shadow hover:shadow-lg transition bg-white"
                        onClick={() =>
                            navigate(`/dashboard/host-companies/${companySlug}/${card.path}`, {
                                state: { companyId, companyName, selectedPlan, requestedPlan },
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

export default HostCompanyOverview;
