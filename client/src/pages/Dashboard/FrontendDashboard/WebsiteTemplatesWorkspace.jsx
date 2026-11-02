import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import PageFrame from "../../../components/Pages/PageFrame";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import ThemeStoreCatalog from "./ThemeStoreCatalog";
import WebsiteTemplateRequests from "./WebsiteTemplateRequests";

const WebsiteTemplatesWorkspace = () => {
  const axiosPrivate = useAxiosPrivate();
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get("view") === "catalog" ? "catalog" : "requests";

  const requestsQuery = useQuery({
    queryKey: ["website-template-change-requests"],
    queryFn: async () => {
      const response = await axiosPrivate.get("/api/website-template-changes/requests");
      return Array.isArray(response.data) ? response.data : [];
    },
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
    enabled: view === "requests",
  });

  const catalogQuery = useQuery({
    queryKey: ["website-theme-catalog"],
    queryFn: async () => {
      const response = await axiosPrivate.get("/api/website-theme-catalog");
      return Array.isArray(response.data) ? response.data : [];
    },
    enabled: view === "catalog",
  });

  const counts = useMemo(() => {
    const requests = requestsQuery.data || [];
    return {
      total: requests.length,
      pending: requests.filter((request) => request.status === "pending").length,
      approved: requests.filter((request) => request.status === "approved").length,
      completed: requests.filter((request) => request.status === "completed").length,
    };
  }, [requestsQuery.data]);

  const catalogStats = useMemo(() => {
    const themes = catalogQuery.data || [];
    const verticalLabel = {
      cafe: "Cafe Themes",
      hostel: "Hostel Themes",
      "co-living": "Co-Living Themes",
      "co-working": "Co-Working Themes",
      "meeting-rooms": "Meeting Room Themes",
    };
    const verticalStyles = [
      ["border-l-sky-500", "text-sky-600"],
      ["border-l-indigo-500", "text-indigo-600"],
      ["border-l-violet-500", "text-violet-600"],
      ["border-l-cyan-500", "text-cyan-600"],
      ["border-l-fuchsia-500", "text-fuchsia-600"],
    ];
    const verticals = [...new Set(themes.map((theme) => theme.vertical).filter(Boolean))];
    const preferredOrder = ["cafe", "hostel", "co-living", "co-working", "meeting-rooms"];
    verticals.sort((left, right) => {
      const leftIndex = preferredOrder.indexOf(left);
      const rightIndex = preferredOrder.indexOf(right);
      if (leftIndex === -1 && rightIndex === -1) return left.localeCompare(right);
      if (leftIndex === -1) return 1;
      if (rightIndex === -1) return -1;
      return leftIndex - rightIndex;
    });

    return [
      ["Total Themes", themes.length, "border-l-slate-400", "text-slate-500"],
      ["Live Themes", themes.filter((theme) => theme.status === "live").length, "border-l-emerald-500", "text-emerald-600"],
      ["Coming Soon", themes.filter((theme) => theme.status === "coming-soon").length, "border-l-amber-500", "text-amber-600"],
      ...verticals.map((vertical, index) => [
        verticalLabel[vertical] || `${vertical.replace(/-/g, " ")} Themes`,
        themes.filter((theme) => theme.vertical === vertical).length,
        verticalStyles[index % verticalStyles.length][0],
        verticalStyles[index % verticalStyles.length][1],
      ]),
    ];
  }, [catalogQuery.data]);

  const requestStats = [
    ["Total Requests", counts.total, "border-l-slate-400", "text-slate-500"],
    ["Pending", counts.pending, "border-l-amber-500", "text-amber-600"],
    ["Approved", counts.approved, "border-l-blue-500", "text-blue-600"],
    ["Completed", counts.completed, "border-l-emerald-500", "text-emerald-600"],
  ];
  const activeStats = view === "catalog" ? catalogStats : requestStats;
  const statsLoading = view === "catalog" ? catalogQuery.isLoading : requestsQuery.isLoading;

  return (
    <PageFrame>
      <div className="flex flex-col gap-4">
        <div className="mb-1">
          <h2 className="text-title font-pmedium uppercase text-primary">Website Templates</h2>
          <p className="mt-1 text-xs font-pmedium text-slate-500">Review template changes and manage the public Theme Store catalog.</p>
        </div>

        <div role="tablist" aria-label="Website template workspace" className="flex flex-wrap gap-1.5 rounded-2xl border border-slate-100 bg-white p-1 shadow-sm">
          {[
            { id: "requests", label: "CHANGE REQUESTS" },
            { id: "catalog", label: "THEME STORE CATALOG" },
          ].map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={view === id}
              onClick={() => setSearchParams(id === "catalog" ? { view: "catalog" } : {})}
              className={`flex-1 rounded-xl px-4 py-2 text-center text-[10px] font-pmedium uppercase tracking-widest transition-all ${view === id ? "bg-[#2563EB] text-white shadow-sm" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div data-tour="website-templates-stats" className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {activeStats.map(([label, value, border, color]) => (
            <div key={label} className={`rounded-[2rem] border border-slate-100 border-l-4 bg-white p-5 shadow-sm ${border}`}>
              <p className={`mb-1 text-[10px] font-pmedium uppercase tracking-widest ${color}`}>{label}</p>
              <p className="text-[15px] font-pmedium text-slate-900">{statsLoading ? "—" : value}</p>
            </div>
          ))}
        </div>

        <div>
          {view === "catalog" ? <ThemeStoreCatalog embedded /> : <WebsiteTemplateRequests embedded />}
        </div>
      </div>
    </PageFrame>
  );
};

export default WebsiteTemplatesWorkspace;
