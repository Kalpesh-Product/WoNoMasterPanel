import test from "node:test";
import assert from "node:assert/strict";
import { buildContributionTimeline, getLastEditedDate } from "./contribution-timeline.js";

const config = { singular: "Blog" };
const createdAt = "2026-10-12T09:55:00Z";
const deletedAt = "2026-10-30T13:06:05Z";

test("deletion always comes last, including equal, missing and later review dates", () => {
  for (const reviewDate of [deletedAt, undefined, "2026-10-30T13:06:06Z"]) {
    const entries = buildContributionTimeline({
      createdAt, deletedAt,
      moderationHistory: [
        { status: "deleted", date: deletedAt },
        { status: "rejected", date: reviewDate },
      ],
    }, config);
    assert.deepEqual(entries.map((entry) => entry.title), ["First Submission", "Rejected", "Deleted"]);
    assert.equal(entries[1].date, reviewDate);
  }
});

test("legacy rejection never borrows the deletion or general update timestamp", () => {
  const entries = buildContributionTimeline({
    createdAt, deletedAt, updatedAt: deletedAt,
    status: "deleted", statusBeforeDeletion: "rejected",
    rejectionReason: "Needs revision",
  }, config);
  assert.deepEqual(entries.map((entry) => entry.title), ["First Submission", "Rejected", "Deleted"]);
  assert.equal(entries[1].date, undefined);
  assert.equal(entries[1].details, "Needs revision");
  assert.equal(entries[2].date, deletedAt);
});

test("review and deletion retain their independent second-level timestamps", () => {
  const rejectedAt = "2026-10-30T13:06:01Z";
  const entries = buildContributionTimeline({
    createdAt, deletedAt, updatedAt: deletedAt, rejectedAt,
    approvedAt: createdAt, statusBeforeDeletion: "rejected",
  }, config);
  assert.equal(entries[1].date, rejectedAt);
  assert.equal(entries[2].date, deletedAt);
});

test("history keeps repeated reviews and edits in chronological order", () => {
  const entries = buildContributionTimeline({
    createdAt, deletedAt,
    edits: [{ editedAt: "2026-10-14T12:00:00Z" }],
    moderationHistory: [
      { status: "approved", date: "2026-10-15T12:00:00Z" },
      { status: "rejected", date: "2026-10-13T12:00:00Z" },
    ],
  }, config);
  assert.deepEqual(entries.map((entry) => entry.title), ["First Submission", "Rejected", "Edit 1", "Approved", "Deleted"]);
});

test("moderation and deletion do not masquerade as contributor edits", () => {
  assert.equal(getLastEditedDate({ createdAt, updatedAt: deletedAt }), undefined);
  const entries = buildContributionTimeline({ createdAt, updatedAt: deletedAt, numberOfEdits: 1 }, config);
  assert.ok(!entries.some((entry) => entry.title === "Last Edited"));
  const edited = buildContributionTimeline({ createdAt, lastEditedAt: deletedAt }, config);
  assert.equal(edited.find((entry) => entry.title === "Last Edited").date, deletedAt);
});
