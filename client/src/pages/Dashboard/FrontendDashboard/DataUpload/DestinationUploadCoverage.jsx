import React from "react";

const DestinationUploadCoverage = ({ total, uploaded, isLoading }) => {
  const safeTotal = Math.max(total || 0, 0);
  const safeUploaded = Math.min(Math.max(uploaded || 0, 0), safeTotal);
  const remaining = Math.max(safeTotal - safeUploaded, 0);
  const percentage = safeTotal ? Math.round((safeUploaded / safeTotal) * 100) : 0;

  return (
    <div className="mb-4 border-b border-slate-100 pb-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-pmedium uppercase tracking-widest text-slate-400">
            Destination upload coverage
          </p>
          <p className="mt-1 text-sm font-pmedium text-slate-900">
            {isLoading ? "Loading destination progress..." : `${safeUploaded} of ${safeTotal} destinations uploaded`}
          </p>
        </div>
        {!isLoading && (
          <p className="text-[10px] font-pmedium text-slate-500">
            {remaining} remaining · {percentage}% complete
          </p>
        )}
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-emerald-600 transition-[width] duration-300"
          style={{ width: `${isLoading ? 0 : percentage}%` }}
        />
      </div>
    </div>
  );
};

export default DestinationUploadCoverage;
