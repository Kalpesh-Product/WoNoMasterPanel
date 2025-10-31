// src/pages/Dashboard/FrontendDashboard/UploadSingleImage.jsx
import React, { useRef, useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { TextField, MenuItem } from "@mui/material";
import PageFrame from "../../../../components/Pages/PageFrame";
import PrimaryButton from "../../../../components/PrimaryButton";
import SecondaryButton from "../../../../components/SecondaryButton";
import { toast } from "sonner";
import axios from "axios";
import { useLocation } from "react-router-dom";

const API_BASE = "https://wononomadsbe.vercel.app/api";
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const UploadSingleImage = () => {
  const inputRef = useRef(null);
  const location = useLocation();

  const [country, setCountry] = useState("Thailand");
  const [companyType, setCompanyType] = useState("hostel");
  const [searchTerm, setSearchTerm] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [imageType, setImageType] = useState("logo"); // "logo" or "image"
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);

  // ✅ cleanup preview
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

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
    mutationFn: async ({ companyId, file, type }) => {
      const form = new FormData();
      form.append("companyId", companyId);
      form.append("type", type);
      form.append("image", file);

      const res = await axios.post(
        `${API_BASE}/company/add-company-image`,
        form,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data?.message || "Upload successful");
      setFile(null);
      setPreview(null);
      setCompanyId("");
      setCompanyType("");
      setCountry("");
      setImageType("");
      if (inputRef.current) inputRef.current.value = "";
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Upload failed");
      setError(err?.message || "Something went wrong");
    },
  });

  function onFileChange(e) {
    const f = e.target.files?.[0] ?? null;
    if (!f) return setFile(null);

    if (f.size > MAX_BYTES) {
      setError(`File too large. Max allowed: ${humanSize(MAX_BYTES)}`);
      return;
    }

    setError(null);
    setFile(f);
  }

  function handleUpload() {
    if (!companyId) return setError("Please select a company first");
    if (!imageType) return setError("Please select image type");
    if (!file) return setError("Please select an image to upload");
    mutate({ companyId, file, type: imageType });
  }

  const handleReset = () => {
    setError(null);
    setFile(null);
    setPreview(null);
    setCompanyId("");
    setCompanyType("");
    setCountry("");
    setImageType("");
    if (inputRef.current) inputRef.current.value = "";
  };

  useEffect(() => {
    if (isLoading || !companies.length) return;

    const params = new URLSearchParams(location.search);
    if (params.get("autoFill") === "true") {
      try {
        const context = JSON.parse(
          sessionStorage.getItem("uploadContext") || "{}"
        );
        if (context.companyId) {
          setCountry(context.country);
          setCompanyType(context.companyType);
          setCompanyId(context.companyId);
          setImageType("logo");
          sessionStorage.removeItem("uploadContext");
        }
      } catch (err) {
        console.error("Failed to parse upload context:", err);
      }
    }
  }, [location.search, companies, isLoading]);

  return (
    <div className="p-0">
      <PageFrame>
        <h2 className="font-pmedium text-title text-primary uppercase">
          Upload Single Logo Image
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
                }}
              >
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
                disabled={!country}
              >
                {types.map((t) => (
                  <MenuItem key={t} value={t}>
                    {t}
                  </MenuItem>
                ))}
              </TextField>

              {/* Company */}
              {/* <TextField
                select
                size="small"
                fullWidth
                label="Company"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                disabled={!companyType}
              >
                {filteredCompanies.map((c) => (
                  <MenuItem key={c._id} value={c._id}>
                    {c.companyName}
                  </MenuItem>
                ))}
              </TextField> */}
              <TextField
                select
                size="small"
                fullWidth
                label="Company"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                disabled={!companyType}
                SelectProps={{
                  MenuProps: {
                    PaperProps: {
                      sx: { maxHeight: 300 },
                    },
                  },
                  renderValue: (selected) => {
                    const company = filteredCompanies.find(
                      (c) => c._id === selected
                    );
                    return company ? company.companyName : "";
                  },
                }}
              >
                {/* 🔍 Search box inside dropdown */}
                <MenuItem disableRipple disableTouchRipple>
                  <TextField
                    size="small"
                    placeholder="Search company..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    fullWidth
                    autoFocus
                    onClick={(e) => e.stopPropagation()} // ✅ prevents dropdown from closing
                    onKeyDown={(e) => e.stopPropagation()} // ✅ allows typing safely
                  />
                </MenuItem>

                {filteredCompanies
                  .filter((c) =>
                    c.companyName
                      .toLowerCase()
                      .includes(searchTerm.toLowerCase())
                  )
                  .map((c) => (
                    <MenuItem key={c._id} value={c._id}>
                      {c.companyName}
                    </MenuItem>
                  ))}
              </TextField>

              {/* Image Type */}
              <TextField
                select
                size="small"
                fullWidth
                label="Image Type"
                value={imageType}
                onChange={(e) => setImageType(e.target.value)}
                disabled={!companyId}
              >
                {/* {["image", "logo"].map((opt) => ( */}
                {["logo"].map((opt) => (
                  <MenuItem key={opt} value={opt}>
                    {opt}
                  </MenuItem>
                ))}
              </TextField>

              {/* File input */}
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                onChange={onFileChange}
                className="hidden"
                id="single-img-input"
              />
              <div
                className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:border-gray-400"
                onClick={() => inputRef.current?.click()}
              >
                <p className="font-medium">
                  {file
                    ? "Change image"
                    : "Upload image here (click to browse)"}
                </p>
                {file && (
                  <p className="text-sm text-gray-600">
                    Selected: {file.name} • {humanSize(file.size)}
                  </p>
                )}
              </div>

              {/* Preview */}
              {preview && (
                <div className="mt-4">
                  <img
                    src={preview}
                    alt="preview"
                    className="w-48 h-48 object-cover border rounded-lg mx-auto"
                  />
                </div>
              )}

              <p className="text-xs text-gray-500">
                Accepted type: <code>.jpg, .png</code>. Max size:{" "}
                {humanSize(MAX_BYTES)}.
              </p>

              {error && <div className="text-sm text-red-600">{error}</div>}

              {/* Actions */}
              <div className="flex gap-4 justify-center">
                <PrimaryButton
                  type="button"
                  title={isPending ? "Uploading…" : "Upload"}
                  handleSubmit={handleUpload}
                  isLoading={isPending}
                  disabled={!file || !companyId || !imageType || isPending}
                />
                <SecondaryButton
                  type="button"
                  title="Reset"
                  handleSubmit={handleReset}
                  disabled={isPending && !file}
                />
              </div>
            </>
          )}
        </div>
      </PageFrame>
    </div>
  );
};

export default UploadSingleImage;

// Helpers
function humanSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
