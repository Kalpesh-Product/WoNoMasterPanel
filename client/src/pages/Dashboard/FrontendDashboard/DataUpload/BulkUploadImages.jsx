// src/pages/Dashboard/FrontendDashboard/BulkUploadImages.jsx
import React, { useRef, useState, useEffect, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { TextField, MenuItem } from "@mui/material";
import { toast } from "sonner";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import UploadMultipleFilesInput from "../../../../components/UploadMultipleFilesInput";
import useAxiosPrivate from "../../../../hooks/useAxiosPrivate";
import UploadResultSummary from "./UploadResultSummary";
import { UploadCard, UploadPanel, UploadActions, ExistingImageThumb, muiFieldSx } from "./UploadUI";
import { NOMADS_API_BASE_URL } from "../../../../constants/api";

const API_BASE = NOMADS_API_BASE_URL;
const MAX_FILES = 10;
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const UPLOAD_FILTERS_STORAGE_KEY = "dataUploadFilters";

const BulkUploadImages = () => {
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const axios = useAxiosPrivate();

  const [country, setCountry] = useState("");
  const [companyType, setCompanyType] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [images, setImages] = useState([]); // store File[]
  const [previews, setPreviews] = useState([]); // store preview URLs
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);

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
      const res = await axios.get(`${API_BASE}/company/companiesma`);
      return res.data;
    },
  });

  // ✅ Prefill from session storage if available
  useEffect(() => {
    if (isLoading || !companies.length) return;
    try {
      const context = JSON.parse(
        sessionStorage.getItem("uploadContext") || "{}",
      );

      if (context.companyId && context.country && context.companyType) {
        setCountry(context.country);
        setCompanyType(context.companyType);
        setCompanyId(context.companyId);
        sessionStorage.removeItem("uploadContext");
      }
    } catch (err) {
      console.error("Failed to parse upload context:", err);
    }
  }, [companies, isLoading]);

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

  // ✅ Fetch this company's already-live images, so the upload cap (10 per
  // company) accounts for what's already there, not just this session's pick.
  const { data: fetchedListing } = useQuery({
    queryKey: ["company-images", companyId, companyType],
    enabled: !!companyId && !!companyType,
    queryFn: async () => {
      const company = companies.find((c) => c._id === companyId);
      if (!company?.companyId) return [];

      const res = await axios.get(
        `${API_BASE}/company/get-listings/${company.companyId}`,
      );
      const all = Array.isArray(res.data) ? res.data : [];
      return all.filter(
        (item) => item.companyType === companyType.toLowerCase(),
      );
    },
  });

  const existingImages = useMemo(
    () =>
      Array.isArray(fetchedListing)
        ? fetchedListing.flatMap((item) => item.images || [])
        : [],
    [fetchedListing],
  );
  const remainingSlots = Math.max(0, MAX_FILES - existingImages.length);
  const atLimit = !!companyId && remainingSlots === 0;

  // ✅ mutation for upload
  // const { mutate, isPending } = useMutation({
  //   mutationFn: async ({ companyId, images }) => {
  //     const form = new FormData();
  //     form.append("companyId", companyId);
  //     images.forEach((img) => form.append("images", img));

  //     // const res = await axios.post(
  //     //   `${API_BASE}/company/bulk-add-company-images`,
  //     //   form,
  //     //   { headers: { "Content-Type": "multipart/form-data" } }
  //     // );

  //     const res = await axios.post(
  //       `api/company/bulk-add-company-images`,
  //       form,
  //       { headers: { "Content-Type": "multipart/form-data" } }
  //     );
  //     return res.data;
  //   },
  //   onSuccess: (data) => {
  //     // toast.success(data?.message || "Upload successful");

  //     toast.success(data?.message || "Upload successful", {
  //       duration: 5000,
  //       action: {
  //         label: "→ Upload Logo",
  //         onClick: () => {
  //           sessionStorage.setItem(
  //             "uploadContext",
  //             JSON.stringify({
  //               country,
  //               companyType,
  //               companyId,
  //             })
  //           );
  //           navigate("../upload-single-image?autoFill=true");
  //         },
  //       },
  //     });
  //     setImages([]);
  //     setCompanyId("");
  //     if (inputRef.current) inputRef.current.value = ""; // ✅ safe reset
  //   },
  //   onError: (err) => {
  //     toast.error(err?.response?.data?.message || "Upload failed");
  //     setError(err?.message || "Something went wrong");
  //   },
  // });

  const { mutate, isPending, data: uploadResult, error: uploadError } = useMutation({
    mutationFn: async ({ companyId, images }) => {
      const form = new FormData();
      form.append("companyId", companyId);
      images.forEach((img) => form.append("images", img));

      const res = await axios.post(`/api/admin/bulk-upload-images`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data;
    },
    onSuccess: (data) => {
      // toast.success(data?.message || "Upload successful");
      toast.success(data?.message || "Upload successful", {
        duration: 5000,
        action: {
          label: "→ Upload Logo",
          onClick: () => {
            sessionStorage.setItem(
              "uploadContext",
              JSON.stringify({
                country,
                companyType,
                companyId,
              }),
            );
            navigate("../upload-single-image?autoFill=true");
          },
        },
      });
      setImages([]);
      setCompanyId("");
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Upload failed");
    },
  });

  function onFileChange(e) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return setImages([]);

    const tooLarge = files.find((f) => f.size > MAX_BYTES);
    if (tooLarge) {
      setError(
        `File ${tooLarge.name} is too large (max ${humanSize(MAX_BYTES)})`,
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

  // function handleUpload() {
  //   if (!companyId) return setError("Please select a company first");
  //   if (!images.length) return setError("Please select images to upload");
  //   mutate({ companyId, images });
  // }

  function handleUpload() {
    if (!companyId || typeof companyId !== "string")
      return setError("Please select a valid company first");
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
    <>
    <UploadCard
      title="Bulk Upload Images"
      description="Pick a company, then upload up to 10 .webp images for it."
    >
      <UploadPanel>
          {isLoading ? (
            <p className="text-xs font-pmedium text-slate-500">Loading companies...</p>
          ) : (
            <>
              {/* Country / Company Type / Company */}
              <div data-tour="data-upload-target-picker" className="grid gap-3 sm:grid-cols-3">
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
                  setSearchTerm(""); // ✅ reset search
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
                  setSearchTerm(""); // ✅ reset search
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
                onChange={(e) => {
                  setCompanyId(e.target.value);
                  setImages([]);
                }}
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
                    onClick={(e) => e.stopPropagation()} // ✅ prevent dropdown from closing
                    onKeyDown={(e) => e.stopPropagation()} // ✅ allow typing without closing
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
              </div>

              {/* Existing images + remaining slots */}
              {companyId && companyType && (
                <div className="mt-4">
                  <p className="text-[10px] font-pmedium uppercase tracking-widest text-slate-400">
                    Current images ({existingImages.length} of {MAX_FILES})
                  </p>
                  {existingImages.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-3">
                      {existingImages.map((img) => (
                        <ExistingImageThumb
                          key={img._id || img.url}
                          src={img.url}
                          onClick={() => setSelectedImage(img.url)}
                        />
                      ))}
                    </div>
                  )}
                  <p className={`mt-2 text-xs font-pmedium ${atLimit ? "text-rose-600" : "text-slate-500"}`}>
                    {atLimit
                      ? `This company already has the maximum of ${MAX_FILES} images — remove some on the Reupload tab before adding more.`
                      : `${remainingSlots} more image${remainingSlots === 1 ? "" : "s"} can be added.`}
                  </p>
                </div>
              )}

              {/* File Input */}
              <div className="mt-4">
                <UploadMultipleFilesInput
                  value={images}
                  onChange={setImages}
                  label="Company Images"
                  maxFiles={companyId ? remainingSlots : MAX_FILES}
                  maxFileSize={MAX_BYTES}
                  allowedExtensions={["webp"]}
                  id="bulk-upload-images"
                  previewType="image"
                  dataTour="data-upload-dropzone"
                  variant="spacious"
                  disabled={atLimit}
                />
              </div>

              <p className="text-xs font-pmedium text-gray-500">
                Accepted type: <code>.webp</code>. Max size:{" "}
                {humanSize(MAX_BYTES)}. Max files: {MAX_FILES} per company.
              </p>

              {error && <div className="mt-2 text-xs text-rose-600">{error}</div>}

              {/* Actions */}
              <div className="mt-4" data-tour="data-upload-actions">
                <UploadActions
                  onUpload={handleUpload}
                  onReset={handleReset}
                  pending={isPending}
                  uploadDisabled={!images.length || !companyId || isPending || atLimit}
                  resetDisabled={isPending && !images.length}
                />
              </div>

              <UploadResultSummary data={uploadResult} error={uploadError} />
            </>
          )}
      </UploadPanel>
    </UploadCard>
    {selectedImage && (
      <div
        className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50"
        onClick={() => setSelectedImage(null)}
      >
        <div className="relative max-w-4xl max-h-[90vh]">
          <img
            src={selectedImage}
            alt="Preview"
            className="max-w-full max-h-[90vh] rounded-lg shadow-lg"
          />
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-2 right-2 text-white text-2xl font-bold bg-black/60 rounded-full px-3 hover:bg-black/80"
          >
            ×
          </button>
        </div>
      </div>
    )}
    </>
  );
};

export default BulkUploadImages;

function safeParseJSON(value) {
  try {
    return JSON.parse(value || "{}");
  } catch {
    return {};
  }
}

// Helpers
function humanSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
