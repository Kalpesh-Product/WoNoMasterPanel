import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Box, Button, Typography, TextField } from "@mui/material";
import MuiModal from "../../../components/MuiModal";
import { toast } from "sonner";
import AgTable from "../../../components/AgTable";
import PageFrame from "../../../components/Pages/PageFrame";
import ThreeDotMenu from "../../../components/ThreeDotMenu";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import { queryClient } from "../../../main";

// const WORLD_RANKING_ENDPOINT =
//   "https://wononomadsbe.vercel.app/api/state-wise-weight";
const WORLD_RANKING_ENDPOINT = "http://localhost:3000/api/state-wise-weight";

const toRows = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.result)) return payload.result;
  return [];
};

const fmtNumber = (value, digits = 2) => {
  if (value === null || value === undefined || value === "") return "-";
  const num = Number(value);
  if (Number.isNaN(num)) return "-";
  return num.toFixed(digits);
};

const toNumericOrFallback = (value, fallback = 0) => {
  if (value === "" || value === null || value === undefined) return fallback;
  const numericValue = Number(value);
  return Number.isNaN(numericValue) ? fallback : numericValue;
};

const weightColumns = [
  { field: "costOfLiving", headerName: "Cost Of Living", minWidth: 150 },
  { field: "internet", headerName: "Internet", minWidth: 120 },
  { field: "safety", headerName: "Safety", minWidth: 120 },
  { field: "nomadCommunity", headerName: "Nomad Community", minWidth: 170 },
  {
    field: "workInfrastructure",
    headerName: "Work Infrastructure",
    minWidth: 180,
  },
  { field: "qualityOfLife", headerName: "Quality of Life", minWidth: 150 },
  { field: "visaFlexibility", headerName: "Visa Flexibility", minWidth: 160 },
  {
    field: "lifestyleEntertainment",
    headerName: "Lifestyle & Entertainment",
    minWidth: 220,
  },
  {
    field: "climateEnvironment",
    headerName: "Climate & Environment",
    minWidth: 190,
  },
  { field: "accessibility", headerName: "Accessibility", minWidth: 140 },
  { field: "airQualityIndex", headerName: "Air Quality Index", minWidth: 160 },
  {
    field: "startupEcosystemScore",
    headerName: "Startup Ecosystem Score",
    minWidth: 210,
  },
  {
    field: "airportConnectivity",
    headerName: "Airport Connectivity",
    minWidth: 190,
  },
  {
    field: "directInternationalFlights",
    headerName: "Direct International Flights",
    minWidth: 230,
  },
  {
    field: "taxFriendly",
    headerName: "Lower Taxes - Tax Friendly",
    minWidth: 220,
  },
  { field: "purchasingPower", headerName: "Purchasing Power", minWidth: 160 },
  {
    field: "inflationStability",
    headerName: "Inflation Stability",
    minWidth: 170,
  },
  {
    field: "startupSetupCost",
    headerName: "Startup Setup Cost",
    minWidth: 170,
  },
  {
    field: "ventureCapital",
    headerName: "Venture Capital Presence",
    minWidth: 190,
  },
  {
    field: "incubators",
    headerName: "Startup Incubators & Accelerators",
    minWidth: 250,
  },
  {
    field: "techTalentDensity",
    headerName: "Tech Talent Density",
    minWidth: 170,
  },
  { field: "conferences", headerName: "Conferences & Events", minWidth: 180 },
  { field: "remoteJobs", headerName: "Remote Job Availability", minWidth: 200 },
  { field: "founderNomads", headerName: "Founder Nomads", minWidth: 150 },
  { field: "meetupsEvents", headerName: "Meetups & Events", minWidth: 160 },
  { field: "soloNomad", headerName: "Solo Nomad Traveller", minWidth: 180 },
  {
    field: "familyNomads",
    headerName: "Family Nomad Traveller",
    minWidth: 190,
  },
  { field: "femaleNomads", headerName: "Girl Nomad Traveller", minWidth: 170 },
  {
    field: "coupleNomads",
    headerName: "Couple Nomad Travelletrs",
    minWidth: 200,
  },
  {
    field: "partyLifestyle",
    headerName: "Party & Events Nomad Traveller",
    minWidth: 250,
  },
  { field: "nature", headerName: "Nature Nomad Travelling", minWidth: 200 },
  {
    field: "adventure",
    headerName: "Adventure Nomad Travelling",
    minWidth: 220,
  },
  { field: "nightlife", headerName: "Nightlife & Pubs", minWidth: 150 },
  { field: "yoga", headerName: "Yoga", minWidth: 100 },
  {
    field: "healthcareCostIndex",
    headerName: "Healthcare Cost Index",
    minWidth: 190,
  },
];

