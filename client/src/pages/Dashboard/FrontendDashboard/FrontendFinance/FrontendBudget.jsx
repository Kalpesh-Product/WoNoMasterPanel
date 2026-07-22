import React, { Suspense, useEffect, useMemo, useState, useRef } from "react";
import WidgetSection from "../../../../components/WidgetSection";
import {
  TextField,
  Select,
  MenuItem,
  FormControl,
  Skeleton,
  Box,
} from "@mui/material";
import { LocalizationProvider, DatePicker } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import PrimaryButton from "../../../../components/PrimaryButton";
import useAxiosPrivate from "../../../../hooks/useAxiosPrivate";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Controller, useForm } from "react-hook-form";
import DataCard from "../../../../components/DataCard";
import AllocatedBudget from "../../../../components/Tables/AllocatedBudget";
import { toast } from "sonner";
import Yearlygraph from "../../../../components/graphs/YearlyGraph";
import { inrFormat } from "../../../../utils/currencyFormat";
import { useNavigate } from "react-router-dom";
import BarGraph from "../../../../components/graphs/BarGraph";
import { transformBudgetData } from "../../../../utils/transformBudgetData";
import usePageDepartment from "../../../../hooks/usePageDepartment";

const FrontendBudget = () => {
  const axios = useAxiosPrivate();
  const [isReady, setIsReady] = useState(false);
  const budget = usePageDepartment();

  const [openModal, setOpenModal] = useState(false);
  const modalRef = useRef(null);

  const { data: hrFinance = [], isPending: isHrLoading } = useQuery({
    queryKey: ["frontendBudget"],
    queryFn: async () => {
      try {
        const response = await axios.get(
          `/api/budget/company-budget?departmentId=6798ba9de469e809084e2494`
        );
        const budgets = response.data.allBudgets;
        return Array.isArray(budgets) ? budgets : [];
      } catch (error) {
        console.error("Error fetching budget:", error);
        return [];
      }
    },
  });

  const budgetBar = useMemo(() => {
    if (isHrLoading || !Array.isArray(hrFinance)) return null;
    return transformBudgetData(isHrLoading ? [] : hrFinance);
  }, [isHrLoading, hrFinance]);

  useEffect(() => {
    if (!isHrLoading) {
      const timer = setTimeout(() => setIsReady(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [isHrLoading]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (openModal && modalRef.current && !modalRef.current.contains(e.target)) {
        setOpenModal(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openModal]);

  const expenseRawSeries = useMemo(() => {
    return [
      {
        name: "total",
        group: "FY 2024-25",
        data: budgetBar?.utilisedBudget || [],
      },
      {
        name: "total",
        group: "FY 2025-26",
        data: [1000054, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      },
    ];
  }, [budgetBar]);

  const expenseOptions = {
    chart: {
      type: "bar",
      toolbar: { show: false },
      stacked: true,
      fontFamily: "Poppins-Regular, Arial, sans-serif",
    },
    colors: ["#54C4A7", "#EB5C45"],
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: "40%",
        borderRadius: 5,
        borderRadiusApplication: "none",
        dataLabels: {
          position: "top",
        },
      },
    },
    dataLabels: {
      enabled: true,
      formatter: (val) => {
        const formatted = inrFormat(val.toFixed(0));
        return formatted;
      },
      style: {
        fontSize: "12px",
        colors: ["#000"],
      },
      offsetY: -22,
    },
    yaxis: {
      title: { text: "Amount In Lakhs (INR)" },
      labels: {
        formatter: (val) => `${Math.round(val / 100000)}`,
      },
    },
    fill: {
      opacity: 1,
    },
    legend: {
      show: true,
      position: "top",
    },
    tooltip: {
      enabled: false,
      custom: function ({ series, seriesIndex, dataPointIndex }) {
        const rawData = expenseRawSeries[seriesIndex]?.data[dataPointIndex];
        return `
            <div style="padding: 8px; font-size: 13px; font-family: Poppins, sans-serif">
              <div style="display: flex; align-items: center; justify-content: space-between; background-color: #d7fff4; color: #00936c; padding: 6px 8px; border-radius: 4px; margin-bottom: 4px;">
                <div><strong>HR Expense:</strong></div>
                <div style="width: 10px;"></div>
                <div style="text-align: left;">INR ${Math.round(rawData).toLocaleString("en-IN")}</div>
              </div>
            </div>
          `;
      },
    },
  };

  const totalUtilised =
    budgetBar?.utilisedBudget?.reduce((acc, val) => acc + val, 0) || 0;
  const navigate = useNavigate();

  const { control, handleSubmit, reset } = useForm({
    defaultValues: {
      expanseName: "",
      expanseType: "",
      amount: "",
      dueDate: null,
    },
  });

  const onSubmit = (data) => {
    setOpenModal(false);
    toast.success("Budget Requested succesfully");
    reset();
  };

  const groupedData = Array.isArray(hrFinance)
    ? hrFinance?.reduce((acc, item) => {
        const month = dayjs(item.dueDate).format("MMM-YYYY");

        if (!acc[month]) {
          acc[month] = {
            month,
            latestDueDate: item.dueDate,
            projectedAmount: 0,
            amount: 0,
            tableData: {
              rows: [],
              columns: [
                { field: "expanseName", headerName: "Expense Name", flex: 1 },
                { field: "expanseType", headerName: "Expense Type", flex: 1 },
                { field: "projectedAmount", headerName: "Projected (INR)", flex: 1 },
                { field: "actualAmount", headerName: "Actual (INR)", flex: 1 },
                { field: "dueDate", headerName: "Due Date", flex: 1 },
                { field: "status", headerName: "Status", flex: 1 },
              ],
            },
          };
        }

        acc[month].projectedAmount += item?.projectedAmount;
        acc[month].amount += item?.actualAmount;
        acc[month].tableData.rows.push({
          id: item._id,
          expanseName: item?.expanseName,
          invoiceAttached: item?.invoiceAttached,
          department: item?.department,
          expanseType: item?.expanseType,
          projectedAmount: Number(item?.projectedAmount).toFixed(2),
          actualAmount: inrFormat(item?.actualAmount || 0),
          dueDate: dayjs(item.dueDate).format("DD-MM-YYYY"),
          status: item.status,
        });

        return acc;
      }, {})
    : [];

  const financialData = Object.values(groupedData)
    .map((data, index) => {
      const transoformedRows = data.tableData.rows.map((row, index) => ({
        ...row,
        srNo: index + 1,
        projectedAmount: Number(
          row.projectedAmount.toLocaleString("en-IN").replace(/,/g, "")
        ).toLocaleString("en-IN", { maximumFractionDigits: 0 }),
      }));
      const transformedCols = [
        { field: "srNo", headerName: "SR NO", flex: 1 },
        ...data.tableData.columns,
      ];

      return {
        ...data,
        projectedAmount: data.projectedAmount.toLocaleString("en-IN"),
        amount: Number(data?.amount || 0).toLocaleString("en-IN"),
        expanseType: data?.expanseType,
        tableData: {
          ...data.tableData,
          rows: transoformedRows,
          columns: transformedCols,
        },
      };
    })
    .sort((a, b) => dayjs(b.latestDueDate).diff(dayjs(a.latestDueDate)));

  if (!isReady) {
    return <Skeleton height="100vh" width="100%" />;
  } else {
    return (
      <div className="flex flex-col gap-8">
        <div>
          <Suspense
            fallback={
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <Skeleton variant="text" width={200} height={30} />
                <Skeleton variant="rectangular" width="100%" height={300} />
              </Box>
            }
          >
            <Yearlygraph
              data={expenseRawSeries}
              options={expenseOptions}
              title={"BIZ Nest TECH DEPARTMENT EXPENSE"}
              titleAmount={`INR ${Math.round(totalUtilised).toLocaleString("en-IN")}`}
            />
          </Suspense>
        </div>

        <div className="flex justify-end">
          <PrimaryButton
            title={"Request Budget"}
            padding="px-5 py-2"
            fontSize="text-base"
            handleSubmit={() => setOpenModal(true)}
          />
        </div>

        {!isHrLoading ? (
          <AllocatedBudget
            financialData={financialData}
            isLoading={isHrLoading}
            variant={"fullWidth"}
          />
        ) : (
          <Skeleton height={600} width={"100%"} />
        )}

        {openModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div
              ref={modalRef}
              className="bg-white rounded-[2rem] shadow-xl max-w-md w-full mx-4 max-h-[90vh] flex flex-col"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <h3 className="text-sm font-pmedium text-slate-900">Request Budget</h3>
                <button onClick={() => setOpenModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
              <div className="px-6 py-4 overflow-y-auto flex-1">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <Controller
                    name="expanseName"
                    control={control}
                    rules={{ required: "Expense name is required" }}
                    render={({ field, fieldState }) => (
                      <TextField
                        {...field}
                        label="Expense Name"
                        fullWidth
                        size="small"
                        error={!!fieldState.error}
                        helperText={fieldState.error?.message}
                      />
                    )}
                  />
                  <Controller
                    name="expanseType"
                    control={control}
                    rules={{ required: "Expense type is required" }}
                    render={({ field, fieldState }) => (
                      <FormControl fullWidth error={!!fieldState.error}>
                        <Select {...field} size="small" displayEmpty>
                          <MenuItem value="" disabled>Select Expense Type</MenuItem>
                          <MenuItem value="Internal">Internal</MenuItem>
                          <MenuItem value="External">External</MenuItem>
                        </Select>
                      </FormControl>
                    )}
                  />
                  <Controller
                    name="amount"
                    control={control}
                    rules={{
                      required: "Amount is required",
                      pattern: {
                        value: /^[0-9]+(\.[0-9]{1,2})?$/,
                        message: "Enter a valid amount",
                      },
                    }}
                    render={({ field, fieldState }) => (
                      <TextField
                        {...field}
                        label="Amount"
                        fullWidth
                        size="small"
                        error={!!fieldState.error}
                        helperText={fieldState.error?.message}
                      />
                    )}
                  />
                  <Controller
                    name="dueDate"
                    control={control}
                    rules={{ required: "Due date is required" }}
                    render={({ field, fieldState }) => (
                      <LocalizationProvider dateAdapter={AdapterDayjs}>
                        <DatePicker
                          {...field}
                          label="Due Date"
                          format="DD-MM-YYYY"
                          value={field.value ? dayjs(field.value) : null}
                          onChange={(date) => field.onChange(date ? date.toISOString() : null)}
                          slotProps={{
                            textField: {
                              fullWidth: true,
                              size: "small",
                              error: !!fieldState.error,
                              helperText: fieldState.error?.message,
                            },
                          }}
                        />
                      </LocalizationProvider>
                    )}
                  />
                  <div className="flex justify-center items-center">
                    <PrimaryButton type={"submit"} title={"Submit"} />
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
};

export default FrontendBudget;
