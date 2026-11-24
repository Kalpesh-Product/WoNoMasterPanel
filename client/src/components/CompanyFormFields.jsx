import LocationDropdowns from "./LocationDropdowns";

const locationNames = {
  continent: "companyContinent",
  country: "companyCountry",
  state: "companyState",
  city: "companyCity",
};
const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500";

const CompanyFormInput = ({
  register, name, label, required, type = "text", error,
}) => (
  <label className="flex min-w-0 flex-col gap-1.5 text-xs font-pmedium text-slate-700">
    <span>
      {label}
      {required && <span className="text-red-600"> *</span>}
    </span>
    <input
      className={inputClass}
      type={type}
      min={type === "number" ? 0 : undefined}
      required={required}
      aria-invalid={Boolean(error)}
      {...register(name, {
        setValueAs: (value) => value.trim(),
        required: required ? `${label} is required.` : false,
      })}
    />
    {error && <span className="text-red-600" role="alert">{error}</span>}
  </label>
);

const CompanyFormFields = ({ form, requireLocation = true, seatInputType = "number", children }) => {
  const { control, register, setValue, formState: { errors } } = form;
  return (
    <>
      <section className="rounded-xl border border-slate-200 p-4 sm:p-5">
        <h2 className="mb-4 text-sm font-pmedium text-primary">Company Details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <CompanyFormInput
            register={register}
            name="companyName"
            label="Company Name"
            required
            error={errors.companyName?.message}
          />
          <CompanyFormInput register={register} name="registeredEntityName" label="Registered Entity Name" />
          <CompanyFormInput register={register} name="industry" label="Industry" />
          <CompanyFormInput register={register} name="companySize" label="Total Seats" type={seatInputType} />
          <CompanyFormInput register={register} name="websiteLink" label="Website" />
          <CompanyFormInput register={register} name="linkedinURL" label="LinkedIn URL" />
          {children}
        </div>
      </section>
      <section className="rounded-xl border border-slate-200 p-4 sm:p-5">
        <h2 className="mb-4 text-sm font-pmedium text-primary">Location</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <LocationDropdowns
            control={control}
            setValue={setValue}
            names={locationNames}
            required={requireLocation}
          />
          <div className="sm:col-span-2">
            <CompanyFormInput register={register} name="address" label="Street Address" />
          </div>
        </div>
      </section>
    </>
  );
};

export default CompanyFormFields;
