import { useEffect, useRef } from "react";
import { LeadFormPanel } from "../shared/TplLead";
import { useItaliano } from "./ItalianoContext";
export function ItalianoBooking({ service, item, onClose }) {
    const dialog = useRef(null);
    const { c, draft } = useItaliano();
    useEffect(() => {
        const element = dialog.current;
        element?.showModal();
        return () => element?.close();
    }, []);
    return (<dialog className="italiano-dialog" ref={dialog} aria-labelledby="italiano-booking-title" onCancel={(event) => {
            event.preventDefault();
            onClose();
        }}>
      <div className="italiano-dialog-inner">
        <button type="button" className="italiano-dialog-close" onClick={onClose} aria-label="Close reservation">×</button>
        <p className="italiano-kicker">{item?.title || draft.companyName}</p>
        <h2 id="italiano-booking-title">{c("booking.title", "Book a table")}</h2>
        <LeadFormPanel service={service} item={item}/>
      </div>
    </dialog>);
}
