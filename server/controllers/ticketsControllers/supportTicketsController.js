const mongoose = require("mongoose");
const SupportTicket = require("../../models/tickets/supportTickets");
const User = require("../../models/hr/UserData");
const Ticket = require("../../models/tickets/Tickets");
const Company = require("../../models/hr/Company");
const { handleFileUpload } = require("../../config/cloudinaryConfig");
const { createLog } = require("../../utils/moduleLogs");
const CustomError = require("../../utils/customErrorlogs");
const sharp = require("sharp");

const uploadSupportImage = async (image, companyName) => {
  if (!image) return null;

  try {
    const buffer = await sharp(image.buffer)
      .resize(1200, 800, { fit: "cover" })
      .webp({ quality: 80 })
      .toBuffer();
    const base64Image = `data:image/webp;base64,${buffer.toString("base64")}`;
    const uploadedImage = await handleFileUpload(
      base64Image,
      `${companyName || "support"}/support-tickets`
    );

    return {
      id: uploadedImage.public_id,
      url: uploadedImage.secure_url,
    };
  } catch (error) {
    throw new CustomError(
      "Error uploading support image",
      "tickets/TicketLog",
      "Support Ticket",
      "supportTicket"
    );
  }
};

const supportTicket = async (req, res, next) => {
  const logPath = "tickets/TicketLog";
  const logAction = "Support Ticket";
  const logSourceKey = "supportTicket";
  const { user, company, ip } = req;

  try {
    const { ticketId, description } = req.body;
    const image = req.file;

    // Validate user existence
    const foundUser = await User.findOne({ _id: user })
      .populate({ path: "role", select: "roleTitle" })
      .populate({ path: "departments", select: "name" })
      .select("-refreshToken -password")
      .exec();
    if (!foundUser) {
      throw new CustomError("User not found", logPath, logAction, logSourceKey);
    }

    // Validate description
    if (
      !description ||
      typeof description !== "string" ||
      description.trim().length === 0 ||
      description.trim().length > 500
    ) {
      throw new CustomError(
        "Invalid description provided",
        logPath,
        logAction,
        logSourceKey
      );
    }

    // Validate ticketId
    if (!mongoose.Types.ObjectId.isValid(ticketId)) {
      throw new CustomError(
        "Invalid ticket ID provided",
        logPath,
        logAction,
        logSourceKey
      );
    }
    const foundTicket = await Ticket.findOne({ _id: ticketId })
      .populate({ path: "raisedToDepartment", select: "name" })
      .populate({ path: "acceptedBy", select: "firstName lastName" })
      .populate({ path: "assignees", select: "firstName lastName" })
      .populate({ path: "closedBy", select: "firstName lastName" })
      .exec();
    if (!foundTicket) {
      throw new CustomError(
        "Invalid ticket ID provided",
        logPath,
        logAction,
        logSourceKey
      );
    }

    const foundCompany = company
      ? await Company.findById(company).select("companyName").lean().exec()
      : null;

    // Verify the user belongs to a department that has tickets
    const userDepartments = foundUser.departments.map((dept) =>
      dept.toString()
    );
    const foundTickets = await Ticket.find({
      raisedToDepartment: { $in: userDepartments },
    });
    if (!foundTickets.length) {
      throw new CustomError(
        "Tickets not found",
        logPath,
        logAction,
        logSourceKey
      );
    }

    // Update the ticket's status to "Open"
    await Ticket.findByIdAndUpdate(ticketId, { status: "Open" });

    const imageDetails = await uploadSupportImage(
      image,
      foundCompany?.companyName || "support"
    );

    const acceptedByUser =
      foundTicket.acceptedBy ||
      (Array.isArray(foundTicket.assignees) ? foundTicket.assignees[0] : null);

    const roleTitles = Array.isArray(foundUser.role)
      ? foundUser.role.map((item) => item?.roleTitle).filter(Boolean).join(", ")
      : "";

    // Create a support ticket record
    const supportTicketDoc = new SupportTicket({
      ticket: ticketId,
      user: user,
      requestedBy: user,
      ticketId: foundTicket.ticket || ticketId,
      title: foundTicket.ticket || "Support Ticket",
      description: description.trim(),
      company: company || null,
      companyName: foundCompany?.companyName || "",
      role: roleTitles,
      department: foundTicket.raisedToDepartment?.name || "",
      acceptedBy: acceptedByUser?._id || null,
      requestedAt: new Date(),
      status: foundTicket.status || "Open",
      image: imageDetails || undefined,
      resolvedBy: foundTicket.closedBy?._id || null,
      resolvedAt: foundTicket.closedAt || null,
    });
    await supportTicketDoc.save();

    // Log the successful support ticket creation
    await createLog({
      path: logPath,
      action: logAction,
      remarks: "Support request sent successfully",
      status: "Success",
      user: user,
      ip: ip,
      company: company,
      sourceKey: logSourceKey,
      sourceId: supportTicketDoc._id,
      changes: { title: supportTicketDoc.title, description: supportTicketDoc.description },
    });

    return res.status(201).json({ message: "Support request sent" });
  } catch (error) {
    if (error instanceof CustomError) {
      next(error);
    } else {
      next(
        new CustomError(error.message, logPath, logAction, logSourceKey, 500)
      );
    }
  }
};

