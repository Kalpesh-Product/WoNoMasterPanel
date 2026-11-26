import React from "react";
import { useParams } from "react-router-dom";
import RoleLeadsPage from "./RoleLeadsPage";

const CONTRIBUTOR_TABS = [
  {
    slug: "bloggers",
    label: "Bloggers",
    singular: "Blogger",
    contributionLabel: "Become a Blogger",
    roleFlag: "isBlogger",
    matchers: ["become a blogger", "blogger", "become a nomad blog & news writer"],
  },
  {
    slug: "news-writers",
    label: "News Writers",
    singular: "News Writer",
    contributionLabel: "Become A News Writer",
    roleFlag: "isNewsWriter",
    matchers: ["become a news writer", "news writer", "become a nomad blog & news writer"],
  },
  {
    slug: "events-contributors",
    label: "Events Contributors",
    singular: "Event Contributor",
    contributionLabel: "Contribute To Events",
    roleFlag: "isEventWriter",
    matchers: ["contribute to events", "event writer", "events", "become a content creator", "become a content contributor"],
  },
  {
    slug: "places-contributors",
    label: "Places Contributors",
    singular: "Place Contributor",
    contributionLabel: "Contribute To Places",
    roleFlag: "isPlaceWriter",
    matchers: ["contribute to places", "place writer", "places", "become a content creator", "become a content contributor"],
  },
];

const ContributorLeads = () => {
  const { contributorLeadTab } = useParams();

  return (
    <RoleLeadsPage
      tabs={CONTRIBUTOR_TABS}
      activeSlug={contributorLeadTab}
      basePath="/dashboard/contributor-leads"
      apiEndpoint="/api/contributor-leads"
      queryKey="contributorLeads"
      modalKindLabel="Become Contributor"
    />
  );
};

export default ContributorLeads;
