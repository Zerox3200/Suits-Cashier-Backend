import { Invoice } from "../../../DB/Invoices/Invoices.model.js";
import { INVOICE_STATUS } from "../../constants/enums.js";

export const invoiceRepository = {
  create: (data, session = null) => {
    if (session) {
      return Invoice.create([data], { session }).then((docs) => docs[0]);
    }
    return Invoice.create(data);
  },

  findById: (id) =>
    Invoice.findById(id)
      .populate("createdBy", "name email role")
      .populate("returnedBy", "name email"),

  findByNumber: (invoiceNumber) =>
    Invoice.findOne({ invoiceNumber })
      .populate("createdBy", "name email role")
      .populate("returnedBy", "name email"),

  findPaginated: async ({ skip, limit, filter = {} }) => {
    const [items, total] = await Promise.all([
      Invoice.find(filter)
        .populate("createdBy", "name email role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Invoice.countDocuments(filter),
    ]);
    return { items, total };
  },

  updateById: (id, data, session = null) => {
    const opts = { new: true, runValidators: true };
    if (session) opts.session = session;
    return Invoice.findByIdAndUpdate(id, data, opts);
  },

  count: (filter = {}) => Invoice.countDocuments(filter),

  aggregate: (pipeline) => Invoice.aggregate(pipeline),

  findRecent: (limit = 10) =>
    Invoice.find({ status: INVOICE_STATUS.COMPLETED })
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .limit(limit),
};
