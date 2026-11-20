// src/pages/Dashboard/FrontendDashboard/UploadSingleImage.jsx
import React, { useRef, useState, useEffect, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { TextField, MenuItem } from "@mui/material";
import { toast } from "sonner";
import axios from "axios";
import { useLocation } from "react-router-dom";
import useAxiosPrivate from "../../../../hooks/useAxiosPrivate";
import { UploadCloud } from "lucide-react";
import UploadResultSummary from "./UploadResultSummary";
import { UploadCard, UploadPanel, UploadActions, muiFieldSx } from "./UploadUI";
import { NOMADS_API_BASE_URL } from "../../../../constants/api";

const API_BASE = NOMADS_API_BASE_URL;
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const UPLOAD_FILTERS_STORAGE_KEY = "dataUploadFilters";

const UploadSingleImage = () => {
  const inputRef = useRef(null);
  const location = useLocation();
  const axios = useAxiosPrivate();

  const [country, setCountry] = useState("");
  const [companyType, setCompanyType] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [imageType, setImageType] = useState("logo"); // "logo" or "image"
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

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
      const res = await axios.get(`${API_BASE}/company/companiesma`);
      return res.data;
    },
  });

  const countries = useMemo(
    () => [...new Set(companies.map((c) => c.country))],
    [companies],
  );
  const types = useMemo(
    () => [
      ...new Set(
        companies
          .filter((c) => c.country === country)
          .map((c) => c.companyType),
      ),
    ],
    [companies, country],
  );
  const filteredCompanies = companies.filter(
    (c) => c.country === country && c.companyType === companyType,
  );

  useEffect(() => {
    if (!companies.length) return;

    const savedFilters = safeParseJSON(
      localStorage.getItem(UPLOAD_FILTERS_STORAGE_KEY),
    );

    const savedCountry = savedFilters?.country;
    const resolvedCountry = countries.includes(savedCountry)
      ? savedCountry
      : "";

    const typesForCountry = [
      ...new Set(
        companies
          .filter((c) => c.country === resolvedCountry)
          .map((c) => c.companyType),
      ),
    ];
    const savedCompanyType = savedFilters?.companyType;
    const resolvedCompanyType = typesForCountry.includes(savedCompanyType)
      ? savedCompanyType
      : "";

    setCountry(resolvedCountry);
    setCompanyType(resolvedCompanyType);
  }, [companies, countries]);

  useEffect(() => {
    if (!companies.length) return;

    localStorage.setItem(
      UPLOAD_FILTERS_STORAGE_KEY,
      JSON.stringify({
        country,
        companyType,
      }),
    );
  }, [companies, country, companyType]);

  useEffect(() => {
    if (companyType && !types.includes(companyType)) {
      setCompanyType("");
      setCompanyId("");
    }
  }, [types, companyType]);

  // ✅ mutation for upload
  // const { mutate, isPending } = useMutation({
  //   mutationFn: async ({ companyId, file, type }) => {
  //     const form = new FormData();
  //     form.append("companyId", companyId);
  //     form.append("type", type);
  //     form.append("image", file);

  //     const res = await axios.post(
  //       `${API_BASE}/company/add-company-image`,
  //       form,
  //       { headers: { "Content-Type": "multipart/form-data" } }
  //     );
  //     return res.data;
  //   },
  //   onSuccess: (data) => {
  //     toast.success(data?.message || "Upload successful");
  //     setFile(null);
  //     setPreview(null);
  //     setCompanyId("");
  //     setCompanyType("");
  //     setCountry("");
  //     setImageType("");
  //     if (inputRef.current) inputRef.current.value = "";
  //   },
  //   onError: (err) => {
  //     toast.error(err?.response?.data?.message || "Upload failed");
  //     setError(err?.message || "Something went wrong");
  //   },
  // });

  const { mutate, isPending, data: uploadResult, error: uploadError } = useMutation({
    mutationFn: async ({ companyId, file, type }) => {
      const form = new FormData();
      form.append("companyId", companyId);
      form.append("type", type);
      form.append("image", file);

      const res = await axios.post(`/api/admin/upload-single-image`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data?.message || "Upload successful");
      setFile(null);
      setPreview(null);
      setCompanyId("");
      setImageType("logo");
      if (inputRef.current) inputRef.current.value = "";
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Upload failed");
      setError(err?.message || "Something went wrong");
    },
  });

  function onFileChange(e) {
    selectFile(e.target.files?.[0] ?? null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function selectFile(f) {
    if (!f) return setFile(null);

    if (!f.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    if (f.size > MAX_BYTES) {
      setError(`File too large. Max allowed: ${humanSize(MAX_BYTES)}`);
      return;
    }

    setError(null);
    setFile(f);
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!isPending) setIsDragging(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget)) setIsDragging(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (isPending) return;
    selectFile(e.dataTransfer.files?.[0] ?? null);
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
          sessionStorage.getItem("uploadContext") || "{}",
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
    <UploadCard
      title="Upload Single Image"
      description="Pick a company, then upload one image or logo for it."
    >
      <UploadPanel>
          {isLoading ? (
            <p className="text-xs font-pmedium text-slate-500">Loading companies...</p>
          ) : (
            <>
              {/* Country / Company Type / Company */}
              <div data-tour="data-upload-target-picker" className="grid gap-3 font-pmedium sm:grid-cols-4">
              <TextField
                select
                size="small"
                fullWidth
                label="Country"
                value={country}
                sx={muiFieldSx}
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
                sx={muiFieldSx}
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
              <TextField
                select
                size="small"
                fullWidth
                label="Company"
                value={companyId}
                sx={muiFieldSx}
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
                      (c) => c._id === selected,
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
                      .includes(searchTerm.toLowerCase()),
                  )
                  .map((c) => (
                    <MenuItem key={c._id} value={c._id}>
                      {c.companyName}
                    </MenuItem>
                  ))}
              </TextField>

              {/* Image Type */}
              <div data-tour="data-upload-image-type">
                <TextField
                  select
                  size="small"
                  fullWidth
                  label="Image Type"
                  value={imageType}
                  sx={muiFieldSx}
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
              </div>
              </div>

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
                data-tour="data-upload-dropzone"
                className={`mt-4 flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-7 text-center cursor-pointer transition ${
                  isDragging
                    ? "border-[#2563EB] bg-blue-50/60"
                    : "border-slate-200 bg-white hover:border-[#2563EB]/40 hover:bg-blue-50/30"
                }`}
                onClick={() => inputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <UploadCloud size={22} className={isDragging ? "text-[#2563EB]" : "text-slate-400"} />
                <p className="text-xs font-pmedium text-slate-600">
                  {isDragging
                    ? "Drop image here"
                    : file
                    ? "Change image"
                    : "Drag & drop an image here, or click to browse"}
                </p>
                {file ? (
                  <p className="text-[10px] font-pmedium text-slate-400">
                    {file.name} · {humanSize(file.size)}
                  </p>
                ) : (
                  <p className="text-[10px] font-pmedium text-slate-400">
                    .jpg, .png · Max {humanSize(MAX_BYTES)}
                  </p>
                )}
              </div>

              {/* Preview */}
              {preview && (
                <div className="mt-4">
                  <img
                    src={preview}
                    alt="preview"
                    className="mx-auto h-48 w-48 rounded-xl border border-slate-200 object-cover"
                  />
                </div>
              )}

              {error && <div className="mt-2 text-xs text-rose-600">{error}</div>}

              {/* Actions */}
              <div className="mt-4" data-tour="data-upload-actions">
                <UploadActions
                  onUpload={handleUpload}
                  onReset={handleReset}
                  pending={isPending}
                  uploadDisabled={!file || !companyId || !imageType || isPending}
                  resetDisabled={isPending && !file}
                />
              </div>

              <UploadResultSummary data={uploadResult} error={uploadError} />
            </>
          )}
      </UploadPanel>
    </UploadCard>
  );
};

export default UploadSingleImage;

// Helpers

function safeParseJSON(value) {
  try {
    return JSON.parse(value || "{}");
  } catch {
    return {};
  }
}

function humanSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
