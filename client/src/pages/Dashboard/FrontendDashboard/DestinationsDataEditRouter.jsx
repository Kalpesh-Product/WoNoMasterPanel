import { useParams } from "react-router-dom";
import EditBlogNews from "./EditBlogNews";
import DestinationsDataNomadListingEdit from "./DestinationsDataNomadListingEdit";

const LISTING_DETAIL_TYPES = new Set([
  "coworking",
  "coliving",
  "hostel",
  "meetingroom",
  "cafe",
]);

// The "add"/"edit" sub-routes under destinations-data/:locationType serve
// both content categories (blog/news/event/place/restaurant) and Nomad
// Listing categories — this just picks which editor to render based on the
// category encoded in :locationType ("<destination>-<category>").
const DestinationsDataEditRouter = () => {
  const { locationType } = useParams();
  const dashIndex = locationType?.lastIndexOf("-") ?? -1;
  const category = dashIndex !== -1 ? locationType.substring(dashIndex + 1) : "";

  return LISTING_DETAIL_TYPES.has(category) ? (
    <DestinationsDataNomadListingEdit />
  ) : (
    <EditBlogNews />
  );
};

export default DestinationsDataEditRouter;
