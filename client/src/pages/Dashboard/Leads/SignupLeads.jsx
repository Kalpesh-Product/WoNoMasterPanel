import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import AgTable from "../../../components/AgTable";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import { IconButton, MenuItem, TextField } from "@mui/material";
import { MdOutlineRateReview } from "react-icons/md";
import MuiModal from "../../../components/MuiModal";
import { Controller, useForm } from "react-hook-form";
import PrimaryButton from "../../../components/PrimaryButton";
import { toast } from "sonner";
import { Button } from "@mui/material";

const SignupLeads = () => {
  const axios = useAxiosPrivate();
  const queryClient = useQueryClient();
  const [openModal, setOpenModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [sendingInviteLeadId, setSendingInviteLeadId] = useState(null);

  const normalizeInviteStatus = (status) => {
    const normalized = String(status || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");

    if (normalized === "invite_sent") return "invite_sent";
    if (normalized === "registered") return "registered";
    if (normalized === "joined") return "joined";
    return "not_invited";
  };

  const deriveInviteStatusFromLead = (lead = {}, localStatus) => {
    const explicitStatus = normalizeInviteStatus(
      localStatus?.inviteStatus ||
        lead?.inviteStatus ||
        lead?.invitationStatus ||
        lead?.userStatus ||
        lead?.registrationStatus,
    );

    if (
      localStatus?.joinedAt ||
      lead?.joinedAt ||
      lead?.lastLoginAt ||
      lead?.isJoined === true
    ) {
      return "joined";
    }

    if (
      localStatus?.registeredAt ||
      lead?.registeredAt ||
      lead?.accountCreatedAt ||
      lead?.isRegistered === true
    ) {
      return "registered";
    }

    if (localStatus?.inviteSentAt || lead?.inviteSentAt) {
      return "invite_sent";
    }

    return explicitStatus;
  };

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

  const inviteStatusEmails = useMemo(
    () =>
      leads
        .map((lead) => String(lead?.email || "").trim().toLowerCase())
        .filter(Boolean),
    [leads],
  );

  const { data: inviteStatuses = {} } = useQuery({
    queryKey: ["signup-lead-invite-statuses", inviteStatusEmails],
    enabled: inviteStatusEmails.length > 0,
    queryFn: async () => {
      const response = await axios.get("/api/host-user/invite-statuses", {
        params: { emails: inviteStatusEmails.join(",") },
      });
      return response?.data?.data || {};
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
      queryClient.invalidateQueries({
        queryKey: ["signup-lead-invite-statuses"],
      });
      setOpenModal(false);
      toast.success("Lead updated");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Update failed");
    },
  });

  const sendInviteMutation = useMutation({
    mutationFn: async (lead) => {
      const response = await axios.post("/api/host-user/send-invite", {
        email: lead?.email,
        name: lead?.name,
        fullName: lead?.name,
        companyName: lead?.companyName,
        selectedPlan: lead?.goals,
        country: lead?.country,
        state: lead?.state,
        city: lead?.city,
        verticalType: lead?.verticalType,
        status: lead?.status,
      });

      if (lead?._id) {
        await axios.patch(
          `https://wononomadsbe.vercel.app/api/forms/host-users/${lead._id}`,
          {
            inviteStatus: "invite_sent",
            inviteSentAt: new Date().toISOString(),
          },
        );
      }

      return response.data;
    },
    onSuccess: (data) => {
      setSendingInviteLeadId(null);
      queryClient.invalidateQueries({ queryKey: ["signup-leads"] });
      queryClient.invalidateQueries({
        queryKey: ["signup-lead-invite-statuses"],
      });
      toast.success(data?.message || "Invite email sent");
    },
    onError: (error) => {
      setSendingInviteLeadId(null);
      toast.error(error?.response?.data?.message || "Failed to send invite");
    },
  });

  const { control, handleSubmit, reset } = useForm({
    defaultValues: { comment: "" },
  });

  const handleStatusChange = (hostUserId, status) => {
    if (!hostUserId || !status) return;
    updateLeadMutation.mutate({ hostUserId, status: status.toLowerCase() });
  };

  const handlePlanChange = (hostUserId, plan) => {
    if (!hostUserId || !plan) return;
    updateLeadMutation.mutate({ hostUserId, goals: plan.toLowerCase() });
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
    {
      field: "goals",
      headerName: "Plan",
      cellRenderer: (params) => {
        const planValue = (params.data.goals || "basic").toLowerCase();
        const planStyles = {
          basic: { bg: "#DBEAFE", color: "#1D4ED8" },
          professional: { bg: "#FEF3C7", color: "#B45309" },
          custom: { bg: "#FCE7F3", color: "#BE185D" },
        };

        return (
          <div style={{ display: "flex", justifyContent: "center" }}>
            <TextField
              select
              size="small"
              value={planValue}
              onChange={(e) => handlePlanChange(params.data._id, e.target.value)}
              sx={{
                minWidth: 140,
                "& .MuiOutlinedInput-root": {
                  borderRadius: "9999px",
                  px: 1.5,
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  backgroundColor: planStyles[planValue]?.bg,
                  color: planStyles[planValue]?.color,
                  "& fieldset": { border: "none" },
                },
              }}
            >
              {["basic", "professional", "custom"].map((option) => (
                <MenuItem
                  key={option}
                  value={option}
                  sx={{
                    justifyContent: "center",
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    borderRadius: "9999px",
                    backgroundColor: planStyles[option]?.bg,
                    color: planStyles[option]?.color,
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
    { field: "companyName", headerName: "Company" },
    { field: "verticalType", headerName: "Vertical" },
    { field: "country", headerName: "Country" },
    { field: "state", headerName: "State" },
    { field: "city", headerName: "City" },
    { field: "source", headerName: "Source" },
    { field: "formName", headerName: "Form" },
    {
      field: "status",
      headerName: "Leads Status",
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
    {
      field: "inviteStatus",
      headerName: "Invite Status",
      cellRenderer: (params) => {
        const emailKey = String(params.data?.email || "").trim().toLowerCase();
        const inviteStatus = deriveInviteStatusFromLead(
          params.data,
          inviteStatuses[emailKey],
        );
        const statusStyles = {
          not_invited: { bg: "#F3F4F6", color: "#4B5563" },
          invite_sent: { bg: "#DBEAFE", color: "#1D4ED8" },
          registered: { bg: "#FEF3C7", color: "#B45309" },
          joined: { bg: "#D1FAE5", color: "#047857" },
        };
        const labelMap = {
          not_invited: "Not invited",
          invite_sent: "Invite sent",
          registered: "Registered",
          joined: "Joined",
        };

        return (
          <div style={{ display: "flex", justifyContent: "center" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: 96,
                minHeight: 40,
                padding: "0 12px",
                borderRadius: "9999px",
                fontSize: "0.85rem",
                fontWeight: 600,
                backgroundColor: statusStyles[inviteStatus]?.bg,
                color: statusStyles[inviteStatus]?.color,
              }}
            >
              {labelMap[inviteStatus]}
            </span>
          </div>
        );
      },
    },
    {
      field: "Invite user",
      headerName: "Invite user",
      cellRenderer: (params) => {
        const emailKey = String(params.data?.email || "").trim().toLowerCase();
        const inviteStatus = deriveInviteStatusFromLead(
          params.data,
          inviteStatuses[emailKey],
        );
        const canInvite =
          (params.data.status || "").toLowerCase() === "closed" &&
          !["registered", "joined"].includes(inviteStatus);
        const isSendingThisRow = sendingInviteLeadId === params.data._id;

        return (
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Button
              variant="contained"
              sx={{
                backgroundColor: "#2563eb",
                color: "white",
                textTransform: "none",
                borderRadius: "9999px",
              }}
              disabled={!canInvite || isSendingThisRow}
              onClick={() => {
                setSendingInviteLeadId(params.data._id);
                sendInviteMutation.mutate(params.data);
              }}
            >
              {isSendingThisRow ? "Sending..." : "Invite user"}
            </Button>
          </div>
        );
      },
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
