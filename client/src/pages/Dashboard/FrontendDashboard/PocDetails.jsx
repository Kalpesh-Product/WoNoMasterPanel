// src/pages/Dashboard/FrontendDashboard/PocDetails.jsx
import React, { useEffect, useMemo, useState } from "react";
import PageFrame from "../../../components/Pages/PageFrame";
import axios from "axios";
import { useSelector } from "react-redux";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Avatar,
  Button,
  CircularProgress,
  FormControlLabel,
  MenuItem,
  Switch,
  TextField,
} from "@mui/material";
import { toast } from "sonner";

// ---------- UI helpers ----------
const ReadOnlyField = ({ label, value }) => (
  <TextField
    label={label}
    value={value ?? "—"}
    variant="standard"
    fullWidth
    disabled
    InputProps={{ readOnly: true }}
    sx={{
      "& .MuiInputBase-input.Mui-disabled": { WebkitTextFillColor: "#111827" },
      "& .MuiInputLabel-root.Mui-disabled": { color: "#6b7280" },
    }}
  />
);

const placeholder = {
  name: "—",
  designation: "—",
  email: "—",
  linkedInProfile: "—",
  languagesSpoken: [],
  address: "—",
  isActive: null,
  avatarUrl: "",
};

// ---------- data helpers ----------
const getPocId = (p) => p?._id?.$oid || p?._id || p?.id || null;

const normalizeFormValues = (poc, companyId) => ({
  name: poc?.name || "",
  companyId: poc?.companyId || companyId || "",
  designation: poc?.designation || "",
  email: poc?.email || "",
  phone: poc?.phone || "",
  linkedInProfile: poc?.linkedInProfile || "",
  languagesSpoken: Array.isArray(poc?.languagesSpoken)
    ? poc.languagesSpoken.join(", ")
    : Array.isArray(poc?.languages)
      ? poc.languages.join(", ")
      : "",
  address: poc?.address || "",
  profileImage: poc?.profileImage || poc?.avatarUrl || "",
  isActive: typeof poc?.isActive === "boolean" ? poc.isActive : true,
  availibilityTime: poc?.availibilityTime || "",
});

const normalizePocList = (data) => {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") return [data];
  return [];
};

const sortByMostRecentlyUpdated = (a, b) => {
  const aDate = new Date(a?.updatedAt || a?.createdAt || 0).getTime();
  const bDate = new Date(b?.updatedAt || b?.createdAt || 0).getTime();
  return bDate - aDate;
};

async function fetchPocAxios(companyId, signal) {
  try {
    const res = await axios.get(
      `https://wononomadsbe.vercel.app/api/poc/poc?companyId=${companyId}`,
      { signal },
    );
    return normalizePocList(res.data).sort(sortByMostRecentlyUpdated);
  } catch (_err) {
    // keep UI stable when endpoint fails
  }

  return [];
}

