import React, { useRef, useState, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { TextField, MenuItem } from "@mui/material";
import PageFrame from "../../../../components/Pages/PageFrame";
import PrimaryButton from "../../../../components/PrimaryButton";
import SecondaryButton from "../../../../components/SecondaryButton";
import { toast } from "sonner";
import useAxiosPrivate from "../../../../hooks/useAxiosPrivate";

// const KIND_OPTIONS = ["companies", "poc", "reviews"];
const KIND_OPTIONS = ["companies"];
const TYPE_MAP = {
  companies: { api: "company/bulk-insert-companies", formKey: "companies" },
  poc: { api: "poc/bulk-insert-poc", formKey: "poc" },
  //   reviews: { api: "review/bulk-insert-reviews", formKey: "reviews" },
};

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

const CompaniesUpload = () => {
  const axios = useAxiosPrivate();
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);
  const [kind, setKind] = useState("companies");

  const filename = file?.name ?? "No file selected";
  const filesize = useMemo(() => (file ? humanSize(file.size) : ""), [file]);

  const { mutate, isPending } = useMutation({
    mutationKey: ["bulk-upload"],
    mutationFn: async ({ file, kind }) => {
      const { api, formKey } = TYPE_MAP[kind];
      const form = new FormData();
      form.append(formKey, file);

      const res = await axios.post(`/api/${api}`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data;
    },
    onSuccess: (data) => {
      setError(null);
      toast.success(data?.message || "Upload successful");
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Upload failed");
      setError(err?.message || "Something went wrong");
    },
  });

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
        !ok && setError("This doesn’t look like a CSV (no commas in header).")
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
    mutate({ file, kind });
  }

  const handleReset = () => {
    setError(null);
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <PageFrame>
      <h2 className="font-pmedium text-title text-primary uppercase">
        Companies Upload
      </h2>
      <div className="p-6 flex flex-col gap-6 max-w-2xl mx-auto">
        <div>
          <h4 className="text-2xl font-semibold">Bulk Upload</h4>
          <p className="text-sm text-gray-600">
            Choose the upload type and provide a CSV. Example header:{" "}
            <code>name,email,phone</code>.
          </p>
        </div>

        {/* Upload Type */}
        <TextField
          select
          size="small"
          fullWidth
          label="Upload Type"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          disabled={isPending}>
          {KIND_OPTIONS.map((option) => (
            <MenuItem key={option} value={option}>
              {option}
            </MenuItem>
          ))}
        </TextField>
        <p className="text-xs text-gray-500">
          Endpoint: <code>/api/{TYPE_MAP[kind].api}</code> • File key:{" "}
          <code>{TYPE_MAP[kind].formKey}</code>
        </p>

        {/* File input */}
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={onInputChange}
          className="hidden"
          id="csv-input"
        />
        <div
          className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:border-gray-400"
          onClick={() => inputRef.current?.click()}>
          <p className="font-medium">
            {file
              ? "Change file"
              : "Drag & drop your CSV here or click to browse"}
          </p>
          {filename && (
            <p className="text-sm text-gray-600">
              Selected: {filename} {filesize && `• ${filesize}`}
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
            title={isPending ? "Uploading…" : "Upload"}
            handleSubmit={handleUpload}
            isLoading={isPending}
            disabled={!file || isPending}
          />
          <SecondaryButton
            type="button"
            title="Reset"
            handleSubmit={handleReset}
            disabled={isPending && !file}
          />
        </div>
      </div>
    </PageFrame>
  );
};

export default CompaniesUpload;

// Helpers
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
