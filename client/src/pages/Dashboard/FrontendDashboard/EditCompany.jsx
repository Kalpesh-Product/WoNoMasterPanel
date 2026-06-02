import React, { useEffect, useState } from "react";
import PageFrame from "../../../components/Pages/PageFrame";
import { Controller, useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import Input from '@mui/joy/Input';
import Select from '@mui/joy/Select';
import Option from '@mui/joy/Option';
import Textarea from '@mui/joy/Textarea';
import { toast } from "sonner";
import PrimaryButton from "../../../components/PrimaryButton";
import { City, Country, State } from "country-state-city";
import { useParams } from "react-router-dom";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import Button from '@mui/joy/Button';
import SvgIcon from '@mui/joy/SvgIcon';
import { styled } from '@mui/joy';

const VisuallyHiddenInput = styled('input')`
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  height: 1px;
  overflow: hidden;
  position: absolute;
  bottom: 0;
  left: 0;
  white-space: nowrap;
  width: 1px;
`;

const LogoUploadInput = ({ value, onChange, currentLogoUrl }) => {
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    if (value instanceof File) {
      const objectUrl = URL.createObjectURL(value);
      setPreviewUrl(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    } else {
      setPreviewUrl(null);
    }
  }, [value]);

  const hasLogo = value || currentLogoUrl;

  return (
    <div className="flex flex-col gap-2 w-full mt-4">
      <label className="text-sm text-slate-700">Company Logo</label>
      <div className="flex items-center gap-3 h-[40px]">
        <Button
          component="label"
          role={undefined}
          tabIndex={-1}
          variant="outlined"
          color="neutral"
          size="sm"
          className="h-full"
          startDecorator={
            <SvgIcon>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z"
                />
              </svg>
            </SvgIcon>
          }
        >
          {hasLogo ? "Change Logo" : "Upload Logo"}
          <VisuallyHiddenInput
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                onChange(file);
              }
            }}
          />
        </Button>

        {hasLogo && (
          <div className="flex items-center gap-2 h-full">
            <img
              src={previewUrl || currentLogoUrl}
              alt="Company Logo Preview"
              className="w-10 h-10 rounded-md border border-slate-200 object-contain bg-white shadow-sm"
            />
            {value && (
              <span className="text-xs text-slate-500 max-w-[150px] truncate">
                {value.name}
              </span>
            )}
            {value && (
              <button
                type="button"
                onClick={() => onChange(null)}
                className="text-xs text-red-600 hover:text-red-800 font-medium ml-1"
              >
                Remove
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const parseCommaSeparatedList = (value = "") =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const EditCompany = () => {
  const { companyId } = useParams();
  const axiosPrivate = useAxiosPrivate();

  const { control, handleSubmit, reset, setValue, watch } = useForm({
    defaultValues: {
      // name: "",
      // email: "",
      // mobile: "",
      // country: "",
      // state: "",
      // city: "",
      companyName: "",
      registeredEntityName: "",
      industry: "",
      companySize: "",
      companyCity: "",
      companyState: "",
      companyCountry: "",
      companyContinent: "",
      websiteURL: "",
      linkedinURL: "",
      selectedApps: "",
      selectedModules: "",
      selectedDefaults: "",

      pocName: "",
      pocDesignation: "",
      pocEmail: "",
      pocPhone: "",
      pocLinkedInProfile: "",
      pocLanguages: "",
      pocAddress: "",
      pocProfileImage: "",
      companyLogo: null,
      isActive: true,
    },
  });

  const {
    data: company,
    isLoading: isCompanyLoading,
    isError: isCompanyError,
    error: companyError,
  } = useQuery({
    queryKey: ["companyDetails", companyId],
    enabled: Boolean(companyId),
    queryFn: async () => {
      const response = await axiosPrivate.get("/api/hosts/company", {
        params: { companyId },
      });

      return response?.data?.data || response?.data;
    },
  });

  useEffect(() => {
    if (!companyId) {
      toast.error("Invalid company id");
    }
  }, [companyId]);

  useEffect(() => {
    if (!company) return;

    const selectedServices = company?.selectedServices || {};
    reset({
      companyName: company.companyName || "",
      registeredEntityName: company.registeredEntityName || "",
      industry: company.industry || "",
      companySize: company.companySize || "",
      companyCity: company.companyCity || "",
      companyState: company.companyState || "",
      companyCountry: company.companyCountry || "",
      companyContinent: company.companyContinent || "",
      websiteURL: company.websiteURL || company.websiteLink || "",
      linkedinURL: company.linkedinURL || "",
      selectedApps: (selectedServices.apps || [])
        .map((item) => item?.appName)
        .filter(Boolean)
        .join(", "),
      selectedModules: (selectedServices.modules || [])
        .map((item) => item?.moduleName)
        .filter(Boolean)
        .join(", "),
      selectedDefaults: (selectedServices.defaults || [])
        .map((item) => item?.name)
        .filter(Boolean)
        .join(", "),
      pocName: company.pocName || "",
      pocDesignation: company.pocDesignation || "",
      pocEmail: company.pocEmail || "",
      pocPhone: company.pocPhone || "",
      pocLinkedInProfile: company.pocLinkedInProfile || "",
      pocLanguages: (company.pocLanguages || []).join(", "),
      pocAddress: company.pocAddress || "",
      pocProfileImage: company.pocProfileImage || "",
      isActive: company.isActive ?? true,
    });
  }, [company, reset]);

  useEffect(() => {
    if (isCompanyError) {
      toast.error(
        companyError?.response?.data?.message ||
        "Failed to fetch company details",
      );
    }
  }, [isCompanyError, companyError]);

  const { mutate: updateCompany, isPending: isUpdateCompanyLoading } =
    useMutation({
      mutationFn: async (payload) => {
        const response = await axiosPrivate.patch(
          "/api/hosts/edit-company",
          payload,
        );

        return response.data;
      },
      onSuccess: () => {
        toast.success("Company updated successfully");
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || "Something went wrong");
      },
    });

  const onSubmit = (data) => {
    if (!companyId) {
      toast.error("Invalid company id");
      return;
    }

    const formattedData = {
      companyId,
      companyName: data.companyName,
      registeredEntityName: data.registeredEntityName,
      industry: data.industry,
      companySize: data.companySize,
      companyCity: data.companyCity,
      companyState: data.companyState,
      companyCountry: data.companyCountry,
      companyContinent: data.companyContinent,
      websiteURL: data.websiteURL,
      linkedinURL: data.linkedinURL,
      selectedServices: {
        apps: parseCommaSeparatedList(data.selectedApps).map((appName) => ({
          appName,
          isActive: true,
        })),
        modules: parseCommaSeparatedList(data.selectedModules).map(
          (moduleName) => ({
            moduleName,
            isActive: true,
          }),
        ),
        defaults: parseCommaSeparatedList(data.selectedDefaults).map(
          (name) => ({
            name,
          }),
        ),
      },
    };

    const formData = new FormData();
    formData.append("data", JSON.stringify(formattedData));

    if (data.companyLogo instanceof File) {
      formData.append("logo", data.companyLogo);
    }

    updateCompany(formData);
  };

  return (
    <div className="p-4">
      <PageFrame>
        <h1 className="text-title text-primary font-pmedium uppercase mb-4">
          Edit Company
        </h1>
        {isCompanyLoading ? <p>Loading company details...</p> : null}
        <form
          className="grid grid-cols-1 gap-4 md:grid-cols-2"
          onSubmit={handleSubmit(onSubmit)}
        >
          {/* Personal Details */}
          {/* <Controller
            name="name"
            control={control}
            rules={{ required: "Full Name is required" }}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label="Full Name"
                fullWidth
                margin="normal"
                variant="standard"
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              />
            )}
          />

          <Controller
            name="email"
            control={control}
            rules={{
              required: "Email is required",
              pattern: { value: /^\S+@\S+$/i, message: "Invalid email" },
            }}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label="Email"
                fullWidth
                margin="normal"
                variant="standard"
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              />
            )}
          />

          <Controller
            name="mobile"
            control={control}
            rules={{ required: "Mobile number is required" }}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label="Mobile"
                fullWidth
                margin="normal"
                variant="standard"
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              />
            )}
          /> */}

          {/* Location */}
          {/* <Controller
            name="country"
            control={control}
            // rules={{ required: "Country is required" }}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                select
                label="Country"
                fullWidth
                margin="normal"
                variant="standard"
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
                onChange={(e) => {
                  const value = e.target.value;
                  field.onChange(value); // update form with country name
                  setValue("state", ""); // reset state
                  setValue("city", ""); // reset city
                }}
              >
                {Country.getAllCountries().map((c) => (
                  <MenuItem key={c.isoCode} value={c.name}>
                    {c.name}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />

          <Controller
            name="state"
            control={control}
            // rules={{ required: "State is required" }}
            render={({ field, fieldState }) => {
              const countryName = watch("country");
              const countryObj = Country.getAllCountries().find(
                (c) => c.name === countryName
              );
              const states = countryObj
                ? State.getStatesOfCountry(countryObj.isoCode)
                : [];

              return (
                <TextField
                  {...field}
                  select
                  label="State"
                  fullWidth
                  margin="normal"
                  variant="standard"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                  disabled={!countryObj}
                  onChange={(e) => {
                    const value = e.target.value;
                    field.onChange(value); // store state name
                    setValue("city", ""); // reset city when state changes
                  }}
                >
                  {states.map((s) => (
                    <MenuItem key={s.isoCode} value={s.name}>
                      {s.name}
                    </MenuItem>
                  ))}
                </TextField>
              );
            }}
          />

          <Controller
            name="city"
            control={control}
            // rules={{ required: "City is required" }}
            render={({ field, fieldState }) => {
              const countryName = watch("country");
              const stateName = watch("state");

              const countryObj = Country.getAllCountries().find(
                (c) => c.name === countryName
              );
              const stateObj =
                countryObj &&
                State.getStatesOfCountry(countryObj.isoCode).find(
                  (s) => s.name === stateName
                );

              const cities =
                countryObj && stateObj
                  ? City.getCitiesOfState(countryObj.isoCode, stateObj.isoCode)
                  : [];

              return (
                <TextField
                  {...field}
                  select
                  label="City"
                  fullWidth
                  margin="normal"
                  variant="standard"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                  disabled={!stateObj}
                >
                  {cities.map((city) => (
                    <MenuItem key={city.name} value={city.name}>
                      {city.name}
                    </MenuItem>
                  ))}
                </TextField>
              );
            }}
          /> */}

          {/* Company Info */}
          <Controller
            name="companyName"
            control={control}
            rules={{ required: "Company Name is required" }}
            render={({ field, fieldState }) => (
              <div className="flex flex-col gap-2 w-full mt-4">
                <label className="text-sm text-slate-700">Company Name</label>
                <Input
                  {...field}
                  placeholder="Company Name"
                  variant="outlined"
                  color="neutral"
                  error={!!fieldState.error}
                />
                {fieldState.error ? (
                  <span className="text-xs text-red-600">
                    {fieldState.error.message}
                  </span>
                ) : null}
              </div>
            )}
          />

          {/* companyLogo (single) */}
          {/* logo preview */}
          <Controller
            name="companyLogo"
            control={control}
            render={({ field }) => (
              <LogoUploadInput
                value={field.value}
                onChange={field.onChange}
                currentLogoUrl={company?.logo?.url}
              />
            )}
          />

          <Controller
            name="industry"
            control={control}
            render={({ field }) => (
              <div className="flex flex-col gap-2 w-full mt-4">
                <label className="text-sm text-slate-700">Industry</label>
                <Input
                  {...field}
                  placeholder="Industry"
                  variant="outlined"
                  color="neutral"
                // error={!!fieldState.error}
                />
                {/* {fieldState.error ? ( */}
                <span className="text-xs text-red-600">
                  {/* {fieldState.error.message} */}
                </span>
                {/* ) : null} */}
              </div>
            )}
          />

          <Controller
            name="companySize"
            control={control}
            render={({ field, fieldState }) => (
              <div className="flex flex-col gap-2 w-full mt-4">
                <label className="text-sm text-slate-700">Company Size</label>
                <Input
                  {...field}
                  placeholder="Company Size"
                  variant="outlined"
                  color="neutral"
                  error={!!fieldState.error}
                />
                {fieldState.error ? (
                  <span className="text-xs text-red-600">
                    {fieldState.error.message}
                  </span>
                ) : null}
              </div>
            )}
          />
          <Controller
            name="registeredEntityName"
            control={control}
            render={({ field }) => (
              <div className="flex flex-col gap-2 w-full mt-4">
                <label className="text-sm text-slate-700">Registered Entity Name</label>
                <Input
                  {...field}
                  placeholder="Registered Entity Name"
                  variant="outlined"
                  color="neutral"
                // error={!!fieldState.error}
                />
                {/* {fieldState.error ? ( */}
                <span className="text-xs text-red-600">
                  {/* {fieldState.error.message} */}
                </span>
                {/* ) : null} */}
              </div>
            )}
          />

          {/* <Controller
            name="companyType"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Company Type"
                fullWidth
                margin="normal"
                variant="standard"
              />
            )}
          /> */}

          {/* Company Location */}
          <Controller
            name="companyCountry"
            control={control}
            render={({ field, fieldState }) => (
              <div className="flex flex-col gap-2 w-full mt-4">
                <label className="text-sm text-slate-700">Company Country</label>
                <Select
                  value={field.value || null}
                  placeholder="Select Country"
                  variant="outlined"
                  color="neutral"
                  error={!!fieldState.error}
                  onChange={(_, val) => {
                    field.onChange(val);
                    setValue("companyState", "");
                    setValue("companyCity", "");
                  }}
                >
                  {Country.getAllCountries().map((c) => (
                    <Option key={c.isoCode} value={c.name}>
                      {c.name}
                    </Option>
                  ))}
                </Select>
                {fieldState.error ? (
                  <span className="text-xs text-red-600">
                    {fieldState.error.message}
                  </span>
                ) : null}
              </div>
            )}
          />

          <Controller
            name="companyState"
            control={control}
            render={({ field, fieldState }) => {
              const companyCountryName = watch("companyCountry");
              const companyCountryObj = Country.getAllCountries().find(
                (c) => c.name === companyCountryName,
              );
              const states = companyCountryObj
                ? State.getStatesOfCountry(companyCountryObj.isoCode)
                : [];

              return (
                <div className="flex flex-col gap-2 w-full mt-4">
                  <label className="text-sm text-slate-700">Company State</label>
                  <Select
                    value={field.value || null}
                    placeholder="Select State"
                    variant="outlined"
                    color="neutral"
                    disabled={!companyCountryObj}
                    error={!!fieldState.error}
                    onChange={(_, val) => {
                      field.onChange(val);
                      setValue("companyCity", "");
                    }}
                  >
                    {states.map((s) => (
                      <Option key={s.isoCode} value={s.name}>
                        {s.name}
                      </Option>
                    ))}
                  </Select>
                  {fieldState.error ? (
                    <span className="text-xs text-red-600">
                      {fieldState.error.message}
                    </span>
                  ) : null}
                </div>
              );
            }}
          />

          <Controller
            name="companyCity"
            control={control}
            render={({ field, fieldState }) => {
              const companyCountryName = watch("companyCountry");
              const companyStateName = watch("companyState");

              const companyCountryObj = Country.getAllCountries().find(
                (c) => c.name === companyCountryName,
              );
              const companyStateObj =
                companyCountryObj &&
                State.getStatesOfCountry(companyCountryObj.isoCode).find(
                  (s) => s.name === companyStateName,
                );

              const cities =
                companyCountryObj && companyStateObj
                  ? City.getCitiesOfState(
                    companyCountryObj.isoCode,
                    companyStateObj.isoCode,
                  )
                  : [];

              return (
                <div className="flex flex-col gap-2 w-full mt-4">
                  <label className="text-sm text-slate-700">Company City</label>
                  <Select
                    value={field.value || null}
                    placeholder="Select City"
                    variant="outlined"
                    color="neutral"
                    disabled={!companyStateObj}
                    error={!!fieldState.error}
                    onChange={(_, val) => {
                      field.onChange(val);
                    }}
                  >
                    {cities.map((city) => (
                      <Option key={city.name} value={city.name}>
                        {city.name}
                      </Option>
                    ))}
                  </Select>
                  {fieldState.error ? (
                    <span className="text-xs text-red-600">
                      {fieldState.error.message}
                    </span>
                  ) : null}
                </div>
              );
            }}
          />

          <Controller
            name="companyContinent"
            control={control}
            render={({ field }) => (
              <div className="flex flex-col gap-2 w-full mt-4">
                <label className="text-sm text-slate-700">Company Continent</label>
                <Input
                  {...field}
                  placeholder="Company Continent"
                  variant="outlined"
                  color="neutral"
                // error={!!fieldState.error}
                />
                {/* {fieldState.error ? ( */}
                <span className="text-xs text-red-600">
                  {/* {fieldState.error.message} */}
                </span>
                {/* ) : null} */}
              </div>
            )}
          />

          <Controller
            name="websiteURL"
            control={control}
            render={({ field, fieldState }) => (
              <div className="flex flex-col gap-2 w-full mt-4">
                <label className="text-sm text-slate-700">Website URL</label>
                <Input
                  {...field}
                  placeholder="https://example.com"
                  variant="outlined"
                  color="neutral"
                  error={!!fieldState.error}
                />
                {fieldState.error ? (
                  <span className="text-xs text-red-600">
                    {fieldState.error.message}
                  </span>
                ) : null}
              </div>
            )}
          />

          <Controller
            name="linkedinURL"
            control={control}
            render={({ field }) => (
              <div className="flex flex-col gap-2 w-full mt-4">
                <label className="text-sm text-slate-700">LinkedIn URL</label>
                <Input
                  {...field}
                  placeholder="Type in here"
                  variant="outlined"
                  color="neutral"
                // error={!!fieldState.error}
                />
                {/* {fieldState.error ? ( */}
                <span className="text-xs text-red-600">
                  {/* {fieldState.error.message} */}
                </span>
                {/* ) : null} */}
              </div>
            )}
          />

          <Controller
            name="selectedApps"
            control={control}
            render={({ field, fieldState }) => (
              <div className="flex flex-col gap-2 w-full mt-4">
                <label className="text-sm text-slate-700">Apps (comma separated)</label>
                <Input
                  {...field}
                  placeholder="Type in here"
                  variant="outlined"
                  color="neutral"
                  error={!!fieldState.error}
                />
                <span className="text-xs text-slate-500">
                  Allowed: tickets, meetings, tasks, performance, visitors, assets
                </span>
                {fieldState.error ? (
                  <span className="text-xs text-red-600">
                    {fieldState.error.message}
                  </span>
                ) : null}
              </div>
            )}
          />

          <Controller
            name="selectedModules"
            control={control}
            render={({ field, fieldState }) => (
              <div className="flex flex-col gap-2 w-full mt-4">
                <label className="text-sm text-slate-700">Modules (comma separated)</label>
                <Input
                  {...field}
                  placeholder="Type in here"
                  variant="outlined"
                  color="neutral"
                  error={!!fieldState.error}
                />
                <span className="text-xs text-slate-500">
                  Allowed: finance, sales, hr, admin, maintenance, it
                </span>
                {fieldState.error ? (
                  <span className="text-xs text-red-600">
                    {fieldState.error.message}
                  </span>
                ) : null}
              </div>
            )}
          />

          <Controller
            name="selectedDefaults"
            control={control}
            render={({ field, fieldState }) => (
              <div className="flex flex-col gap-2 w-full mt-4">
                <label className="text-sm text-slate-700">Defaults (comma separated)</label>
                <Input
                  {...field}
                  placeholder="Type in here"
                  variant="outlined"
                  color="neutral"
                  error={!!fieldState.error}
                />
                <span className="text-xs text-slate-500">
                  Allowed: websiteBuilder, leadGeneration, automatedGoogleSheets
                </span>
                {fieldState.error ? (
                  <span className="text-xs text-red-600">
                    {fieldState.error.message}
                  </span>
                ) : null}
              </div>
            )}
          />

          {/* ------------------- POC SECTION ------------------- */}
          <div className="col-span-1 mt-6 md:col-span-2">
            <h2 className="text-title font-pmedium text-primary mb-2">
              Point of Contact (POC) Details
            </h2>
          </div>

          <Controller
            name="pocName"
            control={control}
            rules={{ required: "POC Name is required" }}
            render={({ field, fieldState }) => (
              <div className="flex flex-col gap-2 w-full mt-4">
                <label className="text-sm text-slate-700">POC Name</label>
                <Input
                  {...field}
                  placeholder="Type in here"
                  variant="outlined"
                  color="neutral"
                  error={!!fieldState.error}
                />
                {fieldState.error ? (
                  <span className="text-xs text-red-600">
                    {fieldState.error.message}
                  </span>
                ) : null}
              </div>
            )}
          />

          <Controller
            name="pocDesignation"
            control={control}
            render={({ field, fieldState }) => (
              <div className="flex flex-col gap-2 w-full mt-4">
                <label className="text-sm text-slate-700">POC Designation</label>
                <Input
                  {...field}
                  placeholder="Type in here"
                  variant="outlined"
                  color="neutral"
                  error={!!fieldState.error}
                />
                {fieldState.error ? (
                  <span className="text-xs text-red-600">
                    {fieldState.error.message}
                  </span>
                ) : null}
              </div>
            )}
          />

          <Controller
            name="pocEmail"
            control={control}
            rules={{
              required: "POC Email is required",
              pattern: { value: /^\S+@\S+$/i, message: "Invalid email" },
            }}
            render={({ field, fieldState }) => (
              <div className="flex flex-col gap-2 w-full mt-4">
                <label className="text-sm text-slate-700">POC Email</label>
                <Input
                  {...field}
                  placeholder="Type in here"
                  variant="outlined"
                  color="neutral"
                  error={!!fieldState.error}
                />
                {fieldState.error ? (
                  <span className="text-xs text-red-600">
                    {fieldState.error.message}
                  </span>
                ) : null}
              </div>
            )}
          />

          <Controller
            name="pocPhone"
            control={control}
            rules={{ required: "POC Phone is required" }}
            render={({ field, fieldState }) => (
              <div className="flex flex-col gap-2 w-full mt-4">
                <label className="text-sm text-slate-700">POC Phone</label>
                <Input
                  {...field}
                  placeholder="Type in here"
                  variant="outlined"
                  color="neutral"
                  error={!!fieldState.error}
                />
                {fieldState.error ? (
                  <span className="text-xs text-red-600">
                    {fieldState.error.message}
                  </span>
                ) : null}
              </div>
            )}
          />

          <Controller
            name="pocLinkedInProfile"
            control={control}
            render={({ field, fieldState }) => (
              <div className="flex flex-col gap-2 w-full mt-4">
                <label className="text-sm text-slate-700">LinkedIn Profile URL</label>
                <Input
                  {...field}
                  placeholder="Type in here"
                  variant="outlined"
                  color="neutral"
                  error={!!fieldState.error}
                />
                {fieldState.error ? (
                  <span className="text-xs text-red-600">
                    {fieldState.error.message}
                  </span>
                ) : null}
              </div>
            )}
          />

          <Controller
            name="pocLanguages"
            control={control}
            render={({ field, fieldState }) => (
              <div className="flex flex-col gap-2 w-full mt-4">
                <label className="text-sm text-slate-700">Languages (comma separated)</label>
                <Input
                  {...field}
                  placeholder="Type in here"
                  variant="outlined"
                  color="neutral"
                  error={!!fieldState.error}
                />
                {fieldState.error ? (
                  <span className="text-xs text-red-600">
                    {fieldState.error.message}
                  </span>
                ) : null}
              </div>
            )}
          />

          <Controller
            name="pocAddress"
            control={control}
            render={({ field, fieldState }) => (
              <div className="flex flex-col gap-2 w-full mt-4">
                <label className="text-sm text-slate-700">POC Address</label>
                <Textarea
                  {...field}
                  placeholder="Type address here..."
                  minRows={3}
                  variant="outlined"
                  color="neutral"
                  error={!!fieldState.error}
                />
                {fieldState.error ? (
                  <span className="text-xs text-red-600">
                    {fieldState.error.message}
                  </span>
                ) : null}
              </div>
            )}
          />

          <Controller
            name="pocProfileImage"
            control={control}
            render={({ field, fieldState }) => (
              <div className="flex flex-col gap-2 w-full mt-4">
                <label className="text-sm text-slate-700">Profile Image URL</label>
                <Input
                  {...field}
                  placeholder="Type in here"
                  variant="outlined"
                  color="neutral"
                  error={!!fieldState.error}
                />
                {fieldState.error ? (
                  <span className="text-xs text-red-600">
                    {fieldState.error.message}
                  </span>
                ) : null}
              </div>
            )}
          />

          {/* <Controller
            name="pocAvailabilityTime"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Availability Time"
                fullWidth
                margin="normal"
                variant="standard"
              />
            )}
          /> */}

          {/* Later: selectedServices → you may want checkboxes or multi-select */}
          <div className="flex justify-center items-center w-full col-span-1 md:col-span-2">
            <PrimaryButton
              externalStyles={""}
              title={"Submit"}
              type={"submit"}
              isLoading={isUpdateCompanyLoading}
              disabled={isUpdateCompanyLoading}
            />
          </div>
        </form>
      </PageFrame>
    </div>
  );
};

export default EditCompany;
