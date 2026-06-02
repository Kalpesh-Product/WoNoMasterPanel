import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import AgTable from "../../../components/AgTable";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import { Chip, MenuItem, TextField } from "@mui/material";
import MuiModal from "../../../components/MuiModal";
import { Controller, useForm } from "react-hook-form";
import PrimaryButton from "../../../components/PrimaryButton";
import { toast } from "sonner";
import { Button } from "@mui/material";
import ThreeDotMenu from "../../../components/ThreeDotMenu";
import DetalisFormatted from "../../../components/DetalisFormatted";
import { MdOutlineRemoveRedEye } from "react-icons/md";

const SignupLeads = () => {
  const axios = useAxiosPrivate();
  const queryClient = useQueryClient();
  const [openModal, setOpenModal] = useState(false);
  const [openViewModal, setOpenViewModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [sendingInviteLeadId, setSendingInviteLeadId] = useState(null);
  const [inviteStatusOverrides, setInviteStatusOverrides] = useState({});

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

  const normalizePlanValue = (value) => {
    const normalized = String(value || "basic").trim().toLowerCase();

    if (normalized === "custom") {
      return "customise";
    }

    if (["customise", "customized", "customised"].includes(normalized)) {
      return "customise";
    }

    if (normalized === "professional") return "professional";
    return "basic";
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
        leadId: lead?._id,
        email: lead?.email,
        name: lead?.name,
        mobile: lead?.mobile,
        companyName: lead?.companyName,
        verticalType: lead?.verticalType,
        country: lead?.country,
        state: lead?.state,
        city: lead?.city,
        source: lead?.source,
        fullName: lead?.name,
        selectedPlan: lead?.goals,
        status: lead?.status,
        goals: lead?.goals,
        comment: lead?.comment,
      });

      if (lead?._id) {
        // Keep this best-effort only. That endpoint validates that at least one of
        // status/comment/goals is present, so we include the current status.
        try {
          await axios.patch(
            `https://wononomadsbe.vercel.app/api/forms/host-users/${lead._id}`,
            {
              status: String(lead?.status || "closed").toLowerCase(),
              inviteStatus: "invite_sent",
              inviteSentAt: new Date().toISOString(),
            },
          );
        } catch (error) {
          console.warn(
            "Lead invite metadata update failed, but invite email was sent:",
            error?.response?.data || error?.message,
          );
        }
      }

      return response.data;
    },
    onSuccess: (data, lead) => {
      setSendingInviteLeadId(null);
      const emailKey = String(lead?.email || "").trim().toLowerCase();
      const inviteSentAt = new Date().toISOString();
      setInviteStatusOverrides((prev) => ({
        ...prev,
        [emailKey]: {
          ...(prev[emailKey] || {}),
          inviteStatus: "invite_sent",
          inviteSentAt,
        },
      }));

      queryClient.setQueriesData(
        { queryKey: ["signup-lead-invite-statuses"] },
        (current = {}) => ({
          ...current,
          [emailKey]: {
            ...(current[emailKey] || {}),
            inviteStatus: "invite_sent",
            inviteSentAt,
          },
        }),
      );

      queryClient.setQueryData(["signup-leads"], (current = []) =>
        Array.isArray(current)
          ? current.map((row) =>
            row?._id === lead?._id
              ? {
                ...row,
                inviteStatus: "invite_sent",
                inviteSentAt,
              }
              : row,
          )
          : current,
      );

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
    updateLeadMutation.mutate({
      hostUserId,
      goals: normalizePlanValue(plan),
    });
  };

  const handleOpenModal = (lead) => {
    setSelectedLead(lead);
    reset({ comment: lead?.comment || "" });
    setOpenModal(true);
  };

  const handleOpenViewModal = (lead) => {
    setSelectedLead(lead);
    setOpenViewModal(true);
  };

  const onSubmitComment = (data) => {
    if (!selectedLead?._id) return;
    updateLeadMutation.mutate({
      hostUserId: selectedLead._id,
      comment: data.comment,
    });
  };

  const getSelectChipSx = (styles, value) => ({
    minWidth: 130,
    "& .MuiOutlinedInput-root": {
      borderRadius: "9999px",
      minHeight: 30,
      px: 1,
      fontWeight: 600,
      fontSize: "0.75rem",
      backgroundColor: styles[value]?.bg,
      color: styles[value]?.color,
      border: "1px solid rgba(148, 163, 184, 0.35)",
      "& fieldset": { border: "none" },
    },
    "& .MuiSelect-select": {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      py: "4px !important",
      pr: "22px !important",
      pl: "10px !important",
      textTransform: "capitalize",
    },
    "& .MuiSelect-icon": {
      right: 8,
      color: styles[value]?.color,
      fontSize: "1rem",
    },
  });

  const selectMenuProps = {
    PaperProps: {
      sx: {
        mt: 1,
        borderRadius: "18px",
        border: "1px solid #e2e8f0",
        boxShadow: "0 20px 40px rgba(15, 23, 42, 0.18)",
        p: 0.5,
        overflow: "hidden",
      },
    },
    MenuListProps: {
      dense: true,
      sx: {
        p: 0,
      },
    },
  };

  const columns = [
    { field: "name", headerName: "Name" },
    { field: "email", headerName: "Email" },
    // { field: "mobile", headerName: "Mobile" },
    { field: "companyName", headerName: "Company" },
    {
      field: "goals",
      headerName: "Plan",
      cellRenderer: (params) => {
        const planValue = normalizePlanValue(params.data.goals);
        const planStyles = {
          basic: { bg: "#DBEAFE", color: "#1D4ED8" },
          professional: { bg: "#FEF3C7", color: "#B45309" },
          customise: { bg: "#FCE7F3", color: "#BE185D" },
        };

        return (
          <div style={{ display: "flex", justifyContent: "center" }}>
            <TextField
              select
              size="small"
              value={planValue}
              onChange={(e) => handlePlanChange(params.data._id, e.target.value)}
              sx={getSelectChipSx(planStyles, planValue)}
              MenuProps={selectMenuProps}
            >
              {["basic", "professional", "customise"].map((option) => (
                <MenuItem
                  key={option}
                  value={option}
                  sx={{
                    justifyContent: "flex-start",
                    alignItems: "center",
                    fontWeight: 600,
                    fontSize: "0.75rem",
                    borderRadius: 0,
                    backgroundColor: "transparent",
                    color: "#0f172a",
                    my: 0,
                    px: 1.5,
                    py: 1,
                    textTransform: "capitalize",
                    "&:hover": {
                      backgroundColor: "#f8fafc",
                    },
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
              sx={getSelectChipSx(statusStyles, statusValue)}
              MenuProps={selectMenuProps}
            >
              {["pending", "contacted", "closed", "rejected"].map((option) => (
                <MenuItem
                  key={option}
                  value={option}
                  sx={{
                    justifyContent: "flex-start",
                    alignItems: "center",
                    fontWeight: 600,
                    fontSize: "0.75rem",
                    borderRadius: 0,
                    backgroundColor: "transparent",
                    color: "#0f172a",
                    my: 0,
                    px: 1.5,
                    py: 1,
                    textTransform: "capitalize",
                    "&:hover": {
                      backgroundColor: "#f8fafc",
                    },
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
      field: "inviteStatus",
      headerName: "Invite Status",
      cellRenderer: (params) => {
        const emailKey = String(params.data?.email || "").trim().toLowerCase();
        const inviteStatus = deriveInviteStatusFromLead(
          params.data,
          {
            ...(inviteStatuses[emailKey] || {}),
            ...(inviteStatusOverrides[emailKey] || {}),
          },
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
            <Chip
              label={labelMap[inviteStatus]}
              size="small"
              sx={{
                backgroundColor: statusStyles[inviteStatus]?.bg,
                color: statusStyles[inviteStatus]?.color,
                fontWeight: 600,
                fontSize: "0.75rem",
              }}
            />
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
          {
            ...(inviteStatuses[emailKey] || {}),
            ...(inviteStatusOverrides[emailKey] || {}),
          },
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
    {
      field: "actions",
      headerName: "Actions",
      pinned: "right",
      minWidth: 120,
      cellRenderer: (params) => (
        <div className="flex items-center gap-2">
          <div
            role="button"
            onClick={() => handleOpenViewModal(params.data)}
            className="p-2 rounded-full hover:bg-borderGray cursor-pointer"
          >
            <MdOutlineRemoveRedEye />
          </div>
          <ThreeDotMenu
            rowId={params.data._id}
            menuItems={[
              {
                label: "Comment",
                onClick: () => handleOpenModal(params.data),
              },
            ]}
          />
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="rounded-md">
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

      <MuiModal
        open={openViewModal}
        onClose={() => setOpenViewModal(false)}
        title="Signup Lead Details"
      >
        <div className="flex flex-col gap-3">
          <DetalisFormatted title="Name" detail={selectedLead?.name} />
          <DetalisFormatted title="Email" detail={selectedLead?.email} />
          <DetalisFormatted title="Mobile" detail={selectedLead?.mobile} />
          <DetalisFormatted title="Role" detail={selectedLead?.role} />
          <DetalisFormatted title="Company" detail={selectedLead?.companyName} />
          <DetalisFormatted
            title="Plan"
            detail={normalizePlanValue(selectedLead?.goals)}
            upperCase
          />
          <DetalisFormatted
            title="Vertical"
            detail={
              Array.isArray(selectedLead?.verticalType)
                ? selectedLead.verticalType.join(", ")
                : selectedLead?.verticalType
            }
          />
          <DetalisFormatted title="Country" detail={selectedLead?.country} />
          <DetalisFormatted title="State" detail={selectedLead?.state} />
          <DetalisFormatted title="City" detail={selectedLead?.city} />
          <DetalisFormatted title="Source" detail={selectedLead?.source} />
          <DetalisFormatted title="Form" detail={selectedLead?.formName} />
          <DetalisFormatted title="Status" detail={selectedLead?.status} />
          <DetalisFormatted title="Comment" detail={selectedLead?.comment} />
          <DetalisFormatted
            title="Created At"
            detail={
              selectedLead?.createdAt
                ? new Date(selectedLead.createdAt).toLocaleString()
                : "-"
            }
          />
        </div>
      </MuiModal>
    </>
  );
};

export default SignupLeads;
