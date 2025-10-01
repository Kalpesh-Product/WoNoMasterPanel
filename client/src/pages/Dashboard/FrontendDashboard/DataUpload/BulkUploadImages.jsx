// src/pages/Dashboard/FrontendDashboard/BulkUploadImages.jsx
import React, { useRef, useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { TextField, MenuItem } from "@mui/material";
import PageFrame from "../../../../components/Pages/PageFrame";
import PrimaryButton from "../../../../components/PrimaryButton";
import SecondaryButton from "../../../../components/SecondaryButton";
import { toast } from "sonner";
import axios from "axios";

const API_BASE = "https://wononomadsbe.vercel.app/api";
const MAX_FILES = 12;
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const BulkUploadImages = () => {
  const inputRef = useRef(null);

  const [country, setCountry] = useState("");
  const [companyType, setCompanyType] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [images, setImages] = useState([]); // store File[]
  const [previews, setPreviews] = useState([]); // store preview URLs
  const [error, setError] = useState(null);

  // ✅ cleanup previews when images change
  useEffect(() => {
    if (!images.length) {
      setPreviews([]);
      return;
    }
    const urls = images.map((file) => ({
      name: file.name,
      url: URL.createObjectURL(file),
    }));
    setPreviews(urls);

    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u.url));
    };
  }, [images]);

  // ✅ fetch companies
  const { data: companies = [], isLoading } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const res = await axios.get(`${API_BASE}/company/companies`);
      return res.data;
    },
  });

  const countries = [...new Set(companies.map((c) => c.country))];
  const types = [...new Set(companies.map((c) => c.companyType))];
  const filteredCompanies = companies.filter(
    (c) => c.country === country && c.companyType === companyType
  );

  // ✅ mutation for upload
  const { mutate, isPending } = useMutation({
    mutationFn: async ({ companyId, images }) => {
      const form = new FormData();
      form.append("companyId", companyId);
      images.forEach((img) => form.append("images", img));

      const res = await axios.post(
        `${API_BASE}/company/bulk-add-company-images`,
        form,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data?.message || "Upload successful");
      setImages([]);
      setCompanyId("");
      inputRef.current.value = "";
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Upload failed");
      setError(err?.message || "Something went wrong");
    },
  });

  function onFileChange(e) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return setImages([]);

    const tooLarge = files.find((f) => f.size > MAX_BYTES);
    if (tooLarge) {
      setError(
        `File ${tooLarge.name} is too large (max ${humanSize(MAX_BYTES)})`
      );
      return;
    }
    if (files.length > MAX_FILES) {
      setError(`Max ${MAX_FILES} images allowed`);
      return;
    }

    setError(null);
    setImages(files);
  }

  function handleUpload() {
    if (!companyId) return setError("Please select a company first");
    if (!images.length) return setError("Please select images to upload");
    mutate({ companyId, images });
  }

  const handleReset = () => {
    setError(null);
    setImages([]);
    setCompanyId("");
    setCompanyType("");
    setCountry("");
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="p-0">
      <PageFrame>
        <h2 className="font-pmedium text-title text-primary uppercase">
          Bulk Upload Images
        </h2>

        <div className="p-6 flex flex-col gap-6 max-w-2xl mx-auto">
          {isLoading ? (
            <p>Loading companies...</p>
          ) : (
            <>
              {/* Country */}
              <TextField
                select
                size="small"
                fullWidth
                label="Country"
                value={country}
                onChange={(e) => {
                  setCountry(e.target.value);
                  setCompanyType("");
                  setCompanyId("");
                }}>
                {countries.map((c) => (
                  <MenuItem key={c} value={c}>
                    {c}
                  </MenuItem>
                ))}
              </TextField>

              {/* Company Type */}
              <TextField
                select
                size="small"
                fullWidth
                label="Company Type"
                value={companyType}
                onChange={(e) => {
                  setCompanyType(e.target.value);
                  setCompanyId("");
                }}
                disabled={!country}>
                {types.map((t) => (
                  <MenuItem key={t} value={t}>
                    {t}
                  </MenuItem>
                ))}
              </TextField>

              {/* Company */}
              <TextField
                select
                size="small"
                fullWidth
                label="Company"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                disabled={!companyType}>
                {filteredCompanies.map((c) => (
                  <MenuItem key={c._id} value={c._id}>
                    {c.companyName}
                  </MenuItem>
                ))}
              </TextField>

              {/* File input */}
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={onFileChange}
                className="hidden"
                id="img-input"
              />
              <div
                className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:border-gray-400"
                onClick={() => inputRef.current?.click()}>
                <p className="font-medium">
                  {images.length
                    ? `${images.length} image(s) selected`
                    : "Upload company images here (click to browse)"}
                </p>
              </div>

              {/* Preview thumbnails */}
              {previews.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  {previews.map((p) => (
                    <div
                      key={p.url}
                      className="relative border rounded-lg overflow-hidden">
                      <img
                        src={p.url}
                        alt={p.name}
                        className="w-full h-24 object-cover"
                      />
                      <p className="text-xs text-center truncate p-1">
                        {p.name}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs text-gray-500">
                Accepted type: <code>.jpg, .png</code>. Max size:{" "}
                {humanSize(MAX_BYTES)}. Max files: {MAX_FILES}.
              </p>

              {error && <div className="text-sm text-red-600">{error}</div>}

              {/* Actions */}
              <div className="flex gap-4 justify-center">
                <PrimaryButton
                  type="button"
                  title={isPending ? "Uploading…" : "Upload"}
                  handleSubmit={handleUpload}
                  isLoading={isPending}
                  disabled={!images.length || !companyId || isPending}
                />
                <SecondaryButton
                  type="button"
                  title="Reset"
                  handleSubmit={handleReset}
                  disabled={isPending && !images.length}
                />
              </div>
            </>
          )}
        </div>
      </PageFrame>
    </div>
  );
};

export default BulkUploadImages;

// Helpers
function humanSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
