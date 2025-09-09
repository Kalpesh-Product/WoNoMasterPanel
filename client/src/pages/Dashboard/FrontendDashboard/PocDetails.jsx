// src/pages/Dashboard/FrontendDashboard/PocDetails.jsx
import React from "react";
import PageFrame from "../../../components/Pages/PageFrame";
import { useSelector } from "react-redux";
import { useQuery } from "@tanstack/react-query";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import { Avatar, Chip, TextField } from "@mui/material";

const StatusChip = ({ status = "Pending" }) => {
  const map = {
    Verified: { bg: "#E3FCEF", color: "#057A55" },
    Invited: { bg: "#FFF4E5", color: "#8A4B0F" },
    Pending: { bg: "#FFE4E6", color: "#9F1239" },
  };
  const { bg, color } = map[status] || { bg: "#e5e7eb", color: "#374151" };
  return (
    <Chip label={status} size="small" style={{ backgroundColor: bg, color }} />
  );
};

const ReadOnlyField = ({ label, value }) => (
  <TextField
    label={label}
    value={value ?? ""}
    variant="standard"
    fullWidth
    InputProps={{ readOnly: true }}
    disabled
    sx={{
      "& .MuiInputBase-input.Mui-disabled": { WebkitTextFillColor: "#111827" },
      "& .MuiInputLabel-root.Mui-disabled": { color: "#6b7280" },
    }}
  />
);

const placeholder = {
  fullName: "—",
  email: "—",
  phone: "—",
  country: "—",
  state: "—",
  city: "—",
  designation: "Point of Contact",
  status: "Pending",
  avatarUrl: "",
};

const PocDetails = () => {
  const axios = useAxiosPrivate();
  const selectedCompany = useSelector((s) => s.company?.selectedCompany);
  const businessId = selectedCompany?.businessId;

  const {
    data: poc = placeholder,
    isError,
    error,
  } = useQuery({
    queryKey: ["pocDetails", businessId],
    enabled: !!businessId, // won’t block render; we still show placeholders
    queryFn: async () => {
      const { data } = await axios.get("/api/hosts/get-poc-details", {
        params: { businessId },
      });
      return data; // { fullName, email, phone, country, state, city, designation, status, avatarUrl }
    },
    placeholderData: placeholder, // ✅ instant UI, no loader
    staleTime: 5 * 60 * 1000, // avoid refetch flicker
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const view = {
    fullName: poc?.fullName ?? "—",
    email: poc?.email ?? "—",
    phone: poc?.phone ?? "—",
    country: poc?.country ?? "—",
    state: poc?.state ?? "—",
    city: poc?.city ?? "—",
    designation: poc?.designation ?? "Point of Contact",
    status: poc?.status ?? "Pending",
    avatarUrl: poc?.avatarUrl ?? "",
  };

  return (
    <div className="p-4">
      <PageFrame>
        <div className="flex items-center justify-between pb-4">
          <span className="text-title font-pmedium text-primary uppercase">
            POC Details
          </span>
          {selectedCompany?.companyName && (
            <span className="text-sm text-gray-500">
              Company:{" "}
              <span className="font-pmedium text-gray-700">
                {selectedCompany.companyName}
              </span>
            </span>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow p-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center gap-6 border border-gray-200 rounded-xl p-4">
            <Avatar
              src={view.avatarUrl}
              sx={{ width: 96, height: 96, fontSize: "2rem" }}>
              {String(view.fullName || "P").charAt(0)}
            </Avatar>

            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xl font-semibold text-gray-900">
                  {view.fullName}
                </span>
                {/* <StatusChip status={view.status} /> */}
              </div>
              <div className="text-sm text-gray-500 mt-1">
                {view.designation}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Business ID: {businessId || "—"}
              </div>
            </div>
          </div>

          {/* Two-column read-only fields (mirrors signup form) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 mt-6">
            <ReadOnlyField label="Full Name" value={view.fullName} />
            <ReadOnlyField label="Email" value={view.email} />
            <ReadOnlyField label="Phone Number" value={view.phone} />
            <ReadOnlyField label="Country" value={view.country} />
            <ReadOnlyField label="State" value={view.state} />
            <ReadOnlyField label="City" value={view.city} />
          </div>

          {/* Optional: a subtle inline error if fetch fails (no loaders) */}
          {/* {isError && (
            <p className="text-xs text-red-600 mt-4">
              Failed to fetch latest POC details
              {error?.message ? `: ${error.message}` : ""}. Showing
              placeholders.
            </p>
          )} */}
        </div>
      </PageFrame>
    </div>
  );
};

export default PocDetails;
