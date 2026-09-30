import axios from "axios";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronDown, Save } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { NOMADS_BACKEND_URL } from "../../../constants/api";

const defaultValues = {
  srNo: "",
  continent: "",
  country: "",
  destination: "",
  visaType: [],
  supportProviding: "",
  numberOfPeople: "",
  company: "",
  agentName: "",
  website: "",
  contact: "",
  email: "",
  address: "",
  rating: "",
  googleReviews: "",
  status: "Active",
};

const visaTypeOptions = [
  "Explore / Travel",
  "Work Remotely",
  "Get a Job Abroad",
  "Study Abroad",
  "Start or Expand a Business",
  "Relocate / Settle Long-Term",
  "Move with Family",
];

const fields = [
  { name: "srNo", label: "Sr No", type: "number", readOnly: true },
  { name: "continent", label: "Continent" },
  { name: "country", label: "Country", required: true },
  { name: "destination", label: "State", required: true },
  { name: "visaType", label: "Visa Type", type: "checkboxGroup" },
  { name: "company", label: "Company", required: true },
  { name: "agentName", label: "Agent Name" },
  { name: "website", label: "Website" },
  { name: "contact", label: "Contact" },
  { name: "email", label: "Email", type: "email" },
  { name: "rating", label: "Rating", type: "number", step: "0.1" },
  { name: "googleReviews", label: "Google Reviews", type: "number" },
];

const supportProvidingField = {
  name: "supportProviding",
  label: "Support Providing",
};

const numberOfPeopleField = {
  name: "numberOfPeople",
  label: "Number Of People",
  type: "number",
};

const partnerEditConfigs = {
  "visa-support": {
    title: "Visa Support",
    routePath: "visa-support",
    endpoint: "/api/visa-support/partners",
    queryKey: ["valueAddsPartners", "visa-support"],
    fields,
    successMessage: "Visa support partner updated successfully",
    errorMessage: "Failed to update visa support partner",
    description:
      "Update visa partner details used across the value-adds partner table.",
  },
  "activation-support": {
    title: "Activation Support",
    routePath: "activation-support",
    endpoint: "/api/activation-support/partners",
    queryKey: ["valueAddsPartners", "activation-support"],
    fields: fields.map((field) =>
      field.name === "visaType" ? supportProvidingField : field,
    ),
    successMessage: "Activation support partner updated successfully",
    errorMessage: "Failed to update activation support partner",
    description:
      "Update activation partner details used across the value-adds partner table.",
  },
  "company-setup": {
    title: "Company Setup",
    routePath: "company-setup",
    endpoint: "/api/company-setup-support/partners",
    queryKey: ["valueAddsPartners", "company-setup"],
    fields: fields.map((field) =>
      field.name === "visaType" ? supportProvidingField : field,
    ),
    successMessage: "Company setup partner updated successfully",
    errorMessage: "Failed to update company setup partner",
    description:
      "Update company setup partner details used across the value-adds partner table.",
  },
  consultation: {
    title: "Consultation",
    routePath: "consultation",
    endpoint: "/api/consultation-support/partners",
    queryKey: ["valueAddsPartners", "consultation"],
    fields: fields.map((field) =>
      field.name === "visaType" ? supportProvidingField : field,
    ),
    successMessage: "Consultation partner updated successfully",
    errorMessage: "Failed to update consultation partner",
    description:
      "Update consultation partner details used across the value-adds partner table.",
  },
  workation: {
    title: "Workation",
    routePath: "workation",
    endpoint: "/api/workation-support/partners",
    queryKey: ["valueAddsPartners", "workation"],
    fields: fields.map((field) =>
      field.name === "visaType" ? numberOfPeopleField : field,
    ),
    successMessage: "Workation partner updated successfully",
    errorMessage: "Failed to update workation partner",
    description:
      "Update workation partner details used across the value-adds partner table.",
  },
};

