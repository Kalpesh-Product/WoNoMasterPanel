import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
} from "react";
import { AgGridReact } from "ag-grid-react";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";
import { TextField, MenuItem, Chip, Popover } from "@mui/material";
import PrimaryButton from "./PrimaryButton";
import SecondaryButton from "./SecondaryButton";
import { IoIosSearch } from "react-icons/io";
import { IoFilter } from "react-icons/io5";
const AgTableComponent = React.memo(
  ({
    data,
    columns,
    dropdownColumns = [],
    paginationPageSize,
    exportData,
    hideFilter,
    rowSelection,
    search,
    tableTitle,
    handleClick,
    buttonTitle,
    tableHeight = 400,
    enableCheckbox, // ✅ New prop to enable checkboxes
    getRowStyle,
    checkAll,
    disabled,
    handleBatchAction,
    isRowSelectable,
    batchButton,
    hideTitle,
    tableRef,
    onSelectionChange,
    filterExcludeColumns = [],
    loading = false,
  }) => {
    const [filteredData, setFilteredData] = useState(data);
    const [searchQuery, setSearchQuery] = useState("");
    const [filters, setFilters] = useState({});
    const [appliedFilters, setAppliedFilters] = useState({});
    const [filterAnchorEl, setFilterAnchorEl] = useState(null);
    const [selectedRows, setSelectedRows] = useState([]); // ✅ Track selected rows
    const [isSmallScreen, setIsSmallScreen] = useState(false);
    const gridRef = useRef(null);

    useEffect(() => {
      setFilteredData(data || []);
    }, [data]);

    useEffect(() => {
      if (tableRef && gridRef.current) {
        tableRef.current = gridRef.current;
      }
    }, [gridRef, tableRef]);

    useEffect(() => {
      const mediaQuery = window.matchMedia("(max-width: 640px)");
      const handleChange = (event) => {
        setIsSmallScreen(event.matches);
      };

      setIsSmallScreen(mediaQuery.matches);

      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener("change", handleChange);
      } else {
        mediaQuery.addListener(handleChange);
      }

      return () => {
        if (mediaQuery.removeEventListener) {
          mediaQuery.removeEventListener("change", handleChange);
        } else {
          mediaQuery.removeListener(handleChange);
        }
      };
    }, []);

    const defaultColDef = {
      resizable: true,
      sortable: true,
      autoHeight: true,
      ...(isSmallScreen ? { minWidth: 140 } : {}),
    };

    // Get unique values for dropdown columns
    const columnOptions = useMemo(() => {
      const options = {};
      dropdownColumns.forEach((col) => {
        options[col] = [...new Set(data.map((row) => row[col]))];
      });
      return options;
    }, [data, dropdownColumns]);

    const handleSearch = (event) => {
      const query = event.target.value.toLowerCase();
      setSearchQuery(query);
      if (!query) {
        setFilteredData(data);
        return;
      }
      const filtered = data.filter((row) =>
        Object.values(row).some((value) =>
          value?.toString().toLowerCase().includes(query),
        ),
      );
      setFilteredData(filtered);
    };

    const handleFilterChange = (field, value) => {
      setFilters((prev) => ({
        ...prev,
        [field]: value,
      }));
    };

    const applyFilters = (nextFilters = filters) => {
      if (typeof nextFilters?.preventDefault === "function") {
        nextFilters.preventDefault();
        nextFilters = filters;
      }
      setAppliedFilters(nextFilters);
      const filtered = data.filter((row) => {
        return Object.keys(nextFilters).every((field) => {
          const filterValue = nextFilters[field]?.toLowerCase();
          return (
            !filterValue ||
            row[field]?.toString().toLowerCase().includes(filterValue)
          );
        });
      });
      setFilteredData(filtered);
      setFilterAnchorEl(null);
    };

    const removeFilter = (field) => {
      const updatedFilters = { ...filters };
      delete updatedFilters[field];
      setFilters(updatedFilters);
      applyFilters(updatedFilters);
    };

    const clearFilters = () => {
      setFilters({});
      setAppliedFilters({});
      setSearchQuery("");
      setFilteredData(data);
    };

    const handleSelectionChanged = useCallback(
      (params) => {
        const rows = params.api.getSelectedRows();
        setSelectedRows(rows);
        if (typeof onSelectionChange === "function") {
          onSelectionChange(rows);
        }
      },
      [onSelectionChange],
    );

    const handleActionClick = () => {
      handleBatchAction(selectedRows);
    };

    const modifiedColumns = useMemo(() => {
      if (!enableCheckbox) return columns;

      return [
        {
          field: "",
          headerCheckboxSelection: checkAll, // ✅ Only allow header checkbox when checkAll is true
          checkboxSelection: true,
          width: 50,
        },
        ...columns,
      ];
    }, [columns, enableCheckbox, checkAll]);

    const filterableColumns = useMemo(() => {
      if (!filterExcludeColumns.length) return columns;
      return columns.filter(
        (column) => !filterExcludeColumns.includes(column.field),
      );
    }, [columns, filterExcludeColumns]);
    const isFilterOpen = Boolean(filterAnchorEl);

    const showLoadingMessage =
      loading && (!filteredData || filteredData.length === 0);
    const noRowsMessage = showLoadingMessage
      ? "Loading Data"
      : "No Rows To Show";

    return (
      <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.06)] overflow-hidden">
        <div className=" flex gap-4 items-center">
          <div
            className={`flex items-center ${tableTitle
              ? "justify-between w-full items-center"
              : "justify-end w-full"
              } px-4 pt-4`}
          >
            {!hideTitle && (
              <div className="flex items-center justify-between pb-3">
                <span className="font-pmedium text-title text-color-black uppercase ml-2">
                  {tableTitle}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2">
              {exportData ? (
                <PrimaryButton
                  title={"Export"}
                  handleSubmit={() => {
                    if (gridRef.current) {
                      gridRef.current.api.exportDataAsCsv({
                        fileName: `${tableTitle || "table-data"}.csv`,
                      });
                    }
                  }}
                />
              ) : (
                ""
              )}
              {buttonTitle ? (
                <PrimaryButton
                  title={buttonTitle}
                  handleSubmit={handleClick}
                  disabled={disabled}
                />
              ) : (
                ""
              )}

              {/* {batchButton ? (
                <div cla>
                  <PrimaryButton
                    title={batchButton || ""}
                    handleSubmit={handleActionClick}
                    disabled={!selectedRows.length > 0}
                  />
                </>
              ) : (
                ""
              )} */}
            </div>
          </div>
        </div>

        <hr className="my-0 border-slate-200" />

        <div
          className={`flex ${search ? "justify-between" : "justify-end"
            } items-center px-4 py-3`}
        >
          {search ? (
            <TextField
              label="Search"
              variant="outlined"
              size="small"
              value={searchQuery}
              onChange={handleSearch}
              placeholder="Search"
              sx={{
                minWidth: 260,
                "& .MuiOutlinedInput-root": {
                  borderRadius: "10px",
                  backgroundColor: "#f8fafc",
                  "& fieldset": {
                    borderColor: "#e2e8f0",
                  },
                  "&:hover fieldset": {
                    borderColor: "#cbd5e1",
                  },
                  "&.Mui-focused fieldset": {
                    borderColor: "#2563EB",
                  },
                },
              }}
              InputProps={{
                startAdornment: (
                  <IoIosSearch size={18} style={{ marginRight: 8, color: "#64748b" }} />
                ),
              }}
            />
          ) : (
            <></>
          )}
          <div className="flex items-center gap-4">
            {hideFilter ? (
              ""
            ) : (
              <div className="flex items-center gap-4">
                <div className="flex justify-end items-center w-full">
                  <div
                    className="p-2 hover:bg-slate-100 cursor-pointer rounded-full border border-slate-200 text-slate-600 transition-colors"
                    onClick={(event) => setFilterAnchorEl(event.currentTarget)}
                  >
                    <IoFilter />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2 px-4 pb-2">
          {Object.keys(appliedFilters).map((field) =>
            appliedFilters[field] ? (
              <Chip
                key={field}
                label={`${field}: ${appliedFilters[field]}`}
                onDelete={() => removeFilter(field)}
                sx={{
                  borderRadius: "9999px",
                  fontWeight: 600,
                  backgroundColor: "#eff6ff",
                  color: "#1d4ed8",
                  border: "1px solid #dbeafe",
                }}
              />
            ) : null,
          )}
        </div>

        <Popover
          open={isFilterOpen}
          anchorEl={filterAnchorEl}
          onClose={() => setFilterAnchorEl(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
          PaperProps={{
            sx: {
              mt: 1,
              width: 420,
              maxWidth: "calc(100vw - 32px)",
              maxHeight: "70vh",
              borderRadius: "14px",
              border: "1px solid #e2e8f0",
              boxShadow: "0 18px 36px rgba(15, 23, 42, 0.14)",
              overflow: "hidden",
              backgroundColor: "#fff",
            },
          }}
        >
          <div className="p-4 border-b border-slate-200 bg-slate-50">
            <div className="text-sm font-pmedium text-slate-800">Advanced Filter</div>
          </div>

          <div className="p-4 overflow-y-auto" style={{ maxHeight: "46vh" }}>
            {filterableColumns.length ? (
              filterableColumns.map((column) =>
                dropdownColumns.includes(column.field) ? (
                  <TextField
                    key={column.field}
                    label={column.headerName}
                    variant="outlined"
                    size="small"
                    select
                    fullWidth
                    margin="normal"
                    value={filters[column.field] || ""}
                    onChange={(e) =>
                      handleFilterChange(column.field, e.target.value)
                    }
                  >
                    <MenuItem value="">All</MenuItem>
                    {columnOptions[column.field]?.map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </TextField>
                ) : (
                  <TextField
                    key={column.field}
                    label={column.headerName}
                    variant="outlined"
                    size="small"
                    fullWidth
                    margin="normal"
                    value={filters[column.field] || ""}
                    onChange={(e) =>
                      handleFilterChange(column.field, e.target.value)
                    }
                  />
                ),
              )
            ) : (
              <div className="text-sm text-slate-500 py-4 text-center">
                No filter fields available
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 px-4 py-3 border-t border-slate-200 bg-white">
            <SecondaryButton title="Clear" handleSubmit={clearFilters} />
            <PrimaryButton title="Apply" handleSubmit={applyFilters} />
          </div>
        </Popover>

        <div
          ref={tableRef}
          className="ag-theme-quartz border-none w-full font-pregular"
          style={{
            height: 440,
            "--ag-borders": "none",
            "--ag-border-color": "#e2e8f0",
            "--ag-header-height": "44px",
            "--ag-row-height": "50px",
            "--ag-font-size": "12px",
            "--ag-header-background-color": "#f8fafc",
            "--ag-row-hover-color": "#f1f5f9",
            "--ag-selected-row-background-color": "#eaf2ff",
            "--ag-odd-row-background-color": "#fcfdff",
          }}
        >
          <AgGridReact
            ref={gridRef}
            rowData={filteredData}
            columnDefs={modifiedColumns} // ✅ Use modified columns with checkboxes
            defaultColDef={defaultColDef}
            overlayNoRowsTemplate={`<span class="ag-overlay-loading-center">${noRowsMessage}</span>`}
            pagination={false}
            isRowSelectable={isRowSelectable}
            paginationPageSize={paginationPageSize}
            suppressCellSelection={false}
            enableCellTextSelection={true}
            rowHeight={50}
            rowSelection={
              enableCheckbox ? (checkAll ? "multiple" : "single") : rowSelection
            }
            onSelectionChanged={handleSelectionChanged}
            getRowStyle={getRowStyle}
            className="font-pregular"
            rowBuffer={20} // ✅ Defines how many extra rows to render outside viewport
            cacheBlockSize={paginationPageSize} // ✅ Controls how many rows to fetch per block
            suppressRowVirtualization={false} // ✅ Ensures row virtualization is active
            suppressColumnVirtualisation={false} // ✅ Ensures column virtualization is active
          />
        </div>

        {/* Floating Action Button */}
        {/* {selectedRows.length > 0 && isTableInView && (
          <div
            className="fixed bottom-8 right-[38rem] bg-blue-600 text-white px-6 py-3 rounded-full shadow-lg cursor-pointer hover:bg-blue-700 transition motion-preset-slide-up-sm"
            onClick={handleActionClick}>
            Mark as Done ({selectedRows.length})
          </div>
        )} */}
      </div>
    );
  },
);

AgTableComponent.displayName = "AgTable";

const AgTable = React.memo(AgTableComponent);

export default AgTable;
