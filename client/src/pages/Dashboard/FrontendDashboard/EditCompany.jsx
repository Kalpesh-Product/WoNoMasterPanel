import React from "react";
import PageFrame from "../../../components/Pages/PageFrame";
import { Controller, useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { MenuItem, TextField } from "@mui/material";
import { toast } from "sonner"; // ✅ since you’re already using sonner for notifications
import axios from "axios";
import PrimaryButton from "../../../components/PrimaryButton";
import { City, Country, State } from "country-state-city";

const parseCommaSeparatedList = (value = "") =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const EditCompany = () => {
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
      isActive: true,
    },
  });

  const { mutate: register, isLoading: isRegisterLoading } = useMutation({
    mutationFn: async (fd) => {
      const response = await axios.post(
        "http://localhost:5007/api/hosts/onboard-company",
        fd,
      );
      return response.data;
    },
    onSuccess: () => {
      toast.success("Company added successfully");
      reset();
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Something went wrong");
    },
  });

  const onSubmit = (data) => {
    const formattedData = {
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
      pocName: data.pocName,
      pocEmail: data.pocEmail,
      pocPhone: data.pocPhone,
      pocDesignation: data.pocDesignation,
      pocLinkedInProfile: data.pocLinkedInProfile,
      pocLanguages: parseCommaSeparatedList(data.pocLanguages),
      pocAddress: data.pocAddress,
      pocProfileImage: data.pocProfileImage,
      isActive: data.isActive,
    };

    register(formattedData);
  };

  return (
    <div className="p-4">
      <PageFrame>
        <h1 className="text-title text-primary font-pmedium uppercase mb-4">
          Add Company
        </h1>
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
              <TextField
                {...field}
                label="Company Name"
                fullWidth
                margin="normal"
                variant="standard"
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              />
            )}
          />

          <Controller
            name="industry"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Industry"
                fullWidth
                margin="normal"
                variant="standard"
              />
            )}
          />

          <Controller
            name="companySize"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Company Size"
                fullWidth
                margin="normal"
                variant="standard"
              />
            )}
          />
          <Controller
            name="registeredEntityName"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Registered Entity Name"
                fullWidth
                margin="normal"
                variant="standard"
              />
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
              <TextField
                {...field}
                select
                label="Company Country"
                fullWidth
                margin="normal"
                variant="standard"
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
                onChange={(e) => {
                  const value = e.target.value;
                  field.onChange(value);
                  setValue("companyState", "");
                  setValue("companyCity", "");
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
                <TextField
                  {...field}
                  select
                  label="Company State"
                  fullWidth
                  margin="normal"
                  variant="standard"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                  disabled={!companyCountryObj}
                  onChange={(e) => {
                    const value = e.target.value;
                    field.onChange(value);
                    setValue("companyCity", "");
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
                <TextField
                  {...field}
                  select
                  label="Company City"
                  fullWidth
                  margin="normal"
                  variant="standard"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                  disabled={!companyStateObj}
                >
                  {cities.map((city) => (
                    <MenuItem key={city.name} value={city.name}>
                      {city.name}
                    </MenuItem>
                  ))}
                </TextField>
              );
            }}
          />

          <Controller
            name="companyContinent"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Company Continent"
                fullWidth
                margin="normal"
                variant="standard"
              />
            )}
          />

          <Controller
            name="websiteURL"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Website URL"
                fullWidth
                margin="normal"
                variant="standard"
              />
            )}
          />

          <Controller
            name="linkedinURL"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Company LinkedIn URL"
                fullWidth
                margin="normal"
                variant="standard"
              />
            )}
          />

          <Controller
            name="selectedApps"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Apps (comma separated)"
                fullWidth
                margin="normal"
                variant="standard"
                helperText="Allowed: tickets, meetings, tasks, performance, visitors, assets"
              />
            )}
          />

          <Controller
            name="selectedModules"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Modules (comma separated)"
                fullWidth
                margin="normal"
                variant="standard"
                helperText="Allowed: finance, sales, hr, admin, maintenance, it"
              />
            )}
          />

          <Controller
            name="selectedDefaults"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Defaults (comma separated)"
                fullWidth
                margin="normal"
                variant="standard"
                helperText="Allowed: websiteBuilder, leadGeneration, automatedGoogleSheets"
              />
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
              <TextField
                {...field}
                label="POC Name"
                fullWidth
                margin="normal"
                variant="standard"
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              />
            )}
          />

          <Controller
            name="pocDesignation"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="POC Designation"
                fullWidth
                margin="normal"
                variant="standard"
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
              <TextField
                {...field}
                label="POC Email"
                fullWidth
                margin="normal"
                variant="standard"
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
              <TextField
                {...field}
                label="POC Phone"
                fullWidth
                margin="normal"
                variant="standard"
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              />
            )}
          />

          <Controller
            name="pocLinkedInProfile"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="LinkedIn Profile URL"
                fullWidth
                margin="normal"
                variant="standard"
              />
            )}
          />

          <Controller
            name="pocLanguages"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Languages (comma separated)"
                fullWidth
                margin="normal"
                variant="standard"
              />
            )}
          />

          <Controller
            name="pocAddress"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="POC Address"
                fullWidth
                margin="normal"
                variant="standard"
              />
            )}
          />

          <Controller
            name="pocProfileImage"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Profile Image URL"
                fullWidth
                margin="normal"
                variant="standard"
              />
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
              isLoading={isRegisterLoading}
              disabled={isRegisterLoading}
            />
          </div>
        </form>
      </PageFrame>
    </div>
  );
};

export default EditCompany;
