import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import {
  Briefcase,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Globe,
  Pencil,
  Plus,
  Search,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Country, State } from "country-state-city";
import PageFrame from "../../../../components/Pages/PageFrame";
import useAxiosPrivate from "../../../../hooks/useAxiosPrivate";

const formatEmploymentType = (value) =>
  String(value || "full_time")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const SELECTED_STATUSES = ["selected", "hired", "offer"];
const SCREENING_STATUSES = ["new", "applied", "screening", "interview", "shortlist"];

const candidateStatusGroup = (status) => {
  const value = String(status || "").toLowerCase();
  if (value.includes("onboard")) return "onboarded";
  if (SELECTED_STATUSES.some((keyword) => value.includes(keyword))) return "selected";
  if (value.includes("reject")) return "rejected";
  if (SCREENING_STATUSES.some((keyword) => value.includes(keyword))) return "screening";
  return "screening";
};

const candidateStatusClass = (status) => {
  const group = candidateStatusGroup(status);
  if (group === "selected" || group === "onboarded") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (group === "rejected") return "border-rose-200 bg-rose-50 text-rose-600";
  return "border-amber-200 bg-amber-50 text-amber-600";
};

const EMPTY_JOB_FORM = {
  jobCode: "",
  title: "",
  department: "",
  employmentType: "full_time",
  vacancyTotal: "1",
  isPaid: true,
  internshipDurationMonths: "6",
  location: "",
  workMode: "on_site",
  aboutTheJob: "",
  keyResponsibilities: "",
  requirements: "",
  softSkills: "",
  isActive: true,
  isPostedOnWebsite: true,
};

