import React from "react";
import { CircularProgress } from "@mui/material"; // Import MUI Spinner
import { motion } from "motion/react";

const SecondaryButton = ({
  title,
  handleSubmit,
  type,
  fontSize,
  externalStyles,
  padding,
  className,
  disabled,
  isLoading, // New prop for showing the spinner
}) => {
  return (
    <motion.button
      whileHover={{ scale: 1.050 }}
      whileTap={{ scale: 0.9 }}
      disabled={disabled || isLoading} // Disable if loading
      type={type}
      className={`flex items-center justify-center gap-2 whitespace-nowrap border transition-all duration-200 ${disabled || isLoading
        ? "bg-gray-400 border-gray-400 text-black cursor-not-allowed shadow-none"
        : "bg-borderGray border-borderGray text-black hover:bg-gray-200 shadow-sm"
        } motion-preset-slide-up-sm rounded-xl ${fontSize ? fontSize : "text-[12px] font-semibold leading-5"
        } ${externalStyles} ${padding ? padding : "px-4 py-2.5"} ${className}`}
      onClick={handleSubmit}
    >
      {isLoading && <CircularProgress size={16} color="#111827" />}{" "}
      {/* Spinner */}
      <span>{isLoading ? `${title}` : title}</span>
    </motion.button>
  );
};

export default SecondaryButton;
