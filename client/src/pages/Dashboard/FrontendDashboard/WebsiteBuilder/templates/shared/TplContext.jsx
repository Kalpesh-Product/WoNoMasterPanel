import { createContext, useContext } from "react";
const Ctx = createContext(null);
// eslint-disable-next-line react-refresh/only-export-components
export const googleMapEmbedSrc = (address, configuredUrl) => {
    const value = String(configuredUrl || "").trim();
    if (!value)
        return "";
    const fallback = String(address || "").trim();
    const queryUrl = (query) => `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
    try {
        const url = new URL(value);
        const isGoogleMap = /(^|\.)google\.[a-z.]+$/i.test(url.hostname) || url.hostname === "maps.google.com";
        const isEmbed = url.pathname.includes("/maps/embed") || url.searchParams.get("output") === "embed";
        if (isGoogleMap && isEmbed)
            return value;
        const query = url.searchParams.get("q") || url.searchParams.get("query") || fallback;
        return query ? queryUrl(query) : "";
    }
    catch {
        return fallback ? queryUrl(fallback) : "";
    }
};
export const TplProvider = ({ value, children }) => {
    const mapUrl = googleMapEmbedSrc(value.t?.contactAddress, value.draft?.mapUrl);
    const normalizedValue = mapUrl === value.draft?.mapUrl
        ? value
        : { ...value, draft: { ...value.draft, mapUrl } };
    return <Ctx.Provider value={normalizedValue}>{children}</Ctx.Provider>;
};
// eslint-disable-next-line react-refresh/only-export-components
export const useTpl = () => {
    const value = useContext(Ctx);
    if (!value)
        throw new Error("useTpl must be used inside <TplProvider>");
    return value;
};
