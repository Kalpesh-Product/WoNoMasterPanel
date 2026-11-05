import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import useAxiosPrivate from "../../../../hooks/useAxiosPrivate";
import { queryClient } from "../../../../main";
import DestinationListingUploadPanel from "./DestinationListingUploadPanel";
import DestinationUploadCoverage from "./DestinationUploadCoverage";

const selectCls = "w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-pmedium text-slate-900 outline-none transition focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400";

const DestinationAddUpload = () => {
  const axios = useAxiosPrivate();
  const [continent, setContinent] = useState("");
  const [country, setCountry] = useState("");
  const [destination, setDestination] = useState("");

  const { data: rankingData, isPending: isRankingPending } = useQuery({
    queryKey: ["wono-destination-analytics", "add-upload-list"],
    queryFn: async () => {
      const response = await axios.get("/api/hosts/destination-analytics", { params: { limit: 250, includeInactive: true } });
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: uploadedData, refetch: refetchUploaded, isPending: isUploadedPending } = useQuery({
    queryKey: ["wono-destination-listings-uploaded"],
    queryFn: async () => {
      const response = await axios.get("/api/hosts/destination-listings/uploaded");
      return response.data;
    },
  });

  const rows = useMemo(() => rankingData?.items || [], [rankingData]);
  const uploadedNames = useMemo(() => new Set((uploadedData?.destinations || []).map((d) => d.destination)), [uploadedData]);
  const totalDestinations = useMemo(() => new Set(rows.map((row) => row.destination)).size, [rows]);
  const uploadedDestinationCount = useMemo(
    () => new Set(rows.filter((row) => uploadedNames.has(row.destination)).map((row) => row.destination)).size,
    [rows, uploadedNames],
  );

  const continents = useMemo(() => Array.from(new Set(rows.map((r) => r.continent))).sort(), [rows]);
  const countries = useMemo(
    () => Array.from(new Set(rows.filter((r) => r.continent === continent).map((r) => r.country))).sort(),
    [rows, continent],
  );
  const destinations = useMemo(
    () => rows
      .filter((r) => r.continent === continent && r.country === country)
      .map((r) => ({ ...r, isUploaded: uploadedNames.has(r.destination) }))
      .sort((a, b) => a.destination.localeCompare(b.destination)),
    [rows, continent, country, uploadedNames],
  );

  const handleUploaded = () => {
    refetchUploaded();
    queryClient.invalidateQueries({ queryKey: ["wono-destination-listings-uploaded"] });
    queryClient.invalidateQueries({ queryKey: ["wono-destination-listings-summary", destination] });
    queryClient.invalidateQueries({ queryKey: ["wono-destination-listings", destination] });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <DestinationUploadCoverage
          total={totalDestinations}
          uploaded={uploadedDestinationCount}
          isLoading={isRankingPending || isUploadedPending}
        />
        <p className="text-xs font-pmedium text-slate-500">Pick a destination that doesn&apos;t have listings yet, then upload its raw-data workbook.</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <label className="text-[10px] font-pmedium uppercase tracking-widest text-slate-400">Continent</label>
            <select
              className={`${selectCls} mt-1`}
              value={continent}
              onChange={(event) => { setContinent(event.target.value); setCountry(""); setDestination(""); }}
            >
              <option value="">Select continent</option>
              {continents.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-pmedium uppercase tracking-widest text-slate-400">Country</label>
            <select
              className={`${selectCls} mt-1`}
              value={country}
              disabled={!continent}
              onChange={(event) => { setCountry(event.target.value); setDestination(""); }}
            >
              <option value="">Select country</option>
              {countries.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-pmedium uppercase tracking-widest text-slate-400">Destination</label>
            <select
              className={`${selectCls} mt-1`}
              value={destination}
              disabled={!country}
              onChange={(event) => setDestination(event.target.value)}
            >
              <option value="">Select destination</option>
              {destinations.map((item) => (
                <option key={item.destination} value={item.destination} disabled={item.isUploaded}>
                  {item.destination}{item.isUploaded ? " (Already added)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {destination && (
        <DestinationListingUploadPanel destination={destination} onUploaded={handleUploaded} />
      )}
    </div>
  );
};

export default DestinationAddUpload;
