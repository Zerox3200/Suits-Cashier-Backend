import { Router } from "express";
import { CheckToken, CheckAdmin } from "../../middleware/Admin.middleware.js";
import { SHOP_LOGO_UPLOAD, imageUpload } from "../../utils/multer.js";
import { UpdateSettingsValidation } from "./settings.validation.js";
import { GetSettings, UpdateSettings } from "./settings.controller.js";

const router = Router();

// Any authenticated user can read settings (needed for receipt printing).
router.get("/", CheckToken, GetSettings);
router.put(
  "/",
  CheckToken,
  CheckAdmin,
  ...imageUpload(SHOP_LOGO_UPLOAD),
  UpdateSettingsValidation,
  UpdateSettings
);

export default router;
