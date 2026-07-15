import { ActivityLog } from "./ActivityLog/ActivityLog.model.js";
import { ACTIVITY_ACTIONS, ACTIVITY_ENTITIES } from "../src/constants/enums.js";

const ACTION_MAP = {
  "Created Product": ACTIVITY_ACTIONS.CREATED_PRODUCT,
  "Updated Product": ACTIVITY_ACTIONS.UPDATED_PRODUCT,
  "Deactivated Product": ACTIVITY_ACTIONS.DEACTIVATED_PRODUCT,
  "Restored Product": ACTIVITY_ACTIONS.RESTORED_PRODUCT,
  "Created Supplier": ACTIVITY_ACTIONS.CREATED_SUPPLIER,
  "Updated Supplier": ACTIVITY_ACTIONS.UPDATED_SUPPLIER,
  "Deleted Supplier": ACTIVITY_ACTIONS.DELETED_SUPPLIER,
  "Restored Supplier": ACTIVITY_ACTIONS.RESTORED_SUPPLIER,
  "Created Category": ACTIVITY_ACTIONS.CREATED_CATEGORY,
  "Updated Category": ACTIVITY_ACTIONS.UPDATED_CATEGORY,
  "Deleted Category": ACTIVITY_ACTIONS.DELETED_CATEGORY,
  "Restored Category": ACTIVITY_ACTIONS.RESTORED_CATEGORY,
  "Adjusted Stock": ACTIVITY_ACTIONS.ADJUSTED_STOCK,
  "Created Invoice": ACTIVITY_ACTIONS.CREATED_INVOICE,
  "Returned Invoice": ACTIVITY_ACTIONS.RETURNED_INVOICE,
  "Created User": ACTIVITY_ACTIONS.CREATED_USER,
  "Updated Settings": ACTIVITY_ACTIONS.UPDATED_SETTINGS,
};

const ENTITY_MAP = {
  Product: ACTIVITY_ENTITIES.PRODUCT,
  Supplier: ACTIVITY_ENTITIES.SUPPLIER,
  Category: ACTIVITY_ENTITIES.CATEGORY,
  Stock: ACTIVITY_ENTITIES.STOCK,
  Invoice: ACTIVITY_ENTITIES.INVOICE,
  User: ACTIVITY_ENTITIES.USER,
  Settings: ACTIVITY_ENTITIES.SETTINGS,
};

const translateDescription = (description = "") => {
  let text = String(description);

  const replacements = [
    [/^Created category /i, "تم إنشاء التصنيف "],
    [/^Updated category /i, "تم تحديث التصنيف "],
    [/^Deleted category (.+) and soft-deleted related products$/i, "تم حذف التصنيف $1 وتعطيل المنتجات المرتبطة به"],
    [/^Restored category (.+) and related products$/i, "تم استعادة التصنيف $1 والمنتجات المرتبطة به"],
    [/^Created supplier /i, "تم إنشاء المورد "],
    [/^Updated supplier /i, "تم تحديث المورد "],
    [/^Deleted supplier /i, "تم حذف المورد "],
    [/^Restored supplier /i, "تم استعادة المورد "],
    [/^Created product /i, "تم إنشاء المنتج "],
    [/^Updated product /i, "تم تحديث المنتج "],
    [/^Deactivated product /i, "تم تعطيل المنتج "],
    [/^Restored product /i, "تم استعادة المنتج "],
    [/^Adjusted stock for product (.+): set to (.+) \((.+)\)$/i, "تم تعديل مخزون المنتج $1 إلى $2 ($3)"],
    [/^Created invoice /i, "تم إنشاء الفاتورة "],
    [/^Returned invoice (.+): (.*)$/i, "تم إرجاع الفاتورة $1: $2"],
    [/^Created user (.+) with role (.+)$/i, "تم إنشاء المستخدم $1 بدور $2"],
    [/^Updated store settings$/i, "تم تحديث إعدادات المتجر"],
    // English reason leftovers inside descriptions
    [/\bPurchase\b/g, "شراء"],
    [/\bDamaged\b/g, "تالف"],
    [/\bLost\b/g, "مفقود"],
    [/\bManual\b/g, "يدوي"],
    [/\bCorrection\b/g, "تصحيح"],
    [/\bReturn\b/g, "إرجاع"],
    [/\bInvoice\b/g, "فاتورة"],
    [/\bAdmin\b/g, "مسؤول"],
    [/\bCashier\b/g, "كاشير"],
  ];

  for (const [pattern, replacement] of replacements) {
    text = text.replace(pattern, replacement);
  }

  return text;
};

/**
 * Migrates legacy English activity logs to Arabic (idempotent).
 */
export const migrateActivityLogsToArabic = async () => {
  try {
    const logs = await ActivityLog.find({
      $or: [
        { action: { $in: Object.keys(ACTION_MAP) } },
        { entity: { $in: Object.keys(ENTITY_MAP) } },
        { description: { $regex: /^(Created|Updated|Deleted|Restored|Deactivated|Adjusted|Returned)/i } },
      ],
    });

    let updated = 0;
    for (const log of logs) {
      const nextAction = ACTION_MAP[log.action] || log.action;
      const nextEntity = ENTITY_MAP[log.entity] || log.entity;
      const nextDescription = translateDescription(log.description);

      if (
        nextAction !== log.action ||
        nextEntity !== log.entity ||
        nextDescription !== log.description
      ) {
        log.action = nextAction;
        log.entity = nextEntity;
        log.description = nextDescription;
        await log.save();
        updated += 1;
      }
    }

    if (updated > 0) {
      console.log(`تم ترحيل ${updated} سجل نشاط إلى العربية`);
    } else {
      console.log("سجلات الأنشطة بالعربية بالفعل");
    }
  } catch (error) {
    console.error("خطأ أثناء ترحيل سجلات الأنشطة:", error.message);
  }
};
