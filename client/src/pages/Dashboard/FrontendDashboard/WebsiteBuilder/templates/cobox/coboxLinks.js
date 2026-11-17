export const externalUrl = (value) => {
    try {
        const url = new URL(value);
        return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
    }
    catch {
        return "";
    }
};
