// The services a business can say it offers when it picks a template. The names are
// exactly the predefined service pages the builder's "Select Page" dropdown offers
// (DEFAULT_PRODUCT_DROPDOWN_PAGES in CreateWebsite.tsx), so the choice made in the
// picker can seed the same pages in the builder.
import { resolveServiceKind } from "./verticalProfiles";
export const SERVICE_CHOICES = [
    { name: "Co-Working", hint: "Desks & day passes" },
    { name: "Meeting Rooms", hint: "Bookable by the hour" },
    { name: "Cafe", hint: "Menu & table reservations" },
    { name: "Hostels", hint: "Dorms & private rooms" },
    { name: "Co-Living", hint: "Long-stay rooms" },
    { name: "Workations", hint: "Stay + work packages" },
];
export const SELECTED_SERVICES_STORAGE_KEY = "selectedServiceKinds";
const toSlug = (value) => String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
export const serviceNameToKind = (name) => resolveServiceKind(toSlug(name));
export const readSelectedServices = () => {
    try {
        const parsed = JSON.parse(localStorage.getItem(SELECTED_SERVICES_STORAGE_KEY) || "[]");
        const valid = SERVICE_CHOICES.map((choice) => choice.name);
        return Array.isArray(parsed) ? parsed.filter((name) => valid.includes(name)) : [];
    }
    catch {
        return [];
    }
};
export const writeSelectedServices = (names) => {
    try {
        localStorage.setItem(SELECTED_SERVICES_STORAGE_KEY, JSON.stringify(names));
    }
    catch {
        // ignore
    }
};
export const clearSelectedServices = () => {
    try {
        localStorage.removeItem(SELECTED_SERVICES_STORAGE_KEY);
    }
    catch {
        // ignore
    }
};
