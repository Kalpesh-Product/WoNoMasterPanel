// src/pages/Dashboard/Services/RequestedServicesDetails.jsx
import React, { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { Box, Checkbox, CircularProgress, FormHelperText } from "@mui/material";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import PrimaryButton from "../../../components/PrimaryButton";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";

const RequestedServicesDetails = () => {
  const navigate = useNavigate();

  const axios = useAxiosPrivate();
  const { companyId } = useParams();
  const queryClient = useQueryClient();

  // ✅ fetch company
  const {
    data: company,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["company", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const res = await axios.get(`/api/hosts/company?companyId=${companyId}`);
      return res.data;
    },
  });

  const { control, handleSubmit, reset } = useForm({
    defaultValues: { selectedServices: [] },
  });

  // ✅ format helper
  const formatLabel = (str = "") =>
    str
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[_-]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

  // ✅ hydrate form with active services
  useEffect(() => {
    if (company?.selectedServices) {
      const {
        defaults = [],
        apps = [],
        modules = [],
      } = company.selectedServices;

      const requestedDefaults = defaults
        .filter((d) => d.isRequested)
        .map((d) => formatLabel(d.name));
      const requestedApps = apps
        .filter((a) => a.isRequested)
        .map((a) => formatLabel(a.appName));
      const requestedModules = modules
        .filter((m) => m.isRequested)
        .map((m) => formatLabel(m.moduleName));

      reset({
        selectedServices: [
          ...requestedDefaults,
          ...requestedApps,
          ...requestedModules,
        ],
      });
    }
  }, [company, reset]);

  // ✅ mutation for updating services
  const { mutate: update, isLoading: isUpdating } = useMutation({
    mutationFn: async (payload) => {
      const res = await axios.patch("/api/hosts/update-services", payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Services activated successfully");
      queryClient.invalidateQueries({ queryKey: ["company", companyId] });

      // ✅ redirect after success
      navigate("/dashboard/requested-services");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Something went wrong");
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <CircularProgress />
      </div>
    );
  }

  if (isError || !company) {
    return <div className="p-6 text-red-500">Failed to load company data</div>;
  }

  const defaults = company?.selectedServices?.defaults || [];
  const apps = company?.selectedServices?.apps || [];
  const modules = company?.selectedServices?.modules || [];

  const mandatoryServices = defaults.map((s) => ({
    label: formatLabel(s.name),
    rawKey: s.name,
    isActive: s.isActive,
    isRequested: s.isRequested,
    mandatory: true,
  }));

  const addonApps = apps.map((s) => ({
    label: formatLabel(s.appName),
    rawKey: s.appName,
    isActive: s.isActive,
    isRequested: s.isRequested,
    mandatory: false,
    type: "app",
  }));

  const addonModules = modules.map((s) => ({
    label: formatLabel(s.moduleName),
    rawKey: s.moduleName,
    isActive: s.isActive,
    isRequested: s.isRequested,
    mandatory: false,
    type: "module",
  }));

  const renderCard = (service, fieldValue, onChange) => {
    const isSelected = fieldValue.includes(service.label);

    const toggle = () => {
      if (!service.isRequested) return; // 🔹 only toggle if requested
      const newValue = isSelected
        ? fieldValue.filter((s) => s !== service.label)
        : [...fieldValue, service.label];
      onChange(newValue);
    };

    return (
      <Box
        key={service.label}
        onClick={toggle}
        sx={{
          border: "1px solid",
          borderColor: isSelected ? "primary.main" : "divider",
          borderRadius: 2,
          p: 2,
          cursor: service.isRequested ? "pointer" : "not-allowed",
          userSelect: "none",
          boxShadow: isSelected ? 3 : 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          opacity: service.isRequested ? 1 : 0.5,
        }}>
        <span className="font-medium">{service.label}</span>
        {/* <Checkbox
          checked={isSelected}
          disabled={!service.isRequested}
          onChange={(e) => {
            e.stopPropagation();
            toggle();
          }}
        /> */}
        <Checkbox checked={isSelected} disabled />
      </Box>
    );
  };

  const onSubmit = (data) => {
    const selected = data.selectedServices;

    const appsPayload = addonApps
      .filter((a) => a.isRequested) // take all requested apps
      .map((a) => ({ appName: a.rawKey, isActive: true }));

    const modulesPayload = addonModules
      .filter((m) => m.isRequested) // take all requested modules
      .map((m) => ({ moduleName: m.rawKey, isActive: true }));

    const payload = {
      companyId,
      selectedServices: {
        apps: appsPayload,
        modules: modulesPayload,
      },
    };

    update(payload);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">
        Requested Services for Company: {company.companyName}
      </h1>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Controller
          name="selectedServices"
          control={control}
          render={({ field, fieldState }) => (
            <Box>
              {/* Mandatory Section */}
              <h3 className="font-semibold mb-2">Your Activated Services</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
                {mandatoryServices.map((s) =>
                  renderCard(s, field.value || [], field.onChange)
                )}
              </div>

              {/* Addon Apps */}
              <Box sx={{ mb: 4 }}>
                <h3 className="font-semibold mb-2">Addon Apps (Coming Soon)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {addonApps.map((s) =>
                    renderCard(s, field.value || [], field.onChange)
                  )}
                </div>
              </Box>

              {/* Addon Modules */}
              <Box sx={{ mb: 4 }}>
                <h3 className="font-semibold mb-2">
                  Addon Modules (Coming Soon)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {addonModules.map((s) =>
                    renderCard(s, field.value || [], field.onChange)
                  )}
                </div>
              </Box>

              {fieldState.error && (
                <FormHelperText error>
                  {fieldState.error.message}
                </FormHelperText>
              )}
            </Box>
          )}
        />

        <div className="flex justify-center items-center mt-6">
          <PrimaryButton
            externalStyles=""
            title="Activate"
            type="submit"
            isLoading={isUpdating}
            disabled={isUpdating}
          />
        </div>
      </form>
    </div>
  );
};

export default RequestedServicesDetails;
