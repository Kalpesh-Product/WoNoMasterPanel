import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import CompanyFormFields from "../../../components/CompanyFormFields";
import PageFrame from "../../../components/Pages/PageFrame";
import PrimaryButton from "../../../components/PrimaryButton";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";

const companiesPath = "/dashboard/companies/list";

const AddCompany = () => {
  const axios = useAxiosPrivate();
  const queryClient = useQueryClient();
  const form = useForm();
  const { handleSubmit, reset, formState: { isSubmitting } } = form;

  const {
    data: company,
    error,
    mutateAsync: saveCompany,
    reset: resetSave,
  } = useMutation({
    mutationFn: async (values) => {
      const response = await axios.post("/api/hosts/companies", values);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companiesList"] });
      queryClient.invalidateQueries({ queryKey: ["companyLocations"] });
    },
  });

  const onSubmit = async (values) => {
    try {
      await saveCompany(values);
    } catch {
      // The mutation error is displayed below the form.
    }
  };

  return (
    <div className="p-4">
      <PageFrame>
        <div className="mx-auto max-w-3xl">
          <Link to={companiesPath} className="text-sm font-pmedium text-blue-700 hover:underline">
            Back to Companies
          </Link>
          <h1 className="mb-5 mt-3 text-title font-pmedium uppercase text-primary">
            Add Company
          </h1>
          {company ? (
            <div className="rounded-xl border border-slate-200 p-5">
              <p role="status" className="text-sm font-pmedium text-slate-900">
                {company.companyName} was added to Companies.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Link
                  to={`/dashboard/companies/${encodeURIComponent(company.companyId)}/nomad-listings/add`}
                  state={{ companyId: company.companyId, companyName: company.companyName }}
                  className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  Add Product
                </Link>
                <button
                  type="button"
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  onClick={() => {
                    reset();
                    resetSave();
                  }}
                >
                  Add Another Company
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} aria-busy={isSubmitting}>
              <fieldset disabled={isSubmitting} className="space-y-5">
                <CompanyFormFields form={form} />
                {error && (
                  <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                    {error.response?.data?.message || "Could not save the company. Please try again."}
                  </p>
                )}
                <div className="flex items-center justify-center">
                  <PrimaryButton
                    type="submit"
                    title={isSubmitting ? "Saving Company" : "Save Company"}
                    isLoading={isSubmitting}
                  />
                </div>
              </fieldset>
            </form>
          )}
        </div>
      </PageFrame>
    </div>
  );
};

export default AddCompany;
