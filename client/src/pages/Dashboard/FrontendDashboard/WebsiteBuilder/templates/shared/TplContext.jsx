import { createContext, useContext } from "react";
const Ctx = createContext(null);
export const TplProvider = Ctx.Provider;
export const useTpl = () => {
    const value = useContext(Ctx);
    if (!value)
        throw new Error("useTpl must be used inside <TplProvider>");
    return value;
};
