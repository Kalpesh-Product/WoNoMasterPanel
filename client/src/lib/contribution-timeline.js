const getContributorName = (item) => {
  const contributor = item?.contributor;
  if (contributor && typeof contributor === "object") {
    const name = [contributor.firstName, contributor.lastName].filter(Boolean).join(" ").trim();
    return contributor.fullName || contributor.name || name || contributor.email || item.author || "Contributor";
  }
  return item?.author || "Contributor";
};

const getActorName = (actor, fallback = "Master Panel") => {
  if (!actor) return fallback;
  if (typeof actor === "string") return actor.trim() || fallback;
  const name = [actor.firstName, actor.lastName].filter(Boolean).join(" ").trim();
  return actor.fullName || actor.name || actor.reviewerName || actor.email || name || fallback;
};

const getFirstSubmissionDate = (item) => item?.firstSubmittedAt || item?.submittedAt || item?.createdAt || item?.date;

const getLastEditedDate = (item) => {
  if (Array.isArray(item?.edits) && item.edits.length > 0) {
    const latestEdit = item.edits
      .map((edit) => edit?.updatedAt || edit?.editedAt || edit?.date || edit?.createdAt)
      .filter(Boolean)
      .sort((first, second) => new Date(second).getTime() - new Date(first).getTime())[0];
    if (latestEdit) return latestEdit;
  }

  return item?.lastEditedAt || item?.editedAt;
};

const normalizeTimelineStatus = (status) => {
  const raw = String(status || "").toLowerCase();
  if (raw === "approved") return "Approved";
  if (raw === "rejected") return "Rejected";
  if (raw === "pending") return "Pending Review";
  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : "-";
};

const buildContributionTimeline = (item, config) => {
  if (!item) return [];
  const contributorName = getContributorName(item);
  const createdAt = getFirstSubmissionDate(item);
  const updatedAt = item.lastEditedAt || item.editedAt;
  const status = String(item.statusBeforeDeletion || item.status || "pending").toLowerCase();
  const editCount = Number(item.numberOfEdits ?? item.editCount ?? item.edits?.length ?? 0);
  const timeline = [];

  if (createdAt) {
    timeline.push({
      date: createdAt,
      title: "First Submission",
      description: `${config.singular} submitted by ${contributorName}.`,
      tone: "blue",
    });
  }

  if (Array.isArray(item.edits) && item.edits.length > 0) {
    item.edits.forEach((edit, index) => {
      const editDate = edit?.updatedAt || edit?.editedAt || edit?.date || edit?.createdAt;
      if (!editDate) return;
      timeline.push({
        date: editDate,
        title: `Edit ${index + 1}`,
        description: `Edited by ${getActorName(edit?.editedBy || edit?.updatedBy, contributorName)}.`,
        tone: "amber",
      });
    });
  } else if (updatedAt && updatedAt !== createdAt) {
    timeline.push({
      date: updatedAt,
      title: "Last Edited",
      description: `Edited by ${contributorName}${editCount > 0 ? ` (${editCount} edit${editCount === 1 ? "" : "s"})` : ""}.`,
      tone: "amber",
    });
  }

  if (Array.isArray(item.moderationHistory) && item.moderationHistory.length > 0) {
    item.moderationHistory.forEach((entry) => {
      const entryStatus = String(entry?.status || entry?.action || "").toLowerCase();
      const entryDate = entry?.date || entry?.reviewedAt || entry?.moderatedAt || entry?.createdAt || entry?.updatedAt;
      if (!entryStatus) return;
      timeline.push({
        date: entryDate,
        title: normalizeTimelineStatus(entryStatus),
        description: `${normalizeTimelineStatus(entryStatus)} by ${getActorName(entry?.reviewedBy || entry?.moderatedBy || entry?.actor)}.`,
        details: entry?.reason || entry?.deletionReason || entry?.rejectionReason || "",
        tone: entryStatus === "deleted" ? "red" : entryStatus === "approved" ? "emerald" : entryStatus === "rejected" ? "rose" : "slate",
      });
    });
  } else if (["approved", "rejected"].includes(status)) {
    // updatedAt changes on edits and deletion; it is not a review timestamp.
    const reviewedAt = (status === "rejected" ? item.rejectedAt : item.approvedAt)
      || item.reviewedAt || item.moderatedAt;
    timeline.push({
      date: reviewedAt,
      title: normalizeTimelineStatus(status),
      description: `${normalizeTimelineStatus(status)} by ${getActorName((status === "rejected" ? item.rejectedBy : item.approvedBy) || item.reviewedBy || item.moderatedBy)}.`,
      details: status === "rejected" ? item.rejectionReason : "",
      tone: status === "approved" ? "emerald" : "rose",
    });
  } else if (!item.deletedAt) {
    timeline.push({
      date: item.submittedAt || createdAt,
      title: "Pending Review",
      description: `Waiting for ${config.singular.toLowerCase()} review.`,
      tone: "slate",
    });
  }

  if (item.deletedAt && !timeline.some((entry) => entry.title === "Deleted")) {
    timeline.push({
      date: item.deletedAt,
      title: "Deleted",
      description: `Deleted by ${contributorName}.`,
      details: item.deletionReason || "",
      tone: "red",
    });
  }

  const timestamp = (entry) => {
    const value = entry.date ? new Date(entry.date).getTime() : NaN;
    return Number.isFinite(value) ? value : null;
  };

  return timeline.sort((first, second) => {
    // Submission starts the lifecycle; deletion always ends it, even for legacy
    // records with missing dates or events that share the same timestamp.
    const rank = (entry) => entry.title === "First Submission" ? 0 : entry.title === "Deleted" ? 2 : 1;
    const order = rank(first) - rank(second);
    if (order) return order;
    const firstTime = timestamp(first);
    const secondTime = timestamp(second);
    if (firstTime === null) return secondTime === null ? 0 : 1;
    if (secondTime === null) return -1;
    return firstTime - secondTime;
  });
};

export { buildContributionTimeline, getContributorName, getFirstSubmissionDate, getLastEditedDate };