const WorldRankingWeights = () => {
  const axios = useAxiosPrivate();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [editMode, setEditMode] = useState(false);

  const {
    data: rows = [],
    isPending,
    isError,
  } = useQuery({
    queryKey: ["world-ranking-weights"],
    queryFn: async () => {
      const response = await axios.get(WORLD_RANKING_ENDPOINT);
      return toRows(response.data);
    },
  });

  const { mutate: updateWeights, isPending: isUpdating } = useMutation({
    mutationFn: async ({ id, payload }) => {
      const response = await axios.patch(
        `${WORLD_RANKING_ENDPOINT}/${id}`,
        payload,
      );
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(
        data?.message || "World ranking weight updated successfully",
      );
      queryClient.invalidateQueries({ queryKey: ["world-ranking-weights"] });
      setIsEditOpen(false);
      setEditForm(null);
    },
    onError: (error) => {
      toast.error(
        error?.response?.data?.message ||
          "Failed to update world ranking weight",
      );
    },
  });

  const handleOpenEdit = (row) => {
    const rowWeights = row?.weight || row?.weights || {};
    const initialForm = {
      id: row?._id ?? "",
      rank: row?.rank ?? "",
      continent: row?.continent ?? "",
      country: row?.country ?? "",
      state: row?.state ?? "",
      imageUrl: row?.imageUrl ?? row?.image ?? "",
      imageFile: null,
      weight: {},
    };

    weightColumns.forEach((column) => {
      initialForm.weight[column.field] =
        rowWeights?.[column.field] ?? row?.[column.field] ?? "";
    });

    setEditForm(initialForm);
    setIsEditOpen(true);
  };

  const handleCloseEditModal = () => {
    if (isUpdating) return;
    setIsEditOpen(false);
    setEditForm(null);
  };

  const handleFormFieldChange = (field, value) => {
    setEditForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleWeightFieldChange = (field, value) => {
    setEditForm((prev) => ({
      ...prev,
      weight: {
        ...prev.weight,
        [field]: value,
      },
    }));
  };

  const handleUpdateSubmit = () => {
    if (!editForm) return;

    const payload = {
      rank: toNumericOrFallback(editForm.rank, 0),
      continent: editForm.continent,
      country: editForm.country,
      state: editForm.state,
      imageUrl: editForm.imageUrl || "",
      weight: {},
    };

    weightColumns.forEach((column) => {
      payload.weight[column.field] = toNumericOrFallback(
        editForm.weight?.[column.field],
        0,
      );
    });

    if (!editForm.id) {
      toast.error("Unable to update weight: missing record id");
      return;
    }

    if (editForm.imageFile) {
      const formData = new FormData();
      formData.append("rank", String(payload.rank));
      formData.append("continent", payload.continent || "");
      formData.append("country", payload.country || "");
      formData.append("state", payload.state || "");
      formData.append("image", editForm.imageFile);
      formData.append("weight", JSON.stringify(payload.weight));

      updateWeights({ id: editForm.id, payload: formData });
      return;
    }

    updateWeights({ id: editForm.id, payload });
  };

  const handleImageUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload a valid image file");
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setEditForm((prev) => ({
      ...prev,
      imageUrl: previewUrl,
      imageFile: file,
    }));
    toast.success("Image added successfully");
  };

  useEffect(() => {
    if (!isEditOpen) {
      setEditMode(false);
    }
  }, [isEditOpen]);

  useEffect(() => {
    const previewUrl = editForm?.imageUrl;
    if (!previewUrl || !previewUrl.startsWith("blob:")) return undefined;

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [editForm?.imageUrl]);

  const rowData = useMemo(
    () =>
      rows.map((item, index) => ({
        srNo: index + 1,
        ...item,
      })),
    [rows],
  );

  const columns = useMemo(
    () => [
      {
        field: "srNo",
        headerName: "Sr No",
        width: 90,
        pinned: "left",
        lockPinned: true,
        suppressMovable: true,
      },
      {
        field: "rank",
        headerName: "Rank",
        width: 90,
        pinned: "left",
        lockPinned: true,
        suppressMovable: true,
      },
      {
        field: "state",
        headerName: "State",
        minWidth: 170,
        pinned: "left",
        lockPinned: true,
        suppressMovable: true,
      },
      {
        field: "actions",
        headerName: "Actions",
        width: 110,
        pinned: "right",
        lockPinned: true,
        suppressMovable: true,
        cellRenderer: (params) => (
          <ThreeDotMenu
            rowId={
              params?.data?._id || params?.data?.state || params?.data?.srNo
            }
            menuItems={[
              {
                label: "Edit",
                onClick: () => handleOpenEdit(params.data),
              },
            ]}
          />
        ),
      },
      ...weightColumns.map((column) => ({
        ...column,
        valueGetter: (params) =>
          params.data?.weight?.[column.field] ??
          params.data?.weights?.[column.field] ??
          params.data?.[column.field],
        valueFormatter: (params) => fmtNumber(params.value, 2),
      })),
    ],
    [],
  );

  return (
    <div className="p-4">
      <PageFrame>
        <AgTable
          data={rowData}
          columns={columns}
          search
          tableTitle="World Ranking Weights"
          tableHeight={550}
          loading={isPending}
        />
        {isError ? (
          <p className="pt-3 text-sm text-red-500">
            Could not load world ranking data. Please verify World Ranking API
            connectivity.
          </p>
        ) : null}
      </PageFrame>

      <MuiModal
        open={isEditOpen}
        onClose={handleCloseEditModal}
        title={`Edit Weights of ${editForm?.state || ""} State`}
      >
        <Box
          sx={{
            width: "100%",
          }}
        >
          {editForm ? (
            <>
              <Box className="grid grid-cols-1 md:grid-cols-1 gap-4 mt-1 mb-4">
                <Box className="mt-1 mb-4 flex flex-col items-center justify-center">
                  {/* <TextField
                  label="Image URL"
                  disabled={!editMode}
                  value={editForm.imageUrl || ""}
                  onChange={(event) =>
                    handleFormFieldChange("imageUrl", event.target.value)
                  }
                  fullWidth
                /> */}
                  {editForm.imageUrl ? (
                    <Box sx={{ mt: 2 }}>
                      <Typography
                        variant="subtitle2"
                        sx={{ mb: 1, textAlign: "center" }}
                      >
                        Image Preview
                      </Typography>
                      <Box
                        component="img"
                        src={editForm.imageUrl}
                        alt={`${editForm.state || "State"} preview`}
                        sx={{
                          width: "100%",
                          maxWidth: 360,
                          maxHeight: 220,
                          objectFit: "cover",
                          borderRadius: 1,
                          border: "1px solid #e5e7eb",
                        }}
                      />
                    </Box>
                  ) : null}
                  {editMode ? (
                    <Box sx={{ mt: 2 }}>
                      <Button variant="outlined" component="label">
                        Upload Image
                        <input
                          hidden
                          accept="image/*"
                          type="file"
                          onChange={handleImageUpload}
                        />
                      </Button>
                    </Box>
                  ) : null}
                </Box>
              </Box>
              <Box className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-1 mb-4">
                <TextField
                  label="Rank"
                  type="number"
                  disabled
                  value={editForm.rank}
                  onChange={(event) =>
                    handleFormFieldChange("rank", event.target.value)
                  }
                  fullWidth
                />
                <TextField
                  label="Continent"
                  disabled
                  value={editForm.continent}
                  onChange={(event) =>
                    handleFormFieldChange("continent", event.target.value)
                  }
                  fullWidth
                />
                <TextField
                  label="Country"
                  disabled
                  value={editForm.country}
                  onChange={(event) =>
                    handleFormFieldChange("country", event.target.value)
                  }
                  fullWidth
                />
                <TextField
                  label="State"
                  disabled
                  value={editForm.state}
                  onChange={(event) =>
                    handleFormFieldChange("state", event.target.value)
                  }
                  fullWidth
                />
              </Box>

              <Box className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-1 mb-4">
                {weightColumns.map((column) => (
                  <TextField
                    key={column.field}
                    label={column.headerName}
                    type="number"
                    disabled={!editMode}
                    value={editForm?.weight?.[column.field] ?? ""}
                    onChange={(event) =>
                      handleWeightFieldChange(column.field, event.target.value)
                    }
                    fullWidth
                  />
                ))}
              </Box>
            </>
          ) : null}

          {editMode ? (
            <Box sx={{ display: "flex", justifyContent: "center", gap: 2 }}>
              <Button onClick={() => setEditMode(false)} disabled={isUpdating}>
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={handleUpdateSubmit}
                disabled={isUpdating || !editForm}
              >
                {isUpdating ? "Updating..." : "Update"}
              </Button>
            </Box>
          ) : (
            <Box sx={{ display: "flex", justifyContent: "center", gap: 2 }}>
              <Button onClick={() => setEditMode(true)} variant="contained">
                Edit
              </Button>
            </Box>
          )}
        </Box>
      </MuiModal>
    </div>
  );
};

export default WorldRankingWeights;
