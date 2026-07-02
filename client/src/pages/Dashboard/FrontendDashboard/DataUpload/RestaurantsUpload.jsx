import React, { useMemo, useRef, useState } from "react";
import PageFrame from "../../../../components/Pages/PageFrame";
import PrimaryButton from "../../../../components/PrimaryButton";
import SecondaryButton from "../../../../components/SecondaryButton";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

const RestaurantsUpload = () => {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);

  const filename = file?.name ?? "No file selected";
  const filesize = useMemo(() => (file ? humanSize(file.size) : ""), [file]);

  function validateAndSet(f) {
    setError(null);
    if (!f) return setFile(null);

    const isCsv =
      f.type === "text/csv" ||
      f.name.toLowerCase().endsWith(".csv") ||
      f.type === "";

    if (!isCsv) return fail("Please select a .csv file.");
    if (f.size > MAX_BYTES)
      return fail(`File too large. Max allowed: ${humanSize(MAX_BYTES)}.`);

    setFile(f);

    quickPeek(f).then(
      (ok) =>
        !ok && setError("This doesn't look like a CSV (no commas in header)."),
    );
  }

  function fail(msg) {
    setFile(null);
    setError(msg);
  }

  function onInputChange(e) {
    const f = e.target.files?.[0] ?? null;
    validateAndSet(f);
  }

  function handleUpload() {
    if (!file) return setError("Select a CSV file first.");
    setError("Restaurants upload API integration is pending.");
  }

  const handleReset = () => {
    setError(null);
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="p-0">
      <PageFrame>
        <h2 className="font-pmedium text-title text-primary uppercase">
          Restaurants Data Upload
        </h2>
        <div className="p-6 flex flex-col gap-6 max-w-2xl mx-auto">
          <div>
            <h4 className="text-2xl font-semibold">Bulk Upload</h4>
            <p className="text-sm text-gray-600">
              Choose a restaurants CSV and submit it for bulk upload.
            </p>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={onInputChange}
            className="hidden"
            id="restaurants-csv-input"
          />
          <div
            className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:border-gray-400"
            onClick={() => inputRef.current?.click()}
          >
            <p className="font-medium">
              {file ? "Change file" : "Upload your CSV here (click to browse)"}
            </p>
            {filename && (
              <p className="text-sm text-gray-600">
                Selected: {filename} {filesize && `- ${filesize}`}
              </p>
            )}
          </div>

          <p className="text-xs text-gray-500">
            Accepted type: <code>.csv</code>. Max size: {humanSize(MAX_BYTES)}.
          </p>
          {error && <div className="text-sm text-red-600">{error}</div>}

          <div className="flex gap-4 justify-center">
            <PrimaryButton
              type="button"
              title="Upload"
              handleSubmit={handleUpload}
              disabled={!file}
            />
            <SecondaryButton
              type="button"
              title="Reset"
              handleSubmit={handleReset}
            />
          </div>
        </div>
      </PageFrame>
    </div>
  );
};

export default RestaurantsUpload;

function humanSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function quickPeek(file) {
  const blob = file.slice(0, 1024);
  const text = await blob.text();
  const firstLine = text.split(/\r?\n/)[0] ?? "";
  return firstLine.includes(",");
}
