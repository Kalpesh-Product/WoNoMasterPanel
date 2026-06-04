// MuiModal.js
import React, { useRef } from "react";
import { Modal, Box, IconButton } from "@mui/material";
import { IoMdClose } from "react-icons/io";
import { AnimatePresence, motion } from "motion/react";

const MuiModal = ({ open, onClose, title, children, headerBackground }) => {
  const modalRef = useRef(null);
  return (
    <AnimatePresence>
      <Modal
        open={open}
        onClose={onClose}
        slotProps={{
          backdrop: {
            sx: {
              backgroundColor: "rgba(15, 23, 42, 0.45)",
              backdropFilter: "blur(4px)",
            },
          },
        }}
      >
        <div
          ref={modalRef}
          className="fixed inset-0 flex items-center justify-center p-4 sm:p-6"
        >
          <motion.div
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -12, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="w-full max-w-3xl bg-white border border-slate-200 shadow-[0_22px_50px_rgba(15,23,42,0.25)] rounded-2xl outline-none max-h-[88vh] overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div
              className="flex justify-between items-center px-4 sm:px-5 py-3 border-b border-slate-200 bg-white"
            // style={{
            //   backgroundColor: headerBackground || "white",
            //   color: headerBackground ? "white" : "black",
            // }}
            >
              <div className="min-w-0 pr-3">
                <div className="text-[24px] font-pbold text-slate-900 uppercase truncate">
                  {title || "Details"}
                </div>
              </div>
              <IconButton
                sx={{
                  p: "6px",
                  color: "#64748b",
                  border: "1px solid #e2e8f0",
                  borderRadius: "10px",
                  "&:hover": {
                    backgroundColor: "#f8fafc",
                    color: "#0f172a",
                  },
                }}
                onClick={onClose}
              >
                <IoMdClose
                  className="text-[18px]"
                  style={{ color: "currentColor" }}
                />
              </IconButton>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-5 overflow-y-auto">{children}</div>
          </motion.div>
        </div>
      </Modal>
    </AnimatePresence>
  );
};

export default MuiModal;