// ---------- component ----------
const PocDetails = () => {
  const queryClient = useQueryClient();
  const selectedCompany = useSelector((s) => s.company?.selectedCompany);

  // const companyId = getCompanyId(selectedCompany);

  const companyId = selectedCompany?.companyId;

  const pocFromCompany = selectedCompany?.poc || null; // instant fill if present

  const { data: fetchedPocList = [], isFetching } = useQuery({
    queryKey: ["pocDetails", companyId],
    enabled: !!companyId,
    queryFn: ({ signal }) => fetchPocAxios(companyId, signal),
    placeholderData: [],
    refetchOnWindowFocus: false,
    retry: 0,
    staleTime: 5 * 60 * 1000,
  });

  const pocList = useMemo(() => {
    if (pocFromCompany) return [pocFromCompany];
    return fetchedPocList;
  }, [pocFromCompany, fetchedPocList]);

  const [selectedPocId, setSelectedPocId] = useState(null);

  useEffect(() => {
    if (!pocList.length) {
      setSelectedPocId(null);
      return;
    }

    const hasSelected = pocList.some(
      (item) => getPocId(item) === selectedPocId,
    );
    if (!hasSelected) {
      setSelectedPocId(getPocId(pocList[0]));
    }
  }, [pocList, selectedPocId]);

  const poc =
    pocList.find((item) => getPocId(item) === selectedPocId) ||
    pocList[0] ||
    placeholder;
  const endpointCompanyId = poc?.companyId || companyId || "";

  const initialFormValues = useMemo(
    () => normalizeFormValues(poc, companyId),
    [poc, companyId],
  );
  const [isEditMode, setIsEditMode] = useState(false);
  const [formValues, setFormValues] = useState(initialFormValues);

  useEffect(() => {
    setFormValues(initialFormValues);
  }, [initialFormValues]);

  const { mutate: updatePoc, isPending: isUpdating } = useMutation({
    mutationFn: async (payload) => {
      const res = await axios.put(
        // `https://wononomadsbe.vercel.app/api/poc/poc/${endpointCompanyId}`,
        `http://localhost:3000/api/poc/poc/${endpointCompanyId}`,
        payload,
      );
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data?.message || "POC details updated successfully");
      queryClient.invalidateQueries({ queryKey: ["pocDetails", companyId] });
      setIsEditMode(false);
    },
    onError: (error) => {
      toast.error(
        error?.response?.data?.message || "Failed to update POC details",
      );
    },
  });

  const handleFieldChange = (field) => (event) => {
    const value =
      field === "isActive" ? event.target.checked : event.target.value;
    setFormValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleEditToggle = () => {
    if (!endpointCompanyId) {
      toast.error("Company ID not found for this record");
      return;
    }
    setIsEditMode(true);
  };

  const handleCancelEdit = () => {
    setFormValues(initialFormValues);
    setIsEditMode(false);
  };

  const handleSave = () => {
    if (!endpointCompanyId) {
      toast.error("Company ID not found for this record");
      return;
    }

    const payload = {
      ...formValues,
      companyId: formValues.companyId || endpointCompanyId || companyId,
      languagesSpoken: formValues.languagesSpoken
        .split(",")
        .map((lang) => lang.trim())
        .filter(Boolean),
    };

    updatePoc(payload);
  };

  // Normalize for display
  const languagesArr =
    (Array.isArray(poc?.languagesSpoken) && poc.languagesSpoken.length
      ? poc.languagesSpoken
      : Array.isArray(poc?.languages) && poc.languages?.length
        ? poc.languages
        : []) || [];

  const view = {
    fullName: isEditMode ? formValues.name : (poc?.name ?? "—"),
    designation: isEditMode
      ? formValues.designation
      : (poc?.designation ?? "—"),
    email: isEditMode ? formValues.email : (poc?.email ?? "—"),
    linkedInProfile: isEditMode
      ? formValues.linkedInProfile
      : (poc?.linkedInProfile ?? "—"),
    address: isEditMode ? formValues.address : (poc?.address ?? "—"),
    isActive:
      typeof (isEditMode ? formValues.isActive : poc?.isActive) === "boolean"
        ? (isEditMode ? formValues.isActive : poc?.isActive)
          ? "Active"
          : "Inactive"
        : "—",
    languages: languagesArr.length ? languagesArr.join(", ") : "—",
    avatarUrl: poc?.avatarUrl ?? "",
  };

  if (isFetching && !pocFromCompany && !pocList.length) {
    return (
      <PageFrame>
        <div className="w-full flex justify-center items-center py-60">
          <CircularProgress />
        </div>
      </PageFrame>
    );
  }

  return (
    <div className="p-4">
      <PageFrame>
        <div className="flex items-center justify-between pb-4">
          <span className="text-title font-pmedium text-primary uppercase">
            POC Details
          </span>
          {/* {pocList.length > 1 && (
            <TextField
              select
              size="small"
              label="POC"
              value={selectedPocId || ""}
              onChange={(event) => {
                setSelectedPocId(event.target.value);
                setIsEditMode(false);
              }}
              sx={{ minWidth: 220 }}
            >
              {pocList.map((item) => {
                const itemId = getPocId(item);
                return (
                  <MenuItem key={itemId} value={itemId}>
                    {item?.name || "Unnamed POC"}
                  </MenuItem>
                );
              })}
            </TextField>
          )} */}
          <div className="flex items-center gap-2">
            {isEditMode ? (
              <>
                <Button variant="outlined" onClick={handleCancelEdit}>
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  onClick={handleSave}
                  disabled={isUpdating}
                >
                  {isUpdating ? "Saving..." : "Save"}
                </Button>
              </>
            ) : (
              <Button variant="contained" onClick={handleEditToggle}>
                Edit
              </Button>
            )}
          </div>
          {selectedCompany?.companyName && (
            <span className="text-sm text-gray-500">
              Company:{" "}
              <span className="font-pmedium text-gray-700">
                {selectedCompany.companyName}
              </span>
            </span>
          )}
        </div>

        <div className="bg-white ">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center gap-6 border border-gray-200 rounded-xl p-4">
            <Avatar
              src={view.avatarUrl}
              sx={{ width: 96, height: 96, fontSize: "2rem" }}
            >
              {String(view.fullName || "P").charAt(0)}
            </Avatar>

            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xl font-semibold text-gray-900">
                  {view.fullName}
                </span>
              </div>
              <div className="text-sm text-gray-500 mt-1">
                {view.designation}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {/* Company ID: {companyId || "—"} */}
              </div>
            </div>
          </div>

          {/* Two-column form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 mt-6">
            {isEditMode ? (
              <>
                <TextField
                  label="Full Name"
                  value={formValues.name}
                  onChange={handleFieldChange("name")}
                  variant="standard"
                  fullWidth
                />
                <TextField
                  label="Designation"
                  value={formValues.designation}
                  onChange={handleFieldChange("designation")}
                  variant="standard"
                  fullWidth
                />
                <TextField
                  label="Email"
                  value={formValues.email}
                  onChange={handleFieldChange("email")}
                  variant="standard"
                  fullWidth
                />
                <TextField
                  label="Phone"
                  value={formValues.phone}
                  onChange={handleFieldChange("phone")}
                  variant="standard"
                  fullWidth
                />
                <TextField
                  label="LinkedIn Profile"
                  value={formValues.linkedInProfile}
                  onChange={handleFieldChange("linkedInProfile")}
                  variant="standard"
                  fullWidth
                />
                <TextField
                  label="Languages (comma separated)"
                  value={formValues.languagesSpoken}
                  onChange={handleFieldChange("languagesSpoken")}
                  variant="standard"
                  fullWidth
                />
                <TextField
                  label="Address"
                  value={formValues.address}
                  onChange={handleFieldChange("address")}
                  variant="standard"
                  fullWidth
                />
                <TextField
                  label="Profile Image URL"
                  value={formValues.profileImage}
                  onChange={handleFieldChange("profileImage")}
                  variant="standard"
                  fullWidth
                />
                <TextField
                  label="Availability Time"
                  value={formValues.availibilityTime}
                  onChange={handleFieldChange("availibilityTime")}
                  variant="standard"
                  fullWidth
                />
                <div className="flex items-center">
                  <FormControlLabel
                    control={
                      <Switch
                        checked={Boolean(formValues.isActive)}
                        onChange={handleFieldChange("isActive")}
                      />
                    }
                    label="Active"
                  />
                </div>
              </>
            ) : (
              <>
                <ReadOnlyField label="Full Name" value={view.fullName} />
                <ReadOnlyField label="Designation" value={view.designation} />
                <ReadOnlyField label="Email" value={view.email} />
                <ReadOnlyField label="Phone" value={poc?.phone ?? "—"} />
                <ReadOnlyField
                  label="LinkedIn Profile"
                  value={view.linkedInProfile}
                />
                <ReadOnlyField label="Languages" value={view.languages} />
                <ReadOnlyField label="Address" value={view.address} />
                <ReadOnlyField
                  label="Profile Image URL"
                  value={poc?.profileImage ?? poc?.avatarUrl ?? "—"}
                />
                <ReadOnlyField
                  label="Availability Time"
                  value={poc?.availibilityTime ?? "—"}
                />
                <ReadOnlyField label="Active" value={view.isActive} />
              </>
            )}
          </div>
        </div>
      </PageFrame>
    </div>
  );
};

export default PocDetails;
