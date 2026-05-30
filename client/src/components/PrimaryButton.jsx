import React from "react";
import { CircularProgress } from "@mui/material"; // Import MUI Spinner
import { motion } from "motion/react";

const PrimaryButton = ({
  title,
  handleSubmit,
  type,
  fontSize,
  externalStyles,
  disabled,
  padding,
  className,
  isLoading, // New prop for showing the spinner
}) => {

  return (
    <motion.button
      whileHover={{ scale: disabled || isLoading ? 1 : 1.01 }}
      whileTap={{ scale: disabled || isLoading ? 1 : 0.98 }}
      disabled={disabled || isLoading} // Disable if loading
      type={type}
      className={`flex items-center justify-center gap-2 whitespace-nowrap border transition-all duration-200 ${
        disabled || isLoading
          ? "bg-slate-300 border-slate-300 text-white cursor-not-allowed shadow-none"
          : "bg-[#2563EB] border-blue-600 text-white hover:bg-[#1d4ed8] shadow-[0_10px_18px_rgba(37,99,235,0.22)]"
      } motion-preset-slide-up-sm rounded-xl ${
        fontSize ? fontSize : "text-[12px] font-semibold leading-5"
      } ${externalStyles} ${padding ? padding : "px-4 py-2.5"} ${className}`}
      onClick={handleSubmit}>
      {isLoading && <CircularProgress size={16} sx={{ color: "#ffffff" }} />}{" "}
      {/* Spinner */}
      <span>{isLoading ? `${title}` : title}</span>
    </motion.button>
  );
};

export default PrimaryButton;
