import React from "react";
import PageFrame from "../../../components/Pages/PageFrame";

const PocDetails = () => {
  return (
    <div className="p-4">
      <PageFrame>
        <div className="flex items-center justify-between pb-4">
          <span className="text-title font-pmedium text-primary uppercase">
            POC Details
          </span>
        </div>

        <div className="bg-white rounded-2xl shadow p-6">
          <p className="text-sm font-pregular text-gray-600">
            This section will contain company-specific POC onboarding details.
          </p>
        </div>
      </PageFrame>
    </div>
  );
};

export default PocDetails;
