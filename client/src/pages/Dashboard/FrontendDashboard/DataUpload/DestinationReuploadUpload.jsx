import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import useAxiosPrivate from "../../../../hooks/useAxiosPrivate";
import { queryClient } from "../../../../main";
import DestinationListingUploadPanel from "./DestinationListingUploadPanel";

const selectCls = "w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-pmedium text-slate-900 outline-none transition focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400";

const DestinationReuploadUpload = () => {
  const axios = useAxiosPrivate();
  const [continent, setContinent] = useState("");
  const [country, setCountry] = useState("");
  const [destination, setDestination] = useState("");

  const { data: rankingData } = useQuery({
    queryKey: ["wono-destination-analytics", "add-upload-list"],
    queryFn: async () => {
      const response = await axios.get("/api/hosts/destination-analytics", { params: { limit: 250, includeInactive: true } });
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: uploadedData, refetch: refetchUploaded } = useQuery({
    queryKey: ["wono-destination-listings-uploaded"],
    queryFn: async () => {
      const response = await axios.get("/api/hosts/destination-listings/uploaded");
      return response.data;
    },
  });

  const uploadedNames = useMemo(() => new Set((uploadedData?.destinations || []).map((d) => d.destination)), [uploadedData]);
  // Only destinations that already have listings — same continent/country/destination
  // taxonomy as the ranking list, filtered down to the uploaded ones.
  const uploadedRows = useMemo(
    () => (rankingData?.items || []).filter((r) => uploadedNames.has(r.destination)),
    [rankingData, uploadedNames],
  );

  const continents = useMemo(() => Array.from(new Set(uploadedRows.map((r) => r.continent))).sort(), [uploadedRows]);
  const countries = useMemo(
    () => Array.from(new Set(uploadedRows.filter((r) => r.continent === continent).map((r) => r.country))).sort(),
    [uploadedRows, continent],
  );
  const destinations = useMemo(
    () => uploadedRows
      .filter((r) => r.continent === continent && r.country === country)
      .sort((a, b) => a.destination.localeCompare(b.destination)),
    [uploadedRows, continent, country],
  );

  const handleUploaded = () => {
    refetchUploaded();
    queryClient.invalidateQueries({ queryKey: ["wono-destination-listings-uploaded"] });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <p className="text-xs font-pmedium text-slate-500">Pick a destination that already has listings uploaded, then replace its data with a new file.</p>

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
              {destinations.map((item) => <option key={item.destination} value={item.destination}>{item.destination}</option>)}
            </select>
          </div>
        </div>

        {continent && countries.length === 0 && (
          <p className="mt-3 text-[11px] font-pmedium text-slate-400">No uploaded destinations in this continent yet.</p>
        )}
      </div>

      {destination && (
        <DestinationListingUploadPanel destination={destination} onUploaded={handleUploaded} />
      )}
    </div>
  );
};

export default DestinationReuploadUpload;
