import React from "react";
import { Search } from "lucide-react";

// Shared list table for the dashboard pages.
//
// Structure follows the Signup Leads page: one card shell, a toolbar row with the
// search field on the left and the filter selects on the right (plus an optional
// blue button after the filters), a pinned Action column that stays reachable
// while the table scrolls horizontally, and a centered empty state.
//
// columns: [{ key, header, align: "left"|"center"|"right", nowrap, minWidth,
//             headerClassName, cellClassName, render(row, index) }]
// rowProps: (row, index) => object — extra props for the <tr> (e.g. drag handlers).
// rowClassName: string or (row, index) => string.
// actions: (row, index) => ReactNode — rendered in the pinned right column.
// filters: ReactNode — selects (or any controls) rendered right of the search.
// toolbarActions: ReactNode — blue button(s) rendered after the filters.

const ALIGN = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

const STICKY_HEAD =
  "sticky right-0 z-20 bg-slate-50 border-l border-slate-100 shadow-[-6px_0_10px_-6px_rgba(15,23,42,0.25)]";
const STICKY_CELL =
  "sticky right-0 z-10 bg-white group-hover:bg-slate-50 border-l border-slate-100 shadow-[-6px_0_10px_-6px_rgba(15,23,42,0.25)]";

export const DataTableButton = ({
  icon: Icon = null,
  children,
  className = "",
  type = "button",
  ...props
}) => (
  <button
    type={type}
    className={`inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-3 py-2 text-[11px] font-pmedium uppercase tracking-wider text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/40 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    {...props}
  >
    {Icon ? <Icon size={13} /> : null}
    {children}
  </button>
);

const DataTable = ({
  columns = [],
  rows = [],
  rowKey,
  loading = false,
  loadingText = "Loading...",
  emptyText = "No records found.",
  emptyIcon: EmptyIcon = null,
  minWidth = 900,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  searchInputProps = {},
  searchWrapperProps = {},
  filters = null,
  filtersProps = {},
  toolbarActions = null,
  actions = null,
  actionsHeader = "Action",
  onRowClick,
  rowClassName = "",
  rowProps = null,
  tableProps = {},
}) => {
  const hasToolbar =
    Boolean(onSearchChange) || Boolean(filters) || Boolean(toolbarActions);
  const showTable = loading || rows.length > 0;

  return (
    <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
      {hasToolbar && (
        <div className="p-3 sm:p-4 lg:p-5 border-b border-slate-100/60 flex flex-col sm:flex-row sm:flex-nowrap items-stretch sm:items-center gap-3 bg-slate-50/50">
          {onSearchChange ? (
            <div
              {...searchWrapperProps}
              className={`relative flex-1 min-w-[180px] ${
                searchWrapperProps.className || ""
              }`}
            >
              <Search
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                size={15}
              />
              <input
                type="text"
                {...searchInputProps}
                placeholder={searchPlaceholder}
                className={`w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200/60 rounded-lg text-[12px] font-pmedium text-[#0F172A] focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] outline-none transition-all placeholder:text-slate-400 ${
                  searchInputProps.className || ""
                }`}
                value={searchValue ?? ""}
                onChange={(e) => onSearchChange(e.target.value)}
              />
            </div>
          ) : (
            <div className="flex-1" />
          )}

          <div
            {...filtersProps}
            className={`flex min-w-0 items-center justify-end gap-2 flex-nowrap overflow-x-auto sm:shrink-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
              filtersProps.className || ""
            }`}
          >
            {filters}
            {toolbarActions}
          </div>
        </div>
      )}

      {!showTable ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
          {EmptyIcon ? (
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-400">
              <EmptyIcon size={28} />
            </div>
          ) : null}
          <p className="text-slate-400 font-semibold font-pmedium">{emptyText}</p>
        </div>
      ) : (
        <div className="overflow-x-auto flex-1">
          <table
            {...tableProps}
            className={`w-full text-left ${tableProps.className || ""}`}
            style={{ minWidth: `${minWidth}px`, ...(tableProps.style || {}) }}
          >
            <thead className="bg-slate-50/50 text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100/60">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`px-5 py-4 ${col.nowrap === false ? "" : "whitespace-nowrap"} ${
                      ALIGN[col.align || "left"]
                    } ${col.headerClassName || ""}`}
                    style={col.minWidth ? { minWidth: col.minWidth } : undefined}
                  >
                    {col.header}
                  </th>
                ))}
                {actions && (
                  <th
                    className={`px-5 py-4 whitespace-nowrap text-center ${STICKY_HEAD}`}
                  >
                    {actionsHeader}
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/60">
              {loading ? (
                <tr>
                  <td
                    colSpan={columns.length + (actions ? 1 : 0)}
                    className="py-20 text-center text-slate-400 font-pmedium"
                  >
                    {loadingText}
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => (
                  <tr
                    key={rowKey ? rowKey(row, index) : index}
                    className={`hover:bg-slate-50/50 transition-colors group ${
                      onRowClick ? "cursor-pointer" : ""
                    } ${
                      typeof rowClassName === "function"
                        ? rowClassName(row, index)
                        : rowClassName
                    }`}
                    {...(rowProps ? rowProps(row, index) : {})}
                    onClick={onRowClick ? () => onRowClick(row, index) : undefined}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`px-5 py-4 text-[12px] font-pmedium text-slate-600 ${
                          col.nowrap === false ? "" : "whitespace-nowrap"
                        } ${ALIGN[col.align || "left"]} ${
                          col.cellClassName || ""
                        }`}
                      >
                        {col.render ? col.render(row, index) : row[col.key]}
                      </td>
                    ))}
                    {actions && (
                      <td className={`px-5 py-4 text-center ${STICKY_CELL}`}>
                        <div className="flex items-center justify-center gap-1.5">
                          {actions(row, index)}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default DataTable;
