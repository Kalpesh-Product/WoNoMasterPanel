import React from "react";
import { FileSpreadsheet, ImageOff, UploadCloud, X } from "lucide-react";

// Shared visual shell for every Data Upload tab — matches Listings Data
// Update / Add Destination Data: white card header, slate dropzone panel,
// blue full-width action button. Each page keeps its own state/mutation
// logic and only swaps its JSX for these pieces.

export const formatFileSize = (bytes) =>
  bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

export const UploadCard = ({ title, description, children }) => (
  <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
    {(title || description) && (
      <div className="mb-4">
        {title && <h4 className="text-xs font-pmedium text-slate-700">{title}</h4>}
        {description && (
          <p className="mt-1 text-[10px] font-pmedium text-slate-400">{description}</p>
        )}
      </div>
    )}
    {children}
  </div>
);

export const UploadPanel = ({ children }) => (
  <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">{children}</div>
);

// Single-file dropzone with a file chip once something's picked.
export const FileDropzone = ({
  file,
  onPick,
  onRemove,
  accept,
  hint,
  dataTour,
  disabled,
}) => {
  const [isDragOver, setIsDragOver] = React.useState(false);

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragOver(false);
    const dropped = event.dataTransfer.files?.[0] ?? null;
    if (dropped) onPick(dropped);
  };

  if (file) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5">
        <FileSpreadsheet size={20} className="shrink-0 text-emerald-600" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-pmedium text-slate-900">{file.name}</p>
          <p className="text-[10px] font-pmedium text-slate-400">{formatFileSize(file.size)}</p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove file"
          className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <label
      data-tour={dataTour}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={disabled ? undefined : handleDrop}
      className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-7 text-center transition ${disabled ? "cursor-not-allowed border-slate-200 bg-slate-100/60 opacity-60" : "cursor-pointer"} ${isDragOver ? "border-[#2563EB] bg-blue-50/60" : "border-slate-200 bg-white hover:border-[#2563EB]/40 hover:bg-blue-50/30"}`}
    >
      <UploadCloud size={22} className={isDragOver ? "text-[#2563EB]" : "text-slate-400"} />
      <span className="text-xs font-pmedium text-slate-600">
        Drag &amp; drop a file here, or click to browse
      </span>
      {hint && <span className="text-[10px] font-pmedium text-slate-400">{hint}</span>}
      <input
        type="file"
        accept={accept}
        className="hidden"
        disabled={disabled}
        onChange={(event) => {
          onPick(event.target.files?.[0] ?? null);
          event.target.value = "";
        }}
      />
    </label>
  );
};

export const UploadSubmitButton = ({ onClick, disabled, pending, label, pendingLabel }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    data-tour="data-upload-actions"
    className="mt-3 w-full rounded-xl bg-[#2563EB] px-4 py-2.5 text-xs font-pmedium text-white transition hover:bg-[#1d4ed8] disabled:opacity-50"
  >
    {pending ? pendingLabel || "Uploading..." : label || "Upload"}
  </button>
);

// Restyles a MUI <TextField select> to match the slate/blue look used
// everywhere else here, for the few pickers (searchable company list) that
// still need MUI instead of a native <select>.
export const muiFieldSx = {
  "& .MuiOutlinedInput-root": {
    borderRadius: "0.75rem",
    fontSize: "0.75rem",
    fontWeight: 500,
    backgroundColor: "#fff",
    "& fieldset": { borderColor: "#e2e8f0" },
    "&:hover fieldset": { borderColor: "#2563eb66" },
    "&.Mui-focused fieldset": { borderColor: "#2563EB", borderWidth: "1.5px" },
  },
  "& .MuiInputLabel-root": { fontSize: "0.75rem", fontWeight: 500 },
  "& .MuiInputLabel-root.Mui-focused": { color: "#2563EB" },
};

// A thumbnail for an existing, already-uploaded image. Shows a clean
// "Unavailable" placeholder instead of the browser's broken-image glyph
// when the URL 404s/times out — the failure is still visible, just tidy.
export const ExistingImageThumb = ({ src, onClick }) => {
  const [broken, setBroken] = React.useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      title={broken ? src : "Click to enlarge"}
      className="relative h-24 w-24 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 transition hover:border-[#2563EB]/40"
    >
      {broken ? (
        <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-slate-400">
          <ImageOff size={18} />
          <span className="text-[9px] font-pmedium">Unavailable</span>
        </span>
      ) : (
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setBroken(true)}
        />
      )}
    </button>
  );
};

export const UploadActions = ({ onUpload, onReset, uploadLabel, pendingLabel, uploadDisabled, resetDisabled, pending }) => (
  <div className="mt-3 flex flex-col items-center gap-2">
    <UploadSubmitButton
      onClick={onUpload}
      disabled={uploadDisabled}
      pending={pending}
      label={uploadLabel}
      pendingLabel={pendingLabel}
    />
    <button
      type="button"
      onClick={onReset}
      disabled={resetDisabled}
      className="text-[10px] font-pmedium text-slate-400 underline-offset-2 transition hover:text-slate-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
    >
      Reset
    </button>
  </div>
);

export const selectCls =
  "w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-pmedium text-slate-900 outline-none transition focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400";

export const SelectField = ({ label, value, onChange, options, disabled }) => (
  <div>
    <label className="text-[10px] font-pmedium uppercase tracking-widest text-slate-400">
      {label}
    </label>
    <select
      className={`${selectCls} mt-1`}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  </div>
);
