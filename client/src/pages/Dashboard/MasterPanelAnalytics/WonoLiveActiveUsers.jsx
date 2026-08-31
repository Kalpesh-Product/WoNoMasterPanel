import { useQuery } from "@tanstack/react-query";
import { Radio, Globe2, FileText } from "lucide-react";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";

// GA4's realtime API itself only refreshes every ~30-60s, so polling this
// endpoint faster than that just re-fetches the same numbers.
const POLL_INTERVAL_MS = 30000;

const RankedList = ({ icon: Icon, title, items }) => (
  <div className="flex-1 min-w-[200px]">
    <p className="flex items-center gap-1.5 text-[10px] font-pmedium uppercase tracking-widest text-slate-400 mb-2">
      <Icon size={12} /> {title}
    </p>
    {items.length === 0 ? (
      <p className="text-[11px] font-pmedium text-slate-400">No active visitors right now.</p>
    ) : (
      <div className="flex flex-col gap-1.5">
        {items.slice(0, 5).map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-2">
            <span className="truncate text-[11px] font-pmedium text-slate-600">
              {item.label}
            </span>
            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-pmedium text-slate-500">
              {item.value}
            </span>
          </div>
        ))}
      </div>
    )}
  </div>
);

const WonoLiveActiveUsers = () => {
  const axiosPrivate = useAxiosPrivate();

  const { data, isPending, isError } = useQuery({
    queryKey: ["wonoRealtimeActiveUsers"],
    queryFn: async () => {
      const response = await axiosPrivate.get(
        "/api/site-analytics/wono/realtime-active-users",
      );
      return response.data;
    },
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: true,
  });

  return (
    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-3 px-5 py-4 bg-slate-50/50 border-b border-slate-100">
        <span className="flex items-center gap-3 min-w-0">
          <span className="relative p-2 rounded-xl bg-emerald-600 text-white shrink-0 shadow-sm shadow-emerald-200">
            <Radio size={16} />
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-pmedium text-slate-900 uppercase tracking-wide">
              wono.co — Live Right Now
            </span>
            <span className="block text-xs font-pmedium text-slate-500 mt-0.5">
              Active visitors on the site, via Google Analytics realtime data.
            </span>
          </span>
        </span>
        <div className="text-right shrink-0">
          {isError ? (
            <span className="text-[11px] font-pmedium text-red-500">
              Failed to load realtime analytics.
            </span>
          ) : (
            <>
              <span className="block text-2xl font-pmedium text-slate-900 leading-none">
                {isPending ? "—" : data?.activeUsers ?? 0}
              </span>
              <span className="block text-[10px] font-pmedium uppercase tracking-widest text-slate-400 mt-1">
                active users
              </span>
            </>
          )}
        </div>
      </div>

      {!isError && !isPending && (
        <div className="flex flex-wrap gap-6 px-5 py-4">
          <RankedList icon={Globe2} title="By Country" items={data?.byCountry || []} />
          <RankedList icon={FileText} title="By Page" items={data?.byPage || []} />
        </div>
      )}
    </section>
  );
};

export default WonoLiveActiveUsers;