const getSupportTickets = async (req, res, next) => {
  const logPath = "tickets/TicketLog";
  const logAction = "Get Support Tickets";
  const logSourceKey = "supportTicket";

  try {
    const supportTickets = await SupportTicket.find()
      .populate({
        path: "ticket",
        populate: [
          {
            path: "raisedBy",
            model: "UserData",
            select: "firstName lastName email",
          },
          {
            path: "raisedToDepartment",
            model: "Department",
            select: "name",
          },
          {
            path: "company",
            model: "Company",
            select: "companyName",
          },
          {
            path: "closedBy",
            model: "UserData",
            select: "firstName lastName email",
          },
        ],
      })
      .populate({
        path: "user",
        model: "UserData",
        select: "firstName lastName email",
      })
      .populate({
        path: "requestedBy",
        model: "UserData",
        select: "firstName lastName email",
      })
      .populate({
        path: "acceptedBy",
        model: "UserData",
        select: "firstName lastName email",
      })
      .populate({
        path: "resolvedBy",
        model: "UserData",
        select: "firstName lastName email",
      })
      .populate({
        path: "company",
        model: "Company",
        select: "companyName",
      })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return res.status(200).json(supportTickets);
  } catch (error) {
    next(
      new CustomError(error.message, logPath, logAction, logSourceKey, 500)
    );
  }
};

