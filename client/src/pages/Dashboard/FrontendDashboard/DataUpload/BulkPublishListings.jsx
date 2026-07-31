import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Globe, EyeOff, X } from "lucide-react";
import PageFrame from "../../../../components/Pages/PageFrame";
import useAxiosPrivate from "../../../../hooks/useAxiosPrivate";

const selectClassName =
  "w-full px-3 py-2.5 bg-white border border-slate-200/60 rounded-lg text-[12px] font-pmedium text-[#0F172A] focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] outline-none transition-all disabled:bg-slate-50 disabled:text-slate-400";

const BulkPublishListings = () => {
  const axiosPrivate = useAxiosPrivate();
  const queryClient = useQueryClient();

  const [country, setCountry] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [confirmAction, setConfirmAction] = useState(null); // "public" | "private" | null

  const { data: tree = [], isLoading } = useQuery({
    queryKey: ["public-location-tree"],
    queryFn: async () => {
      const response = await axiosPrivate.get("/api/hosts/public-location-tree");
      return Array.isArray(response.data) ? response.data : [];
    },
  });

  const countryOptions = useMemo(
    () => tree.map((c) => c.country).sort(),
    [tree],
  );

  const stateOptions = useMemo(() => {
    const match = tree.find((c) => c.country === country);
    return (match?.states || []).map((s) => s.state).sort();
  }, [tree, country]);

  const cityOptions = useMemo(() => {
    const countryMatch = tree.find((c) => c.country === country);
    const stateMatch = countryMatch?.states?.find((s) => s.state === state);
    return (stateMatch?.cities || []).map((c) => c.city).sort();
  }, [tree, country, state]);

  const summary = useMemo(() => {
    const countryMatch = tree.find((c) => c.country === country);
    if (!countryMatch) return null;

    let cities = [];
    if (state) {
      const stateMatch = countryMatch.states.find((s) => s.state === state);
      if (!stateMatch) return null;
      cities = city
        ? stateMatch.cities.filter((c) => c.city === city)
        : stateMatch.cities;
    } else {
      cities = countryMatch.states.flatMap((s) => s.cities);
    }

    return cities.reduce(
      (acc, c) => ({
        total: acc.total + c.total,
        active: acc.active + c.active,
        public: acc.public + c.public,
      }),
      { total: 0, active: 0, public: 0 },
    );
  }, [tree, country, state, city]);

  const handleCountryChange = (value) => {
    setCountry(value);
    setState("");
    setCity("");
  };

  const handleStateChange = (value) => {
    setState(value);
    setCity("");
  };

  const { mutate: bulkSetPublic, isPending } = useMutation({
    mutationFn: async (isPublic) => {
      const response = await axiosPrivate.patch(
        "/api/hosts/bulk-set-public-status",
        { country, state, city: city || undefined, isPublic },
      );
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data?.message || "Listings updated");
      queryClient.invalidateQueries({ queryKey: ["public-location-tree"] });
      setConfirmAction(null);
    },
    onError: (error) => {
      toast.error(
        error?.response?.data?.message || "Failed to update listings",
      );
      setConfirmAction(null);
    },
  });

  const canSubmit = Boolean(country && state) && !isPending;
  const locationLabel = [country, state, city].filter(Boolean).join(" > ");

  return (
    <div className="min-h-full text-[#0F172A] font-sans text-[12px]">
      <PageFrame>
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-title font-pmedium text-primary uppercase">
              Bulk Publish Listings
            </h2>
            <p className="text-xs font-pmedium text-slate-500 mt-1">
              Select a country and state (city optional) to make every
              matching listing public or private in one action.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest">
                Country
              </label>
              <select
                className={selectClassName}
                value={country}
                disabled={isLoading}
                onChange={(e) => handleCountryChange(e.target.value)}
              >
                <option value="">Select country</option>
                {countryOptions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest">
                State
              </label>
              <select
                className={selectClassName}
                value={state}
                disabled={!country}
                onChange={(e) => handleStateChange(e.target.value)}
              >
                <option value="">Select state</option>
                {stateOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest">
                City (optional)
              </label>
              <select
                className={selectClassName}
                value={city}
                disabled={!state}
                onChange={(e) => setCity(e.target.value)}
              >
                <option value="">All cities</option>
                {cityOptions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {country && state && (
            <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex gap-6">
                <div>
                  <span className="block text-[9px] uppercase tracking-widest text-slate-500 font-pmedium">Total listings</span>
                  <span className="text-lg font-pmedium text-[#0F172A]">{summary?.total ?? 0}</span>
                </div>
                <div>
                  <span className="block text-[9px] uppercase tracking-widest text-slate-500 font-pmedium">Active</span>
                  <span className="text-lg font-pmedium text-[#0F172A]">{summary?.active ?? 0}</span>
                </div>
                <div>
                  <span className="block text-[9px] uppercase tracking-widest text-slate-500 font-pmedium">Currently public</span>
                  <span className="text-lg font-pmedium text-[#0F172A]">{summary?.public ?? 0}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!canSubmit || !(summary?.active > 0)}
                  onClick={() => setConfirmAction("public")}
                  title={
                    !(summary?.active > 0)
                      ? "No active listings here to publish"
                      : "Make all active listings here public"
                  }
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-[#2563EB] text-white rounded-lg font-pmedium text-[11px] uppercase tracking-wider shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <Globe size={14} strokeWidth={2.5} />
                  Make Public
                </button>
                <button
                  type="button"
                  disabled={!canSubmit || !(summary?.public > 0)}
                  onClick={() => setConfirmAction("private")}
                  title={
                    !(summary?.public > 0)
                      ? "No public listings here to revert"
                      : "Make all listings here private"
                  }
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-lg font-pmedium text-[11px] uppercase tracking-wider hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <EyeOff size={14} strokeWidth={2.5} />
                  Make Private
                </button>
              </div>
            </div>
          )}
        </div>
      </PageFrame>

      {confirmAction ? (
        <div
          className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-sm flex items-center justify-center z-50 p-3"
          onClick={() => !isPending && setConfirmAction(null)}
        >
          <div
            className="bg-white rounded-[1.5rem] max-w-md w-full shadow-2xl overflow-hidden border border-white/70"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-slate-100 flex items-center justify-between gap-3">
              <span className="text-base font-pmedium text-slate-800">
                {confirmAction === "public" ? "Make listings public?" : "Make listings private?"}
              </span>
              <button
                type="button"
                onClick={() => !isPending && setConfirmAction(null)}
                className="w-8 h-8 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5 text-[13px] text-slate-600">
              {confirmAction === "public" ? (
                <p>
                  This will make <strong>{summary?.active ?? 0}</strong> active
                  listing(s) in <strong>{locationLabel}</strong> public.
                </p>
              ) : (
                <p>
                  This will make <strong>{summary?.public ?? 0}</strong> public
                  listing(s) in <strong>{locationLabel}</strong> private again.
                </p>
              )}
            </div>
            <div className="p-4 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                disabled={isPending}
                className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-pmedium text-[10px] uppercase tracking-wider hover:bg-slate-50 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => bulkSetPublic(confirmAction === "public")}
                disabled={isPending}
                className="px-6 py-2.5 bg-[#2563EB] text-white rounded-xl font-pmedium text-[10px] uppercase tracking-wider shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-all"
              >
                {isPending ? "Saving..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default BulkPublishListings;
