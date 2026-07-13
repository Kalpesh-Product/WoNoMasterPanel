const mongoose = require("mongoose");
require("dotenv").config();
const uri = process.env.DB_URL;

(async () => {
  try {
    await mongoose.connect(uri);
    const db = mongoose.connection.db;

    // Replicate getCompanyMembers' exact matching for companyId=6a0d60509095fbe5f12caf7f / companyName=hinovor639
    const companyId = "6a0d60509095fbe5f12caf7f";
    const companyName = "hinovor639";
    const idRegex = new RegExp(`^${companyId}(?:$|-)`, "i");
    const nameRegex = new RegExp(`^${companyName}$`, "i");

    const directWorkspaces = await db.collection("workspaces")
      .find({ companyId: { $regex: idRegex }, isActive: true })
      .project({ companyId: 1, workspaceName: 1, businessName: 1, selectedPlan: 1 })
      .toArray();
    const nameMatchedWorkspaces = await db.collection("workspaces")
      .find({ businessName: { $regex: nameRegex }, isActive: true })
      .project({ companyId: 1, workspaceName: 1, businessName: 1, selectedPlan: 1 })
      .toArray();

    console.log("=== directWorkspaces (companyId prefix match) ===");
    console.log(JSON.stringify(directWorkspaces, null, 2));
    console.log("=== nameMatchedWorkspaces (businessName exact match) ===");
    console.log(JSON.stringify(nameMatchedWorkspaces, null, 2));

    const merged = [...directWorkspaces, ...nameMatchedWorkspaces.filter(w => !directWorkspaces.some(d => String(d._id) === String(w._id)))];
    console.log("=== merged (what getCompanyMembers would return as `workspaces`) ===");
    console.log(JSON.stringify(merged.map(w => ({ id: w._id, workspaceName: w.workspaceName, businessName: w.businessName, selectedPlan: w.selectedPlan })), null, 2));
  } catch (err) {
    console.error("ERROR", err.message);
  } finally {
    await mongoose.disconnect();
  }
})();
