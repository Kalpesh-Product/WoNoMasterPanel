import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import useAxiosPrivate from "../../../../hooks/useAxiosPrivate";
import UploadResultSummary from "./UploadResultSummary";
import {
  UploadCard,
  UploadPanel,
  FileDropzone,
  UploadSubmitButton,
  SelectField,
  formatFileSize,
} from "./UploadUI";
import { NOMADS_API_BASE_URL } from "../../../../constants/api";

const KIND_OPTIONS = ["restaurants", "poc", "reviews"];
const TYPE_MAP = {
  restaurants: {
    api: `${NOMADS_API_BASE_URL}/restaurants/bulk-insert`,
    formKey: "restaurants-file",
  },
  poc: {
    api: `${NOMADS_API_BASE_URL}/restaurantpocs/bulk-insert-poc`,
    formKey: "poc",
  },
  reviews: {
    api: `${NOMADS_API_BASE_URL}/restaurantreviews/bulk-insert-reviews`,
    formKey: "reviews",
  },
};

const TEMPLATE_BY_KIND = {
  restaurants: "/templates/restaurants-template.xlsx",
  poc: "/templates/poc-upload-template.csv",
  reviews: "/templates/reviews-upload-template.csv",
};

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

const RestaurantsUpload = () => {
  const axios = useAxiosPrivate();
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);
  const [kind, setKind] = useState("restaurants");

  const { mutate, isPending, data: uploadResult, error: uploadError } = useMutation({
    mutationKey: ["restaurants-bulk-upload"],
    mutationFn: async ({ file, kind }) => {
      const { api, formKey } = TYPE_MAP[kind];
      const form = new FormData();
      form.append(formKey, file);

      const res = await axios.post(api, form, {
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
        !ok && setError("This doesn't look like a CSV (no commas in header)."),
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
      title="Restaurants Upload"
      description="Choose the restaurant upload type and submit the matching CSV."
      templateHref={TEMPLATE_BY_KIND[kind]}
    >
      <UploadPanel>
        <div className="mb-3" data-tour="data-upload-type">
          <SelectField
            label="Upload Type"
            value={kind}
            onChange={setKind}
            options={KIND_OPTIONS}
            disabled={isPending}
          />
        </div>
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

export default RestaurantsUpload;

async function quickPeek(file) {
  const blob = file.slice(0, 1024);
  const text = await blob.text();
  const firstLine = text.split(/\r?\n/)[0] ?? "";
  return firstLine.includes(",");
}
