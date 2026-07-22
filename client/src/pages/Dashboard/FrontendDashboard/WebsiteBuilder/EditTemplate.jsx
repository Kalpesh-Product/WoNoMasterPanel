import { useEffect, useState } from "react";
import grapesjs from "grapesjs";
import gjsPresetWebpage from "grapesjs-preset-webpage";
import gjsBasicBlocks from "grapesjs-blocks-basic";
import useAxiosPrivate from "../../../../hooks/useAxiosPrivate";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { useSidebar } from "../../../../context/SideBarContext";
import { toast } from "sonner";
import PrimaryButton from "../../../../components/PrimaryButton";
import { CircularProgress, MenuItem, TextField } from "@mui/material";
import DangerButton from "../../../../components/DangerButton";
import { MdDelete } from "react-icons/md";
import { CiCirclePlus } from "react-icons/ci";
import SecondaryButton from "../../../../components/SecondaryButton";
import { queryClient } from "../../../../main";
// import { useLocation } from "react-router-dom";

const EditTemplate = () => {
  const { templateName, pageName } = useParams();
  const [editor, setEditor] = useState(null);
  const [selectedPage, setSelectedPage] = useState(pageName); // ✅ Track selected page
  const [input, setInput] = useState(false);
  const navigate = useNavigate();
  const {
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      pageName: "",
    },
  });
  const { isSidebarOpen, setIsSidebarOpen } = useSidebar();
  const location = useLocation();

  const axios = useAxiosPrivate();

  useEffect(() => {
    if (isSidebarOpen) {
      setIsSidebarOpen(false);
    }
  }, []);

  // New useEffect: sets sidebar to true for specific route
  useEffect(() => {
    if (location.pathname === "/app/dashboard/frontend-dashboard/edit-theme") {
      setIsSidebarOpen(true);
    }
  }, [location.pathname, setIsSidebarOpen]); // Re-run when route changes

  const fetchPages = async ({ queryKey }) => {
    const [, templateName] = queryKey; // Extract template name
    const response = await axios.get(`/api/editor/templates/${templateName}`);
    return response.data?.pages.map((page) => page.pageName) || [];
  };

  const {
    data: pages = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["pages", templateName],
    queryFn: fetchPages,
    enabled: !!templateName, // ✅ Fetch only when templateName is available
  });

  const { mutate: addPage, isPending: isAddPagePending } = useMutation({
    mutationFn: async (data) => {
      const response = await axios.post(
        `/api/editor/templates/${encodeURIComponent(templateName)}/addPage`,
        {
          pageName: data.pageName,
        }
      );
      return response.data;
    },
    onSuccess: function (data) {
      toast.success(data.message || "Page added successfully");
      queryClient.invalidateQueries({ queryKey: ["pages"] });
      setInput(false);
      reset();
    },
    onError: function (error) {
      toast.error(error.message || "Error adding pages");
    },
  });

  useEffect(() => {
    if (!templateName || !pageName) return;
  
    if (editor) {
      editor.destroy();
      setEditor(null);
    }
  
    const editorInstance = grapesjs.init({
      container: "#editor-canvas",
      storageManager: false,
      blockManager: { appendTo: "#blocks" },
      deviceManager: {},
      plugins: [gjsPresetWebpage, gjsBasicBlocks],
      pluginsOpts: {
        gjsPresetWebpage: {},
        gjsBasicBlocks: {},
      },
      canvas: {
        styles: [
          'https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&family=Montserrat:wght@300;500&display=swap',
          'https://fonts.googleapis.com/css2?family=Belleza&display=swap'
        ],
      },
    });
  
    setEditor(editorInstance);
  
    editorInstance.on("load", () => {
      // Load content from backend
      loadEditorData(editorInstance);
  
      // Add font family dropdown to Style Manager
      editorInstance.StyleManager.addProperty('typography', {
        name: 'Font Family',
        property: 'font-family',
        type: 'select',
        defaults: 'Roboto, sans-serif',
        list: [
          { value: 'Roboto, sans-serif', name: 'Roboto' },
          { value: 'Montserrat, sans-serif', name: 'Montserrat' },
          { value: 'Arial, sans-serif', name: 'Arial' },
          { value: 'Georgia, serif', name: 'Georgia' },
          { value: 'Belleza, serif', name: 'Belleza' },
        ],
      });
    });
  
    addBlocks(editorInstance);
  }, [templateName, pageName]);
  

  // 🔹 Function to Load Editor Data from MongoDB
  const loadEditorData = async (editorInstance) => {
    try {
      const response = await axios.get(
        `/api/editor/load/${encodeURIComponent(
          templateName
        )}/${encodeURIComponent(pageName)}`
      );
      const { components, style, assets } = response.data;

      if (components && components.length > 0) {
        editorInstance.addComponents(components);
      }
      if (style) editorInstance.setStyle(style);
      if (assets) editorInstance.AssetManager.add(assets);
    } catch (error) {
      console.error("Error loading editor data:", error);
    }
  };

  // 🔹 Function to Save Editor Data to MongoDB
  const saveEditorDatas = async () => {
    if (!editor) return;

    const data = {
      templateName: templateName, // Hardcoded for now, make this dynamic
      pageName: pageName, // Hardcoded for now, make this dynamic
      components: editor.getComponents(),
      style: editor.getStyle(),
      assets: editor.AssetManager.getAll().toArray(),
    };

    const response = await axios.post("/api/editor/save", data);
    return response.data;
  };

  const { mutate: saveEditorData, isPending: isSaveEditorData } = useMutation({
    mutationFn: async () => {
      await saveEditorDatas();
    },
    onSuccess: () => {
      toast.success("Changes saved");
    },
    onError: () => {
      toast.error("Error saving data");
    },
  });

  // 🔹 Function to Add Blocks
  const addBlocks = (editorInstance) => {
    editorInstance.BlockManager.add("button", {
      label: "Button",
      category: "Buttons",
      content: `<button style="background: #ff6600; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; font-size: 16px;">Click Me</button>`,
      draggable: true, // ✅ Ensures it can be dragged
    });

    editorInstance.BlockManager.add("div", {
      label: "Div",
      category: "Basic",
      content: `<div style="padding:10px; min-height:50px; border:1px dashed #ccc;">Drag elements here</div>`,
      draggable: true, // ✅ Ensures it can be dragged
    });
  };

  const handlePageChange = (e) => {
    const newPage = e.target.value;
    setSelectedPage(newPage);
    saveEditorData();
    navigate(
      `/app/dashboard/frontend-dashboard/select-theme/edit-theme/${templateName}/${newPage}`
    ); // ✅ Navigate to new page
  };

  return (
    <div
      style={{
        display: "flex",
        height: "75vh",
        background: "#ffff",
        overflowY: "auto",
      }}>
      {/* Sidebar */}
      <div
        style={{
          width: "250px",
          background: "#ffff",
          color: "#fff",
          display: "flex",
          flexDirection: "column",
        }}>
        <span className="text-title text-primary font-pmedium p-4">
          Elements
        </span>
        <div id="blocks" style={{ flex: 1, overflowY: "auto" }}></div>
      </div>

      {/* Main Editor Area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <div
          style={{
            background: "white",
            color: "black",
            padding: "5px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}>
          <span className="text-title text-primary font-pmedium p-3">
            Editor
          </span>
          <div className="flex items-center gap-2 w-1/2">
            {/* 🔹 Page Selection Dropdown */}
            {isLoading ? (
              <div className="">
                <CircularProgress size={10} />
              </div>
            ) : error ? (
              <span style={{ color: "red" }}>Error loading pages</span>
            ) : (
              <TextField
                fullWidth
                size="small"
                select
                value={selectedPage}
                onChange={handlePageChange}
                label="Select Page">
                <MenuItem value="" disabled>
                  Select Page
                </MenuItem>
                {pages.map((page) => (
                  <MenuItem key={page} value={page}>
                    {page}
                  </MenuItem>
                ))}
              </TextField>
            )}

            {isLoading ? (
              <span>Loading</span>
            ) : error ? (
              <span>Error loading pages</span>
            ) : (
              <PrimaryButton
                title={" Add Page"}
                handleSubmit={() => setInput(true)}
              />
            )}
            <PrimaryButton
              title={"Save"}
              handleSubmit={saveEditorData}
              isLoading={isSaveEditorData}
              disabled={isSaveEditorData}
            />
          </div>
        </div>

        <div
          id="editor-canvas"
          style={{ flex: 1, background: "#fff", height: "75vh" }}></div>
      </div>

      {input && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] shadow-xl max-w-md w-full mx-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-sm font-pmedium text-slate-900">Add Page</h3>
              <button onClick={() => { setInput(false); reset(); }} className="text-slate-400 hover:text-slate-600 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <div className="px-6 py-4 overflow-y-auto flex-1">
              <form
                onSubmit={handleSubmit(addPage)}
                className="flex flex-col items-center gap-4"
              >
                <Controller
                  name="pageName"
                  control={control}
                  rules={{ required: "Enter a page name", maxLength: 10 }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Page Name"
                      placeholder="Home"
                      size="small"
                      fullWidth
                      error={!!errors.pageName}
                      helperText={errors.pageName?.message}
                    />
                  )}
                />
                <div className="flex gap-2 items-center">
                  <SecondaryButton
                    title={"Cancel"}
                    handleSubmit={() => {
                      setInput(false);
                      reset();
                    }}
                  />
                  <PrimaryButton
                    title={"Add Page"}
                    type="submit"
                    disabled={isAddPagePending}
                    isLoading={isAddPagePending}
                  />
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditTemplate;
