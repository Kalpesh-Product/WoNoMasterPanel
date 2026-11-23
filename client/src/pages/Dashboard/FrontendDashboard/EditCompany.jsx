import React, { useEffect, useState } from "react";
import PageFrame from "../../../components/Pages/PageFrame";
import { Controller, useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import PrimaryButton from "../../../components/PrimaryButton";
import SecondaryButton from "../../../components/SecondaryButton";
import WebsiteFormField from "../../../components/WebsiteFormField";
import { City, Country, State } from "country-state-city";
import { useNavigate, useParams } from "react-router-dom";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import { Building2, Loader2, Trash2, Upload } from "lucide-react";
import { statusPillClass } from "../../../lib/status-pill";

// A section heading inside the form grid — same treatment as the Nomad
// listing edit form's "Reviews" divider.
const SectionTitle = ({ title }) => (
  <div className="col-span-1 mt-2 border-b border-gray-300 py-3 md:col-span-2">
    <span className="text-lg font-medium text-primary">{title}</span>
  </div>
);

// Logo picker: preview of the stored logo plus a native file input, styled
// like the other labelled fields on this form.
const LogoUploadField = ({ value, onChange, currentLogoUrl }) => {
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    if (value instanceof File) {
      const objectUrl = URL.createObjectURL(value);
      setPreviewUrl(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    }
    setPreviewUrl(null);
  }, [value]);

  const resolvedLogo = previewUrl || currentLogoUrl || null;

  return (
    <div className="col-span-1 flex min-w-0 flex-col md:col-span-2">
      <label
        htmlFor="companyLogo"
        className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest"
      >
        Company Logo
      </label>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200/60 bg-white">
          {resolvedLogo ? (
            <img
              src={resolvedLogo}
              alt="Company logo preview"
              className="h-full w-full object-contain"
            />
          ) : (
            <Building2 size={20} className="text-slate-300" />
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <label
              htmlFor="companyLogo"
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200/60 bg-white px-3 py-2 text-[11px] font-pmedium uppercase tracking-wider text-slate-600 transition hover:border-[#2563EB] hover:text-[#2563EB]"
            >
              <Upload size={13} />
              {resolvedLogo ? "Change logo" : "Upload logo"}
            </label>
            {value instanceof File ? (
              <button
                type="button"
                onClick={() => onChange(null)}
                className="inline-flex items-center gap-1 text-[11px] font-pmedium text-rose-600 hover:text-rose-800"
              >
                <Trash2 size={12} />
                Remove
              </button>
            ) : null}
          </div>
          <p className="max-w-[260px] truncate text-[10px] text-slate-400">
            {value instanceof File
              ? value.name
              : "Leave unchanged to keep the current logo."}
          </p>
        </div>
      </div>
      <input
        id="companyLogo"
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onChange(file);
        }}
      />
    </div>
  );
};

const parseCommaSeparatedList = (value = "") =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

// Single place that maps the fetched company onto form defaults, so both the
// initial prefill and "Reset" restore exactly what the server returned.
const toFormValues = (company) => {
  const selectedServices = company?.selectedServices || {};
  return {
    companyName: company?.companyName || "",
    registeredEntityName: company?.registeredEntityName || "",
    industry: company?.industry || "",
    companySize: company?.companySize || "",
    companyCity: company?.companyCity || "",
    companyState: company?.companyState || "",
    companyCountry: company?.companyCountry || "",
    companyContinent: company?.companyContinent || "",
    websiteURL: company?.websiteURL || company?.websiteLink || "",
    linkedinURL: company?.linkedinURL || "",
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
    pocName: company?.pocName || "",
    pocDesignation: company?.pocDesignation || "",
    pocEmail: company?.pocEmail || "",
    pocPhone: company?.pocPhone || "",
    pocLinkedInProfile: company?.pocLinkedInProfile || "",
    pocLanguages: (company?.pocLanguages || []).join(", "),
    pocAddress: company?.pocAddress || "",
    pocProfileImage: company?.pocProfileImage || "",
    companyLogo: null,
    isActive: company?.isActive ?? true,
  };
};

const EditCompany = () => {
  const { companyId } = useParams();
  const axiosPrivate = useAxiosPrivate();
  const navigate = useNavigate();

  const { control, handleSubmit, reset, setValue, watch } = useForm({
    defaultValues: toFormValues(null),
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
    reset(toFormValues(company));
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

  const currentLogoUrl = company?.logo?.url || null;
  const resetToSaved = () => reset(toFormValues(company));

  return (
    <div className="p-4">
      <PageFrame>
        <div className="mb-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <h1 className="text-title text-primary font-pmedium uppercase">
              Edit Company
            </h1>
            <p className="mt-1 truncate text-xs font-pmedium text-slate-500">
              {company?.companyName || "Company details"}
              {companyId ? ` · ${companyId}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {company ? (
              <span
                className={statusPillClass(
                  company.isRegistered ? "Active" : "Inactive",
                )}
              >
                {company.isRegistered ? "Active" : "Inactive"}
              </span>
            ) : null}
            <SecondaryButton
              type="button"
              title="Back"
              handleSubmit={() => navigate(-1)}
            />
          </div>
        </div>

        {isCompanyLoading ? (
          <p className="flex items-center gap-2 py-6 text-[12px] font-pmedium text-slate-400">
            <Loader2 size={14} className="animate-spin" />
            Loading company details...
          </p>
        ) : null}

        <form
          className="grid grid-cols-1 gap-x-4 md:grid-cols-2"
          onSubmit={handleSubmit(onSubmit)}
        >
          <SectionTitle title="Company Details" />

          <Controller
            name="companyName"
            control={control}
            rules={{ required: "Company Name is required" }}
            render={({ field, fieldState }) => (
              <WebsiteFormField
                field={field}
                label="Company Name"
                required
                placeholder="Company Name"
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              />
            )}
          />

          <Controller
            name="registeredEntityName"
            control={control}
            render={({ field }) => (
              <WebsiteFormField
                field={field}
                label="Registered Entity Name"
                placeholder="Registered Entity Name"
              />
            )}
          />

          <Controller
            name="industry"
            control={control}
            render={({ field }) => (
              <WebsiteFormField
                field={field}
                label="Industry"
                placeholder="e.g. Hospitality"
              />
            )}
          />

          <Controller
            name="companySize"
            control={control}
            render={({ field }) => (
              <WebsiteFormField
                field={field}
                label="Company Size"
                placeholder="e.g. 51-200"
              />
            )}
          />

          <Controller
            name="companyLogo"
            control={control}
            render={({ field }) => (
              <LogoUploadField
                value={field.value}
                onChange={field.onChange}
                currentLogoUrl={currentLogoUrl}
              />
            )}
          />

          <SectionTitle title="Location" />

          <Controller
            name="companyCountry"
            control={control}
            render={({ field, fieldState }) => (
              <WebsiteFormField
                field={field}
                select
                label="Company Country"
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
                onChange={(event) => {
                  field.onChange(event);
                  setValue("companyState", "");
                  setValue("companyCity", "");
                }}
              >
                <option value="">Select Country</option>
                {Country.getAllCountries().map((c) => (
                  <option key={c.isoCode} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </WebsiteFormField>
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
                <WebsiteFormField
                  field={field}
                  select
                  label="Company State"
                  disabled={!companyCountryObj}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                  onChange={(event) => {
                    field.onChange(event);
                    setValue("companyCity", "");
                  }}
                >
                  <option value="">Select State</option>
                  {states.map((s) => (
                    <option key={s.isoCode} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </WebsiteFormField>
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
                <WebsiteFormField
                  field={field}
                  select
                  label="Company City"
                  disabled={!companyStateObj}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                >
                  <option value="">Select City</option>
                  {cities.map((city) => (
                    <option key={city.name} value={city.name}>
                      {city.name}
                    </option>
                  ))}
                </WebsiteFormField>
              );
            }}
          />

          <Controller
            name="companyContinent"
            control={control}
            render={({ field }) => (
              <WebsiteFormField
                field={field}
                label="Company Continent"
                placeholder="e.g. Asia"
              />
            )}
          />

          <SectionTitle title="Web Presence" />

          <Controller
            name="websiteURL"
            control={control}
            render={({ field, fieldState }) => (
              <WebsiteFormField
                field={field}
                label="Website URL"
                placeholder="https://example.com"
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              />
            )}
          />

          <Controller
            name="linkedinURL"
            control={control}
            render={({ field }) => (
              <WebsiteFormField
                field={field}
                label="LinkedIn URL"
                placeholder="https://linkedin.com/company/..."
              />
            )}
          />

          <SectionTitle title="Apps, Modules & Defaults" />

          <Controller
            name="selectedApps"
            control={control}
            render={({ field, fieldState }) => (
              <WebsiteFormField
                field={field}
                label="Apps"
                placeholder="tickets, meetings"
                helperText={
                  fieldState.error?.message ||
                  "Comma separated. Allowed: tickets, meetings, tasks, performance, visitors, assets"
                }
                error={!!fieldState.error}
              />
            )}
          />

          <Controller
            name="selectedModules"
            control={control}
            render={({ field, fieldState }) => (
              <WebsiteFormField
                field={field}
                label="Modules"
                placeholder="finance, hr"
                helperText={
                  fieldState.error?.message ||
                  "Comma separated. Allowed: finance, sales, hr, admin, maintenance, it"
                }
                error={!!fieldState.error}
              />
            )}
          />

          <div className="col-span-1 md:col-span-2">
            <Controller
              name="selectedDefaults"
              control={control}
              render={({ field, fieldState }) => (
                <WebsiteFormField
                  field={field}
                  label="Defaults"
                  placeholder="websiteBuilder, leadGeneration"
                  helperText={
                    fieldState.error?.message ||
                    "Comma separated. Allowed: websiteBuilder, leadGeneration, automatedGoogleSheets"
                  }
                  error={!!fieldState.error}
                />
              )}
            />
          </div>

          <SectionTitle title="Point of Contact" />

          <Controller
            name="pocName"
            control={control}
            rules={{ required: "POC Name is required" }}
            render={({ field, fieldState }) => (
              <WebsiteFormField
                field={field}
                label="POC Name"
                required
                placeholder="Full name"
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              />
            )}
          />

          <Controller
            name="pocDesignation"
            control={control}
            render={({ field, fieldState }) => (
              <WebsiteFormField
                field={field}
                label="POC Designation"
                placeholder="e.g. Operations Manager"
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              />
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
              <WebsiteFormField
                field={field}
                label="POC Email"
                required
                type="email"
                placeholder="name@company.com"
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              />
            )}
          />

          <Controller
            name="pocPhone"
            control={control}
            rules={{ required: "POC Phone is required" }}
            render={({ field, fieldState }) => (
              <WebsiteFormField
                field={field}
                label="POC Phone"
                required
                placeholder="+91 00000 00000"
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              />
            )}
          />

          <Controller
            name="pocLinkedInProfile"
            control={control}
            render={({ field, fieldState }) => (
              <WebsiteFormField
                field={field}
                label="LinkedIn Profile URL"
                placeholder="https://linkedin.com/in/..."
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              />
            )}
          />

          <Controller
            name="pocLanguages"
            control={control}
            render={({ field, fieldState }) => (
              <WebsiteFormField
                field={field}
                label="Languages"
                placeholder="English, Hindi"
                helperText={fieldState.error?.message || "Comma separated"}
                error={!!fieldState.error}
              />
            )}
          />

          <Controller
            name="pocProfileImage"
            control={control}
            render={({ field, fieldState }) => (
              <WebsiteFormField
                field={field}
                label="Profile Image URL"
                placeholder="https://..."
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              />
            )}
          />

          <div className="col-span-1 mt-3 md:col-span-2">
            <Controller
              name="pocAddress"
              control={control}
              render={({ field, fieldState }) => (
                <WebsiteFormField
                  field={field}
                  label="POC Address"
                  multiline
                  minRows={3}
                  placeholder="Type address here..."
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
          </div>

          <div className="col-span-1 mt-4 flex items-center justify-center gap-3 md:col-span-2">
            <PrimaryButton
              type="submit"
              title={isUpdateCompanyLoading ? "Saving..." : "Submit"}
              isLoading={isUpdateCompanyLoading}
              disabled={isUpdateCompanyLoading}
            />
            <button
              type="button"
              onClick={resetToSaved}
              disabled={isUpdateCompanyLoading}
              className="rounded-md bg-gray-200 px-6 py-2 text-[12px] font-pmedium text-black transition hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Reset
            </button>
          </div>
        </form>
      </PageFrame>
    </div>
  );
};

export default EditCompany;
