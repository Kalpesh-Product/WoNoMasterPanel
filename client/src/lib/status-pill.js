// Single source of truth for status chips shown in tables across the app.
// Ported from the HostPanel so website builder pages render identically.
export const STATUS_PILL_BASE =
  "inline-flex w-max items-center rounded-full px-2.5 py-1 text-[10px] font-pmedium uppercase tracking-wider";

export function statusToneClass(value = "") {
  const v = String(value ?? "").toLowerCase();
  if (/(reject|cancel|disable|inactive|expired|absent|lost|overdue|fail|declin|ban|high|late)/.test(v)) {
    return "bg-rose-50 text-rose-700";
  }
  if (/(approve|complete|resolve|active|joined|convert|checked in|checked-in|present|paid|success|done|confirm)/.test(v)) {
    return "bg-emerald-50 text-emerald-700";
  }
  if (/(in progress|in-progress|contact|accept|register|booked|upcoming|medium|half day|on leave)/.test(v)) {
    return "bg-blue-50 text-blue-700";
  }
  if (/(pending|invited|open|raised|await|expiring|hold|review|new)/.test(v)) {
    return "bg-amber-50 text-amber-700";
  }
  return "bg-slate-100 text-slate-600";
}

export function statusPillClass(value = "") {
  return `${STATUS_PILL_BASE} ${statusToneClass(value)}`;
}
