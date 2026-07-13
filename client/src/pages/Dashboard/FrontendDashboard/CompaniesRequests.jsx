import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import AgTable from "../../../components/AgTable";
import ThreeDotMenu from "../../../components/ThreeDotMenu";
import MuiModal from "../../../components/MuiModal";
import PrimaryButton from "../../../components/PrimaryButton";
import { TextField } from "@mui/material";
import { toast } from "sonner";
import { queryClient } from "../../../main";

const emptyForm = {
  companyName: "",
  companyCity: "",
  companyState: "",
  companyCountry: "",
  companyContinent: "",
};

const slugify = (str) =>
  String(str || "")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "");

const CompaniesRequests = () => {
  const axiosPrivate = useAxiosPrivate();
  const navigate = useNavigate();
  const [reviewTarget, setReviewTarget] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const {
    data: requests = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["companiesListingRequests"],
    queryFn: async () => {
      const response = await axiosPrivate.get("/api/hosts/companies-requests");
      return response.data || [];
    },
  });

  const openReview = (request) => {
    setReviewTarget(request);
    setForm({
      companyName: request.companyName || "",
      companyCity: request.companyCity || "",
      companyState: request.companyState || "",
      companyCountry: request.companyCountry || "",
      companyContinent: request.companyContinent || "",
    });
  };

  const closeReview = () => {
    setReviewTarget(null);
    setForm(emptyForm);
  };

  const { mutate: approveRequest, isPending: isApproving } = useMutation({
    mutationFn: async () => {
      const response = await axiosPrivate.post(
        `/api/hosts/companies-requests/${reviewTarget.companyId}/approve`,
        form,
      );
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data?.message || "Company created");
      queryClient.invalidateQueries({ queryKey: ["companiesListingRequests"] });
      queryClient.invalidateQueries({ queryKey: ["companiesList"] });
      closeReview();
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to create company");
    },
  });

  const { mutate: rejectRequest } = useMutation({
    mutationFn: async (companyId) => {
      const response = await axiosPrivate.post(
        `/api/hosts/companies-requests/${companyId}/reject`,
      );
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data?.message || "Request dismissed");
      queryClient.invalidateQueries({ queryKey: ["companiesListingRequests"] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to dismiss request");
    },
  });

  const columns = [
    {
      field: "logo",
      headerName: "Logo",
      width: 80,
      cellRenderer: (params) => {
        const logoUrl =
          typeof params.value === "string" ? params.value : params.value?.url;
        return logoUrl ? (
          <img
            src={logoUrl}
            alt="logo"
            className="h-10 w-10 object-contain rounded"
          />
        ) : (
          "-"
        );
      },
    },
    {
      field: "companyName",
      headerName: "Company Name",
      flex: 1,
      cellRenderer: (params) => (
        <span
          onClick={() =>
            navigate(`requests/${slugify(params.data.companyName)}`, {
              state: {
                companyId: params.data.companyId,
                companyName: params.data.companyName,
                companyCity: params.data.companyCity,
                companyState: params.data.companyState,
                companyCountry: params.data.companyCountry,
                companyContinent: params.data.companyContinent,
              },
            })
          }
          className="text-blue-600 hover:underline cursor-pointer"
        >
          {params.value}
        </span>
      ),
    },
    {
      field: "companyContinent",
      headerName: "Continent",
      flex: 1,
      cellRenderer: (params) => params.value || "-",
    },
    {
      field: "companyCountry",
      headerName: "Country",
      flex: 1,
      cellRenderer: (params) => params.value || "-",
    },
    {
      field: "companyState",
      headerName: "State",
      flex: 1,
      cellRenderer: (params) => params.value || "-",
    },
    {
      field: "companyCity",
      headerName: "City",
      flex: 1,
      cellRenderer: (params) => params.value || "-",
    },
    {
      field: "actions",
      headerName: "Actions",
      width: 140,
      pinned: "right",
      lockPinned: true,
      cellRenderer: (params) => (
        <ThreeDotMenu
          rowId={params?.data?.companyId}
          menuItems={[
            {
              label: "Review & Create",
              onClick: () => openReview(params.data),
            },
            {
              label: "Reject",
              onClick: () => rejectRequest(params?.data?.companyId),
            },
          ]}
        />
      ),
    },
  ];

  if (isLoading) return <div className="p-6">Loading requests…</div>;
  if (isError)
    return <div className="p-6 text-red-500">Failed to load requests.</div>;

  return (
    <div>
      <AgTable
        data={requests}
        columns={columns}
        search={true}
        tableTitle={"Companies Requests"}
        tableHeight={500}
        loading={isLoading}
      />

      <MuiModal
        open={!!reviewTarget}
        onClose={closeReview}
        title="Review & Create Company"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-500">
            This creates a new entry in Companies, linked back to this host's
            already-existing Nomads listing(s) — nothing gets duplicated or
            moved in Nomads.
          </p>

          <TextField
            label="Company Name"
            size="small"
            value={form.companyName}
            onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
            fullWidth
          />
          <TextField
            label="City"
            size="small"
            value={form.companyCity}
            onChange={(e) => setForm((f) => ({ ...f, companyCity: e.target.value }))}
            fullWidth
          />
          <TextField
            label="State"
            size="small"
            value={form.companyState}
            onChange={(e) => setForm((f) => ({ ...f, companyState: e.target.value }))}
            fullWidth
          />
          <TextField
            label="Country"
            size="small"
            value={form.companyCountry}
            onChange={(e) => setForm((f) => ({ ...f, companyCountry: e.target.value }))}
            fullWidth
          />
          <TextField
            label="Continent"
            size="small"
            value={form.companyContinent}
            onChange={(e) =>
              setForm((f) => ({ ...f, companyContinent: e.target.value }))
            }
            helperText="Leave blank to auto-derive from country"
            fullWidth
          />

          <div className="flex justify-end gap-2 pt-2">
            <PrimaryButton
              type="button"
              title={isApproving ? "Creating..." : "Create Company"}
              disabled={!form.companyName.trim() || isApproving}
              handleSubmit={() => approveRequest()}
            />
          </div>
        </div>
      </MuiModal>
    </div>
  );
};

export default CompaniesRequests;
