import React from "react";

const PageFrame = ({ children }) => {
  return (
    // NOTE: the page-guide scope (data-tour="page-content") is applied once in
    // MainLayout around the routed <Outlet />, which already covers every page
    // rendered inside this frame. Do not add another marker here — nested
    // duplicates would shadow the outer scope for guide queries.
    <div className="p-4 border-default border-borderGray rounded-xl">
      {/* <div className="rounded-xl"> */}
      {children}
    </div>
  );
};

export default PageFrame;
