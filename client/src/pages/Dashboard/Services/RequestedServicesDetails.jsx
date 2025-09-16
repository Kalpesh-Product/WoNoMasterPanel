// src/pages/Dashboard/Services/RequestedServicesDetails.jsx
import React from "react";
import { useLocation, useParams } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { Box, Checkbox, FormHelperText } from "@mui/material";

// ✅ hardcoded data (same as in RequestedServices.jsx)
const requestedServicesData = [
  {
    id: 1,
    logo: "https://via.placeholder.com/40",
    companyName: "Alpha Tech",
    noOfServices: 5,
    registration: "Active",
  },
  {
    id: 2,
    logo: "https://via.placeholder.com/40",
    companyName: "Beta Solutions",
    noOfServices: 8,
    registration: "Inactive",
  },
  {
    id: 3,
    logo: "https://via.placeholder.com/40",
    companyName: "Gamma Group",
    noOfServices: 3,
    registration: "Active",
  },
  {
    id: 4,
    logo: "https://via.placeholder.com/40",
    companyName: "Delta Enterprises",
    noOfServices: 10,
    registration: "Inactive",
  },
];

// ✅ services available
const serviceOptions = [
  {
    category: "Addon Apps (Coming Soon)",
    items: [
      "Tickets",
      "Meetings",
      "Tasks",
      "Performance",
      "Visitors",
      "Assets",
    ],
  },
  {
    category: "Addon Modules (Coming Soon)",
    items: ["Finance", "Sales", "HR", "Admin", "Maintenance", "IT"],
  },
];

// ✅ mandatory services
const mandatoryServices = [
  "Website Builder",
  "Lead Generation",
  "Automated Google Sheets",
];

const RequestedServicesDetails = () => {
  const { companyId } = useParams();
  const location = useLocation();

  // ✅ Prefer companyName from navigation state
  const companyName = location.state?.companyName;

  // fallback: find in hardcoded array if navigated directly by URL
  const company = requestedServicesData.find((c) => String(c.id) === companyId);
  const displayName = companyName || company?.companyName || "Unknown Company";

  const { control } = useForm({
    defaultValues: {
      selectedServices: [...mandatoryServices],
    },
  });

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">
        Requested Services for Company:{" "}
        {company ? company.companyName : "Unknown Company"}
      </h1>

      <Controller
        name="selectedServices"
        control={control}
        render={({ field, fieldState }) => {
          const value = Array.from(
            new Set([...(field.value || []), ...mandatoryServices])
          );

          const renderCard = (service, isMandatory = false) => {
            const isSelected = value.includes(service);

            const toggle = () => {
              if (isMandatory) return;
              const newValue = isSelected
                ? value.filter((s) => s !== service)
                : [...value, service];
              field.onChange(newValue);
            };

            return (
              <Box
                key={service}
                onClick={toggle}
                role="checkbox"
                aria-checked={isSelected}
                tabIndex={0}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === " ") && !isMandatory) {
                    toggle();
                  }
                }}
                sx={{
                  border: "1px solid",
                  borderColor: isSelected ? "primary.main" : "divider",
                  borderRadius: 2,
                  p: 2,
                  cursor: isMandatory ? "not-allowed" : "pointer",
                  userSelect: "none",
                  boxShadow: isSelected ? 3 : 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  opacity: isMandatory ? 0.8 : 1,
                }}>
                <span className="font-medium">{service}</span>
                <Checkbox
                  checked={isSelected}
                  disabled={isMandatory}
                  onChange={(e) => {
                    e.stopPropagation();
                    toggle();
                  }}
                />
              </Box>
            );
          };

          return (
            <Box>
              {/* Mandatory Section */}
              <h3 className="font-semibold mb-2">Your Activated Services</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
                {mandatoryServices.map((s) => renderCard(s, true))}
              </div>

              {/* Other Categories */}
              {serviceOptions.map((group) => (
                <Box key={group.category} sx={{ mb: 4 }}>
                  <h3 className="font-semibold mb-2">{group.category}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {group.items.map((s) => renderCard(s))}
                  </div>
                </Box>
              ))}

              {fieldState.error && (
                <FormHelperText error>
                  {fieldState.error.message}
                </FormHelperText>
              )}
            </Box>
          );
        }}
      />
    </div>
  );
};

export default RequestedServicesDetails;
