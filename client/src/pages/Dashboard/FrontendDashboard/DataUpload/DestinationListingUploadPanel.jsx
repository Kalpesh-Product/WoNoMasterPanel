import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, UploadCloud, X } from "lucide-react";
import useAxiosPrivate from "../../../../hooks/useAxiosPrivate";

const isSpreadsheet = (file) => /\.(xlsx|xlsm)$/i.test(file.name);
const formatSize = (bytes) => (bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`);

const ImportResultSummary = ({ result }) => {
  const totalRows = result.totalRows ?? result.imported ?? 0;
  const imported = result.imported || 0;
  const failed = result.failed ?? (result.success ? 0 : totalRows);

  return (
    <section className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-start gap-2 border-b border-slate-100 px-4 py-3">
        {result.success ? (
          <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-600" />
        ) : (
          <X size={15} className="mt-0.5 shrink-0 text-rose-600" />
        )}
        <div>
          <p className="text-xs font-pmedium text-slate-800">
            {result.success ? "Import completed" : "Import could not be completed"}
          </p>
          {result.error && (
            <p className="mt-1 text-[10px] font-pmedium text-rose-600">{result.error}</p>
          )}
          {result.success && result.removed > 0 && (
            <p className="mt-1 text-[10px] font-pmedium text-slate-400">
              Replaced {result.removed} previously stored businesses.
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 divide-x divide-slate-100">
        <div className="px-3 py-3 text-center">
          <p className="text-[9px] font-pmedium uppercase tracking-widest text-slate-400">Sheet rows</p>
          <p className="mt-1 text-lg font-pmedium text-slate-800">{totalRows}</p>
        </div>
        <div className="px-3 py-3 text-center">
          <p className="text-[9px] font-pmedium uppercase tracking-widest text-emerald-600">Imported</p>
          <p className="mt-1 text-lg font-pmedium text-emerald-700">{imported}</p>
        </div>
        <div className="px-3 py-3 text-center">
          <p className="text-[9px] font-pmedium uppercase tracking-widest text-rose-500">Failed</p>
          <p className="mt-1 text-lg font-pmedium text-rose-600">{failed}</p>
        </div>
      </div>

      {result.failures?.length > 0 && (
        <div className="border-t border-rose-100 bg-rose-50/60 px-4 py-3">
          <div className="flex items-center gap-2 text-[10px] font-pmedium uppercase tracking-widest text-rose-700">
            <AlertTriangle size={13} />
            Failed row reasons
          </div>
          <div className="mt-2 max-h-44 space-y-2 overflow-y-auto pr-1">
            {result.failures.map((failure) => (
              <div
                key={`${failure.row}-${failure.column}-${failure.value}`}
                className="rounded-lg border border-rose-100 bg-white px-3 py-2"
              >
                <p className="text-[10px] font-pmedium text-slate-700">
                  Row {failure.row} · Column: {failure.column || "Unknown"}
                </p>
                {failure.value && (
                  <p className="mt-0.5 text-[10px] font-pmedium text-slate-500">Value: {failure.value}</p>
                )}
                <p className="mt-0.5 text-[10px] font-pmedium text-rose-600">{failure.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.warnings?.length > 0 && (
        <div className="border-t border-amber-100 bg-amber-50/60 px-4 py-3">
          <p className="text-[10px] font-pmedium uppercase tracking-widest text-amber-700">Workbook warnings</p>
          <div className="mt-1.5 space-y-1">
            {result.warnings.map((warning) => (
              <p key={warning} className="text-[10px] font-pmedium text-amber-700">{warning}</p>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

// Single-destination upload: the destination is already known (picked from a
// dropdown or list by the caller), so it's sent as an explicit override and
// the bulk-import endpoint doesn't need to guess it from the file name.
const DestinationListingUploadPanel = ({ destination, onUploaded }) => {
  const axios = useAxiosPrivate();
  const [file, setFile] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const { mutate: upload, isPending, data: result, reset } = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("destination", destination);
      formData.append("files", file);
      const response = await axios.post("/api/hosts/destination-listings/bulk-import", formData);
      return response.data.results[0];
    },
    onSuccess: (uploadResult) => {
      if (uploadResult.success) {
        const failedMessage = uploadResult.failed ? ` ${uploadResult.failed} rows failed.` : "";
        toast.success(`${destination}: imported ${uploadResult.imported} businesses.${failedMessage}`);
        onUploaded?.();
      } else {
        toast.error(uploadResult.error || "Upload failed.");
      }
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Upload failed.");
    },
  });

  const acceptFile = (picked) => {
    if (!picked) return;
    if (!isSpreadsheet(picked)) {
      toast.error("Only .xlsx or .xlsm files are allowed.");
      return;
    }
    setFile(picked);
    reset();
  };

  const handleFilePicked = (event) => {
    acceptFile(event.target.files?.[0]);
    event.target.value = "";
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragOver(false);
    const dropped = Array.from(event.dataTransfer.files || []);
    if (dropped.length > 1) {
      toast.error("Drop one file at a time — one file per destination.");
      return;
    }
    acceptFile(dropped[0]);
  };

  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
      <p className="text-xs font-pmedium text-slate-700">Uploading for <span className="text-[#2563EB]">{destination}</span></p>

      {file ? (
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5">
          <FileSpreadsheet size={20} className="shrink-0 text-emerald-600" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-pmedium text-slate-900">{file.name}</p>
            <p className="text-[10px] font-pmedium text-slate-400">{formatSize(file.size)}</p>
          </div>
          <button
            type="button"
            onClick={() => { setFile(null); reset(); }}
            aria-label="Remove file"
            className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <label
          onDragOver={(event) => { event.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          className={`mt-3 flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-7 text-center transition ${isDragOver ? "border-[#2563EB] bg-blue-50/60" : "border-slate-200 bg-white hover:border-[#2563EB]/40 hover:bg-blue-50/30"}`}
        >
          <UploadCloud size={22} className={isDragOver ? "text-[#2563EB]" : "text-slate-400"} />
          <span className="text-xs font-pmedium text-slate-600">Drag &amp; drop a .xlsx/.xlsm file here, or click to browse</span>
          <span className="text-[10px] font-pmedium text-slate-400">One file per destination</span>
          <input type="file" accept=".xlsx,.xlsm" className="hidden" onChange={handleFilePicked} />
        </label>
      )}

      <button
        type="button"
        disabled={!file || isPending}
        onClick={() => upload()}
        className="mt-3 w-full rounded-xl bg-[#2563EB] px-4 py-2.5 text-xs font-pmedium text-white transition hover:bg-[#1d4ed8] disabled:opacity-50"
      >
        {isPending ? "Uploading..." : "Upload"}
      </button>

      {result && <ImportResultSummary result={result} />}
    </div>
  );
};

export default DestinationListingUploadPanel;