const toVisaTypeValues = (value) => {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const toFormValues = (partner = {}) => ({
  ...defaultValues,
  ...Object.fromEntries(
    Object.keys(defaultValues).map((key) => [key, partner[key] ?? ""]),
  ),
  visaType: toVisaTypeValues(partner.visaType),
  status: partner.status || "Active",
});

const cleanNumberValue = (value) => (value === "" ? null : Number(value));

const cleanPayload = (values, config) => {
  const payloadFields = new Set([
    ...config.fields.map((field) => field.name),
    "address",
    "status",
  ]);

  return Array.from(payloadFields).reduce((payload, fieldName) => {
    const value = values[fieldName];

    if (fieldName === "visaType") {
      payload.visaType = Array.isArray(value)
        ? value.join(", ")
        : String(value || "").trim();
      return payload;
    }

    if (
      ["srNo", "rating", "googleReviews", "numberOfPeople"].includes(
        fieldName,
      )
    ) {
      payload[fieldName] = cleanNumberValue(value);
      return payload;
    }

    if (fieldName === "email") {
      payload.email = String(value || "").trim().toLowerCase();
      return payload;
    }

    payload[fieldName] = value ?? "";
    return payload;
  }, {});
};

const EditValueAddPartner = ({ config }) => {
  const { partnerId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const statePartner = location.state?.partner || null;
  const [isVisaTypeOpen, setIsVisaTypeOpen] = useState(false);
  const visaTypeDropdownRef = useRef(null);
  const listPath = `/dashboard/value-adds-partners/${config.routePath}`;

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ defaultValues: toFormValues(statePartner) });
  const selectedVisaTypes = useWatch({ control, name: "visaType" }) || [];
  const selectedVisaTypeCount = Array.isArray(selectedVisaTypes)
    ? selectedVisaTypes.length
    : 0;
  const selectedVisaTypeText = selectedVisaTypeCount
    ? `${selectedVisaTypeCount} selected`
    : "Select visa type";

  const { data: partner, isFetching, isError, error } = useQuery({
    queryKey: [...config.queryKey, partnerId],
    queryFn: async () => {
      const response = await axios.get(
        `${NOMADS_BACKEND_URL}${config.endpoint}/${partnerId}`,
      );
      return response?.data?.data || response?.data;
    },
    enabled: Boolean(partnerId),
  });

  useEffect(() => {
    if (partner) {
      reset(toFormValues(partner));
    }
  }, [partner, reset]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        visaTypeDropdownRef.current &&
        !visaTypeDropdownRef.current.contains(event.target)
      ) {
        setIsVisaTypeOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const { mutate, isPending } = useMutation({
    mutationFn: async (values) => {
      const response = await axios.patch(
        `${NOMADS_BACKEND_URL}${config.endpoint}/${partnerId}`,
        cleanPayload(values, config),
      );
      return response.data;
    },
    onSuccess: () => {
      toast.success(config.successMessage);
      queryClient.invalidateQueries({ queryKey: config.queryKey });
      navigate(listPath);
    },
    onError: (err) => {
      toast.error(
        err?.response?.data?.message || err?.message || config.errorMessage,
      );
    },
  });

  const onSubmit = (values) => mutate(values);

  return (
    <div className="flex flex-col gap-4 text-slate-700 font-sans">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-title font-pmedium text-primary uppercase">
            Edit {config.title} Partner
          </h2>
          <p className="text-xs font-pmedium text-slate-500 mt-1">
            {config.description}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate(listPath)}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[11px] font-pmedium uppercase tracking-wider text-slate-600 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-900"
        >
          <ArrowLeft size={15} />
          Back
        </button>
      </div>

      <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {isError ? (
          <div className="p-6 text-sm font-pmedium text-rose-500">
            {error?.response?.data?.message || error?.message || config.errorMessage}
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="p-4 sm:p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {config.fields.map((field) =>
                field.type === "checkboxGroup" ? (
                  <fieldset
                    key={field.name}
                    ref={visaTypeDropdownRef}
                    className="relative flex min-w-0 flex-col gap-2"
                  >
                    <legend className="text-[11px] font-pmedium uppercase tracking-wider text-slate-500">
                      {field.label}
                    </legend>
                    <button
                      type="button"
                      disabled={isFetching || isPending}
                      onClick={() => setIsVisaTypeOpen((isOpen) => !isOpen)}
                      className="flex min-h-[42px] w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-[12px] font-pmedium text-slate-800 outline-none transition-all focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                    >
                      <span className={selectedVisaTypeCount ? "truncate" : "text-slate-400"}>
                        {selectedVisaTypeText}
                      </span>
                      <ChevronDown
                        size={15}
                        className={`shrink-0 text-slate-400 transition-transform ${
                          isVisaTypeOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    {isVisaTypeOpen ? (
                      <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_16px_30px_rgba(15,23,42,0.14)]">
                        <div className="border-b border-slate-100 px-4 py-2 text-[11px] font-pmedium text-slate-500">
                          {selectedVisaTypeCount
                            ? selectedVisaTypes.join(", ")
                            : "Choose one or more visa types"}
                        </div>
                        <div className="max-h-72 overflow-y-auto py-2">
                          {visaTypeOptions.map((option) => (
                            <label
                              key={option}
                              className="flex min-h-10 cursor-pointer items-center gap-3 px-4 py-2 text-[12px] font-pmedium text-slate-700 transition-colors hover:bg-blue-50 has-[:checked]:bg-blue-50"
                            >
                              <input
                                type="checkbox"
                                value={option}
                                disabled={isFetching || isPending}
                                {...register("visaType")}
                                className="h-4 w-4 rounded border-slate-300 text-[#2563EB] accent-[#2563EB] focus:ring-[#2563EB]"
                              />
                              <span>{option}</span>
                            </label>
                          ))}
                        </div>
                        <div className="flex justify-center border-t border-slate-100 bg-white px-3 py-2">
                          <button
                            type="button"
                            onClick={() => setIsVisaTypeOpen(false)}
                            className="rounded-full bg-[#12A7E8] px-5 py-1.5 text-[11px] font-semibold text-white shadow-sm transition-all hover:bg-[#0d95cf]"
                          >
                            Done
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </fieldset>
                ) : (
                  <label key={field.name} className="flex flex-col gap-2">
                    <span className="text-[11px] font-pmedium uppercase tracking-wider text-slate-500">
                      {field.label}
                    </span>
                    <input
                      type={field.type || "text"}
                      step={field.step}
                      disabled={isFetching || isPending}
                      readOnly={field.readOnly}
                      aria-readonly={field.readOnly || undefined}
                      {...register(field.name, {
                        required: field.required ? `${field.label} is required` : false,
                      })}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[12px] font-pmedium text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 read-only:cursor-not-allowed read-only:bg-slate-50 read-only:text-slate-500 disabled:cursor-not-allowed disabled:bg-slate-50"
                    />
                    {errors[field.name] ? (
                      <span className="text-[10px] font-pmedium text-rose-500">
                        {errors[field.name]?.message}
                      </span>
                    ) : null}
                  </label>
                ),
              )}

              <label className="flex flex-col gap-2">
                <span className="text-[11px] font-pmedium uppercase tracking-wider text-slate-500">
                  Status
                </span>
                <select
                  disabled={isFetching || isPending}
                  {...register("status")}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[12px] font-pmedium text-slate-800 outline-none transition-all focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 disabled:cursor-not-allowed disabled:bg-slate-50"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </label>

              <label className="md:col-span-2 xl:col-span-3 flex flex-col gap-2">
                <span className="text-[11px] font-pmedium uppercase tracking-wider text-slate-500">
                  Address
                </span>
                <textarea
                  rows={4}
                  disabled={isFetching || isPending}
                  {...register("address")}
                  className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[12px] font-pmedium text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 disabled:cursor-not-allowed disabled:bg-slate-50"
                />
              </label>
            </div>

            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                type="submit"
                disabled={isFetching || isPending}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-600 bg-[#2563EB] px-5 py-2.5 text-[12px] font-semibold leading-5 text-white shadow-[0_10px_18px_rgba(37,99,235,0.22)] transition-all hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300 disabled:shadow-none"
              >
                <Save size={15} />
                {isPending ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => navigate(listPath)}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-slate-100 px-5 py-2.5 text-[12px] font-semibold leading-5 text-slate-700 transition-all hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export const EditVisaSupportPartner = () => (
  <EditValueAddPartner config={partnerEditConfigs["visa-support"]} />
);

export const EditActivationSupportPartner = () => (
  <EditValueAddPartner config={partnerEditConfigs["activation-support"]} />
);

export const EditCompanySetupPartner = () => (
  <EditValueAddPartner config={partnerEditConfigs["company-setup"]} />
);

export const EditConsultationPartner = () => (
  <EditValueAddPartner config={partnerEditConfigs.consultation} />
);

export const EditWorkationPartner = () => (
  <EditValueAddPartner config={partnerEditConfigs.workation} />
);

export default EditVisaSupportPartner;