const createStandaloneSupportTicket = async (req, res, next) => {
  const logPath = "tickets/TicketLog";
  const logAction = "Create Standalone Support Ticket";
  const logSourceKey = "supportTicket";
  const { user, company, ip } = req;

  try {
    const {
      title,
      description,
      companyName,
      role,
      department,
      acceptedBy,
      requestedAt,
      status,
      resolvedBy,
    } = req.body;
    const image = req.file;

    const foundUser = await User.findById(user)
      .populate({ path: "role", select: "roleTitle" })
      .select("-refreshToken -password")
      .lean()
      .exec();

    if (!foundUser) {
      throw new CustomError("User not found", logPath, logAction, logSourceKey);
    }

    if (!title || typeof title !== "string" || !title.trim()) {
      throw new CustomError("Title is required", logPath, logAction, logSourceKey);
    }

    if (
      !description ||
      typeof description !== "string" ||
      !description.trim() ||
      description.trim().length > 500
    ) {
      throw new CustomError(
        "Description is required",
        logPath,
        logAction,
        logSourceKey
      );
    }

    const allowedStatuses = [
      "Open",
      "In Progress",
      "Closed",
      "Pending",
      "Escalated",
      "Rejected",
    ];
    const normalizedStatus =
      typeof status === "string" && allowedStatuses.includes(status)
        ? status
        : "Open";

    const foundCompany = company
      ? await Company.findById(company).select("companyName").lean().exec()
      : null;

    const roleTitles = Array.isArray(foundUser.role)
      ? foundUser.role.map((item) => item?.roleTitle).filter(Boolean).join(", ")
      : "";

    const imageDetails = await uploadSupportImage(
      image,
      companyName || foundCompany?.companyName || "support"
    );

    const supportTicketDoc = new SupportTicket({
      ticket: null,
      user,
      requestedBy: user,
      ticketId: `CST-${Date.now()}`,
      title: title.trim(),
      description: description.trim(),
      company: company || null,
      companyName: String(companyName || foundCompany?.companyName || "").trim(),
      role: String(role || roleTitles || "").trim(),
      department: String(department || "").trim(),
      acceptedBy:
        acceptedBy && mongoose.Types.ObjectId.isValid(acceptedBy)
          ? acceptedBy
          : null,
      requestedAt: requestedAt ? new Date(requestedAt) : new Date(),
      status: normalizedStatus,
      image: imageDetails || undefined,
      resolvedBy:
        resolvedBy && mongoose.Types.ObjectId.isValid(resolvedBy)
          ? resolvedBy
          : null,
      resolvedAt: normalizedStatus === "Closed" ? new Date() : null,
    });

    await supportTicketDoc.save();

    await createLog({
      path: logPath,
      action: logAction,
      remarks: "Standalone support ticket created successfully",
      status: "Success",
      user,
      ip,
      company,
      sourceKey: logSourceKey,
      sourceId: supportTicketDoc._id,
      changes: {
        ticketId: supportTicketDoc.ticketId,
        title: supportTicketDoc.title,
        description: supportTicketDoc.description,
      },
    });

    return res.status(201).json({
      message: "Customer support ticket created successfully",
      data: supportTicketDoc,
    });
  } catch (error) {
    if (error instanceof CustomError) {
      next(error);
    } else {
      next(
        new CustomError(error.message, logPath, logAction, logSourceKey, 500)
      );
    }
  }
};

const updateSupportTicketStatus = async (req, res, next) => {
  const logPath = "tickets/TicketLog";
  const logAction = "Update Support Ticket Status";
  const logSourceKey = "supportTicket";
  const { user } = req;

  try {
    const { supportTicketId } = req.params;
    const { status } = req.body;
    const allowedStatuses = [
      "Open",
      "In Progress",
      "Closed",
      "Pending",
      "Escalated",
      "Rejected",
    ];

    if (!mongoose.Types.ObjectId.isValid(supportTicketId)) {
      throw new CustomError(
        "Invalid support ticket ID provided",
        logPath,
        logAction,
        logSourceKey
      );
    }

    if (typeof status !== "string" || !allowedStatuses.includes(status)) {
      throw new CustomError(
        "Invalid support ticket status provided",
        logPath,
        logAction,
        logSourceKey
      );
    }

    const updates = { status };
    if (status === "Closed") {
      updates.resolvedBy = user;
      updates.resolvedAt = new Date();
    } else {
      updates.resolvedBy = null;
      updates.resolvedAt = null;
    }

    const updatedSupportTicket = await SupportTicket.findByIdAndUpdate(
      supportTicketId,
      { $set: updates },
      { new: true }
    ).lean();

    if (!updatedSupportTicket) {
      throw new CustomError(
        "Support ticket not found",
        logPath,
        logAction,
        logSourceKey
      );
    }

    return res.status(200).json({
      message: "Support ticket status updated successfully",
      data: updatedSupportTicket,
    });
  } catch (error) {
    if (error instanceof CustomError) {
      next(error);
    } else {
      next(
        new CustomError(error.message, logPath, logAction, logSourceKey, 500)
      );
    }
  }
};

module.exports = {
  supportTicket,
  getSupportTickets,
  updateSupportTicketStatus,
  createStandaloneSupportTicket,
};
