import { settingsRepository } from "./settings.repository.js";
import { createActivityLog } from "../ActivityLog/activityLog.service.js";
import { ACTIVITY_ACTIONS, ACTIVITY_ENTITIES } from "../../constants/enums.js";
import { MSG } from "../../constants/messages.ar.js";

export const getSettings = async () => {
  let settings = await settingsRepository.findOne();
  if (!settings) {
    settings = await settingsRepository.create({});
  }
  return settings;
};

export const updateSettings = async (payload, logoPath, userId) => {
  let settings = await settingsRepository.findOne();

  const updateData = {
    ...payload,
    updatedBy: userId,
  };

  if (logoPath) {
    updateData.logo = logoPath;
  }

  if (!settings) {
    settings = await settingsRepository.create(updateData);
  } else {
    settings = await settingsRepository.updateById(settings._id, updateData);
  }

  await createActivityLog({
    user: userId,
    action: ACTIVITY_ACTIONS.UPDATED_SETTINGS,
    entity: ACTIVITY_ENTITIES.SETTINGS,
    entityId: settings._id,
    description: MSG.LOG_UPDATED_SETTINGS,
  });

  return settings;
};
