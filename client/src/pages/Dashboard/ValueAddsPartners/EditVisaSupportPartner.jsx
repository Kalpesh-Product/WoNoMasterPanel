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

const cleanPayload = (values) => ({
  ...values,
  visaType: Array.isArray(values.visaType)
    ? values.visaType.join(", ")
    : String(values.visaType || "").trim(),
  srNo: values.srNo === "" ? null : Number(values.srNo),
  rating: values.rating === "" ? null : Number(values.rating),
  googleReviews: values.googleReviews === "" ? null : Number(values.googleReviews),
  email: String(values.email || "").trim().toLowerCase(),
});

const EditVisaSupportPartner = () => {
  const { partnerId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const statePartner = location.state?.partner || null;
  const [isVisaTypeOpen, setIsVisaTypeOpen] = useState(false);
  const visaTypeDropdownRef = useRef(null);

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
    queryKey: ["valueAddsPartners", "visa-support", partnerId],
    queryFn: async () => {
      const response = await axios.get(
        `${NOMADS_BACKEND_URL}/api/visa-support/partners/${partnerId}`,
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
        `${NOMADS_BACKEND_URL}/api/visa-support/partners/${partnerId}`,
        cleanPayload(values),
      );
      return response.data;
    },
    onSuccess: () => {
      toast.success("Visa support partner updated successfully");
      queryClient.invalidateQueries({ queryKey: ["valueAddsPartners", "visa-support"] });
      navigate("/dashboard/value-adds-partners/visa-support");
    },
    onError: (err) => {
      toast.error(
        err?.response?.data?.message || err?.message || "Failed to update visa support partner",
      );
    },
  });

  const onSubmit = (values) => mutate(values);

  return (
    <div className="flex flex-col gap-4 text-slate-700 font-sans">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-title font-pmedium text-primary uppercase">
            Edit Visa Support Partner
          </h2>
          <p className="text-xs font-pmedium text-slate-500 mt-1">
            Update visa partner details used across the value-adds partner table.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/dashboard/value-adds-partners/visa-support")}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[11px] font-pmedium uppercase tracking-wider text-slate-600 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-900"
        >
          <ArrowLeft size={15} />
          Back
        </button>
      </div>

      <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {isError ? (
          <div className="p-6 text-sm font-pmedium text-rose-500">
            {error?.response?.data?.message || error?.message || "Failed to load visa support partner."}
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="p-4 sm:p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {fields.map((field) =>
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
                onClick={() => navigate("/dashboard/value-adds-partners/visa-support")}
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

export default EditVisaSupportPartner;
