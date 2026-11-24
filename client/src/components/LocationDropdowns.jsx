import { useQuery } from "@tanstack/react-query";
import { City, Country, State } from "country-state-city";
import { useEffect, useState } from "react";
import { useController, useWatch } from "react-hook-form";
import useAxiosPrivate from "../hooks/useAxiosPrivate";

const locationFields = {
  continent: "continent",
  country: "country",
  state: "state",
  city: "city",
};
const continents = [
  "Africa", "Antarctica", "Asia", "Europe", "North America", "Oceania", "South America",
];
const countries = Country.getAllCountries();
const noSubdivision = "Not applicable";
const customOption = "__custom_location__";
const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 disabled:bg-slate-50";

const LocationDropdown = ({
  control, name, label, options, disabled, clearDescendants, allowCustom, required,
}) => {
  const { field, fieldState: { error } } = useController({
    control,
    name,
    rules: { required: required ? `${label} is required.` : false },
  });
  const value = field.value || "";
  const [isCustom, setIsCustom] = useState(false);
  const visibleOptions = value && !isCustom && !options.includes(value)
    ? [value, ...options]
    : options;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label className="flex flex-col gap-1.5 text-xs font-pmedium text-slate-700">
        <span>{label}{required && <span className="text-red-600"> *</span>}</span>
        <select
          {...field}
          className={inputClass}
          value={isCustom ? customOption : value}
          disabled={disabled}
          required={required}
          aria-invalid={Boolean(error)}
          onChange={(event) => {
            const next = event.target.value;
            const custom = next === customOption;
            setIsCustom(custom);
            field.onChange(custom ? "" : next);
            clearDescendants?.();
          }}
        >
          <option value="">Select {label.toLowerCase()}</option>
          {visibleOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          {allowCustom && <option value={customOption}>Enter city manually</option>}
        </select>
      </label>
      {isCustom && (
        <input
          className={inputClass}
          aria-label={label}
          placeholder="Enter city"
          value={value}
          required
          onChange={(event) => field.onChange(event.target.value)}
          onBlur={field.onBlur}
        />
      )}
      {error && <span className="text-xs text-red-600" role="alert">{error.message}</span>}
    </div>
  );
};

const LocationDropdowns = ({ control, setValue, names = locationFields, required = true }) => {
  const axios = useAxiosPrivate();
  const { data: countryContinents, isError, refetch } = useQuery({
    queryKey: ["location-continents"],
    queryFn: async () => (await axios.get("/api/hosts/location-continents")).data,
    staleTime: Infinity,
  });
  const [continent, country, state] = useWatch({
    control,
    name: [names.continent, names.country, names.state],
  });
  const savedCountryContinent = countryContinents?.[country];
  useEffect(() => {
    if (!continent && savedCountryContinent) {
      setValue(names.continent, savedCountryContinent);
    }
  }, [continent, names.continent, savedCountryContinent, setValue]);

  const countryCode = countries.find(({ name }) => name === country)?.isoCode;
  const states = countryCode ? State.getStatesOfCountry(countryCode) : [];
  const stateCode = states.find(({ name }) => name === state)?.isoCode;
  const cities = stateCode
    ? City.getCitiesOfState(countryCode, stateCode)
    : state === noSubdivision && countryCode
      ? City.getCitiesOfCountry(countryCode)
      : [];
  const cityNames = [...new Set(cities.map(({ name }) => name))];
  const fields = [
    { name: names.continent, label: "Continent", options: continents },
    {
      name: names.country,
      label: "Country",
      disabled: !continent || !countryContinents,
      options: countries
        .filter(({ name }) => continent && countryContinents?.[name] === continent)
        .map(({ name }) => name),
    },
    {
      name: names.state,
      label: "State or Region",
      disabled: !country,
      options: states.length ? states.map(({ name }) => name) : [noSubdivision],
    },
    {
      name: names.city,
      label: "City",
      disabled: !state,
      options: cityNames,
      allowCustom: Boolean(state) && !cityNames.length,
    },
  ];

  return (
    <>
      {fields.map((field, index) => (
        <LocationDropdown
          key={field.allowCustom ? `${field.name}:${country}:${state}` : field.name}
          control={control}
          required={required}
          {...field}
          clearDescendants={() => {
            fields.slice(index + 1).forEach(({ name }) => setValue(name, ""));
          }}
        />
      ))}
      {isError && (
        <p role="alert" className="text-xs text-red-600 sm:col-span-2">
          Could not load countries.{" "}
          <button type="button" onClick={() => refetch()} className="underline">
            Retry
          </button>
        </p>
      )}
    </>
  );
};

export default LocationDropdowns;
