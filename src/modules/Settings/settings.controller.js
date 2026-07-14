import { ErrorCatch } from "../../utils/ErrorCatch.js";
import { sendSuccess } from "../../utils/response.js";
import { getSingleImage } from "../../utils/multer.js";
import { getSettings, updateSettings } from "./settings.service.js";
import { MSG } from "../../constants/messages.ar.js";

export const GetSettings = ErrorCatch(async (req, res) => {
  const settings = await getSettings();
  return sendSuccess(res, 200, MSG.SETTINGS_RETRIEVED, { settings });
});

export const UpdateSettings = ErrorCatch(async (req, res) => {
  const imageData = req.file || req.files ? getSingleImage(req, "logo") : null;
  const settings = await updateSettings(
    req.body,
    imageData?.path || null,
    req.user._id
  );
  return sendSuccess(res, 200, MSG.SETTINGS_UPDATED, { settings });
});
