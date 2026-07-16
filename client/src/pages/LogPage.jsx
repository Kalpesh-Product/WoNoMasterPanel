import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import useAxiosPrivate from "../hooks/useAxiosPrivate";
import YearWiseTable from "../components/Tables/YearWiseTable";
import humanDate from "../utils/humanDateForamt";
import humanTime from "../utils/humanTime";
import DetalisFormatted from "../components/DetalisFormatted";
import MuiModal from "../components/MuiModal";

const LogPage = () => {
  const axios = useAxiosPrivate();
  const [openModal, setOpenModal] = useState(false);
  const [selectedLog, setselectedLog] = useState({});
  const { data, isLoading } = useQuery({
    queryKey: ["log"],
    queryFn: async () => {
      try {
        const response = await axios.get("/api/logs/get-logs");
        return response.data;
      } catch (error) {
        console.error(error.response.data.message);
      }
    },
  });

  const handleViewlog = (data) => {
    setselectedLog(data);
    setOpenModal(true);
  };

  const columns = [
    {
      headerName: "Sr No",
      field: "srNo",
      width: 80,
    },
    {
      headerName: "Action",
      field: "action",
      flex: 1,
      cellRenderer: (params) => (
        <div role="button" onClick={() => handleViewlog(params.data)}>
          <span className="underline text-blue-600 cursor-pointer">
            {params.value}
          </span>
        </div>
      ),
    },
    {
      headerName: "Module",
      field: "module",
      flex: 1,
      valueFormatter: (params) => params.value || "-",
    },
    {
      headerName: "Company",
      field: "companyName",
      flex: 1,
      valueFormatter: (params) => params.value || "-",
    },
    {
      headerName: "User",
      field: "user",
      flex: 1,
    },
    // {
    //   headerName: "Path",
    //   field: "path",
    //   flex: 1,
    // },
    {
      headerName: "Date",
      field: "createdAt",
      flex: 1,
      cellRenderer: (params) => humanDate(params.value),
    },
  ];
  // const tableData = isLoading
  //   ? []
  //   : data.map((item) => ({
  //       ...item,
  //       user: `${item.performedBy?.firstName} ${item.performedBy?.lastName}`,
  //       path: item.path ? item.path.split("/").splice(2).join(" > ") : "-",

  //       createdAt: item.createdAt,
  //       payload: item.payload,
  //     }));

  const tableData = isLoading
    ? []
    : data.map((item, index) => ({
      srNo: index + 1,
      ...item,
      user:
        item.fullName ||
        (item.performedBy
          ? `${item.performedBy.firstName ?? ""} ${item.performedBy.lastName ?? ""
            }`.trim()
          : "-"),
      path: item.path ? item.path.split("/").splice(2).join(" > ") : "-",
      createdAt: item.createdAt,
      payload: item.payload,
    }));

  //////////////////////Format data for view modal/////////////////////////

  // Format key to be human-readable
  // const formatKey = (key) =>
  //   key.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase());

  const skipKeys = ["__v", "_id", "refreshToken", "password"];

  const formatKey = (key) => {
    return key
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase());
  };

  const isMongoId = (value) =>
    typeof value === "string" && /^[a-f\d]{24}$/i.test(value);

  // Enhanced filter for object fields
  // const shouldSkipField = (key, value) => {
  //   if (skipKeys.includes(key)) return true;
  //   if (isMongoId(value)) return true;
  //   if (typeof value === "object" && !Array.isArray(value) && value !== null)
  //     return false; // allow first-level objects for image
  //   return false;
  // };

  const shouldSkipField = (key, value) => {
    if (skipKeys.includes(key)) return true;
    if (typeof value === "string" && isMongoId(value)) return true;
    if (Array.isArray(value)) {
      return value.every((item) => isMongoId(item));
    }
    return false;
  };

  const formatValue = (key, value) => {
    if (shouldSkipField(key, value)) return null;
    if (isMongoId(value)) return null;

    // Arrays
    if (Array.isArray(value)) {
      const cleanList = value.filter(
        (item) => !isMongoId(item) && typeof item !== "object",
      );

      const cleanedObjects = value
        .filter((item) => typeof item === "object" && item !== null)
        .map((obj) =>
          Object.fromEntries(
            Object.entries(obj).filter(([k, v]) => !shouldSkipField(k, v)),
          ),
        );

      const finalList = [...cleanList, ...cleanedObjects].filter(Boolean);

      if (finalList.length === 0) return "-";

      return (
        <ul className="list-disc list-inside">
          {finalList.map((item, idx) => (
            <li key={idx}>
              {typeof item === "object" ? JSON.stringify(item) : item}
            </li>
          ))}
        </ul>
      );
    }

    // Objects
    if (typeof value === "object" && value !== null) {
      const entries = Object.entries(value).filter(
        ([subKey, subVal]) => !shouldSkipField(subKey, subVal),
      );

      const hasImage = Object.keys(value).some((k) =>
        k.toLowerCase().includes("image"),
      );

      if (entries.length === 0 && !hasImage) return null;

      return (
        <div className="grid grid-cols-1 gap-1 text-sm max-w-md overflow-x-auto">
          {Object.entries(value).map(([innerKey, innerValue], idx) => {
            if (shouldSkipField(innerKey, innerValue)) return null;

            const isImageField = innerKey.toLowerCase().includes("image");
            if (isImageField && innerValue) {
              const imageUrl =
                typeof innerValue === "string"
                  ? innerValue
                  : innerValue.url || null;

              if (imageUrl) {
                return (
                  <div key={idx} className="flex flex-col gap-1">
                    <span>{formatKey(innerKey)}:</span>
                    <img
                      src={imageUrl}
                      alt={innerKey}
                      className="h-24 w-24 rounded border object-cover"
                    />
                  </div>
                );
              }
            }

            if (
              typeof innerValue !== "object" ||
              innerValue === null ||
              Array.isArray(innerValue)
            ) {
              let displayValue = innerValue;

              if (innerKey.toLowerCase().includes("date")) {
                displayValue = humanDate(innerValue);
              } else if (innerKey.toLowerCase().includes("time")) {
                displayValue = humanTime(innerValue);
              }

              return (
                <div key={idx} className="flex gap-1 items-start">
                  <span className="whitespace-nowrap">
                    {formatKey(innerKey)}:
                  </span>
                  <span className="break-words">{displayValue ?? "-"}</span>
                </div>
              );
            }

            return null;
          })}
        </div>
      );
    }

    // Top-level key formatting
    if (key.toLowerCase().includes("date")) return humanDate(value);
    if (key.toLowerCase().includes("time")) return humanTime(value);

    return value ?? "-";
  };

  return (
    <div>
      <YearWiseTable
        data={tableData || []}
        columns={columns}
        dateColumn="createdAt"
        tableHeight={400}
        tableTitle="Logs Table"
        exportData={true}
        search={true}
        filterExcludeColumns={["createdAt"]}
      />
      <MuiModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        title="View Log"
      >
        {selectedLog && (
          <div className="flex flex-col gap-5">
            {/* Summary */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {[
                ["Action", selectedLog.action],
                ["Module", selectedLog.module],
                ["Company", selectedLog.companyName],
                ["Company ID", selectedLog.companyId],
                ["User", selectedLog.user || selectedLog.fullName],
                ["Page", selectedLog.page],
                [
                  "Publish State",
                  selectedLog.publishState
                    ? selectedLog.publishState.toUpperCase()
                    : null,
                ],
                [
                  "Credits Used",
                  selectedLog.creditsUsed !== undefined
                    ? String(selectedLog.creditsUsed)
                    : null,
                ],
                [
                  "Credits Remaining",
                  selectedLog.creditsRemaining !== undefined
                    ? String(selectedLog.creditsRemaining)
                    : null,
                ],
                [
                  "Status",
                  selectedLog.success === undefined
                    ? null
                    : selectedLog.success
                      ? "Success"
                      : "Failed",
                ],
                [
                  "Date",
                  selectedLog.createdAt
                    ? `${humanDate(selectedLog.createdAt)} ${humanTime(selectedLog.createdAt)}`
                    : null,
                ],
              ]
                .filter(([, value]) => value !== null && value !== undefined && value !== "")
                .map(([title, value]) => (
                  <DetalisFormatted key={title} title={title} detail={value} />
                ))}
            </div>

            {/* Changes done in this action */}
            {Array.isArray(selectedLog.changes) &&
              selectedLog.changes.length > 0 && (
                <div>
                  <h4 className="mb-2 border-b border-slate-200 pb-2 text-sm font-semibold text-slate-700">
                    Changes ({selectedLog.changes.length})
                  </h4>
                  <div className="flex max-h-72 flex-col divide-y divide-slate-100 overflow-y-auto">
                    {selectedLog.changes.map((change, index) => (
                      <div key={index} className="py-2.5 text-sm">
                        {(change.page || change.section) && (
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-600">
                            {[change.page, change.section]
                              .filter(Boolean)
                              .join(" / ")}
                          </p>
                        )}
                        <p className="mt-0.5 text-slate-800">
                          <span className="font-semibold">
                            {change.field || "-"}
                          </span>
                          <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-slate-500">
                            {change.change || change.type || "changed"}
                          </span>
                        </p>
                        {(change.from !== undefined ||
                          change.to !== undefined) && (
                          <p className="mt-1 break-words text-xs">
                            {change.from !== undefined && (
                              <span className="text-red-500 line-through">
                                {String(change.from)}
                              </span>
                            )}
                            {change.from !== undefined &&
                              change.to !== undefined && (
                                <span className="mx-1.5 text-slate-400">→</span>
                              )}
                            {change.to !== undefined && (
                              <span className="font-medium text-emerald-600">
                                {String(change.to)}
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {/* Submitted data (full payload for legacy logs, identifiers for change-tracked ones) */}
            {selectedLog.payload &&
              Object.keys(selectedLog.payload).length > 0 && (
                <div>
                  <h4 className="mb-2 border-b border-slate-200 pb-2 text-sm font-semibold text-slate-700">
                    Submitted Data
                  </h4>
                  <div className="grid grid-cols-1 gap-4">
                    {Object.entries(selectedLog.payload).map(
                      ([key, value], index) => {
                        if (skipKeys.includes(key)) return null;
                        const formattedKey = formatKey(key);
                        const formattedValue = formatValue(key, value);
                        if (!formattedKey || formattedValue === null)
                          return null;
                        return (
                          <DetalisFormatted
                            key={index}
                            title={formattedKey}
                            detail={formattedValue}
                          />
                        );
                      },
                    )}
                  </div>
                </div>
              )}
          </div>
        )}
      </MuiModal>
    </div>
  );
};

export default LogPage;