const JobDetailModal = ({ job, onClose }) => {
  if (!job) return null;
  const details = [
    ["Job Code", job.jobCode || "--"],
    ["Department", job.department || "--"],
    ["Employment Type", formatEmploymentType(job.employmentType)],
    ["Paid Role", job.isPaid === false ? "No" : "Yes"],
    ...(job.employmentType === "intern"
      ? [["Internship Duration", `${job.internshipDurationMonths || 0} months`]]
      : []),
    ["Location", job.location || "--"],
    ["Work Mode", formatEmploymentType(job.workMode)],
    ["Vacancies", `${job.vacancyFilled || 0} filled / ${job.vacancyTotal || 0} total`],
    ["Opening Status", job.isActive === false ? "Inactive" : "Active"],
    ["Website Status", job.isPostedOnWebsite === false ? "Not Posted" : "Posted"],
    ["Created On", job.createdAt ? new Date(job.createdAt).toLocaleDateString() : "--"],
  ];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-slate-100 bg-blue-50/30 p-5 sm:p-6">
          <div>
            <p className="text-[10px] font-pmedium uppercase tracking-widest text-blue-600">Published Job Opening</p>
            <h3 className="mt-1 text-lg font-pmedium text-slate-900">{job.designation || job.title || "Untitled opening"}</h3>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-slate-700">
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[70vh] space-y-5 overflow-y-auto p-5 sm:p-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {details.map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                <p className="text-[9px] font-pmedium uppercase tracking-widest text-slate-400">{label}</p>
                <p className="mt-1 text-[12px] font-pmedium text-slate-800">{value}</p>
              </div>
            ))}
          </div>
          {[
            ["About the Job", job.aboutTheJob || job.description],
            ["Key Responsibilities", job.keyResponsibilities],
            ["Requirements", job.requirements],
            ["Soft Skills", job.softSkills],
          ].filter(([, value]) => value).map(([label, value]) => (
            <section key={label}>
              <h4 className="border-b border-slate-100 pb-2 text-[10px] font-pmedium uppercase tracking-widest text-slate-500">{label}</h4>
              <p className="mt-3 whitespace-pre-line text-[12px] leading-6 text-slate-700">{value}</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
};

// Fallback for candidates fetched before the server started resolving labels.
const parseRawCustomFields = (value) => {
  try {
    const raw = typeof value === "string" ? JSON.parse(value || "{}") : value;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
    return Object.entries(raw)
      .filter(([, answer]) => String(answer ?? "").trim() !== "")
      .map(([id, answer]) => ({ id, label: id, value: String(answer) }));
  } catch {
    return [];
  }
};

// The website form stores country/state as ISO codes; resolve display names.
const resolveCountryName = (countryCode) => {
  if (!countryCode) return "";
  return Country.getCountryByCode(countryCode)?.name || countryCode;
};

const resolveStateName = (stateCode, countryCode) => {
  if (!stateCode) return "";
  if (!countryCode) return stateCode;
  return State.getStateByCodeAndCountry(stateCode, countryCode)?.name || stateCode;
};

const CandidateDetailModal = ({ candidate, onClose }) => {
  if (!candidate) return null;
  const customAnswers =
    Array.isArray(candidate.customFieldAnswers) && candidate.customFieldAnswers.length
      ? candidate.customFieldAnswers
      : parseRawCustomFields(candidate.customFields);
  // Mirror the fields collected on the website's application form.
  const details = [
    ["Candidate Code", candidate.candidateCode || "--"],
    ["Applied On", candidate.appliedAt ? new Date(candidate.appliedAt).toLocaleDateString() : "--"],
    ["Position Applied", candidate.positionApplied || "--"],
    ["Job Code", candidate.jobCode || "--"],
    ["Email", candidate.email || "--"],
    ["Mobile Number", candidate.phone || "--"],
    ["Date of Birth", candidate.dateOfBirth ? new Date(candidate.dateOfBirth).toLocaleDateString() : "--"],
    ["Country", resolveCountryName(candidate.country) || "--"],
    ["State", resolveStateName(candidate.state, candidate.country) || "--"],
    ["City", candidate.city || "--"],
    ["Pipeline Status", candidate.status || "New"],
  ];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-slate-100 bg-blue-50/30 p-5 sm:p-6">
          <div>
            <p className="text-[10px] font-pmedium uppercase tracking-widest text-blue-600">Job Application</p>
            <h3 className="mt-1 text-lg font-pmedium text-slate-900">{candidate.fullName || "Unknown candidate"}</h3>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-slate-700">
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[70vh] space-y-5 overflow-y-auto p-5 sm:p-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {details.map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                <p className="text-[9px] font-pmedium uppercase tracking-widest text-slate-400">{label}</p>
                <p className="mt-1 break-words text-[12px] font-pmedium text-slate-800">{value}</p>
              </div>
            ))}
          </div>
          {customAnswers.length > 0 && (
            <section>
              <h4 className="border-b border-slate-100 pb-2 text-[10px] font-pmedium uppercase tracking-widest text-slate-500">Application Form Responses</h4>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {customAnswers.map((answer) => (
                  <div key={answer.id} className={`rounded-2xl border border-slate-100 bg-slate-50/60 p-4 ${String(answer.value).length > 80 ? "sm:col-span-2" : ""}`}>
                    <p className="text-[9px] font-pmedium uppercase tracking-widest text-slate-400">{answer.label}</p>
                    <p className="mt-1 whitespace-pre-line break-words text-[12px] font-pmedium text-slate-800">{answer.value}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
          {candidate.resume?.url && (
            <a href={candidate.resume.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-2xl border border-blue-100 bg-blue-50/60 p-4 text-[12px] font-pmedium text-blue-700 transition-all hover:bg-blue-100">
              <FileText size={16} /> View Resume{candidate.resume.name ? ` — ${candidate.resume.name}` : ""}
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

const inputClass =
  "w-full rounded-lg border border-slate-200/60 bg-white px-3 py-2 text-[12px] font-pmedium text-[#0F172A] outline-none transition-all focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20";

const JobOpeningModal = ({ open, mode, form, setForm, onClose, onSave, isSaving }) => {
  if (!open) return null;
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center overflow-y-auto bg-slate-900/40 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div className="relative flex h-[92vh] w-full flex-col overflow-hidden rounded-t-[32px] border-t border-white/80 bg-white/95 shadow-2xl backdrop-blur-xl sm:h-auto sm:max-h-[95vh] sm:max-w-3xl sm:rounded-[32px] sm:border" onClick={(event) => event.stopPropagation()}>
        <div className="mx-auto mb-1 mt-3 h-1.5 w-12 shrink-0 rounded-full bg-slate-200 sm:hidden" />
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-white p-5 sm:p-6 md:p-8">
          <div>
            <h3 className="text-xl font-pmedium tracking-tight text-primary sm:text-2xl">
              {mode === "edit" ? "Edit Job Opening" : "Publish Job Opening"}
            </h3>
            <p className="mt-2 text-[10px] font-pmedium uppercase tracking-widest text-slate-500 sm:text-[11px]">
              {mode === "edit" ? "Update the role details shown on careers" : "Create a new role for your careers page"}
            </p>
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-500 shadow-sm transition-all hover:bg-slate-100 hover:text-red-500">
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50/30 p-3 sm:p-4">
          <section className="rounded-2xl border border-slate-100 bg-white p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Briefcase size={15} className="text-blue-600" />
              <h4 className="text-[11px] font-pmedium uppercase tracking-widest text-slate-700">Job Details</h4>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <JobField label="Job Code"><input className={inputClass} value={form.jobCode} onChange={(event) => update("jobCode", event.target.value)} placeholder="e.g. HR-001" /></JobField>
              <JobField label="Role / Designation" required><input className={inputClass} value={form.title} onChange={(event) => update("title", event.target.value)} placeholder="e.g. Senior Product Designer" /></JobField>
              <JobField label="Department" required><input className={inputClass} value={form.department} onChange={(event) => update("department", event.target.value)} placeholder="e.g. Design" /></JobField>
              <JobField label="Vacancies"><input type="number" min="1" className={inputClass} value={form.vacancyTotal} onChange={(event) => update("vacancyTotal", event.target.value)} /></JobField>
              <JobField label="Employment Type">
                <select className={inputClass} value={form.employmentType} onChange={(event) => setForm((current) => ({ ...current, employmentType: event.target.value, isPaid: event.target.value === "intern" ? false : current.isPaid }))}>
                  <option value="full_time">Full Time</option><option value="part_time">Part Time</option><option value="contractor">Contractor</option><option value="intern">Internship</option><option value="trainee">Trainee</option>
                </select>
              </JobField>
              <JobField label="Paid Role">
                <label className="flex items-center gap-3 rounded-lg border border-slate-200/60 bg-white px-3 py-2">
                  <input type="checkbox" checked={form.isPaid} disabled={form.employmentType === "intern"} onChange={(event) => update("isPaid", event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-[#2563EB]" />
                  <span className="text-[12px] font-pmedium text-slate-700">{form.employmentType === "intern" ? "Unpaid internship" : "Paid opening"}</span>
                </label>
              </JobField>
              {form.employmentType === "intern" && <JobField label="Internship Duration"><select className={inputClass} value={form.internshipDurationMonths} onChange={(event) => update("internshipDurationMonths", event.target.value)}>{[2, 3, 4, 6].map((months) => <option key={months} value={months}>{months} months</option>)}</select></JobField>}
              <JobField label="Location"><input className={inputClass} value={form.location} onChange={(event) => update("location", event.target.value)} placeholder="State or city" /></JobField>
              <JobField label="Work Mode"><select className={inputClass} value={form.workMode} onChange={(event) => update("workMode", event.target.value)}><option value="on_site">On Site</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option></select></JobField>
              <JobField label="About the Job" wide><textarea rows={5} className={`${inputClass} resize-none`} value={form.aboutTheJob} onChange={(event) => update("aboutTheJob", event.target.value)} placeholder="Short overview shown at the top of the role page..." /></JobField>
              <JobField label="Key Responsibilities" wide><textarea rows={5} className={`${inputClass} resize-none`} value={form.keyResponsibilities} onChange={(event) => update("keyResponsibilities", event.target.value)} placeholder="Add the responsibilities shown in the job description..." /></JobField>
              <JobField label="Requirements" wide><textarea rows={5} className={`${inputClass} resize-none`} value={form.requirements} onChange={(event) => update("requirements", event.target.value)} placeholder="List the required skills and experience..." /></JobField>
              <JobField label="Soft Skills" wide><textarea rows={3} className={`${inputClass} resize-none`} value={form.softSkills} onChange={(event) => update("softSkills", event.target.value)} placeholder="Communication, teamwork, ownership..." /></JobField>
            </div>
          </section>
        </div>

        <div className="flex shrink-0 gap-3 border-t border-slate-100 bg-white p-3 sm:p-4">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-200 bg-white px-6 py-2.5 text-[10px] font-pmedium uppercase tracking-wider text-slate-600 transition-all hover:bg-slate-50">Cancel</button>
          <button type="button" disabled={!form.title.trim() || !form.department.trim() || isSaving} onClick={onSave} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-6 py-2.5 text-[10px] font-pmedium uppercase tracking-wider text-white shadow-sm transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
            <Briefcase size={14} /> {isSaving ? "Saving..." : mode === "edit" ? "Update Job" : "Publish to Website"}
          </button>
        </div>
      </div>
    </div>
  );
};

const JobField = ({ label, required = false, wide = false, children }) => (
  <div className={`flex flex-col gap-1 ${wide ? "md:col-span-2" : ""}`}>
    <label className="text-[10px] font-pmedium uppercase tracking-widest text-slate-500">{label}{required && <span className="text-red-400"> *</span>}</label>
    {children}
  </div>
);

export default function WebsiteBuilderCareers() {
  const axios = useAxiosPrivate();
  const queryClient = useQueryClient();
  const selectedCompany = useSelector((state) => state.company.selectedCompany);
  const workspaceId = String(selectedCompany?.workspaceId || sessionStorage.getItem("workspaceId") || "").trim();
  const [activeTab, setActiveTab] = useState("jobs");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewingJob, setViewingJob] = useState(null);
  const [viewingCandidate, setViewingCandidate] = useState(null);
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [editingJobCode, setEditingJobCode] = useState("");
  const [jobForm, setJobForm] = useState({ ...EMPTY_JOB_FORM });

  const { data: jobs = [], isPending, isError } = useQuery({
    queryKey: ["website-careers", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const response = await axios.get("/api/recruitment/jobs", { params: { workspaceId } });
      return Array.isArray(response?.data?.data) ? response.data.data : [];
    },
  });

  const { data: candidates = [], isError: isCandidatesError } = useQuery({
    queryKey: ["website-careers-candidates", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const response = await axios.get("/api/recruitment/candidates", { params: { workspaceId } });
      return Array.isArray(response?.data?.data) ? response.data.data : [];
    },
  });

  const saveJobMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...jobForm,
        workspaceId,
        jobCode: jobForm.jobCode.trim().toUpperCase(),
        title: jobForm.title.trim(),
        designation: jobForm.title.trim(),
        department: jobForm.department.trim(),
        vacancyTotal: Number(jobForm.vacancyTotal || 1),
        internshipDurationMonths:
          jobForm.employmentType === "intern"
            ? Number(jobForm.internshipDurationMonths || 6)
            : 0,
      };
      if (editingJobCode) {
        return axios.patch(
          `/api/recruitment/jobs/${encodeURIComponent(editingJobCode)}`,
          payload,
        );
      }
      return axios.post("/api/recruitment/jobs", payload);
    },
    onSuccess: () => {
      toast.success(editingJobCode ? "Job opening updated." : "Job opening published.");
      queryClient.invalidateQueries({ queryKey: ["website-careers", workspaceId] });
      setIsJobModalOpen(false);
      setEditingJobCode("");
      setJobForm({ ...EMPTY_JOB_FORM });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to save job opening.");
    },
  });

  // The update endpoint requires the full job payload (title/department are
  // validated), so send the job's current values with only the flag flipped.
  const togglePostedMutation = useMutation({
    mutationFn: async (job) => {
      return axios.patch(
        `/api/recruitment/jobs/${encodeURIComponent(job.jobCode)}`,
        {
          workspaceId,
          jobCode: job.jobCode || "",
          title: job.title || job.designation || "",
          designation: job.designation || job.title || "",
          department: job.department || "",
          employmentType: job.employmentType || "full_time",
          isPaid: job.isPaid !== false,
          internshipDurationMonths: job.internshipDurationMonths || 0,
          vacancyTotal: Number(job.vacancyTotal || 1),
          location: job.location || "",
          workMode: job.workMode || "on_site",
          isActive: job.isActive !== false,
          isPostedOnWebsite: job.isPostedOnWebsite === false,
          aboutTheJob: job.aboutTheJob || job.description || "",
          keyResponsibilities: job.keyResponsibilities || "",
          requirements: job.requirements || "",
          softSkills: job.softSkills || "",
        },
      );
    },
    onSuccess: (_, job) => {
      toast.success(
        job.isPostedOnWebsite === false
          ? "Job is now posted on the website."
          : "Job removed from the website.",
      );
      queryClient.invalidateQueries({ queryKey: ["website-careers", workspaceId] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to update website status.");
    },
  });

  const openCreateJobModal = () => {
    setEditingJobCode("");
    setJobForm({ ...EMPTY_JOB_FORM });
    setIsJobModalOpen(true);
  };

  const openEditJobModal = (job) => {
    setEditingJobCode(job.jobCode || "");
    setJobForm({
      jobCode: job.jobCode || "",
      title: job.title || job.designation || "",
      department: job.department || "",
      employmentType: job.employmentType || "full_time",
      vacancyTotal: String(job.vacancyTotal ?? 1),
      isPaid: job.isPaid !== false,
      internshipDurationMonths: String(job.internshipDurationMonths || 6),
      location: job.location || "",
      workMode: job.workMode || "on_site",
      aboutTheJob: job.aboutTheJob || job.description || "",
      keyResponsibilities: job.keyResponsibilities || "",
      requirements: job.requirements || "",
      softSkills: job.softSkills || "",
      isActive: job.isActive !== false,
      isPostedOnWebsite: job.isPostedOnWebsite !== false,
    });
    setIsJobModalOpen(true);
  };

  const displayedJobs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return [...jobs]
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .filter((job) => {
        const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? job.isActive !== false : job.isActive === false);
        const matchesQuery = !query || [job.title, job.designation, job.department, job.jobCode, job.location]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
        return matchesStatus && matchesQuery;
      });
  }, [jobs, searchQuery, statusFilter]);

  const displayedCandidates = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return [...candidates]
      .sort((a, b) => new Date(b.appliedAt || b.createdAt || 0).getTime() - new Date(a.appliedAt || a.createdAt || 0).getTime())
      .filter((candidate) => {
        const matchesStatus = statusFilter === "all" || candidateStatusGroup(candidate.status) === statusFilter;
        const matchesQuery = !query || [candidate.fullName, candidate.email, candidate.phone, candidate.positionApplied, candidate.candidateCode, candidate.jobCode]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
        return matchesStatus && matchesQuery;
      });
  }, [candidates, searchQuery, statusFilter]);

  const totalVacancies = jobs.reduce((sum, job) => sum + Number(job.vacancyTotal || 0), 0);
  const filledVacancies = jobs.reduce((sum, job) => sum + Number(job.vacancyFilled || 0), 0);
  const candidateGroupCount = (group) => candidates.filter((candidate) => candidateStatusGroup(candidate.status) === group).length;
  const statCards = activeTab === "jobs"
    ? [
        { key: "total", label: "Total Jobs", value: jobs.length, icon: Briefcase, className: "", iconClass: "bg-blue-50 text-blue-600" },
        { key: "active", label: "Active", value: jobs.filter((job) => job.isActive !== false).length, icon: CheckCircle2, className: "border-l-4 border-l-emerald-500", iconClass: "bg-emerald-50 text-emerald-600" },
        { key: "vacancies", label: "Total Vacancies", value: totalVacancies, icon: Users, className: "border-l-4 border-l-amber-500", iconClass: "bg-amber-50 text-amber-500" },
        { key: "filled", label: "Filled", value: filledVacancies, icon: UserCheck, className: "border-l-4 border-l-blue-500", iconClass: "bg-blue-50 text-blue-600" },
      ]
    : [
        { key: "applications", label: "Total Candidates", value: candidates.length, icon: Users, className: "", iconClass: "bg-blue-50 text-blue-600" },
        { key: "selected", label: "Selected", value: candidateGroupCount("selected"), icon: UserCheck, className: "border-l-4 border-l-green-500", iconClass: "bg-green-50 text-green-600" },
        { key: "onboarded", label: "Onboarded", value: candidateGroupCount("onboarded"), icon: CheckCircle2, className: "border-l-4 border-l-teal-500", iconClass: "bg-teal-50 text-teal-600" },
        { key: "screening", label: "In Screening", value: candidateGroupCount("screening"), icon: Clock, className: "border-l-4 border-l-amber-500", iconClass: "bg-amber-50 text-amber-500" },
      ];

  if (isPending && workspaceId) {
    return <div className="p-4"><div className="h-[560px] animate-pulse rounded-[2rem] bg-slate-100" /></div>;
  }

  return (
    <div className="p-2 lg:p-2.5 min-h-full text-[#0F172A] font-sans text-[12px]">
      <PageFrame>
        <div className="flex flex-col gap-4">
          <div className="mb-3 flex flex-col items-start justify-between gap-1.5 md:flex-row md:items-end">
            <div>
              <h2 className="text-title font-pmedium text-primary uppercase">Careers</h2>
              <p className="mt-1 text-xs font-pmedium text-slate-500">Job openings & applications from your website.</p>
            </div>
          </div>

          {!workspaceId && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-700">Select a company with a workspace to view Careers.</div>}
          {isError && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-rose-700">Failed to load recruitment data.</div>}

          <div className="mb-3 flex flex-wrap gap-1.5 rounded-2xl border border-slate-100 bg-white p-1 shadow-sm">
            {[{ key: "jobs", label: "JOB OPENINGS" }, { key: "applications", label: "APPLICATIONS" }].map((tab) => (
              <button key={tab.key} type="button" onClick={() => { setActiveTab(tab.key); setSearchQuery(""); setStatusFilter("all"); }} className={`flex-1 rounded-xl px-4 py-2 text-[10px] font-pmedium uppercase tracking-widest transition-all ${activeTab === tab.key ? "bg-[#2563EB] text-white shadow-sm" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}>
                {tab.label}
              </button>
            ))}
          </div>

          <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            {statCards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.key} className={`flex items-center justify-between rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm transition-all hover:shadow-md ${card.className}`}>
                  <div><p className="mb-1 text-[10px] font-pmedium uppercase tracking-widest text-slate-400">{card.label}</p><p className="text-[15px] font-pmedium text-slate-900">{card.value}</p></div>
                  <div className={`shrink-0 rounded-2xl p-2 ${card.iconClass}`}><Icon size={16} /></div>
                </div>
              );
            })}
          </div>

          <div className="flex min-h-[500px] flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white/80 shadow-sm backdrop-blur-md">
            <div className="flex flex-col items-start justify-between gap-3 border-b border-slate-100/60 bg-slate-50/50 p-3 sm:p-4 lg:p-5 xl:flex-row xl:items-center">
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {(activeTab === "jobs" ? [{ key: "all", label: "All" }, { key: "active", label: "Active" }, { key: "inactive", label: "Inactive" }] : [{ key: "all", label: "All" }, { key: "screening", label: "Screening" }, { key: "selected", label: "Selected" }]).map((filter) => (
                  <button key={filter.key} type="button" onClick={() => setStatusFilter(filter.key)} className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-[11px] font-pmedium transition-all ${statusFilter === filter.key ? "bg-[#2563EB] text-white shadow-sm shadow-blue-200" : "bg-slate-100/70 text-slate-500 hover:bg-slate-200/70"}`}>{filter.label}</button>
                ))}
              </div>
              <div className="flex w-full flex-wrap items-center gap-3 xl:w-auto sm:flex-nowrap">
                <div className="relative min-w-[180px] flex-1 xl:w-72">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="text" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={activeTab === "jobs" ? "Search by title, department..." : "Search by name, position..."} className="w-full rounded-lg border border-slate-200/60 bg-white py-2.5 pl-9 pr-4 text-[12px] font-pmedium outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20" />
                </div>
                {activeTab === "jobs" && (
                  <button type="button" onClick={openCreateJobModal} className="flex items-center gap-1.5 whitespace-nowrap rounded-2xl bg-[#2563EB] px-4 py-2.5 text-[10px] font-pmedium uppercase tracking-wider text-white shadow-sm transition-all hover:bg-blue-700 active:scale-95">
                    <Plus size={13} strokeWidth={3} /> Publish Job
                  </button>
                )}
              </div>
            </div>

            {activeTab === "applications" ? (
              <div className="overflow-x-auto flex-1">
                <table className="w-full min-w-[880px] border-collapse">
                  <thead className="border-b border-slate-100/60 bg-slate-50/50 text-[10px] font-pmedium uppercase tracking-widest text-slate-500"><tr><th className="px-5 py-4 text-left">Candidate Info</th><th className="px-5 py-4 text-left">Position Applied</th><th className="px-5 py-4 text-center">Source</th><th className="px-5 py-4 text-center">Applied On</th><th className="px-5 py-4 text-center">Pipeline Status</th><th className="px-5 py-4 text-center">Actions</th></tr></thead>
                  <tbody className="divide-y divide-slate-100/60">
                    {displayedCandidates.length === 0 ? (
                      <tr><td colSpan={6} className="px-8 py-16 text-center text-slate-400"><div className="flex flex-col items-center gap-3"><FileText size={28} className="text-slate-300" /><p className="text-sm font-semibold">{isCandidatesError ? "Failed to load applications." : "No applications found for this workspace yet."}</p></div></td></tr>
                    ) : displayedCandidates.map((candidate) => (
                      <tr key={candidate._id || candidate.candidateCode} className="transition-colors hover:bg-slate-50/50">
                        <td className="px-5 py-4"><p className="text-[12px] font-semibold text-slate-800">{candidate.fullName || "--"}</p><p className="mt-0.5 text-[10px] text-slate-400">{candidate.email || "--"}{candidate.phone ? ` | ${candidate.phone}` : ""}</p><p className="mt-0.5 text-[9px] font-medium uppercase tracking-wider text-slate-400">{candidate.candidateCode || "--"}</p></td>
                        <td className="px-5 py-4"><p className="text-[11px] font-semibold text-slate-700">{candidate.positionApplied || "--"}</p><p className="mt-0.5 text-[9px] uppercase tracking-wider text-slate-400">{candidate.jobCode || "General"}</p></td>
                        <td className="px-5 py-4 text-center"><span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-pmedium uppercase tracking-wider text-slate-600">{candidate.sourceType || "--"}</span></td>
                        <td className="px-5 py-4 text-center"><p className="text-[11px] font-pmedium text-slate-600">{candidate.appliedAt ? new Date(candidate.appliedAt).toLocaleDateString() : "--"}</p></td>
                        <td className="px-5 py-4 text-center"><span className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] font-pmedium uppercase tracking-wider ${candidateStatusClass(candidate.status)}`}>{candidate.status || "New"}</span></td>
                        <td className="px-5 py-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button type="button" onClick={() => setViewingCandidate(candidate)} title="View application" className="rounded-lg bg-slate-100 p-1.5 text-slate-600 transition-all hover:bg-blue-100 hover:text-blue-700"><Eye size={15} strokeWidth={2.5} /></button>
                            {candidate.resume?.url && (
                              <a href={candidate.resume.url} target="_blank" rel="noreferrer" title="Open resume" className="rounded-lg bg-slate-100 p-1.5 text-slate-600 transition-all hover:bg-blue-100 hover:text-blue-700"><FileText size={15} strokeWidth={2.5} /></a>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="overflow-x-auto flex-1">
                <table className="w-full min-w-[980px] border-collapse">
                  <thead className="border-b border-slate-100/60 bg-slate-50/50 text-[10px] font-pmedium uppercase tracking-widest text-slate-500"><tr><th className="px-5 py-4 text-left">Job Title & ID</th><th className="px-5 py-4 text-left">Department</th><th className="px-5 py-4 text-center">Application Stats</th><th className="px-5 py-4 text-center">Status</th><th className="px-5 py-4 text-center">Website Status</th><th className="px-5 py-4 text-center">Actions</th></tr></thead>
                  <tbody className="divide-y divide-slate-100/60">
                    {displayedJobs.length === 0 ? <tr><td colSpan={6} className="px-8 py-16 text-center text-slate-400"><div className="flex flex-col items-center gap-3"><Briefcase size={28} className="text-slate-300" /><p className="text-sm font-semibold">No job openings found.</p></div></td></tr> : displayedJobs.map((job) => {
                      const remaining = Math.max(0, Number(job.vacancyTotal || 0) - Number(job.vacancyFilled || 0));
                      return (
                        <tr key={job._id || job.jobCode} className="transition-colors hover:bg-slate-50/50">
                          <td className="px-5 py-4"><p className="text-[12px] font-semibold text-slate-800">{job.designation || job.title}</p><p className="mt-0.5 text-[9px] font-medium uppercase tracking-wider text-slate-400">{job.jobCode || job._id} | {formatEmploymentType(job.employmentType)}</p></td>
                          <td className="px-5 py-4"><p className="text-[11px] font-semibold text-slate-700">{job.department || "--"}</p><p className="mt-0.5 text-[9px] text-slate-400">{job.isPaid === false ? "Unpaid internship" : "Paid role"}</p></td>
                          <td className="px-5 py-4 text-center"><p className="text-xl font-bold text-blue-600">{remaining}</p><p className="text-[9px] uppercase tracking-wider text-slate-400">Open Slots</p><p className="text-[8px] uppercase tracking-wider text-slate-500">Filled {job.vacancyFilled || 0} / {job.vacancyTotal || 0}</p></td>
                          <td className="px-5 py-4 text-center"><span className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] font-pmedium uppercase tracking-wider ${job.isActive === false ? "border-slate-200 bg-slate-100 text-slate-500" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}><CheckCircle2 size={12} />{job.isActive === false ? "Inactive" : "Active"}</span></td>
                          <td className="px-5 py-4 text-center">
                            <button
                              type="button"
                              onClick={() => togglePostedMutation.mutate(job)}
                              disabled={togglePostedMutation.isPending}
                              title={job.isPostedOnWebsite === false ? "Click to post on website" : "Click to remove from website"}
                              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] font-pmedium uppercase tracking-wider transition-all disabled:cursor-not-allowed disabled:opacity-50 ${job.isPostedOnWebsite === false ? "border-slate-200 bg-slate-100 text-slate-500 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700" : "border-blue-200 bg-blue-50 text-blue-700 hover:border-slate-200 hover:bg-slate-100 hover:text-slate-500"}`}
                            >
                              <Globe size={12} />{job.isPostedOnWebsite === false ? "Not Posted" : "Posted"}
                            </button>
                          </td>
                          <td className="px-5 py-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button type="button" onClick={() => setViewingJob(job)} title="View job opening" className="rounded-lg bg-slate-100 p-1.5 text-slate-600 transition-all hover:bg-blue-100 hover:text-blue-700"><Eye size={15} strokeWidth={2.5} /></button>
                              <button type="button" onClick={() => openEditJobModal(job)} title="Edit job opening" className="rounded-lg bg-slate-100 p-1.5 text-slate-600 transition-all hover:bg-blue-100 hover:text-blue-700"><Pencil size={15} strokeWidth={2.5} /></button>
                              <button
                                type="button"
                                onClick={() => togglePostedMutation.mutate(job)}
                                disabled={togglePostedMutation.isPending}
                                title={job.isPostedOnWebsite === false ? "Post on website" : "Remove from website"}
                                className={`rounded-lg p-1.5 transition-all disabled:cursor-not-allowed disabled:opacity-50 ${job.isPostedOnWebsite === false ? "bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700" : "bg-blue-100 text-blue-700 hover:bg-slate-100 hover:text-slate-600"}`}
                              >
                                <Globe size={15} strokeWidth={2.5} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </PageFrame>
      <JobDetailModal job={viewingJob} onClose={() => setViewingJob(null)} />
      <CandidateDetailModal candidate={viewingCandidate} onClose={() => setViewingCandidate(null)} />
      <JobOpeningModal
        open={isJobModalOpen}
        mode={editingJobCode ? "edit" : "create"}
        form={jobForm}
        setForm={setJobForm}
        onClose={() => {
          setIsJobModalOpen(false);
          setEditingJobCode("");
          setJobForm({ ...EMPTY_JOB_FORM });
        }}
        onSave={() => saveJobMutation.mutate()}
        isSaving={saveJobMutation.isPending}
      />
    </div>
  );
}
