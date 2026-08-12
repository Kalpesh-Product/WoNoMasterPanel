import React, { useRef, useState } from "react";
import { IconButton, Avatar, Box } from "@mui/material";
import { LuImageUp } from "react-icons/lu";
import { MdDelete } from "react-icons/md";
import MuiModal from "./MuiModal";

const UploadFileInput = ({
  value,
  onChange,
  disabled=false,
  label = "Upload File",
  allowedExtensions = ["jpg", "jpeg", "png", "pdf","webp"],
  previewType = "auto", // "image", "pdf", "none", or "auto"
  id
}) => {
  const fileInputRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState(
    value ? URL.createObjectURL(value) : null
  );
  const [openModal, setOpenModal] = useState(false);

  const getExtension = (fileName) => fileName.split(".").pop().toLowerCase();

  const isImage = (ext) =>
    ["jpg", "jpeg", "png", "webp", "gif", "bmp"].includes(ext);

  const isPDF = (ext) => ext === "pdf";

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const ext = getExtension(file.name);
      if (!allowedExtensions.includes(ext)) {
        alert(`Only ${allowedExtensions.join(", ")} files are allowed.`);
        return;
      }

      onChange(file);
      setPreviewUrl(URL.createObjectURL(file));
      fileInputRef.current.value = null;
    }
  };

  const handleClear = () => {
    onChange(null);
    setPreviewUrl(null);
  };

  const acceptAttr = allowedExtensions.map((ext) => `.${ext}`).join(",");

  const renderPreview = () => {
    const ext = getExtension(value.name);
    const type =
      previewType === "auto"
        ? isImage(ext)
          ? "image"
          : isPDF(ext)
          ? "pdf"
          : "none"
        : previewType;

    if (type === "image") {
      return (
        <Avatar
          src={previewUrl}
          alt="Preview"
          sx={{ width: "100%", height: "auto", borderRadius: 2 }}
          variant="square"
        />
      );
    }

    if (type === "pdf") {
      return (
        <iframe
          src={previewUrl}
          title="PDF Preview"
          style={{ width: "100%", height: "500px", borderRadius: "8px" }}
        />
      );
    }

    return <div className="text-muted text-sm">Preview not available</div>;
  };

  return (
    <Box className="flex flex-col gap-2">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptAttr}
        disabled={disabled}
        hidden
        id= {id ?? "file-upload"}
        onChange={handleFileChange}
      />

      {/* Display Trigger */}
      <div className="flex flex-col">
        {label ? (
          <label className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest">
            {label}
          </label>
        ) : null}
        <div
          className={`mt-1 flex w-full items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-[13px] font-pmedium ${
            disabled ? "border-slate-200/60 bg-slate-50 text-slate-400" : "border-slate-200/60 bg-white"
          }`}
        >
          <span className={`truncate ${value?.name ? "text-[#0F172A]" : "text-slate-400"}`}>
            {value?.name || "Choose a file..."}
          </span>
          <label
            htmlFor={id ?? "file-upload"}
            className={`shrink-0 rounded p-1 text-[#2563EB] hover:bg-[#2563EB]/10 ${
              disabled ? "pointer-events-none opacity-40" : "cursor-pointer"
            }`}
          >
            <LuImageUp size={16} />
          </label>
        </div>
      </div>

      {/* Preview and Delete */}
      {value && previewUrl && (
        <>
          <span
            className="underline text-primary text-sm cursor-pointer w-fit"
            onClick={() => setOpenModal(true)}
          >
            Preview
          </span>

          <MuiModal
            open={openModal}
            onClose={() => setOpenModal(false)}
            title="File Preview"
          >
            <div className="flex flex-col gap-2">
              <IconButton color="error" onClick={handleClear}>
                <MdDelete />
              </IconButton>
              <div className="p-2 border border-gray-300 rounded-md">
                {renderPreview()}
              </div>
            </div>
          </MuiModal>
        </>
      )}
    </Box>
  );
};

export default UploadFileInput;
