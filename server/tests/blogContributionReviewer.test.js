const test = require("node:test");
const assert = require("node:assert/strict");
const axios = require("axios");
const { updateBlogContributionStatus } = require("../controllers/websiteControllers/blogNewsControllers");

test("approval and rejection forward the authenticated reviewer, ignoring browser-supplied identity", async (t) => {
    const calls = [];
    t.mock.method(axios, "patch", async (url, payload) => {
        calls.push(payload);
        return { data: { blog: payload } };
    });
    for (const status of ["approved", "rejected"]) {
        const req = {
            params: { id: "blog-1" }, user: "admin-1",
            userData: { firstName: "Allan", lastName: "Silveira" },
            body: { status, rejectionReason: "Needs revision", reviewedBy: "Another user", reviewedById: "forged-id" },
        };
        const res = { status(code) { assert.equal(code, 200); return this; }, json(body) { return body; } };
        await updateBlogContributionStatus(req, res);
    }
    assert.equal(calls.length, 2);
    assert.deepEqual(calls.map((call) => call.status), ["approved", "rejected"]);
    for (const payload of calls) {
        assert.equal(payload.reviewedBy, "Allan Silveira");
        assert.equal(payload.reviewedById, "admin-1");
    }
});
