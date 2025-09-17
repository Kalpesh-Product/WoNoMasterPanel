import React, { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { useQuery, useMutation } from "@tanstack/react-query";
import { TextField, MenuItem } from "@mui/material";
import PageFrame from "../../../../components/Pages/PageFrame";
import PrimaryButton from "../../../../components/PrimaryButton";
import SecondaryButton from "../../../../components/SecondaryButton";
import useAxiosPrivate from "../../../../hooks/useAxiosPrivate";
import { toast } from "sonner";
import UploadMultipleFilesInput from "../../../../components/UploadMultipleFilesInput";

const ProductImageUpload = () => {
  const axios = useAxiosPrivate();
  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [selectedCompany, setSelectedCompany] = useState("");

  const { control, handleSubmit, reset } = useForm({
    defaultValues: {
      country: "",
      companyType: "",
      companyId: "",
      images: [],
    },
  });

  // ✅ Fetch companies
  const { data: companies = [], isLoading } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const res = await axios.get("/api/company/companies");
      return res.data;
    },
  });

  // Derive dropdown values
  const countries = [...new Set(companies.map((c) => c.country))];
  const companyTypes = [...new Set(companies.map((c) => c.companyType))];
  const filteredCompanies = companies.filter(
    (c) => c.country === selectedCountry && c.companyType === selectedType
  );

  // ✅ Upload mutation
  const { mutate, isPending } = useMutation({
    mutationKey: ["bulk-add-company-images"],
    mutationFn: async ({ companyId, images }) => {
      const fd = new FormData();
      fd.append("companyId", companyId);
      (images || []).forEach((img) => fd.append("images", img));
      const res = await axios.post("/api/company/bulk-add-company-images", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success("Images uploaded successfully!");
      reset();
      setSelectedCompany("");
      setSelectedCountry("");
      setSelectedType("");
    },
    onError: (err) => {
      console.error(err);
      toast.error(err?.response?.data?.message || "Failed to upload images");
    },
  });

  const onSubmit = (values) => {
    if (!selectedCompany) return toast.error("Select a company first");
    mutate({ companyId: selectedCompany, images: values.images });
  };

  return (
    <PageFrame>
      <div className="p-6 max-w-2xl mx-auto">
        <h4 className="text-2xl font-semibold mb-4">
          Bulk Upload Company Images
        </h4>

        {/* {isLoading ? (
          <p>Loading companies...</p>
        ) : ( */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
          {/* Country */}
          <Controller
            name="country"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                select
                size="small"
                label="Country"
                fullWidth
                value={selectedCountry}
                onChange={(e) => {
                  field.onChange(e);
                  setSelectedCountry(e.target.value);
                  setSelectedType("");
                  setSelectedCompany("");
                }}>
                {countries.map((country) => (
                  <MenuItem key={country} value={country}>
                    {country}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />

          {/* Company Type */}
          <Controller
            name="companyType"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                select
                size="small"
                label="Company Type"
                fullWidth
                value={selectedType}
                onChange={(e) => {
                  field.onChange(e);
                  setSelectedType(e.target.value);
                  setSelectedCompany("");
                }}
                disabled={!selectedCountry}>
                {companyTypes.map((type) => (
                  <MenuItem key={type} value={type}>
                    {type}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />

          {/* Company */}
          <Controller
            name="companyId"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                select
                size="small"
                label="Company"
                fullWidth
                value={selectedCompany}
                onChange={(e) => {
                  field.onChange(e);
                  setSelectedCompany(e.target.value);
                }}
                disabled={!selectedType}>
                {filteredCompanies.map((company) => (
                  <MenuItem key={company._id} value={company._id}>
                    {company.companyName}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />

          {/* Image Upload */}
          <Controller
            name="images"
            control={control}
            render={({ field }) => (
              <UploadMultipleFilesInput
                {...field}
                label="Company Images"
                maxFiles={12}
                allowedExtensions={["jpg", "jpeg", "png", "webp", "pdf"]}
                disabled={!selectedCompany}
              />
            )}
          />
          {!selectedCompany && (
            <p className="text-xs text-gray-500">
              Select a company first to upload images.
            </p>
          )}

          {/* Buttons */}
          <div className="flex gap-4 justify-center">
            <PrimaryButton
              type="submit"
              title={isPending ? "Uploading..." : "Submit"}
              isLoading={isPending}
              disabled={!selectedCompany || isPending}
            />
            <SecondaryButton
              type="button"
              title="Reset"
              handleSubmit={() => {
                reset();
                setSelectedCompany("");
                setSelectedCountry("");
                setSelectedType("");
              }}
              disabled={isPending}
            />
          </div>
        </form>
        {/* )} */}
      </div>
    </PageFrame>
  );
};

export default ProductImageUpload;
