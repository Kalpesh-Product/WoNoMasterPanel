import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, FileSpreadsheet } from "lucide-react";
import useAxiosPrivate from "../../../../hooks/useAxiosPrivate";

const formatUploadedAt = (value) => {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const RecentUploadHistory = ({
  title,
  description,
  items = [],
  isLoading = false,
  emptyMessage = "No uploads found.",
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition hover:bg-slate-50/70"
      >
        <div>
          <h4 className="text-xs font-pmedium text-slate-700">{title}</h4>
          {description && <p className="mt-1 text-[10px] font-pmedium text-slate-400">{description}</p>}
        </div>
        <span className="inline-flex shrink-0 items-center gap-2 text-[10px] font-pmedium uppercase tracking-widest text-[#2563EB]">
          {isOpen ? "Hide" : "View"}
          <ChevronDown size={15} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </span>
      </button>

      {isOpen && (
        <div className="border-t border-slate-100">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-12 animate-pulse rounded-xl bg-slate-100" />)}
            </div>
          ) : items.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left">
                <thead className="bg-slate-50 text-[10px] font-pmedium uppercase tracking-widest text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Record</th>
                    <th className="px-4 py-3">Uploaded sheet</th>
                    <th className="px-4 py-3">Details</th>
                    <th className="px-4 py-3 text-right">Uploaded</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => (
                    <tr key={item.id} className="transition hover:bg-blue-50/30">
                      <td className="px-4 py-3.5 text-xs font-pmedium text-slate-900">{item.label}</td>
                      <td className="max-w-[280px] px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet size={15} className="shrink-0 text-emerald-600" />
                          <span className={`truncate text-xs font-pmedium ${item.fileName ? "text-slate-700" : "text-slate-400"}`} title={item.fileName || "Uploaded before sheet-name tracking was added"}>
                            {item.fileName || "Not recorded (older upload)"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-[10px] font-pmedium text-slate-500">{item.details || "—"}</td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right text-[10px] font-pmedium text-slate-500">{formatUploadedAt(item.uploadedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-4 py-8 text-center text-xs font-pmedium text-slate-400">{emptyMessage}</p>
          )}
        </div>
      )}
    </section>
  );
};

export const AuditRecentUploadHistory = ({ action, title, description }) => {
  const axios = useAxiosPrivate();
  const { data, isPending } = useQuery({
    queryKey: ["recent-data-uploads", action],
    queryFn: async () => {
      const response = await axios.get("/api/logs/data-upload-analytics", { params: { action } });
      return response.data;
    },
  });

  const items = useMemo(() => (data?.recentUploads || [])
    .filter((upload) => !upload.dryRun && upload.success && upload.applied !== false)
    .slice(0, 25)
    .map((upload) => ({
      id: upload.id,
      label: upload.destination || upload.tab,
      fileName: upload.files?.[0] || "",
      details: [
        upload.imported ? `${upload.imported} businesses` : "",
        upload.fullName ? `Uploaded by ${upload.fullName}` : "Committed upload",
      ].filter(Boolean).join(" · "),
      uploadedAt: upload.createdAt,
    })), [data]);

  return (
    <RecentUploadHistory
      title={title}
      description={description}
      items={items}
      isLoading={isPending}
      emptyMessage="No committed uploads found yet."
    />
  );
};

export default RecentUploadHistory;
