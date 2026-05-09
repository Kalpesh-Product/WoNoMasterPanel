import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import AgTable from "../../../components/AgTable";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import { IconButton, MenuItem, TextField } from "@mui/material";
import { MdOutlineRateReview } from "react-icons/md";
import MuiModal from "../../../components/MuiModal";
import { Controller, useForm } from "react-hook-form";
import PrimaryButton from "../../../components/PrimaryButton";
import { toast } from "sonner";

const SignupLeads = () => {
  const axios = useAxiosPrivate();
  const queryClient = useQueryClient();
  const [openModal, setOpenModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);

  const {
    data: leads = [],
    isPending,
    isError,
  } = useQuery({
    queryKey: ["signup-leads"],
    queryFn: async () => {
      //   const response = await axios.get("/api/forms/host-users");
      const response = await axios.get(
        // "http://localhost:3000/api/forms/host-users",
        "https://wononomadsbe.vercel.app/api/forms/host-users",
      );
      return Array.isArray(response?.data?.data) ? response.data.data : [];
    },
  });

  const updateLeadMutation = useMutation({
    mutationFn: async ({ hostUserId, ...payload }) => {
      const response = await axios.patch(
        // `http://localhost:3000/api/forms/host-users/${hostUserId}`,
        `https://wononomadsbe.vercel.app/api/forms/host-users/${hostUserId}`,
        payload,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["signup-leads"] });
      setOpenModal(false);
      toast.success("Lead updated");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Update failed");
    },
  });

  const { control, handleSubmit, reset } = useForm({
    defaultValues: { comment: "" },
  });

  const handleStatusChange = (hostUserId, status) => {
    if (!hostUserId || !status) return;
    updateLeadMutation.mutate({ hostUserId, status: status.toLowerCase() });
  };

  const handleOpenModal = (lead) => {
    setSelectedLead(lead);
    reset({ comment: lead?.comment || "" });
    setOpenModal(true);
  };

  const onSubmitComment = (data) => {
    if (!selectedLead?._id) return;
    updateLeadMutation.mutate({
      hostUserId: selectedLead._id,
      comment: data.comment,
    });
  };

  const columns = [
    { field: "name", headerName: "Name" },
    { field: "email", headerName: "Email" },
    { field: "mobile", headerName: "Mobile" },
    { field: "role", headerName: "Role" },
    { field: "goals", headerName: "Goals" },
    { field: "companyName", headerName: "Company" },
    { field: "verticalType", headerName: "Vertical" },
    { field: "country", headerName: "Country" },
    { field: "state", headerName: "State" },
    { field: "city", headerName: "City" },
    { field: "source", headerName: "Source" },
    { field: "formName", headerName: "Form" },
    {
      field: "status",
      headerName: "Status",
      cellRenderer: (params) => {
        const statusValue = (params.data.status || "pending").toLowerCase();
        const statusStyles = {
          pending: { bg: "#FEF3C7", color: "#F59E0B" },
          contacted: { bg: "#c7fef9", color: "#0b69f5" },
          closed: { bg: "#D1FAE5", color: "#10B981" },
          rejected: { bg: "#FEE2E2", color: "#EF4444" },
        };

        return (
          <div style={{ display: "flex", justifyContent: "center" }}>
            <TextField
              select
              size="small"
              value={statusValue}
              onChange={(e) =>
                handleStatusChange(params.data._id, e.target.value)
              }
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: "9999px",
                  px: 1.5,
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  backgroundColor: statusStyles[statusValue]?.bg,
                  color: statusStyles[statusValue]?.color,
                  "& fieldset": { border: "none" },
                },
              }}
            >
              {["pending", "contacted", "closed", "rejected"].map((option) => (
                <MenuItem
                  key={option}
                  value={option}
                  sx={{
                    justifyContent: "center",
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    borderRadius: "9999px",
                    backgroundColor: statusStyles[option]?.bg,
                    color: statusStyles[option]?.color,
                    my: 0.5,
                  }}
                >
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </MenuItem>
              ))}
            </TextField>
          </div>
        );
      },
    },
    {
      field: "comment",
      headerName: "Comment",
      cellRenderer: (params) => (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <IconButton onClick={() => handleOpenModal(params.data)}>
            <MdOutlineRateReview />
          </IconButton>
        </div>
      ),
    },
    {
      field: "createdAt",
      headerName: "Created At",
      valueGetter: (params) =>
        params.data?.createdAt
          ? new Date(params.data.createdAt).toLocaleString()
          : "-",
    },
  ];

  return (
    <>
      <div className="border border-borderGray rounded-md p-3">
        <AgTable
          data={leads}
          columns={columns}
          search
          tableHeight={500}
          loading={isPending}
          error={isError}
          tableTitle="Signup Leads"
        />
      </div>

      <MuiModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        title="Update Comment"
      >
        <form
          onSubmit={handleSubmit(onSubmitComment)}
          className="flex flex-col gap-4"
        >
          <Controller
            name="comment"
            control={control}
            rules={{ required: "Comment cannot be empty" }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Comment"
                multiline
                rows={4}
                fullWidth
              />
            )}
          />
          <PrimaryButton
            title="Update Comment"
            type="submit"
            isLoading={updateLeadMutation.isPending}
          />
        </form>
      </MuiModal>
    </>
  );
};

export default SignupLeads;
