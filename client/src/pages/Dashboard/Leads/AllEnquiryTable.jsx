import React, { useState } from "react";
import AgTable from "../../../components/AgTable";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import { useMutation, useQuery } from "@tanstack/react-query";
import { NOMADS_API_BASE_URL } from "../../../constants/api";
import { Button } from "@mui/material";
import { toast } from "sonner";

const AllEnquiryTable = () => {
  const axios = useAxiosPrivate();
  const [sendingPaymentLeadId, setSendingPaymentLeadId] = useState(null);

  const {
    data = [],
    isPending,
    isError,
  } = useQuery({
    queryKey: ["leadCompany"],
    queryFn: async () => {
      const response = await axios.get(`${NOMADS_API_BASE_URL}/company/all-leads`);
      return response?.data;
    },
  });

  const sendPaymentLinkMutation = useMutation({
    mutationFn: async (lead) => {
      const response = await axios.post(
        "/api/host-user/send-booking-payment-link",
        {
          customerName: lead?.fullName,
          customerEmail: lead?.email,
          companyName: lead?.companyName,
          productType: lead?.productType || lead?.verticalType,
          startDate: lead?.startDate,
          endDate: lead?.endDate,
          noOfPeople: lead?.noOfPeople,

          // Temporary URL. Replace this with Stripe URL later.
          paymentLinkUrl: "https://example.com",
        },
      );

      return response.data;
    },

    onSuccess: (data) => {
      setSendingPaymentLeadId(null);
      toast.success(
        data?.message || "Payment link email sent successfully",
      );
    },

    onError: (error) => {
      setSendingPaymentLeadId(null);

      toast.error(
        error?.response?.data?.message ||
          "Failed to send payment link",
      );
    },
  });

  const columns = [
    { field: "companyName", headerName: "Company Name" },
    { field: "verticalType", headerName: "Vertical Type" },
    { field: "country", headerName: "Country" },
    { field: "state", headerName: "State" },
    { field: "fullName", headerName: "Full Name" },
    { field: "noOfPeople", headerName: "No. Of People" },
    { field: "mobileNumber", headerName: "Mobile Number" },
    { field: "email", headerName: "Email" },
    { field: "startDate", headerName: "Start Date" },
    { field: "endDate", headerName: "End Date" },
    { field: "source", headerName: "Source" },
    { field: "productType", headerName: "Product Type" },
    // { field: "submittedAt", headerName: "Submitted At" },
    { field: "createdAt", headerName: "Submitted At" },
    {
      field: "sendPayment",
      headerName: "Payment",
      pinned: "right",
      minWidth: 180,
      cellRenderer: (params) => {
        const lead = params.data;
        const isSending = sendingPaymentLeadId === lead?._id;
        const isEmailMissing = !lead?.email;

        return (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "100%",
            }}
          >
            <Button
              variant="contained"
              disabled={isSending || isEmailMissing}
              sx={{
                backgroundColor: "#2563eb",
                color: "#ffffff",
                textTransform: "none",
                borderRadius: "9999px",
                whiteSpace: "nowrap",
              }}
              onClick={() => {
                setSendingPaymentLeadId(lead?._id);
                sendPaymentLinkMutation.mutate(lead);
              }}
            >
              {isSending ? "Sending..." : "Send Payment Link"}
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <AgTable
      tableTitle={"All Enquiry"}
      data={data}
      columns={columns}
      search
      tableHeight={350}
      loading={isPending}
    />
  );
};

export default AllEnquiryTable;
