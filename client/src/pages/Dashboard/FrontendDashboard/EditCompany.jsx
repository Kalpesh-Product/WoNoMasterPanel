import { styled } from "@mui/joy";
import Button from "@mui/joy/Button";
import SvgIcon from "@mui/joy/SvgIcon";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Link, useMatch, useParams } from "react-router-dom";
import { toast } from "sonner";
import CompanyFormFields from "../../../components/CompanyFormFields";
import PageFrame from "../../../components/Pages/PageFrame";
import PrimaryButton from "../../../components/PrimaryButton";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";

const VisuallyHiddenInput = styled("input")`
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
    <div className="flex flex-col gap-1.5 sm:col-span-2">
      <span className="text-xs font-pmedium text-slate-700">Company Logo</span>
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
            aria-label="Company Logo"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                onChange(file);
                e.target.value = "";
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

const getFormValues = (company) => ({
  companyName: company.companyName || "",
  registeredEntityName: company.registeredEntityName || "",
  industry: company.industry || "",
  companySize: company.companySize || "",
  companyCity: company.companyCity || "",
  companyState: company.companyState || "",
  companyCountry: company.companyCountry || "",
  companyContinent: company.companyContinent || "",
  address: company.address || "",
  websiteLink: company.websiteLink ?? company.websiteURL ?? "",
  linkedinURL: company.linkedinURL || "",
  companyLogo: null,
});

const EditCompanyForm = ({ company }) => {
  const { companyId } = company;
  const axios = useAxiosPrivate();
  const queryClient = useQueryClient();
  const form = useForm({ defaultValues: getFormValues(company) });
  const { control, handleSubmit, reset, formState: { isSubmitting } } = form;

  const { mutateAsync: updateCompany, error } = useMutation({
    mutationFn: async (payload) => {
      const response = await axios.patch("/api/hosts/edit-company", payload);
      return response.data.company;
    },
    onSuccess: (savedCompany) => {
      reset(getFormValues(savedCompany));
      queryClient.setQueryData(["companyDetails", companyId], savedCompany);
      queryClient.setQueryData(["nomad-listing-company", companyId], savedCompany);
      queryClient.invalidateQueries({ queryKey: ["companiesList"] });
      queryClient.invalidateQueries({ queryKey: ["companyLocations"] });
      queryClient.invalidateQueries({ queryKey: ["hostCompaniesList"] });
      toast.success("Company updated successfully");
    },
  });

  const onSubmit = async ({ companyLogo, ...details }) => {
    const formData = new FormData();
    formData.append("data", JSON.stringify({ companyId, ...details }));
    if (companyLogo instanceof File) formData.append("logo", companyLogo);

    try {
      await updateCompany(formData);
    } catch {
      // The mutation error is displayed below the form.
    }
  };

  const hasCompleteLocation = Boolean(company.companyCity && company.companyState && company.companyCountry);
  const seatInputType = company.companySize && !/^\d+$/.test(company.companySize) ? "text" : "number";

  return (
    <form onSubmit={handleSubmit(onSubmit)} aria-busy={isSubmitting}>
      <fieldset disabled={isSubmitting} className="space-y-5">
        <CompanyFormFields form={form} requireLocation={hasCompleteLocation} seatInputType={seatInputType}>
          <Controller
            name="companyLogo"
            control={control}
            render={({ field }) => (
              <LogoUploadInput
                value={field.value}
                onChange={field.onChange}
                currentLogoUrl={company.logo?.url}
              />
            )}
          />
        </CompanyFormFields>
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {error.response?.data?.message || "Could not save the company. Please try again."}
          </p>
        )}
        <div className="flex items-center justify-center">
          <PrimaryButton
            type="submit"
            title={isSubmitting ? "Saving Changes" : "Save Changes"}
            isLoading={isSubmitting}
          />
        </div>
      </fieldset>
    </form>
  );
};

const EditCompany = () => {
  const { companyId } = useParams();
  const isHostCompanyRoute = useMatch("/dashboard/host-companies/edit/:companyId");
  const axios = useAxiosPrivate();
  const { data: company, isPending, isError, refetch } = useQuery({
    queryKey: ["companyDetails", companyId],
    enabled: Boolean(companyId),
    queryFn: async () => {
      const response = await axios.get("/api/hosts/company", { params: { companyId } });
      return response.data?.data || response.data;
    },
  });

  return (
    <div className="p-4">
      <PageFrame>
        <div className="mx-auto max-w-3xl">
          <Link
            to={isHostCompanyRoute ? "/dashboard/host-companies" : "/dashboard/companies/list"}
            className="text-sm font-pmedium text-blue-700 hover:underline"
          >
            {isHostCompanyRoute ? "Back to Host Companies" : "Back to Companies"}
          </Link>
          <h1 className="mb-5 mt-3 text-title font-pmedium uppercase text-primary">
            Edit Company
          </h1>
          {companyId && company?.companyId === companyId ? (
            <EditCompanyForm key={companyId} company={company} />
          ) : companyId && isPending ? (
            <p role="status" className="text-sm text-slate-700">Loading company details…</p>
          ) : (
            <p role="alert" className="text-sm text-slate-700">
              {isError ? "Could not load company details." : "Company not found."}
              {isError && (
                <button type="button" className="ml-2 text-blue-700 underline" onClick={() => refetch()}>
                  Retry
                </button>
              )}
            </p>
          )}
        </div>
      </PageFrame>
    </div>
  );
};

export default EditCompany;
