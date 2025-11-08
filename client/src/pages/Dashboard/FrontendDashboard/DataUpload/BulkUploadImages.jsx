// src/pages/Dashboard/FrontendDashboard/BulkUploadImages.jsx
import React, { useRef, useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { TextField, MenuItem } from "@mui/material";
import PageFrame from "../../../../components/Pages/PageFrame";
import PrimaryButton from "../../../../components/PrimaryButton";
import SecondaryButton from "../../../../components/SecondaryButton";
import { toast } from "sonner";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import UploadMultipleFilesInput from "../../../../components/UploadMultipleFilesInput";
import useAxiosPrivate from "../../../../hooks/useAxiosPrivate";

const API_BASE = "https://wononomadsbe.vercel.app/api";
const MAX_FILES = 10;
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const BulkUploadImages = () => {
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const axios = useAxiosPrivate();

  const [country, setCountry] = useState("Thailand");
  const [companyType, setCompanyType] = useState("coworking");
  const [companyId, setCompanyId] = useState("");
  const [images, setImages] = useState([]); // store File[]
  const [previews, setPreviews] = useState([]); // store preview URLs
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");

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

  // ✅ Prefill from session storage if available
  useEffect(() => {
    if (isLoading || !companies.length) return;
    try {
      const context = JSON.parse(
        sessionStorage.getItem("uploadContext") || "{}"
      );

      if (context.companyId && context.country && context.companyType) {
        setCountry(context.country);
        setCompanyType(context.companyType);
        setCompanyId(context.businessId);
        sessionStorage.removeItem("uploadContext");
      }
    } catch (err) {
      console.error("Failed to parse upload context:", err);
    }
  }, [companies, isLoading]);

  const countries = [...new Set(companies.map((c) => c.country))];
  const types = [...new Set(companies.map((c) => c.companyType))];
  const filteredCompanies = companies.filter(
    (c) => c.country === country && c.companyType === companyType
  );

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

  const { mutate, isPending } = useMutation({
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
      toast.success(data?.message || "Upload successful");
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
    <div className="p-0">
      <PageFrame>
        <h2 className="font-pmedium text-title text-primary uppercase">
          Bulk Upload Product Images (For First Time Upload)
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
                    onClick={(e) => e.stopPropagation()} // ✅ prevent dropdown from closing
                    onKeyDown={(e) => e.stopPropagation()} // ✅ allow typing without closing
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

              {/* File Input */}
              <UploadMultipleFilesInput
                value={images}
                onChange={setImages}
                label="Company Images"
                maxFiles={MAX_FILES}
                allowedExtensions={["webp"]}
                id="bulk-upload-images"
                previewType="image"
              />

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
