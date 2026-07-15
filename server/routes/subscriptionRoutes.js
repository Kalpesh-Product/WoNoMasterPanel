const router = require("express").Router();
const { getSubscription } = require("../controllers/subscriptionController");

router.get("/:workspaceId", getSubscription);

module.exports = router;
