import { Settings } from "../../../DB/Settings/Settings.model.js";

export const settingsRepository = {
  findOne: () => Settings.findOne(),

  create: (data) => Settings.create(data),

  updateById: (id, data) =>
    Settings.findByIdAndUpdate(id, data, { new: true, runValidators: true }),
};
