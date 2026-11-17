import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import useAxiosPrivate from "../../../../hooks/useAxiosPrivate";
import UploadResultSummary from "./UploadResultSummary";
import { UploadCard, UploadPanel, FileDropzone, UploadSubmitButton, formatFileSize } from "./UploadUI";

const TYPE_MAP = {
  companies: { api: "hosts/bulk-insert-companies", formKey: "companies" },
  poc: { api: "poc/bulk-insert-poc", formKey: "poc" },
  reviews: { api: "review/bulk-insert-reviews", formKey: "reviews" },
};

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

const CompaniesUpload = () => {
  const axios = useAxiosPrivate();
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);
  const [kind] = useState("companies");

  const { mutate, isPending, data: uploadResult, error: uploadError } = useMutation({
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
      return fail(`File too large. Max allowed: ${formatFileSize(MAX_BYTES)}.`);

    setFile(f);

    quickPeek(f).then(
      (ok) =>
        !ok && setError("This doesn’t look like a CSV (no commas in header)."),
    );
  }

  function fail(msg) {
    setFile(null);
    setError(msg);
  }

  function handleUpload() {
    if (!file) return setError("Select a CSV file first.");
    mutate({ file, kind });
  }

  return (
    <UploadCard
      title="Company Upload"
      description="Upload the companies CSV. Example header: Business Name, Website, City, State, Country."
      templateHref="/templates/company-upload-template.xlsx"
    >
      <UploadPanel>
        <FileDropzone
          file={file}
          onPick={validateAndSet}
          onRemove={() => setFile(null)}
          accept=".csv,text/csv"
          hint={`.csv · Max ${formatFileSize(MAX_BYTES)}`}
          dataTour="data-upload-dropzone"
          disabled={isPending}
        />
        {error && <div className="mt-2 text-xs text-rose-600">{error}</div>}
        <UploadSubmitButton
          onClick={handleUpload}
          disabled={!file || isPending}
          pending={isPending}
        />
        <UploadResultSummary data={uploadResult} error={uploadError} />
      </UploadPanel>
    </UploadCard>
  );
};

export default CompaniesUpload;

async function quickPeek(file) {
  const blob = file.slice(0, 1024);
  const text = await blob.text();
  const firstLine = text.split(/\r?\n/)[0] ?? "";
  return firstLine.includes(",");
}
